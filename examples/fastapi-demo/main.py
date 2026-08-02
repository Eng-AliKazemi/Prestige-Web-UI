"""Prestige UI + FastAPI State Engine Demo

A full-stack example integrating Prestige UI's prestige-store.js with
Python FastAPI and Jinja2 templates. Demonstrates:

- Server-side rendering (Jinja2) with reactive client-side stores
- SWR API caching (stale-while-revalidate)
- URL query deep-linking (?windows=...)
- Two-way data binding with backend POST persistance
- Session auth (login / logout) with CSRF protection and rate limiting

Routes:
  GET  /                Jinja2-rendered desktop shell (sign-in card for guests)
  POST /api/v1/login    Authenticate with the demo credential, establish session
  POST /api/v1/logout   End the session and rotate the CSRF token
  GET  /api/v1/stats    Simulated server stats (600ms latency, session + rate limited)
  POST /api/v1/user     Update user profile in SQLite (session + CSRF protected)

Run: PRESTIGE_SESSION_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))") \
     uvicorn main:app --reload

Required environment variables:
  PRESTIGE_SESSION_SECRET   Session-signing key. REQUIRED — the app refuses to
                            start without it (a fixed fallback key would let an
                            attacker forge sessions).

Optional environment variables:
  PRESTIGE_ENV              "production" hardens defaults: PRESTIGE_DEMO_PASSWORD
                            becomes required and warnings are suppressed.
  PRESTIGE_DEMO_USERNAME    Demo login username (default: "demo").
  PRESTIGE_DEMO_PASSWORD    Demo login password (default: "demo-password" in
                            development; required when PRESTIGE_ENV=production).
  PRESTIGE_HTTPS            "true" when served behind TLS: session cookies get
                            the Secure flag and HSTS is sent (default: "false").
  PRESTIGE_TRUSTED_PROXIES  Comma-separated IPs of reverse proxies. X-Forwarded-For
                            is only trusted when the direct peer is listed here.
  PRESTIGE_ALLOWED_HOSTS    Comma-separated host allowlist (default: localhost,
                            127.0.0.1,testserver).
  PRESTIGE_DB_PATH          SQLite database path (default: ./prestige-demo.sqlite3)
"""

import asyncio
import json
import os
import random
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
if not (ROOT / "static" / "manifest.json").exists():
    raise RuntimeError("Run `python3 scripts/build.py` from the repository root before starting this example.")
ASSET_MANIFEST = json.loads((ROOT / "static" / "manifest.json").read_text("utf-8"))
FINGERPRINTED_ASSET_PATHS = frozenset(f"/static/{asset['file']}" for asset in ASSET_MANIFEST.values())

ENV_PRODUCTION = os.environ.get("PRESTIGE_ENV") == "production"
HTTPS_ONLY = os.environ.get("PRESTIGE_HTTPS", "false").lower() == "true"

SESSION_SECRET = os.environ.get("PRESTIGE_SESSION_SECRET")
if not SESSION_SECRET:
    raise RuntimeError(
        "PRESTIGE_SESSION_SECRET is required to start this example. "
        "Generate one with: python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )

DEMO_USERNAME = os.environ.get("PRESTIGE_DEMO_USERNAME", "demo")
DEMO_PASSWORD = os.environ.get("PRESTIGE_DEMO_PASSWORD")
if ENV_PRODUCTION and not DEMO_PASSWORD:
    raise RuntimeError("PRESTIGE_DEMO_PASSWORD is required when PRESTIGE_ENV=production.")
DEMO_PASSWORD = DEMO_PASSWORD or "demo-password"
DEMO_CREDENTIAL_IS_DEFAULT = not os.environ.get("PRESTIGE_DEMO_PASSWORD")

if not HTTPS_ONLY:
    print("WARNING: PRESTIGE_HTTPS is not enabled. Session cookies may be sent over plain HTTP; enable TLS and set PRESTIGE_HTTPS=true in production.")

app = FastAPI(title="Prestige UI + FastAPI State Engine Demo")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=os.environ.get("PRESTIGE_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(","))
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, https_only=HTTPS_ONLY, same_site="lax")

app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")

_jinja_env = Environment(
    loader=FileSystemLoader(str(ROOT / "templates")),
    auto_reload=False,
    enable_async=False,
    autoescape=select_autoescape(["html", "xml"]),
)

DB_PATH = Path(os.environ.get("PRESTIGE_DB_PATH", str(ROOT / "prestige-demo.sqlite3")))
RATE_BUCKETS = defaultdict(deque)
RATE_LIMIT = 60
RATE_WINDOW = 60.0
RATE_BUCKET_MAX_IPS = 10000
TRUSTED_PROXIES = {proxy.strip() for proxy in os.environ.get("PRESTIGE_TRUSTED_PROXIES", "").split(",") if proxy.strip()}


def db_connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


with db_connect() as connection:
    connection.executescript("""
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL, theme TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL);
    """)
    connection.execute("INSERT OR IGNORE INTO users (id, username, role, theme) VALUES (101, ?, ?, ?)", ("Sarah Johnson", "System Architect", "dark"))


def load_user(user_id=101):
    with db_connect() as connection:
        row = connection.execute("SELECT id, username, role, theme FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Authentication required")
    return dict(row)


def _client_ip(request):
    """Client IP for rate limiting.

    X-Forwarded-For is only trusted when the direct peer is a configured
    reverse proxy (PRESTIGE_TRUSTED_PROXIES); otherwise any client could
    spoof a fresh address per request and defeat the rate limit.
    """
    if request.client and request.client.host in TRUSTED_PROXIES:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


def allow_request(request):
    now = time.monotonic()
    ip = _client_ip(request)
    # Evict stale entries when the cache exceeds the limit
    if len(RATE_BUCKETS) >= RATE_BUCKET_MAX_IPS:
        stale_cutoff = now - RATE_WINDOW * 2
        stale_keys = [k for k, v in RATE_BUCKETS.items() if not v or v[-1] < stale_cutoff]
        for k in stale_keys:
            del RATE_BUCKETS[k]
    bucket = RATE_BUCKETS[ip]
    while bucket and now - bucket[0] > RATE_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    bucket.append(now)


def require_user(request):
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return load_user(user_id)


def require_csrf(request):
    """Reject the request unless the X-CSRF-Token header matches the session token."""
    supplied = request.headers.get("X-CSRF-Token", "")
    expected = request.session.get("csrf_token", "")
    if not expected or not secrets.compare_digest(supplied, expected):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")


def audit(user_id, action):
    with db_connect() as connection:
        connection.execute("INSERT INTO audit_log (user_id, action, created_at) VALUES (?, ?, ?)", (user_id, action, datetime.now().isoformat(timespec="seconds")))
        connection.commit()


class LoginSchema(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=128)


class UserUpdateSchema(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    role: str = Field(min_length=1, max_length=80)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Add baseline browser security headers and a per-response CSP nonce."""
    request.state.csp_nonce = secrets.token_urlsafe(18)
    response = await call_next(request)
    nonce = request.state.csp_nonce
    content_security_policy = (
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; "
        "form-action 'self'; script-src 'self' 'nonce-" + nonce + "'; style-src 'self' 'nonce-" + nonce + "'; "
        "img-src 'self' data:; connect-src 'self'; font-src 'self'"
    )
    if HTTPS_ONLY:
        content_security_policy += "; upgrade-insecure-requests"
    response.headers["Content-Security-Policy"] = content_security_policy
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if HTTPS_ONLY:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path in FINGERPRINTED_ASSET_PATHS:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
    else:
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/", response_class=HTMLResponse)
async def render_desktop(request: Request):
    """Render ``templates/index.html`` with server time, user JSON, and user theme context.

    Guests get the shell with a sign-in card; authenticated users get their
    profile data. Context: ``server_time``, ``initial_user`` (dict or None),
    ``user_theme``, ``authenticated``, ``csrf_token``, ``demo_credential_is_default``,
    ``csp_nonce``, ``assets``.
    """
    tmpl = _jinja_env.get_template("index.html")
    csrf_token = request.session.setdefault("csrf_token", secrets.token_urlsafe(32))
    user = None
    user_id = request.session.get("user_id")
    if user_id:
        try:
            user = load_user(user_id)
        except HTTPException:
            # Stale session (e.g. user record removed) — drop it, show the sign-in card.
            request.session.clear()
            request.session["csrf_token"] = secrets.token_urlsafe(32)
    html = tmpl.render(
        server_time=datetime.now().strftime("%H:%M:%S"),
        initial_user=user,
        user_theme=user["theme"] if user else "dark",
        authenticated=user is not None,
        csrf_token=request.session["csrf_token"],
        demo_credential_is_default=DEMO_CREDENTIAL_IS_DEFAULT,
        csp_nonce=request.state.csp_nonce,
        assets=ASSET_MANIFEST,
    )
    return HTMLResponse(html)


@app.post("/api/v1/login")
async def login(data: LoginSchema, request: Request):
    """Authenticate against the demo credential and establish a session.

    Validates the CSRF token, verifies the credential with a constant-time
    comparison, then rotates the CSRF token so a stolen pre-login cookie is
    useless. Rate-limited per client.
    """
    allow_request(request)
    require_csrf(request)
    if data.username != DEMO_USERNAME or not secrets.compare_digest(data.password, DEMO_PASSWORD):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    request.session["user_id"] = 101
    request.session["csrf_token"] = secrets.token_urlsafe(32)
    audit(101, "auth.login")
    return {"status": "ok", "user": load_user(101)}


@app.post("/api/v1/logout")
async def logout(request: Request):
    """End the session after CSRF validation and drop its authentication state."""
    require_csrf(request)
    user_id = request.session.get("user_id")
    if user_id:
        audit(user_id, "auth.logout")
    request.session.clear()
    return {"status": "ok"}


@app.get("/api/v1/stats")
async def get_server_stats(request: Request):
    """Simulates an API endpoint for SWR caching test with 600ms latency (session + rate limited)."""
    require_user(request)
    allow_request(request)
    await asyncio.sleep(0.6)
    return {
        "active_users": random.randint(300, 950),
        "cpu_load": f"{round(random.uniform(10.5, 89.2), 1)}%",
        "memory_usage": f"{round(random.uniform(4.0, 15.8), 2)} GB",
        "fetched_at": datetime.now().strftime("%H:%M:%S"),
    }


@app.post("/api/v1/user")
async def update_user(data: UserUpdateSchema, request: Request):
    """Persist a CSRF-protected, length-validated profile update for the session user."""
    user = require_user(request)
    allow_request(request)
    require_csrf(request)
    with db_connect() as connection:
        connection.execute("UPDATE users SET username = ?, role = ? WHERE id = ?", (data.username, data.role, user["id"]))
        connection.execute("INSERT INTO audit_log (user_id, action, created_at) VALUES (?, ?, ?)", (user["id"], "profile.update", datetime.now().isoformat(timespec="seconds")))
        connection.commit()
    return {"status": "success", "user": load_user(user["id"])}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
