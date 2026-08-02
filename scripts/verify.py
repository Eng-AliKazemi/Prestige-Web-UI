"""Release checks for the dependency-free Prestige distribution."""
import base64
import hashlib
import json
import os
import pathlib
import shutil
import tempfile
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
STATIC = ROOT / "examples" / "fastapi-demo" / "static"
DOCS_DIST = ROOT / "docs" / "dist"
DOCS_DEMO = ROOT / "docs" / "demo"


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    subprocess.run([sys.executable, "scripts/build.py"], cwd=ROOT, check=True)
    # UMD is CommonJS: syntax-checkable directly on any Node.
    subprocess.run(["node", "--check", "dist/prestige.umd.cjs"], cwd=ROOT, check=True)
    # ESM: `node --check` only auto-detects ESM on Node >= 20.19, so check the
    # bundle through a temporary .mjs copy (works on older Node too).
    with tempfile.TemporaryDirectory(prefix="prestige-esm-check-") as tmp_dir:
        esm_tmp = pathlib.Path(tmp_dir) / "prestige.mjs"
        shutil.copyfile(DIST / "prestige.js", esm_tmp)
        subprocess.run(["node", "--check", str(esm_tmp)], cwd=ROOT, check=True)
    with tempfile.TemporaryDirectory(prefix="prestige-fastapi-") as db_dir:
        env = dict(os.environ, PRESTIGE_DB_PATH=str(pathlib.Path(db_dir) / "demo.sqlite3"), PRESTIGE_SESSION_SECRET="verification-secret", PRESTIGE_ALLOWED_HOSTS="testserver", PYTHONPATH=str(ROOT / "examples" / "fastapi-demo"))
        api_check = """
import main
paths = {route.path for route in main.app.routes}
assert {'/', '/api/v1/stats', '/api/v1/user'}.issubset(paths)
assert main.DB_PATH.parent.exists()
"""
        subprocess.run([sys.executable, "-c", api_check], cwd=ROOT / "examples" / "fastapi-demo", env=env, check=True)
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    require(chrome is not None, "a Chromium browser is required for browser regression checks")
    handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        try:
            browser_output = subprocess.check_output([
                chrome, "--headless=new", "--virtual-time-budget=1000", "--dump-dom",
                f"http://127.0.0.1:{server.server_port}/tests/browser-smoke.html",
            ], text=True, stderr=subprocess.DEVNULL)
        finally:
            server.shutdown()
            server_thread.join()
    require(">PASS<" in browser_output, "browser smoke test failed")
    manifest = json.loads((DIST / "manifest.json").read_text("utf-8"))
    deployments = {
        "dist": DIST,
        "FastAPI": STATIC,
        "docs/dist": DOCS_DIST,
        "docs/demo": DOCS_DEMO,
    }
    for deployment_name, directory in deployments.items():
        deployed_manifest = json.loads((directory / "manifest.json").read_text("utf-8"))
        require(deployed_manifest == manifest, f"{deployment_name} manifest is stale")
        for logical_name, metadata in deployed_manifest.items():
            payload = (directory / metadata["file"]).read_bytes()
            integrity = "sha384-" + base64.b64encode(hashlib.sha384(payload).digest()).decode("ascii")
            require(
                metadata["integrity"] == integrity,
                f"incorrect integrity for {deployment_name} target {logical_name}",
            )
            require(
                payload == (DIST / manifest[logical_name]["file"]).read_bytes(),
                f"{deployment_name} asset is stale: {logical_name}",
            )
    declarations = list(DIST.rglob("*.d.ts"))
    require(declarations, "distribution declarations are missing")
    for directory in (DOCS_DIST, DOCS_DEMO):
        for declaration in declarations:
            relative = declaration.relative_to(DIST)
            require(
                (directory / relative).read_bytes() == declaration.read_bytes(),
                f"declaration is missing or stale in {directory.relative_to(ROOT)}: {relative}",
            )
    require((STATIC / "prestige.js").read_bytes() == (DIST / "prestige.js").read_bytes(), "FastAPI stable JavaScript is stale")
    require((STATIC / "prestige.css").read_bytes() == (DIST / "prestige.css").read_bytes(), "FastAPI stable CSS is stale")
    for deployment_name, directory in deployments.items():
        require(
            (directory / "prestige.umd.js").read_bytes() == (DIST / "prestige.umd.cjs").read_bytes(),
            f"{deployment_name} browser UMD alias is stale",
        )
    source = (ROOT / "typescript" / "src" / "core" / "WindowManager.ts").read_text("utf-8")
    require("onclick=" not in source, "CSP blocker: inline onclick remains in the default window")
    utils = (ROOT / "typescript" / "src" / "utils" / "sanitize.ts").read_text("utf-8")
    require("export function sanitizeHtml" in utils and "startsWith('on')" in utils, "trusted HTML must pass through the built-in sanitizer")
    store = (ROOT / "typescript" / "src" / "core" / "Store.ts").read_text("utf-8")
    require("refuses to persist" in store, "store must reject sensitive localStorage persistence keys")
    dialogs = (ROOT / "typescript" / "src" / "ui" / "Dialogs.ts").read_text("utf-8")
    require("role: 'dialog'" in dialogs and "aria-modal': 'true'" in dialogs, "dialogs must expose accessible modal semantics")
    template = (ROOT / "examples" / "fastapi-demo" / "templates" / "index.html").read_text("utf-8")
    require("initial_user | tojson" in template and "X-CSRF-Token" in template, "FastAPI template lacks safe JSON or CSRF handling")
    print("Prestige release checks passed")


if __name__ == "__main__":
    main()
