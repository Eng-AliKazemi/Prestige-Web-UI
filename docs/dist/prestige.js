var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const BLOCKED_TAGS = /^(script|style|iframe|object|embed|link|meta|base|form|textarea|input|button|animate|animateMotion|animateTransform|discard|foreignObject|use|image|feImage|set)$/i;
const URL_ATTRIBUTES = /(?:^|:)(href|src|action|formaction|poster|cite)$/i;
const SAFE_URL_START = /^(https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i;
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
function sanitizeHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  const elements = [];
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node instanceof Element) elements.push(node);
  }
  for (const el of elements) {
    if (!template.content.contains(el)) continue;
    if (BLOCKED_TAGS.test(el.tagName)) {
      el.remove();
      continue;
    }
    for (let i = el.attributes.length - 1; i >= 0; i--) {
      const attr = el.attributes.item(i);
      if (!attr) continue;
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "srcdoc" || name === "nonce") {
        el.removeAttribute(attr.name);
        continue;
      }
      if (URL_ATTRIBUTES.test(name)) {
        const value = attr.value.trim();
        if (!SAFE_URL_START.test(value)) el.removeAttribute(attr.name);
      }
    }
  }
  return template.content;
}
function sanitizeWith(dirty, sanitizer) {
  if (sanitizer) {
    const result = sanitizer(String(dirty));
    if (result instanceof DocumentFragment) return result;
    if (typeof result === "object" && result !== null) {
      const node = result;
      if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) return result;
    }
    const template = document.createElement("template");
    template.innerHTML = String(result);
    return template.content;
  }
  return sanitizeHtml(dirty);
}
function isSafeAppId(value) {
  return /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
}
function isSafeUrl(value) {
  return SAFE_URL_START.test(String(value).trim());
}
function isSafeIframeSrc(value) {
  if (!value) return true;
  const src = String(value).trim();
  if (src === "about:blank") return true;
  if (/^https?:/i.test(src)) return true;
  return /^(\/|\.\/|\.\.\/)/.test(src);
}
function assertSafeAppId(id) {
  if (!isSafeAppId(id)) {
    throw new Error("Prestige app IDs must match /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.");
  }
  return id;
}
function $id(id) {
  return document.getElementById(id);
}
function $text(str) {
  return document.createTextNode(str);
}
const URL_ATTRIBUTE = /(?:^|:)(href|src|action|formaction|poster|cite)$/i;
function isSafeRelativeUrl(value) {
  const normalizedValue = value.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return !/^[a-z][a-z0-9+.-]*:/i.test(normalizedValue);
}
function setSafeAttribute(element, name, value) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.startsWith("on") || normalizedName === "srcdoc") return;
  if (value === true) {
    element.setAttribute(name, "");
    return;
  }
  const stringValue = String(value);
  if (URL_ATTRIBUTE.test(normalizedName)) {
    const acceptedByPolicy = normalizedName === "src" && element.tagName === "IFRAME" ? isSafeIframeSrc(stringValue) : isSafeUrl(stringValue);
    if (!acceptedByPolicy && !isSafeRelativeUrl(stringValue)) return;
  }
  element.setAttribute(name, stringValue);
}
function $tag(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === void 0 || value === false) continue;
      if (key === "class" && typeof value === "string") {
        el.className = value;
      } else if (key === "style" && typeof value === "object" && value !== null) {
        Object.assign(el.style, value);
      } else if (key.toLowerCase().startsWith("on")) {
        if (typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
      } else {
        setSafeAttribute(el, key, value);
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (child == null) continue;
      if (child instanceof Node) el.appendChild(child);
      else el.appendChild($text(String(child)));
    }
  }
  return el;
}
function replaceContent(parent, content, trustedHtml, sanitizer) {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
  if (content == null) return;
  if (content instanceof Node) {
    parent.appendChild(content);
    return;
  }
  if (trustedHtml === true) {
    parent.appendChild(sanitizeWith(String(content), sanitizer));
    return;
  }
  parent.appendChild($text(String(content)));
}
function isolatedPostTargetOrigin(sandboxValue, src, baseUrl) {
  const tokens = sandboxValue.split(/\s+/).filter(Boolean);
  if (!tokens.includes("allow-same-origin")) return "*";
  if (src && /^https?:/i.test(src)) {
    try {
      return new URL(src, baseUrl).origin;
    } catch {
    }
  }
  return new URL(baseUrl).origin;
}
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
function isFocusable(el) {
  if (el.hasAttribute("disabled")) return false;
  const tabindex = el.getAttribute("tabindex");
  if (tabindex !== null && Number(tabindex) < 0) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  return true;
}
function focusablesWithin(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isFocusable);
}
function trapFocusWithin(root, event) {
  if (event.key !== "Tab") return;
  const focusables = focusablesWithin(root);
  if (focusables.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }
  const currentIndex = focusables.indexOf(document.activeElement);
  if (event.shiftKey) {
    event.preventDefault();
    focusables[currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1].focus();
  } else {
    event.preventDefault();
    focusables[currentIndex < 0 || currentIndex === focusables.length - 1 ? 0 : currentIndex + 1].focus();
  }
}
const ICONS = {
  "activity": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>',
  "ban": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>',
  "chart-no-axes-column": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><line x1="18" x2="18" y1="20" y2="10" /><line x1="12" x2="12" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="14" /></svg>',
  "bell": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></svg>',
  "blocks": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="7" height="7" x="14" y="3" rx="1" /><path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" /></svg>',
  "bot": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>',
  "calendar": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></svg>',
  "circle": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /></svg>',
  "circle-alert": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>',
  "circle-check": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>',
  "circle-help": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>',
  "clock": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>',
  "check": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M20 6 9 17l-5-5" /></svg>',
  "cpu": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="16" height="16" x="4" y="4" rx="2" /><rect width="6" height="6" x="9" y="9" rx="1" /><path d="M15 2v2" /><path d="M15 20v2" /><path d="M2 15h2" /><path d="M2 9h2" /><path d="M20 15h2" /><path d="M20 9h2" /><path d="M9 2v2" /><path d="M9 20v2" /></svg>',
  "database": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5V19A9 3 0 0 0 21 19V5" /><path d="M3 12A9 3 0 0 0 21 12" /></svg>',
  "file-text": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>',
  "folder-open": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" /></svg>',
  "gavel": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8" /><path d="m16 16 6-6" /><path d="m8 8 6-6" /><path d="m9 7 8 8" /><path d="m21 11-8-8" /></svg>',
  "gauge": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>',
  "git-branch": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><line x1="6" x2="6" y1="3" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></svg>',
  "history": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>',
  "info": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>',
  "key": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" /><path d="m21 2-9.6 9.6" /><circle cx="7.5" cy="15.5" r="5.5" /></svg>',
  "layers": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" /></svg>',
  "layout-dashboard": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>',
  "library": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></svg>',
  "list-checks": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></svg>',
  "log-out": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>',
  "message-square": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>',
  "message-square-more": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 10h.01" /><path d="M12 10h.01" /><path d="M16 10h.01" /></svg>',
  "package": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /><path d="M12 22V12" /><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" /><path d="m7.5 4.27 9 5.15" /></svg>',
  "panel-right": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3v18" /></svg>',
  "panels-top-left": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" /></svg>',
  "refresh-cw": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>',
  "route": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></svg>',
  "save": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" /><path d="M7 3v4a1 1 0 0 0 1 1h7" /></svg>',
  "scale": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>',
  "scroll": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M19 17V5a2 2 0 0 0-2-2H4" /><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /></svg>',
  "search": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>',
  "search-check": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m8 11 2 2 4-4" /><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>',
  "settings": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>',
  "shield": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>',
  "shield-alert": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>',
  "sliders-horizontal": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" /><line x1="21" x2="12" y1="12" y2="12" /><line x1="8" x2="3" y1="12" y2="12" /><line x1="21" x2="16" y1="20" y2="20" /><line x1="12" x2="3" y1="20" y2="20" /><line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="16" x2="16" y1="18" y2="22" /></svg>',
  "sticky-note": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M15 3v4a2 2 0 0 0 2 2h4" /></svg>',
  "table-properties": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M15 3v18" /><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M21 9H3" /><path d="M21 15H3" /></svg>',
  "text-cursor-input": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1" /><path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5" /><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" /><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" /><path d="M9 7v10" /></svg>',
  "thumbs-down": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" /></svg>',
  "triangle-alert": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>',
  "upload": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>',
  "user-cog": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="18" cy="15" r="3" /><circle cx="9" cy="7" r="4" /><path d="M10 15H6a4 4 0 0 0-4 4v2" /><path d="m21.7 16.4-.9-.3" /><path d="m15.2 13.9-.9-.3" /><path d="m16.6 18.7.3-.9" /><path d="m19.1 12.2.3-.9" /><path d="m19.6 18.7-.4-1" /><path d="m16.8 12.3-.4-1" /><path d="m14.3 16.6 1-.4" /><path d="m20.7 13.8 1-.4" /></svg>',
  "user-plus": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" /></svg>',
  "user-round": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>',
  "users": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>',
  "wand-sparkles": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></svg>',
  "x": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>',
  "zap": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>',
  "zap-off": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M10.513 4.856 13.12 2.17a.5.5 0 0 1 .86.46l-1.377 4.317" /><path d="M15.656 10H20a1 1 0 0 1 .78 1.63l-1.72 1.773" /><path d="M16.273 16.273 10.88 21.83a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63l4.507-4.643" /><path d="m2 2 20 20" /></svg>',
  "arrow-down": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>',
  "hard-drive": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><line x1="22" x2="2" y1="12" y2="12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /><line x1="6" x2="6.01" y1="16" y2="16" /><line x1="10" x2="10.01" y1="16" y2="16" /></svg>',
  "lock": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>',
  "mail": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>',
  "monitor": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></svg>',
  "thermometer": '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"\n><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /></svg>'
};
const DIALOG_ICON_NAMES = {
  info: "info",
  warning: "triangle-alert",
  danger: "circle-alert",
  success: "circle-check",
  question: "circle-help",
  save: "save",
  open: "folder-open",
  close: "x",
  check: "check"
};
function resolveIconName(name) {
  const key = typeof name === "string" ? name.trim().toLowerCase() : "";
  return Object.hasOwn(ICONS, key) ? key : "circle";
}
function createIcon(name, attrs) {
  const key = resolveIconName(name);
  const source = ICONS[key];
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = parsed.documentElement;
  if (!root) {
    throw new Error(`[LucideIcons] Unable to parse icon source for "${name}".`);
  }
  const node = document.importNode(root, true);
  if (!(node instanceof SVGElement)) {
    throw new Error(`[LucideIcons] Parsed icon source for "${name}" is not an SVG element.`);
  }
  if (attrs) {
    if (attrs.class) node.setAttribute("class", attrs.class);
    if (attrs.title) node.setAttribute("aria-label", attrs.title);
    if (attrs["aria-hidden"] != null) node.setAttribute("aria-hidden", attrs["aria-hidden"]);
    if (attrs.role) node.setAttribute("role", attrs.role);
    if (attrs.style) node.setAttribute("style", attrs.style);
  }
  return node;
}
function renderPlaceholder(placeholder, nameAttr) {
  if (placeholder.getAttribute("data-prestige-rendered") === "true") return;
  const name = placeholder.getAttribute(nameAttr);
  const resolved = resolveIconName(name);
  const attrs = {
    class: placeholder.getAttribute("class") ?? "",
    title: placeholder.getAttribute("title") ?? "",
    role: placeholder.getAttribute("role") ?? "",
    style: placeholder.getAttribute("style") ?? ""
  };
  const ariaHidden = placeholder.getAttribute("aria-hidden");
  if (ariaHidden !== null) attrs["aria-hidden"] = ariaHidden;
  const svg = createIcon(resolved, attrs);
  svg.setAttribute("data-prestige-icon", resolved);
  svg.setAttribute("data-prestige-rendered", "true");
  placeholder.replaceWith(svg);
}
function renderIcons(root) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  scope.querySelectorAll("[data-prestige-icon]").forEach((el) => {
    renderPlaceholder(el, "data-prestige-icon");
  });
  return scope;
}
function dialogIcon(name) {
  const mapped = Object.hasOwn(DIALOG_ICON_NAMES, name) ? DIALOG_ICON_NAMES[name] : void 0;
  return createIcon(mapped || resolveIconName(name));
}
if (typeof Symbol.dispose !== "symbol") {
  Object.defineProperty(Symbol, "dispose", {
    value: Symbol.for("dispose"),
    writable: true,
    configurable: true
  });
}
const DISPOSE_SYMBOL = Symbol.dispose;
class DisposalStack {
  constructor(name = "") {
    __publicField(this, "cleanups", []);
    __publicField(this, "disposed", false);
    __publicField(this, "ownedLeaks", 0);
    this.name = name;
  }
  /** True after this stack has begun disposal. */
  get isDisposed() {
    return this.disposed;
  }
  assertActive() {
    if (this.disposed) {
      throw new Error(`Cannot register a resource on disposed DisposalStack${this.name ? ` "${this.name}"` : ""}.`);
    }
  }
  /** Queue a cleanup callback executed on disposal (LIFO order). */
  defer(fn) {
    this.assertActive();
    if (typeof fn === "function") this.cleanups.push(fn);
  }
  /** Bind an event listener and automatically remove it on disposal. */
  listen(target, type, listener, options) {
    if (!target || typeof target.addEventListener !== "function") return;
    this.assertActive();
    target.addEventListener(type, listener, options);
    this.defer(() => target.removeEventListener(type, listener, options));
  }
  /** Create a timeout and clear it on disposal. */
  setTimeout(fn, delay) {
    this.assertActive();
    const id = window.setTimeout(fn, delay);
    this.defer(() => window.clearTimeout(id));
    return id;
  }
  /** Create an interval and clear it on disposal. */
  setInterval(fn, delay) {
    this.assertActive();
    const id = window.setInterval(fn, delay);
    this.defer(() => window.clearInterval(id));
    return id;
  }
  /** Track a WebSocket and close it safely on disposal. */
  manageSocket(socket) {
    if (!socket) return;
    this.defer(() => {
      if (typeof socket.close === "function" && socket.readyState < WebSocket.CLOSING) {
        try {
          socket.close();
        } catch (_e) {
        }
      }
    });
  }
  /** Register an unsubscribe callback (e.g. a store subscription). */
  subscribe(unsubscribe) {
    if (typeof unsubscribe === "function") this.defer(unsubscribe);
  }
  /**
   * Take ownership of a Disposable. On stack disposal the resource is
   * disposed; Owned-like resources still alive at that point are audited and
   * reported as leaks (use `.move()` to transfer ownership first).
   */
  own(resource) {
    if (!resource) return resource;
    if (this.disposed) {
      const disposer = resource[DISPOSE_SYMBOL];
      if (typeof disposer === "function") disposer.call(resource);
      return resource;
    }
    this.defer(() => {
      const tracked = resource;
      if (typeof tracked.isAlive === "function" && tracked.isAlive()) {
        this.ownedLeaks++;
      }
      const disposer = resource[DISPOSE_SYMBOL];
      if (typeof disposer === "function") disposer.call(resource);
    });
    return resource;
  }
  /**
   * Track a byte buffer holding secrets. On disposal the bytes are zeroed
   * (`ArrayBuffer` is wrapped in a `Uint8Array` view to fill).
   */
  ownSecret(buffer) {
    this.defer(() => {
      if (buffer instanceof ArrayBuffer) {
        new Uint8Array(buffer).fill(0);
      } else if (buffer instanceof Uint8Array) {
        buffer.fill(0);
      }
    });
    return buffer;
  }
  /** Native disposal protocol entry point. */
  [DISPOSE_SYMBOL]() {
    this.dispose();
  }
  /** Execute all queued cleanups in LIFO order. Idempotent. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    while (this.cleanups.length > 0) {
      const cleanup = this.cleanups.pop();
      try {
        cleanup == null ? void 0 : cleanup();
      } catch (e) {
        console.error(`[DisposalStack${this.name ? " " + this.name : ""}]`, e);
      }
    }
    if (this.ownedLeaks > 0) {
      console.warn(`[DisposalStack${this.name ? " " + this.name : ""}] ${this.ownedLeaks} Owned resource(s) were still alive when disposed. Use .move() to transfer ownership before closing.`);
      this.ownedLeaks = 0;
    }
  }
}
class Owned {
  constructor(resource, disposer) {
    __publicField(this, "_value");
    __publicField(this, "_disposer");
    __publicField(this, "_alive", true);
    this._value = resource;
    this._disposer = disposer;
  }
  /** Borrow the inner resource. Throws if already moved or disposed. */
  use(fn) {
    if (!this._alive || this._value === null) {
      throw new Error("Owned resource has already been moved or disposed — use-after-move detected");
    }
    return fn(this._value);
  }
  /** Transfer ownership to a new handle; the current one is invalidated. */
  move() {
    const value = this._value;
    const disposer = this._disposer;
    if (!this._alive || value === null || disposer === null) {
      throw new Error("Owned resource has already been moved — double-move detected");
    }
    this._alive = false;
    this._value = null;
    this._disposer = null;
    return new Owned(value, disposer);
  }
  /** Native disposal protocol entry point. */
  [DISPOSE_SYMBOL]() {
    this.dispose();
  }
  /** Invoke the disposer exactly once and mark the handle as dead. */
  dispose() {
    const value = this._value;
    const disposer = this._disposer;
    if (!this._alive || value === null || disposer === null) return;
    this._alive = false;
    this._value = null;
    this._disposer = null;
    disposer(value);
  }
  /** True while the resource has not been moved or disposed. */
  isAlive() {
    return this._alive;
  }
}
const hasTouch = typeof window !== "undefined" && ("ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0);
function eventPoint(e) {
  if ("touches" in e) {
    const touch = e.touches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }
  return { clientX: e.clientX, clientY: e.clientY };
}
const DEFAULT_WINDOW_SIZES = {
  overview: [780, 540],
  wizard: [780, 580],
  analytics: [900, 620],
  infra: [760, 540],
  keys: [720, 520],
  models: [740, 540],
  widget: [720, 540],
  prompts: [760, 560],
  routing: [740, 540],
  guard: [720, 560],
  memory: [760, 540],
  breakers: [720, 500],
  vector: [740, 540],
  rag: [800, 580],
  upload: [740, 520],
  gdpr: [740, 540],
  observe: [760, 540],
  groups: [720, 540],
  users: [740, 560],
  register: [680, 500],
  logs: [760, 540],
  audit: [740, 520],
  feedback: [760, 540],
  limits: [700, 500],
  config: [800, 560],
  about: [640, 480],
  calendar: [760, 560],
  notes: [720, 540],
  system: [820, 600]
};
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
class WindowManager {
  constructor(_host) {
    __publicField(this, "_openWindows", /* @__PURE__ */ Object.create(null));
    __publicField(this, "_zCounter", 100);
    __publicField(this, "_cascadeIndex", 0);
    __publicField(this, "_snapPreviewEl", null);
    this._host = _host;
  }
  /* ── Geometry ─────────────────────────────────────────────── */
  getSafeBounds() {
    const canvasEl = this._host._query("#desktop-canvas");
    const dockEl = this._host._query(".dock-wrap");
    const canvasTop = canvasEl ? Math.round(canvasEl.getBoundingClientRect().top) : 30;
    let dockTop = dockEl ? Math.round(dockEl.getBoundingClientRect().top) : window.innerHeight - 100;
    const maxSafeDockTop = window.innerHeight - 102;
    if (dockTop > maxSafeDockTop) dockTop = maxSafeDockTop;
    return { top: 2, bottom: dockTop - canvasTop - 2, left: 0, right: window.innerWidth };
  }
  _getMaximizeTarget() {
    const dockEl = this._host._query(".dock-wrap");
    let dockTop = dockEl ? Math.round(dockEl.getBoundingClientRect().top) : window.innerHeight - 100;
    const maxSafeDockTop = window.innerHeight - 102;
    if (dockTop > maxSafeDockTop) dockTop = maxSafeDockTop;
    const canvasEl = this._host._query("#desktop-canvas");
    const canvasTop = canvasEl ? Math.round(canvasEl.getBoundingClientRect().top) : 30;
    const margin = 8;
    return {
      top: 0,
      left: margin,
      width: window.innerWidth - margin * 2,
      height: dockTop - canvasTop,
      halfWidth: (window.innerWidth - margin * 2) / 2
    };
  }
  _calculateDockTransform(win) {
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    const dockBtn = rec && rec.btn ? rec.btn : this._host._query(`.dock-item[data-section="${section}"]`);
    const winRect = win.getBoundingClientRect();
    let targetRect;
    if (dockBtn instanceof HTMLElement && dockBtn.isConnected) {
      targetRect = dockBtn.getBoundingClientRect();
    } else {
      targetRect = { left: window.innerWidth / 2 - 26, top: window.innerHeight - 60, width: 52, height: 52 };
    }
    return {
      dx: targetRect.left + targetRect.width / 2 - (winRect.left + winRect.width / 2),
      dy: targetRect.top + targetRect.height / 2 - (winRect.top + winRect.height / 2),
      sx: targetRect.width / winRect.width,
      sy: targetRect.height / winRect.height
    };
  }
  toggleBounce(section) {
    const rec = this._openWindows[section];
    if (rec && rec.btn) {
      rec.btn.classList.remove("is-bouncing");
      void rec.btn.offsetWidth;
      rec.btn.classList.add("is-bouncing");
      window.setTimeout(() => {
        var _a;
        return (_a = rec.btn) == null ? void 0 : _a.classList.remove("is-bouncing");
      }, 700);
    }
  }
  /* ── Titlebar / content builders (structural DOM only) ────── */
  _defaultControls() {
    return $tag("div", { class: "window-controls" }, [
      $tag("button", { class: "window-btn window-btn-minimize", "data-act": "minimize", title: "Minimize" }),
      $tag("button", { class: "window-btn window-btn-maximize", "data-act": "maximize", title: "Maximize" }),
      $tag("button", { class: "window-btn window-btn-close", "data-act": "close", title: "Close" })
    ]);
  }
  _defaultTitlebar(label, icon) {
    const titlebar = $tag("div", { class: "window-titlebar" });
    const title = $tag("div", { class: "window-title" });
    if (icon) {
      const iconSpan = $tag("span", { class: "window-title-icon" });
      iconSpan.appendChild($tag("i", { "data-prestige-icon": icon }));
      title.appendChild(iconSpan);
    }
    title.appendChild($text(label));
    titlebar.append(title, this._defaultControls());
    return titlebar;
  }
  _buildTitlebar(label, icon) {
    var _a;
    if (this._host.config.renderTitlebar) {
      const rendered = this._host.config.renderTitlebar(label, icon);
      if (rendered instanceof Node) return rendered;
      return sanitizeWith(rendered, (_a = this._host.config.security) == null ? void 0 : _a.sanitizer);
    }
    return this._defaultTitlebar(label, icon);
  }
  _statCard(value, label) {
    return $tag("div", { class: "stat-card" }, [
      $tag("div", { class: "stat-value" }, [$text(value)]),
      $tag("div", { class: "stat-label" }, [$text(label)])
    ]);
  }
  /** Create the built-in window content (structural). */
  createContent(section, label, icon) {
    const appContent = this._appConfig(section);
    if (appContent && appContent.content) {
      return typeof appContent.content === "function" ? appContent.content(section, label ?? section, icon ?? "") : appContent.content;
    }
    const main = $tag("div", { class: "window-content-main" });
    const card = $tag("div", { class: "card" });
    const header = $tag("div", { class: "card-header" }, [$tag("h3", {}, [$text(section === "overview" ? "System Overview" : label ?? section)])]);
    const body = $tag("div", { class: "card-body" });
    const stats = $tag("div", { class: "stats-row" });
    if (section === "overview") {
      stats.append(
        this._statCard("98%", "Uptime"),
        this._statCard("2.4s", "Avg Latency"),
        this._statCard("1.2K", "Req/s")
      );
      body.append(stats, $tag("p", { style: { color: "var(--text-secondary)", lineHeight: "1.7" } }, [$text("System is healthy. All services operational.")]));
    } else {
      stats.append(
        this._statCard(section.charAt(0).toUpperCase(), "Section"),
        this._statCard("✓", "Status"),
        this._statCard("42", "Items")
      );
      const welcome = $tag("p", { style: { color: "var(--text-secondary)", lineHeight: "1.7" } }, [
        $text("Welcome to the "),
        $tag("strong", {}, [$text(label ?? section)]),
        $text(" section.")
      ]);
      const actions = $tag("div", { style: { display: "flex", gap: "12px", marginTop: "16px" } }, [
        $tag("button", { class: "btn btn-primary", type: "button", "data-prestige-action": "info" }, [$text("Action")]),
        $tag("button", { class: "btn btn-ghost", type: "button", "data-prestige-action": "minimize" }, [$text("Minimize")])
      ]);
      body.append(stats, welcome, actions);
    }
    card.append(header, body);
    main.appendChild(card);
    return main;
  }
  /* ── Window creation ──────────────────────────────────────── */
  nextCascadePos() {
    const canvas = this._host._query("#desktop-canvas");
    const cw = canvas ? canvas.clientWidth : window.innerWidth;
    const ch = canvas ? canvas.clientHeight : window.innerHeight;
    const baseX = Math.max(40, Math.floor((cw - 800) / 2));
    const baseY = Math.max(20, Math.floor((ch - 600) / 3));
    const i = this._cascadeIndex % 8;
    return { x: baseX + i * 30, y: baseY + i * 30 };
  }
  createWindow(section, icon, label) {
    var _a;
    if (typeof section !== "string") throw new Error("Prestige app IDs must be strings.");
    assertSafeAppId(section);
    const appConfig = this._appConfig(section);
    const win = $tag("div", { class: "window", "data-section": section });
    win._disposal = new DisposalStack(section);
    const disposal = win._disposal;
    const off = this.nextCascadePos();
    win.style.left = `${off.x}px`;
    win.style.top = `${off.y}px`;
    const defaults = DEFAULT_WINDOW_SIZES[section] ?? [760, 540];
    const size = [(appConfig == null ? void 0 : appConfig.w) ?? defaults[0], (appConfig == null ? void 0 : appConfig.h) ?? defaults[1]];
    win.style.width = `${size[0]}px`;
    win.style.height = `${size[1]}px`;
    const safeLabel = label ?? section;
    win.append(this._buildTitlebar(safeLabel, icon), $tag("div", { class: "window-body" }), $tag("div", { class: "window-resize", "data-act": "resize" }));
    const closeBtn = win.querySelector('[data-act="close"]');
    if (closeBtn) disposal.listen(closeBtn, "click", ((e) => {
      e.stopPropagation();
      this.closeWindow(win);
    }));
    const minimizeBtn = win.querySelector('[data-act="minimize"]');
    if (minimizeBtn) disposal.listen(minimizeBtn, "click", ((e) => {
      e.stopPropagation();
      this.minimizeWindow(win);
    }));
    const maximizeBtn = win.querySelector('[data-act="maximize"]');
    if (maximizeBtn) disposal.listen(maximizeBtn, "click", ((e) => {
      e.stopPropagation();
      this.toggleMaximize(win);
    }));
    const dirs = ["nw", "n", "ne", "e", "s", "sw", "w"];
    const seHandle = win.querySelector(".window-resize");
    if (seHandle) {
      seHandle.classList.add("window-resize-handle", "window-resize-se");
      disposal.listen(seHandle, "mousedown", ((e) => {
        e.stopPropagation();
        this.startResize(win, e, "se");
      }));
      if (hasTouch) disposal.listen(seHandle, "touchstart", ((e) => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        this.startResize(win, e, "se");
      }), { passive: false });
    }
    dirs.forEach((dir) => {
      const handle = $tag("div", { class: `window-resize-handle window-resize-${dir}` });
      win.appendChild(handle);
      disposal.listen(handle, "mousedown", ((e) => {
        e.stopPropagation();
        this.startResize(win, e, dir);
      }));
      if (hasTouch) disposal.listen(handle, "touchstart", ((e) => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        this.startResize(win, e, dir);
      }), { passive: false });
    });
    const titlebarEl = win.querySelector(".window-titlebar");
    if (titlebarEl) {
      disposal.listen(titlebarEl, "mousedown", ((e) => {
        const target = e.target;
        if (target && (target.closest(".window-controls") || target.closest(".window-btn"))) return;
        if (e.detail === 2) {
          this.toggleMaximize(win);
          return;
        }
        this.startDrag(win, e);
      }));
      if (hasTouch) disposal.listen(titlebarEl, "touchstart", ((e) => {
        const target = e.target;
        if (target && (target.closest(".window-controls") || target.closest(".window-btn"))) return;
        if (e.touches.length !== 1) return;
        if (e.cancelable) e.preventDefault();
        this.startDrag(win, e);
      }), { passive: false });
    }
    disposal.listen(win, "mousedown", (() => {
      this.focusWindow(win);
    }));
    const body = win.querySelector(".window-body");
    if (body) {
      if (appConfig && appConfig.tier === "isolated") {
        const frameSrc = appConfig.src && isSafeIframeSrc(appConfig.src) ? appConfig.src : "about:blank";
        const iframe = $tag("iframe", { class: "prestige-app-sandbox", sandbox: "allow-scripts allow-forms", src: frameSrc });
        if (typeof MessageChannel !== "undefined") {
          let channel = null;
          const closeChannel = () => {
            if (!channel) return;
            try {
              channel.port1.close();
            } catch (_e) {
            }
            try {
              channel.port2.close();
            } catch (_e) {
            }
            channel = null;
          };
          disposal.defer(closeChannel);
          disposal.listen(iframe, "load", (() => {
            var _a2, _b;
            closeChannel();
            channel = new MessageChannel();
            try {
              const resolver = ((_a2 = this._host.config.security) == null ? void 0 : _a2.postTargetOrigin) ?? isolatedPostTargetOrigin;
              const targetOrigin = resolver(iframe.sandbox.value, frameSrc, window.location.href);
              (_b = iframe.contentWindow) == null ? void 0 : _b.postMessage({ type: "PRESTIGE_INIT", section }, targetOrigin, [channel.port2]);
            } catch (_e) {
              closeChannel();
            }
          }));
        }
        body.appendChild(iframe);
      } else {
        const content = this.createContent(section, safeLabel, icon);
        if (content instanceof HTMLElement && content.classList.contains("window-content-main")) {
          body.appendChild(content);
        } else {
          const main = $tag("div", { class: "window-content-main" });
          if (content instanceof Node) main.appendChild(content);
          else replaceContent(main, content, !appConfig || appConfig.trustedHtml === true, (_a = this._host.config.security) == null ? void 0 : _a.sanitizer);
          body.appendChild(main);
        }
      }
      body.querySelectorAll("[data-prestige-action]").forEach((button) => {
        const action = button.getAttribute("data-prestige-action");
        if (action === "info") {
          disposal.listen(button, "click", (() => {
            void this._host.dialogInfo(`${safeLabel} action executed.`);
          }));
        }
        if (action === "minimize") {
          disposal.listen(button, "click", (() => {
            this.minimizeWindow(win);
          }));
        }
      });
    }
    disposal.setTimeout(() => renderIcons(this._host.config.container ?? document), 10);
    return win;
  }
  /* ── Open / close ─────────────────────────────────────────── */
  openWindow(section, icon, label, dockBtn, options = {}) {
    var _a;
    if (typeof section !== "string") throw new Error("Prestige app IDs must be strings.");
    assertSafeAppId(section);
    const existing = this._openWindows[section];
    if (existing && existing.el && existing.el.isConnected) {
      if (existing.el.classList.contains("is-closing")) {
        this.removeWindowRecord(existing, true);
      } else if (existing.minimized) {
        this.restoreWindow(existing.el);
        this.focusWindow(existing.el);
        return existing.el;
      } else if (existing.el.classList.contains("is-focused")) {
        this.minimizeWindow(existing.el);
        return existing.el;
      } else {
        this.focusWindow(existing.el);
        return existing.el;
      }
    }
    const win = this.createWindow(section, icon, label);
    const canvas = this._host._query("#desktop-canvas");
    if (canvas) canvas.appendChild(win);
    const record = { el: win, minimized: false, zoomed: false, transitionVersion: 0 };
    if (icon !== void 0) record.icon = icon;
    if (label !== void 0) record.label = label;
    if (dockBtn !== void 0) record.btn = dockBtn;
    this._openWindows[section] = record;
    if (dockBtn) dockBtn.classList.add("is-open");
    const appConfig = this._appConfig(section);
    const shouldAnimate = options.animate ?? this._host.animationsEnabled;
    const shouldFocus = options.focus ?? true;
    const applyManifestMaximized = options.applyManifestMaximized ?? true;
    if (shouldAnimate) {
      const version = ++record.transitionVersion;
      win.style.animation = "none";
      const tf = this._calculateDockTransform(win);
      win.style.setProperty("--tx", `${tf.dx}px`);
      win.style.setProperty("--ty", `${tf.dy}px`);
      win.style.setProperty("--sx", String(tf.sx));
      win.style.setProperty("--sy", String(tf.sy));
      win.classList.add("is-minimized");
      requestAnimationFrame(() => {
        if (!this._isCurrent(section, record) || record.transitionVersion !== version) return;
        win.classList.add("is-animating-restore");
        requestAnimationFrame(() => {
          if (!this._isCurrent(section, record) || record.transitionVersion !== version) return;
          win.classList.remove("is-minimized");
          if (shouldFocus) this.focusWindow(win);
          if (applyManifestMaximized && (appConfig == null ? void 0 : appConfig.maximized)) this.toggleMaximize(win);
        });
      });
      (_a = win._disposal) == null ? void 0 : _a.setTimeout(() => {
        if (this._isCurrent(section, record) && !record.minimized) win.classList.remove("is-animating-restore");
      }, 400);
    } else {
      if (shouldFocus) this.focusWindow(win);
      if (applyManifestMaximized && (appConfig == null ? void 0 : appConfig.maximized)) this.toggleMaximize(win, options.save ?? true);
    }
    this._host._emit("window:open", { section, win, icon, label });
    this._cascadeIndex += 1;
    if (options.save ?? true) this._host._saveSession();
    return win;
  }
  closeWindow(win) {
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    if (!rec || rec.el !== win) {
      this._disposeWindow(win);
      win.remove();
      return;
    }
    this._disposeWindow(win);
    rec.transitionVersion += 1;
    win.classList.remove("is-snapped");
    if (this._host.animationsEnabled) {
      win.classList.add("is-closing");
      window.setTimeout(() => {
        this.removeWindowRecord(rec);
      }, 180);
    } else {
      this.removeWindowRecord(rec);
    }
  }
  ownResource(win, resource, disposer) {
    const owned = new Owned(resource, disposer);
    if (win && win._disposal && !win._disposal.isDisposed) win._disposal.own(owned);
    else owned.dispose();
    return owned;
  }
  ownSocket(win, url, protocols) {
    const ws = new WebSocket(url, protocols);
    return this.ownResource(win, ws, (socket) => {
      if (socket.readyState < WebSocket.CLOSING) {
        try {
          socket.close();
        } catch (_e) {
        }
      }
    });
  }
  /* ── Minimize / restore / maximize / focus ────────────────── */
  minimizeWindow(win) {
    var _a;
    if (!win) return;
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    if (!rec || rec.el !== win || rec.minimized) return;
    rec.minimized = true;
    const version = ++rec.transitionVersion;
    win.classList.remove("is-snapped", "is-animating-restore");
    if (this._host.animationsEnabled) {
      const tf = this._calculateDockTransform(win);
      win.style.setProperty("--tx", `${tf.dx}px`);
      win.style.setProperty("--ty", `${tf.dy}px`);
      win.style.setProperty("--sx", String(tf.sx));
      win.style.setProperty("--sy", String(tf.sy));
      win.classList.add("is-animating-minimize");
      requestAnimationFrame(() => {
        if (this._isCurrent(section, rec) && rec.transitionVersion === version && rec.minimized) win.classList.add("is-minimized");
      });
      (_a = win._disposal) == null ? void 0 : _a.setTimeout(() => {
        if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || !rec.minimized) return;
        win.classList.add("is-gone");
        win.classList.remove("is-animating-minimize");
        if (rec.btn) {
          rec.btn.classList.add("has-minimized");
          this.toggleBounce(section);
        }
      }, 400);
    } else {
      win.classList.add("is-minimized", "is-gone");
      if (rec && rec.btn) rec.btn.classList.add("has-minimized");
    }
    this._host._emit("window:minimize", { win });
    this._host._saveSession();
    const visible = this._getSwitcherWindows().filter((w) => w !== win);
    if (visible.length > 0) this.focusWindow(visible[visible.length - 1]);
  }
  restoreWindow(win) {
    var _a, _b;
    if (!win) return;
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    if (!rec || rec.el !== win) return;
    rec.minimized = false;
    const version = ++rec.transitionVersion;
    win.classList.remove("is-animating-minimize");
    if (this._host.animationsEnabled) {
      const firstRect = win.getBoundingClientRect();
      win.classList.remove("is-minimized", "is-gone");
      const lastRect = win.getBoundingClientRect();
      const dx = firstRect.left - lastRect.left;
      const dy = firstRect.top - lastRect.top;
      const sx = firstRect.width / lastRect.width;
      const sy = firstRect.height / lastRect.height;
      win.classList.add("is-animating-restore");
      win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      win.style.opacity = "0";
      win.style.borderRadius = "40px";
      win.style.filter = "brightness(1.25) blur(1px)";
      void win.offsetWidth;
      win.style.transform = "";
      win.style.opacity = "";
      win.style.borderRadius = "";
      win.style.filter = "";
      (_a = win._disposal) == null ? void 0 : _a.setTimeout(() => {
        if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || rec.minimized) return;
        win.classList.remove("is-animating-restore");
        if (rec.btn) rec.btn.classList.remove("has-minimized");
      }, 400);
    } else {
      win.classList.remove("is-minimized", "is-gone");
      (_b = rec.btn) == null ? void 0 : _b.classList.remove("has-minimized");
    }
    this.focusWindow(win);
    this._host._emit("window:restore", { win });
    this._host._saveSession();
  }
  toggleMaximize(win, save = true) {
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    if (!rec || rec.el !== win) return;
    const version = ++rec.transitionVersion;
    if (rec.zoomed) {
      rec.zoomed = false;
      this._host._emit("window:restore-maximize", { win });
      const firstRect = win.getBoundingClientRect();
      win.classList.remove("is-snapped");
      win.style.left = win.dataset.rL ?? "";
      win.style.top = win.dataset.rT ?? "";
      win.style.width = win.dataset.rW ?? "";
      win.style.height = win.dataset.rH ?? "";
      const lastRect = win.getBoundingClientRect();
      const dx = firstRect.left - lastRect.left;
      const dy = firstRect.top - lastRect.top;
      const sx = firstRect.width / lastRect.width;
      const sy = firstRect.height / lastRect.height;
      win.classList.add("is-animating-maximize");
      win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      requestAnimationFrame(() => {
        if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || rec.zoomed) return;
        win.classList.remove("is-zoomed");
        win.style.transform = "";
        win.classList.remove("is-animating-maximize");
      });
      if (save) this._host._saveSession();
    } else {
      rec.zoomed = true;
      win.classList.remove("is-snapped");
      win.dataset.rL = win.style.left;
      win.dataset.rT = win.style.top;
      win.dataset.rW = win.style.width;
      win.dataset.rH = win.style.height;
      const firstRect = win.getBoundingClientRect();
      const t = this._getMaximizeTarget();
      win.style.left = `${t.left}px`;
      win.style.top = `${t.top}px`;
      win.style.width = `${t.width}px`;
      win.style.height = `${t.height}px`;
      const lastRect = win.getBoundingClientRect();
      const dx = firstRect.left - lastRect.left;
      const dy = firstRect.top - lastRect.top;
      const sx = firstRect.width / lastRect.width;
      const sy = firstRect.height / lastRect.height;
      win.classList.add("is-animating-maximize", "is-zoomed");
      win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      this._host._emit("window:maximize", { win });
      requestAnimationFrame(() => {
        if (!this._isCurrent(section, rec) || rec.transitionVersion !== version || !rec.zoomed) return;
        win.style.transform = "";
        win.classList.remove("is-animating-maximize");
      });
      if (save) this._host._saveSession();
    }
  }
  focusWindow(win) {
    if (!win) return;
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    if (!rec || rec.el !== win || rec.minimized) return;
    this._host._queryAll(".window.is-focused").forEach((w) => w.classList.remove("is-focused"));
    win.classList.add("is-focused");
    this._zCounter += 1;
    win.style.zIndex = String(this._zCounter);
    const titleEl = this._host._query("#active-window-title");
    if (titleEl) {
      titleEl.textContent = rec.label ?? section;
    }
    this._host._emit("window:focus", { win, section });
  }
  /* ── Drag & gestures ──────────────────────────────────────── */
  startDrag(win, e) {
    const record = this._recordFor(win);
    if (record == null ? void 0 : record.zoomed) return;
    if (e.cancelable) e.preventDefault();
    const start = eventPoint(e);
    if (!start) return;
    win.classList.remove("is-snapped");
    const startX = start.clientX;
    const startY = start.clientY;
    const startL = parseInt(win.style.left, 10) || 0;
    const startT = parseInt(win.style.top, 10) || 0;
    win.classList.add("is-dragging");
    this._host._emit("window:dragstart", { win });
    const enableShake = this._host.config.shakeToMinimize ?? true;
    const enableFlick = this._host.config.flickToMinimize ?? true;
    const enableSnap = this._host.config.snap ?? true;
    let shakeData = enableShake ? { positions: [], crossCount: 0, prevVelX: 0, prevVelY: 0, lastCrossTime: 0 } : null;
    let activeSnapZone = null;
    let lastY = start.clientY;
    let lastTime = performance.now();
    let velocityY = 0;
    const onMove = (ev) => {
      const point = eventPoint(ev);
      if (!point) return;
      if (ev.cancelable) ev.preventDefault();
      const now = performance.now();
      const dt = now - lastTime;
      if (dt > 0 && enableFlick) {
        velocityY = (point.clientY - lastY) / dt;
        lastY = point.clientY;
        lastTime = now;
      }
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      const bounds = this.getSafeBounds();
      const w = win.offsetWidth;
      const h = win.offsetHeight;
      const nx = clamp(startL + dx, bounds.left - w + 80, bounds.right - 80);
      const ny = clamp(startT + dy, bounds.top, bounds.bottom - h);
      win.style.left = `${nx}px`;
      win.style.top = `${ny}px`;
      if (enableShake && shakeData) {
        shakeData.positions.push({ x: point.clientX, y: point.clientY, time: now });
        if (shakeData.positions.length > 20) shakeData.positions.shift();
        if (shakeData.positions.length >= 4) {
          const a = shakeData.positions[shakeData.positions.length - 4];
          const b = shakeData.positions[shakeData.positions.length - 1];
          const velX = b.x - a.x;
          const velY = b.y - a.y;
          let crossed = false;
          if (Math.abs(velX) > 8 && shakeData.prevVelX !== 0 && velX !== 0) {
            if (shakeData.prevVelX > 0 && velX < 0 || shakeData.prevVelX < 0 && velX > 0) crossed = true;
          }
          if (Math.abs(velY) > 8 && shakeData.prevVelY !== 0 && velY !== 0) {
            if (shakeData.prevVelY > 0 && velY < 0 || shakeData.prevVelY < 0 && velY > 0) crossed = true;
          }
          if (crossed) {
            shakeData.crossCount += 1;
            if (shakeData.crossCount >= 3 && now - shakeData.lastCrossTime < 600) {
              this._minimizeOtherWindows(win);
              shakeData.crossCount = 0;
            }
            shakeData.lastCrossTime = now;
          }
          shakeData.prevVelX = velX;
          shakeData.prevVelY = velY;
        }
      }
      if (enableSnap) activeSnapZone = this._snapCheck(win);
    };
    const onUp = () => {
      win.classList.remove("is-dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      shakeData = null;
      if (enableFlick && velocityY > 1.1 && !(record == null ? void 0 : record.zoomed)) {
        this.minimizeWindow(win);
        if (enableSnap) this._snapClear();
        activeSnapZone = null;
        return;
      }
      if (enableSnap && activeSnapZone) {
        this._applySnapOnRelease(win, activeSnapZone);
        activeSnapZone = null;
      }
      if (enableSnap) this._snapClear();
      this._host._emit("window:dragend", { win });
      this._host._saveSession();
    };
    this._host._listen(document, "mousemove", onMove);
    this._host._listen(document, "mouseup", onUp);
    if (hasTouch || "touches" in e) {
      this._host._listen(document, "touchmove", onMove, { passive: false });
      this._host._listen(document, "touchend", onUp);
    }
  }
  startResize(win, e, dir) {
    var _a;
    if ((_a = this._recordFor(win)) == null ? void 0 : _a.zoomed) return;
    if (e.cancelable) e.preventDefault();
    const start = eventPoint(e);
    if (!start) return;
    const startX = start.clientX;
    const startY = start.clientY;
    const startW = parseFloat(win.style.width) || win.offsetWidth;
    const startH = parseFloat(win.style.height) || win.offsetHeight;
    const startL = parseFloat(win.style.left) || 0;
    const startT = parseFloat(win.style.top) || 0;
    this._host._emit("window:resizestart", { win, dir });
    const onMove = (ev) => {
      const point = eventPoint(ev);
      if (!point) return;
      if (ev.cancelable) ev.preventDefault();
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      let w = startW;
      let h = startH;
      let x = startL;
      let y = startT;
      switch (dir) {
        case "se":
          w = startW + dx;
          h = startH + dy;
          break;
        case "e":
          w = startW + dx;
          break;
        case "s":
          h = startH + dy;
          break;
        case "sw":
          w = startW - dx;
          h = startH + dy;
          x = startL + dx;
          break;
        case "n":
          h = startH - dy;
          y = startT + dy;
          break;
        case "ne":
          w = startW + dx;
          h = startH - dy;
          y = startT + dy;
          break;
        case "nw":
          w = startW - dx;
          h = startH - dy;
          x = startL + dx;
          y = startT + dy;
          break;
        case "w":
          w = startW - dx;
          x = startL + dx;
          break;
      }
      const bounds = this.getSafeBounds();
      w = Math.max(420, w);
      if (dir.includes("n")) {
        const anchorBottom = clamp(startT + startH, bounds.top, bounds.bottom);
        const feasibleMinH = Math.min(280, Math.max(0, anchorBottom - bounds.top));
        y = clamp(y, bounds.top, anchorBottom - feasibleMinH);
        h = anchorBottom - y;
      } else {
        const availableH = Math.max(0, bounds.bottom - y);
        const feasibleMinH = Math.min(280, availableH);
        h = clamp(h, feasibleMinH, availableH);
      }
      win.style.width = `${w}px`;
      win.style.height = `${h}px`;
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      this._host._emit("window:resizeend", { win, dir });
      this._host._saveSession();
    };
    this._host._listen(document, "mousemove", onMove);
    this._host._listen(document, "mouseup", onUp);
    if (hasTouch || "touches" in e) {
      this._host._listen(document, "touchmove", onMove, { passive: false });
      this._host._listen(document, "touchend", onUp);
    }
  }
  /* ── Snap ─────────────────────────────────────────────────── */
  _snapCheck(win) {
    const canvas = this._host._query("#desktop-canvas");
    if (!canvas) return null;
    const cvRect = canvas.getBoundingClientRect();
    const wr = win.getBoundingClientRect();
    const margin = 20;
    let zone = null;
    if (wr.top - cvRect.top <= margin) zone = "top";
    else if (wr.left - cvRect.left <= margin) zone = "left";
    else if (cvRect.width - (wr.right - cvRect.left) <= margin) zone = "right";
    if (zone) this._showSnapPreview(zone);
    else this._snapClear();
    return zone;
  }
  _getSnapPreview() {
    if (!this._snapPreviewEl) {
      const el = document.createElement("div");
      el.className = "snap-preview";
      el.style.opacity = "0";
      const canvas = this._host._query("#desktop-canvas");
      if (canvas) canvas.appendChild(el);
      this._snapPreviewEl = el;
    }
    return this._snapPreviewEl;
  }
  _showSnapPreview(zone) {
    const t = this._getMaximizeTarget();
    const el = this._getSnapPreview();
    let rect;
    if (zone === "left") rect = { left: t.left, top: t.top, width: t.halfWidth, height: t.height };
    else if (zone === "right") rect = { left: t.left + t.halfWidth, top: t.top, width: t.halfWidth, height: t.height };
    else rect = { left: t.left, top: t.top, width: t.width, height: t.height };
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.opacity = "1";
  }
  _snapClear() {
    if (this._snapPreviewEl) this._snapPreviewEl.style.opacity = "0";
  }
  _applySnapOnRelease(win, zone) {
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    if (!rec || rec.el !== win) return;
    const version = ++rec.transitionVersion;
    this._host._emit("window:snap", { win, zone });
    const firstRect = win.getBoundingClientRect();
    if (!rec.zoomed) {
      win.dataset.rL = win.style.left;
      win.dataset.rT = win.style.top;
      win.dataset.rW = win.style.width;
      win.dataset.rH = win.style.height;
    }
    const t = this._getMaximizeTarget();
    let left;
    let width;
    if (zone === "top") {
      rec.zoomed = true;
      win.classList.remove("is-snapped");
      left = t.left;
      width = t.width;
    } else if (zone === "left") {
      rec.zoomed = false;
      win.classList.remove("is-zoomed");
      win.classList.add("is-snapped");
      left = t.left;
      width = t.halfWidth;
    } else {
      rec.zoomed = false;
      win.classList.remove("is-zoomed");
      win.classList.add("is-snapped");
      left = t.left + t.halfWidth;
      width = t.halfWidth;
    }
    win.style.left = `${left}px`;
    win.style.top = `${t.top}px`;
    win.style.width = `${width}px`;
    win.style.height = `${t.height}px`;
    const lastRect = win.getBoundingClientRect();
    const dx = firstRect.left - lastRect.left;
    const dy = firstRect.top - lastRect.top;
    const sx = firstRect.width / lastRect.width;
    const sy = firstRect.height / lastRect.height;
    win.classList.add("is-animating-maximize");
    if (zone === "top") win.classList.add("is-zoomed");
    win.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    requestAnimationFrame(() => {
      if (!this._isCurrent(section, rec) || rec.transitionVersion !== version) return;
      win.style.transform = "";
      win.classList.remove("is-animating-maximize");
    });
  }
  _minimizeOtherWindows(win) {
    for (const section of Object.keys(this._openWindows)) {
      const rec = this._openWindows[section];
      if (rec && rec.el && rec.el !== win && !rec.minimized) {
        this.minimizeWindow(rec.el);
      }
    }
  }
  /* ── Introspection ────────────────────────────────────────── */
  _getSwitcherWindows() {
    const out = [];
    for (const section of Object.keys(this._openWindows)) {
      const rec = this._openWindows[section];
      if (rec && rec.el && rec.el.isConnected && !rec.minimized) out.push(rec.el);
    }
    return out;
  }
  getOpenWindow(section) {
    return this._openWindows[section];
  }
  getOpenWindowKeys() {
    return Object.keys(this._openWindows);
  }
  getOpenWindowCount() {
    return Object.keys(this._openWindows).length;
  }
  /** Remove a specific record without allowing a stale callback to delete its replacement. */
  removeWindowRecord(record, suppressSessionSave = false) {
    var _a;
    const win = record.el;
    const section = win.getAttribute("data-section") ?? "";
    this._disposeWindow(win);
    win.remove();
    if (!this._isCurrent(section, record)) return false;
    (_a = record.btn) == null ? void 0 : _a.classList.remove("is-open", "has-minimized", "is-bouncing");
    delete this._openWindows[section];
    this._host._emit("window:close", { section, win });
    if (!suppressSessionSave) this._host._saveSession();
    return true;
  }
  setWindowLogicalState(win, minimized, zoomed) {
    var _a;
    const rec = this._recordFor(win);
    if (!rec) return;
    rec.transitionVersion += 1;
    if (minimized !== void 0) {
      rec.minimized = minimized;
      win.classList.toggle("is-minimized", minimized);
      win.classList.toggle("is-gone", minimized);
      (_a = rec.btn) == null ? void 0 : _a.classList.toggle("has-minimized", minimized);
    }
    if (zoomed !== void 0) {
      rec.zoomed = zoomed;
      win.classList.toggle("is-zoomed", zoomed);
    }
    win.classList.remove("is-animating-minimize", "is-animating-restore", "is-animating-maximize");
    win.style.transform = "";
  }
  isMinimized(recordOrWindow) {
    const rec = "el" in recordOrWindow ? recordOrWindow : this._recordFor(recordOrWindow);
    return (rec == null ? void 0 : rec.minimized) ?? false;
  }
  isZoomed(recordOrWindow) {
    const rec = "el" in recordOrWindow ? recordOrWindow : this._recordFor(recordOrWindow);
    return (rec == null ? void 0 : rec.zoomed) ?? false;
  }
  _recordFor(win) {
    const section = win.getAttribute("data-section") ?? "";
    const rec = this._openWindows[section];
    return (rec == null ? void 0 : rec.el) === win ? rec : void 0;
  }
  _isCurrent(section, record) {
    return this._openWindows[section] === record;
  }
  _disposeWindow(win) {
    if (!win._disposal) return;
    win._disposal.dispose();
    win._disposal = null;
  }
  /** Remove the shared snap-preview element (engine destroy). */
  disposeSnapPreview() {
    if (this._snapPreviewEl) {
      this._snapPreviewEl.remove();
      this._snapPreviewEl = null;
    }
  }
  /** Replace content of a window body (returns the content element if present). */
  setWindowTitle(win, title) {
    const t = win ? win.querySelector(".window-title") : null;
    if (t) {
      const icon = t.querySelector(".window-title-icon");
      while (t.firstChild) t.removeChild(t.firstChild);
      if (icon) t.appendChild(icon.cloneNode(true));
      t.append(document.createTextNode(title));
    }
  }
  setWindowContent(win, content) {
    const main = win ? win.querySelector(".window-content-main") : null;
    if (main) replaceContent(main, content, false);
  }
  getWindowContent(win) {
    return win ? win.querySelector(".window-content-main") : null;
  }
  /** Internal: read the app manifest for a section. */
  _appConfig(section) {
    const apps = this._host.config.apps;
    return apps && Object.prototype.hasOwnProperty.call(apps, section) ? apps[section] : void 0;
  }
}
const CREDENTIAL_KEY_PATTERN = /token|secret|password|credential|authorization|permission|session|cookie/i;
const ENCRYPTED_BLOB_PREFIX = "e1:";
const UNSAFE_STATE_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function isUnsafeStateKey(key) {
  return typeof key === "string" && UNSAFE_STATE_KEYS.has(key);
}
function containsCredentialState(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === "string" && CREDENTIAL_KEY_PATTERN.test(key)) return true;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if ((descriptor == null ? void 0 : descriptor.enumerable) && "value" in descriptor && containsCredentialState(descriptor.value, seen)) {
      return true;
    }
  }
  return false;
}
function assertPlaintextSafeState(key, value) {
  if (typeof key === "string" && CREDENTIAL_KEY_PATTERN.test(key) || containsCredentialState(value)) {
    throw new Error("PrestigeStore refuses to persist credential, session, authorization, or permission-like state in localStorage.");
  }
}
function copySafeState(...sources) {
  const result = {};
  for (const source of sources) {
    if (source === null || typeof source !== "object") continue;
    for (const key of Reflect.ownKeys(source)) {
      if (isUnsafeStateKey(key)) continue;
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (!(descriptor == null ? void 0 : descriptor.enumerable)) continue;
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: Reflect.get(source, key),
        writable: true
      });
    }
  }
  return result;
}
function getSchemaValidator(schema, key) {
  if (!schema || typeof key !== "string" || !Object.prototype.hasOwnProperty.call(schema, key)) {
    return void 0;
  }
  return schema[key];
}
function assertValidValue(schema, key, value) {
  const validator = getSchemaValidator(schema, key);
  if (validator && !validator(value)) {
    throw new Error(`[PrestigeStore Guard] Invalid value for key "${String(key)}"`);
  }
}
function isValidRestoredValue(schema, key, value) {
  try {
    assertValidValue(schema, key, value);
    return true;
  } catch (_error) {
    return false;
  }
}
function reportListenerError(kind, error) {
  try {
    console.error(`[PrestigeStore] ${kind} listener error:`, error);
  } catch (_error) {
  }
}
function notifyStateListeners(listeners, key, value, prev, store) {
  listeners.forEach((listener) => {
    try {
      listener(key, value, prev, store);
    } catch (error) {
      reportListenerError("state", error);
    }
  });
}
function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function emitStorageError(key, error) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent("storage:error", { detail: { key, error } }));
}
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  Object.freeze(value);
  const record = value;
  for (const key of Object.keys(value)) {
    const nested = record[key];
    if (nested !== null && typeof nested === "object" && !Object.isFrozen(nested)) {
      deepFreeze(nested);
    }
  }
  return value;
}
class PrestigeStore {
  constructor(options = {}) {
    __publicField(this, "_stores", /* @__PURE__ */ new Map());
    __publicField(this, "_cache", /* @__PURE__ */ new Map());
    __publicField(this, "_cacheListeners", /* @__PURE__ */ new Map());
    __publicField(this, "_inflight", /* @__PURE__ */ new Map());
    __publicField(this, "_persistQueues", /* @__PURE__ */ new Map());
    __publicField(this, "_storage");
    __publicField(this, "_keyProvider");
    this._storage = options.storage ?? "deny-secrets";
    this._keyProvider = options.keyProvider ?? null;
  }
  /** True when encrypted persistence is active. */
  get _isEncrypted() {
    return this._storage === "encrypted";
  }
  /** Resolve the app-owned AES-GCM key, throwing when none is available. */
  async _requireKey() {
    if (!this._keyProvider) {
      throw new Error("PrestigeStore encrypted persistence requires a keyProvider.");
    }
    const key = await this._keyProvider();
    if (!key) throw new Error("PrestigeStore keyProvider returned no key.");
    return key;
  }
  /**
   * Serialize asynchronous persistence writes per key. `_persistEncrypted`
   * is async (key derivation + `crypto.subtle.encrypt`), so firing it
   * unconditionally from the synchronous Proxy `set` trap lets concurrent
   * writes complete out of order and a stale snapshot overwrite a newer one
   * in localStorage. Queueing ensures each write starts only after the
   * previous one finished; because each task stringifies the live `target`
   * when it runs, the final write always carries the newest state.
   */
  _enqueuePersist(persistedKey, task) {
    const previous = this._persistQueues.get(persistedKey) ?? Promise.resolve();
    const next = previous.then(task, task).catch((error) => {
      emitStorageError(persistedKey, error);
    });
    this._persistQueues.set(persistedKey, next);
  }
  /** AES-GCM encrypt `data` and persist it as `e1:<iv+ct>` base64. */
  async _persistEncrypted(persistedKey, state) {
    const key = await this._requireKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(state));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    const payload = new Uint8Array(12 + encrypted.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(encrypted), 12);
    localStorage.setItem(persistedKey, ENCRYPTED_BLOB_PREFIX + bytesToBase64(payload));
  }
  /** Decrypt an `e1:` blob back to JSON text; null for legacy/corrupt data. */
  async _decryptBlob(blob) {
    if (!blob.startsWith(ENCRYPTED_BLOB_PREFIX)) return null;
    const key = await this._requireKey();
    const raw = base64ToBytes(blob.slice(ENCRYPTED_BLOB_PREFIX.length));
    const iv = raw.slice(0, 12);
    const data = raw.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(decrypted);
  }
  /**
   * Create a reactive store. Reuses an existing store registered under the
   * same id (later initial state is ignored). When `persistKey` is provided
   * the state is auto-restored from and written to localStorage.
   */
  createStore(storeId, initialState = {}, options = {}) {
    if (!storeId) throw new Error("PrestigeStore.createStore requires a storeId.");
    if (!this._isEncrypted && options.persistKey && CREDENTIAL_KEY_PATTERN.test(options.persistKey)) {
      throw new Error("PrestigeStore refuses to persist credential, session, authorization, or permission-like state in localStorage.");
    }
    const existing = this._stores.get(storeId);
    if (existing) return existing;
    const initialData = copySafeState(initialState);
    if (options.persistKey && !this._isEncrypted) assertPlaintextSafeState("", initialData);
    for (const key of Reflect.ownKeys(initialData)) {
      assertValidValue(options.schema, key, Reflect.get(initialData, key));
    }
    let rawData = initialData;
    const persistedKey = options.persistKey ? `prestige_store_${options.persistKey}` : null;
    if (persistedKey && !this._isEncrypted) {
      try {
        const saved = localStorage.getItem(persistedKey);
        if (saved !== null) {
          const restored = JSON.parse(saved);
          if (restored !== null && typeof restored === "object" && !Array.isArray(restored)) {
            const validRestored = copySafeState();
            for (const key of Reflect.ownKeys(restored)) {
              if (isUnsafeStateKey(key)) continue;
              const descriptor = Object.getOwnPropertyDescriptor(restored, key);
              if (!(descriptor == null ? void 0 : descriptor.enumerable)) continue;
              const value = Reflect.get(restored, key);
              try {
                assertPlaintextSafeState(key, value);
              } catch (_error) {
                continue;
              }
              if (isValidRestoredValue(options.schema, key, value)) {
                Object.defineProperty(validRestored, key, {
                  configurable: true,
                  enumerable: true,
                  value,
                  writable: true
                });
              }
            }
            rawData = copySafeState(initialData, validRestored);
          }
        }
      } catch (_e) {
      }
    }
    const touched = /* @__PURE__ */ new Set();
    const listeners = /* @__PURE__ */ new Set();
    const persist = (target) => {
      if (!persistedKey) return;
      if (this._isEncrypted) {
        this._enqueuePersist(persistedKey, () => this._persistEncrypted(persistedKey, target));
      } else {
        try {
          localStorage.setItem(persistedKey, JSON.stringify(target));
        } catch (error) {
          emitStorageError(persistedKey, error);
        }
      }
    };
    const assertMutableKey = (prop) => {
      if (isUnsafeStateKey(prop)) {
        throw new Error(`[PrestigeStore Guard] Unsafe state key "${String(prop)}"`);
      }
    };
    const handler = {
      get: (target, prop, receiver) => {
        if (prop === "$subscribe") {
          return (fn) => {
            listeners.add(fn);
            return () => {
              listeners.delete(fn);
            };
          };
        }
        if (prop === "$bindInput") {
          return (inputEl, stateKey) => {
            if (!inputEl || !stateKey) return () => {
            };
            inputEl.value = String(target[stateKey] ?? "");
            const onInput = (e) => {
              const input = e.target;
              proxy[stateKey] = input.value;
            };
            const onStateChange = (key, val) => {
              if (key === stateKey && inputEl.value !== val) {
                inputEl.value = String(val ?? "");
              }
            };
            inputEl.addEventListener("input", onInput);
            listeners.add(onStateChange);
            return () => {
              inputEl.removeEventListener("input", onInput);
              listeners.delete(onStateChange);
            };
          };
        }
        if (prop === "$getRaw") return () => ({ ...target });
        if (prop === "$getSnapshot") return () => deepFreeze(structuredClone(target));
        return Reflect.get(target, prop, receiver);
      },
      set: (target, prop, value, _receiver) => {
        assertMutableKey(prop);
        if (persistedKey && !this._isEncrypted) {
          assertPlaintextSafeState(prop, value);
          assertPlaintextSafeState("", target);
        }
        const key = prop;
        assertValidValue(options.schema, prop, value);
        touched.add(prop);
        const prev = Reflect.get(target, prop);
        if (!Object.is(prev, value)) {
          if (!Reflect.set(target, prop, value)) return false;
          persist(target);
          notifyStateListeners(listeners, key, value, prev, proxy);
        }
        return true;
      },
      defineProperty: (target, prop, descriptor) => {
        assertMutableKey(prop);
        if (!Object.prototype.hasOwnProperty.call(descriptor, "value") || descriptor.get || descriptor.set) {
          throw new Error("[PrestigeStore Guard] Accessor and attribute-only property definitions are unsupported.");
        }
        if (persistedKey && !this._isEncrypted) {
          assertPlaintextSafeState(prop, descriptor.value);
          assertPlaintextSafeState("", target);
        }
        assertValidValue(options.schema, prop, descriptor.value);
        touched.add(prop);
        const existed = Object.prototype.hasOwnProperty.call(target, prop);
        const prev = Reflect.get(target, prop);
        if (!Reflect.defineProperty(target, prop, descriptor)) return false;
        if (!existed || !Object.is(prev, descriptor.value)) {
          persist(target);
          notifyStateListeners(listeners, prop, descriptor.value, prev, proxy);
        }
        return true;
      },
      deleteProperty: (target, prop) => {
        assertMutableKey(prop);
        touched.add(prop);
        if (!Object.prototype.hasOwnProperty.call(target, prop)) return true;
        assertValidValue(options.schema, prop, void 0);
        const prev = Reflect.get(target, prop);
        if (!Reflect.deleteProperty(target, prop)) return false;
        persist(target);
        notifyStateListeners(listeners, prop, void 0, prev, proxy);
        return true;
      }
    };
    const proxy = new Proxy(rawData, handler);
    this._stores.set(storeId, proxy);
    if (persistedKey && this._isEncrypted) {
      this._restoreEncrypted(rawData, persistedKey, listeners, initialData, touched, proxy, options.schema);
    }
    return proxy;
  }
  /**
   * Background decryption-and-merge for `'encrypted'` persistence. Runs
   * asynchronously so `createStore` stays synchronous; on decrypt failure or
   * corrupt/legacy blobs the store falls back to `initialState` and emits a
   * `storage:error` event (never throws).
   *
   * A restored value is applied ONLY to keys the caller has not written
   * since `createStore` (tracked by the `touched` set), so caller writes are
   * never clobbered by stale persisted data — even when a written value
   * equals the `initialState` value.
   */
  async _restoreEncrypted(target, persistedKey, listeners, initialState, touched, proxy, schema) {
    try {
      const saved = localStorage.getItem(persistedKey);
      if (saved === null) return;
      const json = await this._decryptBlob(saved);
      if (json === null) return;
      const restored = JSON.parse(json);
      if (restored === null || typeof restored !== "object" || Array.isArray(restored)) return;
      const safeRestored = copySafeState(restored);
      for (const key of Reflect.ownKeys(safeRestored)) {
        const k = key;
        if (touched.has(k)) continue;
        const value = Reflect.get(safeRestored, key);
        if (!isValidRestoredValue(schema, key, value)) continue;
        if (!Object.is(Reflect.get(target, key), Reflect.get(initialState, key))) continue;
        const prev = Reflect.get(target, key);
        if (!Object.is(prev, value)) {
          Reflect.set(target, key, value);
          notifyStateListeners(listeners, k, value, prev, proxy);
        }
      }
    } catch (error) {
      emitStorageError(persistedKey, error);
    }
  }
  /** Retrieve a previously created store, or null. */
  getStore(storeId) {
    const existing = this._stores.get(storeId);
    return existing ? existing : null;
  }
  /**
   * Stale-While-Revalidate server cache. Fresh entries within `ttl` are
   * served immediately; stale entries are served while revalidating in the
   * background; concurrent requests for the same key are deduplicated.
   */
  async fetchSWR(key, fetcher, options = {}) {
    const ttl = options.ttl ?? 6e4;
    const cached = this._cache.get(key);
    const now = Date.now();
    if (cached && now - cached.timestamp < ttl && !options.force) {
      return cached.data;
    }
    if (cached && options.staleWhileRevalidate && !options.force) {
      this._executeFetcher(key, fetcher).catch(() => {
      });
      return cached.data;
    }
    return await this._executeFetcher(key, fetcher);
  }
  /** Run (or join) a fetcher, caching the result and notifying cache listeners. */
  async _executeFetcher(key, fetcher) {
    const inFlight = this._inflight.get(key);
    if (inFlight) return inFlight;
    const request = Promise.resolve().then(fetcher).then((data) => {
      this._cache.set(key, { data, timestamp: Date.now() });
      const listeners = this._cacheListeners.get(key);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(data);
          } catch (error) {
            reportListenerError("cache", error);
          }
        });
      }
      return data;
    }).catch((error) => {
      console.error(`[PrestigeStore] SWR Fetch Error on key "${key}":`, error);
      throw error;
    }).finally(() => {
      this._inflight.delete(key);
    });
    this._inflight.set(key, request);
    return request;
  }
  /** Subscribe to cache revalidations for a key; returns an unsubscribe function. */
  onCacheChange(key, callback) {
    const existing = this._cacheListeners.get(key);
    if (existing) {
      existing.add(callback);
    } else {
      const listeners = /* @__PURE__ */ new Set();
      listeners.add(callback);
      this._cacheListeners.set(key, listeners);
    }
    return () => {
      const listeners = this._cacheListeners.get(key);
      if (!listeners) return;
      listeners.delete(callback);
      if (listeners.size === 0) this._cacheListeners.delete(key);
    };
  }
}
const PROTECTED_GENERATED_ATTRIBUTES = /* @__PURE__ */ new Set(["crossorigin", "integrity", "nonce", "referrerpolicy"]);
function isProtectedGeneratedAttribute(element, name) {
  const normalizedName = name.toLowerCase();
  if (!element.hasAttribute(normalizedName)) return false;
  if (PROTECTED_GENERATED_ATTRIBUTES.has(normalizedName)) return true;
  if (element.tagName === "IFRAME" && ["allow", "credentialless", "csp", "sandbox"].includes(normalizedName)) return true;
  if (normalizedName === "rel") {
    return /(?:^|\s)(?:noopener|noreferrer)(?:\s|$)/i.test(element.getAttribute("rel") ?? "");
  }
  return false;
}
function applyComponentOptions(element, options) {
  if (options.id) element.id = options.id;
  if (options.className) {
    const names = String(options.className).split(/\s+/).filter(Boolean);
    if (names.length) element.classList.add(...names);
  }
  if (options.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      if (isProtectedGeneratedAttribute(element, key)) continue;
      if (value === false || value == null) element.removeAttribute(key);
      else setSafeAttribute(element, key, value);
    }
  }
  if (options.data) {
    for (const [key, value] of Object.entries(options.data)) element.dataset[key] = String(value);
  }
  if (options.style) Object.assign(element.style, options.style);
  return element;
}
class ComponentRegistry {
  constructor() {
    __publicField(this, "_factories", /* @__PURE__ */ new Map());
  }
  /** Register a factory. Throws on duplicate names unless `{ replace: true }`. */
  register(name, factory, options) {
    if (!name || typeof factory !== "function") {
      throw new Error("register(name, factory) requires a name and factory.");
    }
    if (this._factories.has(name) && !(options == null ? void 0 : options.replace)) {
      throw new Error(`Prestige component already registered: ${name}. Pass { replace: true } to replace it.`);
    }
    this._factories.set(name, (componentOptions, instance) => {
      const element = factory(componentOptions, instance);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Prestige component factory "${name}" must return an HTMLElement.`);
      }
      return applyComponentOptions(element, componentOptions);
    });
    return this;
  }
  /** Remove a registered factory. */
  unregister(name) {
    if (name) this._factories.delete(name);
    return this;
  }
  /** True when a factory is registered under `name`. */
  has(name) {
    return this._factories.has(name);
  }
  /** The raw factory for `name`, or null. */
  get(name) {
    return this._factories.get(name) ?? null;
  }
  /** Sorted list of registered component names. */
  list() {
    return [...this._factories.keys()].sort();
  }
  /** Instantiate a registered component. Throws for unknown names. */
  create(name, options = {}, instance) {
    const factory = this._factories.get(name);
    if (!factory) throw new Error(`Unknown Prestige component: ${name}`);
    return factory(options, instance);
  }
}
const defaultRegistry = new ComponentRegistry();
function isNode(value) {
  return typeof Node !== "undefined" && value instanceof Node;
}
function appendContent(parent, content, instance, trustedHtml) {
  var _a, _b;
  let resolved = content;
  if (typeof resolved === "function") resolved = resolved(instance);
  if (isNode(resolved)) {
    parent.appendChild(resolved);
    return;
  }
  if (resolved == null) return;
  replaceContent(parent, String(resolved), trustedHtml === true, (_b = (_a = instance == null ? void 0 : instance.config) == null ? void 0 : _a.security) == null ? void 0 : _b.sanitizer);
}
function once(fn) {
  let called = false;
  return (...args) => {
    if (called) return;
    called = true;
    fn(...args);
  };
}
let generatedComponentId = 0;
function nextComponentId(prefix) {
  let id;
  do {
    generatedComponentId++;
    id = `${prefix}-${generatedComponentId}`;
  } while (document.getElementById(id));
  return id;
}
function selfCleanupOnDetach(el, cleanup) {
  if (typeof MutationObserver === "undefined") return () => {
  };
  const observer = new MutationObserver(() => {
    if (!el.isConnected) {
      observer.disconnect();
      cleanup();
    }
  });
  let node = el.parentNode;
  let attached = 0;
  while (node) {
    try {
      observer.observe(node, { childList: true });
      attached++;
    } catch (_e) {
    }
    node = node.parentNode;
  }
  if (attached === 0) observer.disconnect();
  return () => observer.disconnect();
}
function createBtn(text, opts = {}) {
  const btn = document.createElement("button");
  btn.className = "btn";
  if (opts.variant) btn.classList.add(`btn-${opts.variant}`);
  if (opts.size === "sm") btn.classList.add("btn-sm");
  if (opts.className) btn.classList.add(...opts.className.split(" "));
  btn.textContent = text;
  if (opts.onclick) btn.addEventListener("click", opts.onclick);
  if (opts.type) btn.type = opts.type;
  if (opts.disabled) btn.disabled = true;
  return btn;
}
function createCard(title, bodyEl, opts = {}) {
  const card = document.createElement("div");
  card.className = "glass-card";
  if (opts.className) card.classList.add(...opts.className.split(" "));
  if (title) {
    const header = document.createElement("div");
    header.className = "card-header";
    const h3 = document.createElement("h3");
    h3.textContent = title;
    header.appendChild(h3);
    card.appendChild(header);
  }
  if (bodyEl) {
    const body = document.createElement("div");
    body.className = "card-body";
    body.append(bodyEl);
    card.appendChild(body);
  }
  return card;
}
function createField(labelText, inputEl, helpText) {
  var _a;
  const group = document.createElement("div");
  group.className = "form-group";
  const label = document.createElement("label");
  label.textContent = labelText;
  const controlId = inputEl.id || nextComponentId("prestige-field");
  if (!inputEl.id) inputEl.id = controlId;
  label.htmlFor = controlId;
  group.appendChild(label);
  group.appendChild(inputEl);
  if (helpText) {
    const help = document.createElement("div");
    help.className = "form-help";
    help.id = nextComponentId("prestige-field-help");
    help.textContent = helpText;
    const describedBy = (_a = inputEl.getAttribute("aria-describedby")) == null ? void 0 : _a.trim();
    inputEl.setAttribute("aria-describedby", describedBy ? `${describedBy} ${help.id}` : help.id);
    group.appendChild(help);
  }
  return group;
}
function createInput(opts = {}) {
  if (opts.textarea) {
    const el2 = document.createElement("textarea");
    el2.className = "form-textarea";
    if (opts.placeholder) el2.placeholder = opts.placeholder;
    if (opts.value !== void 0) el2.value = opts.value;
    if (opts.required) el2.required = true;
    if (opts.rows) el2.rows = opts.rows;
    return el2;
  }
  const el = document.createElement("input");
  el.className = "form-input";
  if (opts.placeholder) el.placeholder = opts.placeholder;
  if (opts.value !== void 0) el.value = opts.value;
  if (opts.type) el.type = opts.type;
  if (opts.required) el.required = true;
  return el;
}
function createStatCard(value, label) {
  const card = document.createElement("div");
  card.className = "stat-card";
  const v = document.createElement("div");
  v.className = "stat-value";
  v.textContent = String(value);
  const l = document.createElement("div");
  l.className = "stat-label";
  l.textContent = label;
  card.append(v, l);
  return card;
}
function createBadge(text, variant = "info") {
  const b = document.createElement("span");
  b.className = `badge badge-${variant}`;
  b.textContent = text;
  return b;
}
function createTable(headers, rows) {
  const table = document.createElement("table");
  if (headers && headers.length) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    for (const h of headers) {
      const th = document.createElement("th");
      th.textContent = h;
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    table.appendChild(thead);
  }
  if (rows && rows.length) {
    const tbody = document.createElement("tbody");
    for (const row of rows) {
      const tr = document.createElement("tr");
      for (const cell of row) {
        const td = document.createElement("td");
        if (isNode(cell)) td.appendChild(cell);
        else td.textContent = String(cell);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }
  return table;
}
function buildProgress(options) {
  const max = Number(options.max);
  const safeMax = isFinite(max) && max > 0 ? max : 100;
  const bar = $tag("div", { class: "prestige-progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(safeMax) });
  const fill = $tag("div", { class: "prestige-progress-fill" });
  bar.appendChild(fill);
  const setValue = (value) => {
    const parsed = Number(value);
    const safe = isFinite(parsed) ? Math.max(0, Math.min(safeMax, parsed)) : 0;
    fill.style.width = `${safe / safeMax * 100}%`;
    bar.setAttribute("aria-valuenow", String(safe));
    if (options.label) bar.setAttribute("aria-label", options.label);
    return safe;
  };
  bar.setValue = setValue;
  bar.getValue = () => Number(bar.getAttribute("aria-valuenow"));
  setValue(options.value ?? 0);
  return bar;
}
function createProgress(options = {}) {
  return applyComponentOptions(buildProgress(options), options);
}
function createProgressBar(value, max, options = {}) {
  const merged = { ...options };
  if (value !== void 0) merged.value = value;
  if (max !== void 0) merged.max = max;
  return createProgress(merged);
}
function buildTabs(options) {
  const tabs = Array.isArray(options.tabs) ? options.tabs : [];
  const container = $tag("div", { class: "prestige-tabs-wrap" });
  const nav = $tag("div", { class: "prestige-tabs", role: "tablist" });
  const panel = $tag("div", { class: "prestige-tabs-panel", role: "tabpanel" });
  const buttons = [];
  let activeIndex = -1;
  const panelId = `prestige-tabs-${Math.random().toString(36).slice(2)}`;
  panel.id = panelId;
  const renderTab = (index) => {
    const tab = tabs[index];
    if (!tab) return;
    activeIndex = index;
    buttons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle("btn-primary", active);
      button.classList.toggle("btn-ghost", !active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    while (panel.firstChild) panel.removeChild(panel.firstChild);
    appendContent(panel, tab.content, options.instance, tab.trustedHtml === true || tab.html === true);
    if (typeof options.onChange === "function") options.onChange(tab, index, container);
  };
  tabs.forEach((tab, index) => {
    const button = createBtn(tab.label ?? `Tab ${index + 1}`, { variant: "ghost", size: options.size ?? "sm", type: "button" });
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", panelId);
    button.addEventListener("click", () => renderTab(index));
    button.addEventListener("keydown", ((event) => {
      var _a;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      (_a = buttons[next]) == null ? void 0 : _a.focus();
      renderTab(next);
    }));
    buttons.push(button);
    nav.appendChild(button);
  });
  container.append(nav, panel);
  container.select = renderTab;
  container.getActiveIndex = () => activeIndex;
  if (tabs.length) renderTab(Math.max(0, Math.min(tabs.length - 1, Number(options.activeIndex) || 0)));
  return container;
}
function createTabs(tabs, options = {}) {
  const opts = { ...options, tabs: tabs ?? options.tabs ?? [] };
  return applyComponentOptions(buildTabs(opts), opts);
}
function createAlert(options = {}) {
  const type = options.type ?? "info";
  const alert = $tag("section", { class: `prestige-alert prestige-alert-${type}`, role: type === "danger" ? "alert" : "status" });
  const content = $tag("div", { class: "prestige-alert-content" });
  if (options.title) content.appendChild($tag("strong", { class: "prestige-alert-title" }, [$text(options.title)]));
  if (options.message !== void 0 || options.content !== void 0) {
    appendContent(content, options.content === void 0 ? options.message : options.content, options.instance, options.html === true);
  }
  alert.appendChild(content);
  if (options.dismissible) {
    const close = createBtn("×", { variant: "ghost", size: "sm", type: "button", className: "prestige-alert-close" });
    close.setAttribute("aria-label", "Dismiss alert");
    close.addEventListener("click", () => {
      alert.remove();
      if (typeof options.onClose === "function") options.onClose();
    });
    alert.appendChild(close);
  }
  return applyComponentOptions(alert, options);
}
function buildSwitch(options) {
  const checked = !!options.checked;
  const control = $tag("button", { class: "prestige-switch", type: "button", role: "switch", "aria-checked": String(checked), "aria-label": options.label ?? "Toggle" });
  control.appendChild($tag("span", { class: "prestige-switch-thumb" }));
  const setChecked = (next, notify) => {
    const value = !!next;
    control.classList.toggle("is-checked", value);
    control.setAttribute("aria-checked", String(value));
    if (notify && typeof options.onChange === "function") options.onChange(value, control);
    return value;
  };
  control.addEventListener("click", () => setChecked(control.getAttribute("aria-checked") !== "true", true));
  control.setChecked = (next) => setChecked(next, false);
  control.isChecked = () => control.getAttribute("aria-checked") === "true";
  return control;
}
function createSwitch(options = {}) {
  return applyComponentOptions(buildSwitch(options), options);
}
function buildAccordion(options) {
  const items = Array.isArray(options.items) ? options.items : [];
  const multiple = !!options.multiple;
  const root = $tag("div", { class: "prestige-accordion" });
  const open = {};
  const setOpen = (index, value) => {
    if (!multiple && value) Object.keys(open).forEach((key) => {
      open[Number(key)] = false;
    });
    open[index] = !!value;
    root.querySelectorAll("[data-accordion-index]").forEach((item) => {
      const itemIndex = item.getAttribute("data-accordion-index");
      const expanded = !!open[Number(itemIndex)];
      item.classList.toggle("is-open", expanded);
      const trigger = item.querySelector("button");
      trigger == null ? void 0 : trigger.setAttribute("aria-expanded", String(expanded));
    });
    if (typeof options.onChange === "function") {
      options.onChange(Object.keys(open).filter((key) => open[Number(key)]).map(Number), root);
    }
  };
  items.forEach((item, index) => {
    const section = $tag("section", { class: "prestige-accordion-item", "data-accordion-index": String(index) });
    const button = $tag("button", { class: "prestige-accordion-trigger", type: "button", "aria-expanded": "false" }, [
      $tag("span", {}, [$text(item.title ?? `Section ${index + 1}`)]),
      $tag("span", { class: "prestige-accordion-chevron", "aria-hidden": "true" }, [$text("⌄")])
    ]);
    const panel = $tag("div", { class: "prestige-accordion-panel" });
    appendContent(panel, item.content, options.instance, item.html === true);
    button.addEventListener("click", () => setOpen(index, !open[index]));
    section.append(button, panel);
    root.appendChild(section);
    if (item.open) open[index] = true;
  });
  root.setOpen = setOpen;
  items.forEach((_item, index) => {
    if (open[index]) setOpen(index, true);
  });
  return root;
}
function createAccordion(options = {}) {
  return applyComponentOptions(buildAccordion(options), options);
}
function buildPagination(options) {
  const total = Math.max(1, Number(options.total) || 1);
  let page = Math.max(1, Math.min(total, Number(options.page) || 1));
  const nav = $tag("nav", { class: "prestige-pagination", "aria-label": options.ariaLabel ?? "Pagination" });
  const render = () => {
    while (nav.firstChild) nav.removeChild(nav.firstChild);
    const previous = createBtn("Previous", { variant: "ghost", size: "sm", type: "button", disabled: page === 1 });
    previous.addEventListener("click", () => setPage(page - 1));
    nav.appendChild(previous);
    for (let number = 1; number <= total; number++) {
      const button = createBtn(String(number), { variant: number === page ? "primary" : "ghost", size: "sm", type: "button" });
      button.setAttribute("aria-current", number === page ? "page" : "false");
      button.addEventListener("click", () => setPage(number));
      nav.appendChild(button);
    }
    const next = createBtn("Next", { variant: "ghost", size: "sm", type: "button", disabled: page === total });
    next.addEventListener("click", () => setPage(page + 1));
    nav.appendChild(next);
  };
  const setPage = (next) => {
    const target = Math.max(1, Math.min(total, Number(next) || page));
    if (target === page) return page;
    page = target;
    render();
    if (typeof options.onChange === "function") options.onChange(page, nav);
    return page;
  };
  nav.setPage = setPage;
  nav.getPage = () => page;
  render();
  return nav;
}
function createPagination(options = {}) {
  return applyComponentOptions(buildPagination(options), options);
}
function createSkeleton(options = {}) {
  const count = Math.max(1, Number(options.count) || 1);
  const root = $tag("div", { class: "prestige-skeleton-group", role: "status", "aria-label": options.label ?? "Loading" });
  for (let index = 0; index < count; index++) {
    const line = $tag("div", { class: "prestige-skeleton" });
    line.style.width = (Array.isArray(options.widths) ? options.widths[index] : options.width) || "100%";
    line.style.height = options.height || "14px";
    root.appendChild(line);
  }
  return applyComponentOptions(root, options);
}
function createEmptyState(options = {}) {
  const root = $tag("section", { class: "prestige-empty-state" });
  if (options.icon) root.appendChild($tag("div", { class: "prestige-empty-state-icon", "aria-hidden": "true" }, [$text(options.icon)]));
  root.appendChild($tag("h3", {}, [$text(options.title ?? "Nothing here yet")]));
  if (options.description) root.appendChild($tag("p", {}, [$text(options.description)]));
  if (options.action) {
    const action = createBtn(options.action.label ?? "Continue", { variant: options.action.variant ?? "primary", type: "button" });
    if (typeof options.action.onClick === "function") action.addEventListener("click", options.action.onClick);
    root.appendChild(action);
  }
  return applyComponentOptions(root, options);
}
function appendAvatarBody(el, options, initials) {
  if (options.src && isSafeUrl(options.src)) {
    const image = $tag("img", { src: options.src, alt: options.alt ?? options.label ?? "" });
    image.addEventListener("error", () => {
      image.remove();
      el.appendChild($text(initials));
    }, { once: true });
    el.appendChild(image);
  } else {
    el.appendChild($text(initials));
  }
}
function createAvatar(options = {}) {
  const label = options.label ?? options.name ?? "";
  const initials = options.initials ?? label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() ?? "?";
  const ariaLabel = options.ariaLabel ?? label ?? "Avatar";
  if (options.href && isSafeUrl(options.href)) {
    const avatar2 = $tag("a", { class: `prestige-avatar prestige-avatar-${options.size ?? "md"}`, "aria-label": ariaLabel, href: options.href });
    appendAvatarBody(avatar2, options, initials);
    return applyComponentOptions(avatar2, options);
  }
  const avatar = $tag("span", { class: `prestige-avatar prestige-avatar-${options.size ?? "md"}`, "aria-label": ariaLabel });
  appendAvatarBody(avatar, options, initials);
  return applyComponentOptions(avatar, options);
}
function createBreadcrumb(options = {}) {
  const items = Array.isArray(options.items) ? options.items : [];
  const nav = $tag("nav", { class: "prestige-breadcrumb", "aria-label": options.ariaLabel ?? "Breadcrumb" });
  const list = $tag("ol");
  items.forEach((item, index) => {
    const entry = $tag("li");
    const current = index === items.length - 1;
    if (item.href && !current && isSafeUrl(item.href)) {
      entry.appendChild($tag("a", { href: item.href }, [$text(item.label ?? "")]));
    } else {
      entry.appendChild($tag("span", current ? { "aria-current": "page" } : void 0, [$text(item.label ?? "")]));
    }
    list.appendChild(entry);
  });
  nav.appendChild(list);
  return applyComponentOptions(nav, options);
}
function createTooltip(options = {}) {
  if (!(options.trigger instanceof Element)) throw new Error("Tooltip requires a trigger DOM node.");
  const wrapper = $tag("span", { class: "prestige-tooltip-wrap" });
  const bubble = $tag("span", { class: "prestige-tooltip", role: "tooltip" }, [$text(options.message ?? "")]);
  wrapper.append(options.trigger, bubble);
  const id = options.id ?? `prestige-tooltip-${Math.random().toString(36).slice(2)}`;
  options.trigger.setAttribute("aria-describedby", id);
  bubble.id = id;
  return applyComponentOptions(wrapper, options);
}
function buildDropdown(options, instance) {
  const items = Array.isArray(options.items) ? options.items : [];
  const root = $tag("div", { class: "prestige-dropdown" });
  const trigger = options.trigger ?? createBtn(options.label ?? "Options", { variant: options.variant ?? "ghost", type: "button" });
  const menu = $tag("div", { class: "prestige-dropdown-menu", role: "menu" });
  let open = false;
  let listening = false;
  let stopWatchingDetach = null;
  const onDocumentClick = (event) => {
    if (!root.contains(event.target)) close();
  };
  const close = () => {
    open = false;
    root.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    if (listening) {
      document.removeEventListener("click", onDocumentClick);
      listening = false;
    }
    stopWatchingDetach == null ? void 0 : stopWatchingDetach();
    stopWatchingDetach = null;
  };
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    open = true;
    root.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    if (instance == null ? void 0 : instance._listen) instance._listen(document, "click", onDocumentClick);
    else document.addEventListener("click", onDocumentClick);
    listening = true;
    stopWatchingDetach = selfCleanupOnDetach(root, close);
  };
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", (event) => {
    event.preventDefault();
    toggle();
  });
  items.forEach((item) => {
    if (item.divider) {
      menu.appendChild($tag("div", { class: "prestige-dropdown-divider", role: "separator" }));
      return;
    }
    const choice = $tag("button", { class: `prestige-dropdown-item${item.danger ? " is-danger" : ""}`, type: "button", role: "menuitem" }, [$text(item.label ?? "")]);
    choice.disabled = !!item.disabled;
    choice.addEventListener("click", () => {
      if (typeof item.onClick === "function") item.onClick(item, root);
      close();
    });
    menu.appendChild(choice);
  });
  root.append(trigger, menu);
  root.close = close;
  root.isOpen = () => open;
  return root;
}
function createDropdown(options = {}, instance) {
  return applyComponentOptions(buildDropdown(options, instance), options);
}
function buildStepper(options) {
  const steps = Array.isArray(options.steps) ? options.steps : [];
  let active = Math.max(0, Math.min(steps.length - 1, Number(options.active) || 0));
  const root = $tag("ol", { class: "prestige-stepper" });
  const render = () => {
    while (root.firstChild) root.removeChild(root.firstChild);
    steps.forEach((step, index) => {
      const state = index < active ? "complete" : index === active ? "active" : "pending";
      const item = $tag("li", { class: `prestige-step prestige-step-${state}` });
      item.append(
        $tag("span", { class: "prestige-step-index" }, [$text(index < active ? "✓" : String(index + 1))]),
        $tag("span", { class: "prestige-step-label" }, [$text(typeof step === "string" ? step : step.label ?? "")])
      );
      root.appendChild(item);
    });
  };
  const setActive = (index) => {
    active = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
    render();
    if (typeof options.onChange === "function") options.onChange(active, root);
    return active;
  };
  root.setActive = setActive;
  root.getActive = () => active;
  render();
  return root;
}
function createStepper(options = {}) {
  return applyComponentOptions(buildStepper(options), options);
}
function buildDataTable(options) {
  const columns = Array.isArray(options.columns) ? options.columns : [];
  let rows = Array.isArray(options.rows) ? options.rows.slice() : [];
  const sort = { key: null, direction: 1 };
  const wrapper = $tag("div", { class: "prestige-data-table-wrap" });
  const table = $tag("table", { class: "prestige-data-table" });
  const head = $tag("thead");
  const body = $tag("tbody");
  table.append(head, body);
  wrapper.appendChild(table);
  const valueFor = (row, column) => typeof column.value === "function" ? column.value(row) : row[column.key];
  const render = () => {
    while (head.firstChild) head.removeChild(head.firstChild);
    while (body.firstChild) body.removeChild(body.firstChild);
    const headerRow = $tag("tr");
    columns.forEach((column) => {
      const heading = $tag("th");
      if (column.sortable) {
        const button = $tag("button", { class: "prestige-data-table-sort", type: "button" }, [$text(column.label ?? String(column.key))]);
        if (sort.key === column.key) button.appendChild($text(sort.direction === 1 ? " ↑" : " ↓"));
        button.addEventListener("click", () => {
          sort.direction = sort.key === column.key ? sort.direction === 1 ? -1 : 1 : 1;
          sort.key = String(column.key);
          rows.sort((a, b) => String(valueFor(a, column) ?? "").localeCompare(String(valueFor(b, column) ?? ""), void 0, { numeric: true }) * sort.direction);
          render();
          if (typeof options.onSort === "function") options.onSort(column, sort.direction, rows.slice());
        });
        heading.appendChild(button);
      } else {
        heading.appendChild($text(column.label ?? String(column.key)));
      }
      headerRow.appendChild(heading);
    });
    head.appendChild(headerRow);
    rows.forEach((row, rowIndex) => {
      const tr = $tag("tr");
      columns.forEach((column) => {
        const cell = $tag("td");
        appendContent(cell, valueFor(row, column), options.instance, column.html === true);
        tr.appendChild(cell);
      });
      const onRowClick = options.onRowClick;
      if (typeof onRowClick === "function") {
        tr.tabIndex = 0;
        tr.classList.add("is-clickable");
        tr.addEventListener("click", () => onRowClick(row, rowIndex, tr));
      }
      body.appendChild(tr);
    });
    if (!rows.length) {
      const empty = $tag("tr");
      const cell = $tag("td", { colspan: String(Math.max(1, columns.length)), class: "prestige-data-table-empty" }, [$text(options.emptyMessage ?? "No data available.")]);
      empty.appendChild(cell);
      body.appendChild(empty);
    }
  };
  wrapper.setRows = (nextRows) => {
    rows = Array.isArray(nextRows) ? nextRows.slice() : [];
    render();
  };
  wrapper.getRows = () => rows.slice();
  render();
  return wrapper;
}
function createDataTable(options = {}) {
  return applyComponentOptions(buildDataTable(options), options);
}
function buildCheckbox(options) {
  const label = $tag("label", { class: "prestige-check-control" });
  const input = $tag("input", { type: "checkbox", name: options.name ?? "" });
  input.checked = !!options.checked;
  input.disabled = !!options.disabled;
  const marker = $tag("span", { class: "prestige-check-marker", "aria-hidden": "true" });
  label.append(input, marker, $tag("span", { class: "prestige-check-label" }, [$text(options.label ?? "")]));
  input.addEventListener("change", () => {
    if (typeof options.onChange === "function") options.onChange(input.checked, input);
  });
  label.input = input;
  label.setChecked = (value) => {
    input.checked = !!value;
    return input.checked;
  };
  label.isChecked = () => input.checked;
  return label;
}
function createCheckbox(options = {}) {
  return applyComponentOptions(buildCheckbox(options), options);
}
function buildRadioGroup(options) {
  const items = Array.isArray(options.items) ? options.items : [];
  const group = $tag("div", { class: "prestige-radio-group", role: "radiogroup", "aria-label": options.label ?? "Options" });
  const name = options.name ?? `prestige-radio-${Math.random().toString(36).slice(2)}`;
  let selected = options.value;
  const setValue = (value, notify) => {
    selected = value;
    group.querySelectorAll("input").forEach((input) => {
      input.checked = input.value === String(value);
    });
    if (notify && typeof options.onChange === "function") options.onChange(selected, group);
    return selected;
  };
  items.forEach((item, index) => {
    const itemValue = item.value === void 0 ? String(index) : item.value;
    const control = $tag("label", { class: "prestige-check-control prestige-radio-control" });
    const input = $tag("input", { type: "radio", name, value: String(itemValue) });
    input.checked = selected === void 0 ? !!item.checked : String(selected) === String(itemValue);
    input.disabled = !!item.disabled;
    control.append(
      input,
      $tag("span", { class: "prestige-check-marker", "aria-hidden": "true" }),
      $tag("span", { class: "prestige-check-label" }, [$text(item.label ?? "")])
    );
    input.addEventListener("change", () => {
      if (input.checked) setValue(itemValue, true);
    });
    group.appendChild(control);
    if (input.checked) selected = itemValue;
  });
  group.setValue = (value) => setValue(value, false);
  group.getValue = () => selected;
  return group;
}
function createRadioGroup(options = {}) {
  return applyComponentOptions(buildRadioGroup(options), options);
}
function buildSelect(options) {
  const select = $tag("select", { class: "form-select", name: options.name ?? "", "aria-label": options.ariaLabel ?? options.label ?? "Select" });
  select.disabled = !!options.disabled;
  select.multiple = !!options.multiple;
  (options.options ?? []).forEach((item) => {
    const value = typeof item === "object" ? item.value : item;
    const label = typeof item === "object" ? item.label : item;
    const option = $tag("option", { value: value === void 0 ? "" : String(value) }, [$text(label === void 0 ? "" : String(label))]);
    option.disabled = !!(typeof item === "object" && item.disabled);
    option.selected = options.value !== void 0 && String(options.value) === String(value);
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    if (typeof options.onChange === "function") options.onChange(select.value, select);
  });
  select.setValue = (value) => {
    select.value = value;
    return select.value;
  };
  select.getValue = () => select.value;
  return select;
}
function createSelect(options = {}) {
  return applyComponentOptions(buildSelect(options), options);
}
function buildTextarea(options) {
  const textarea = $tag("textarea", { class: "form-textarea", placeholder: options.placeholder ?? "" });
  if (options.value !== void 0) textarea.value = options.value;
  if (options.required) textarea.required = true;
  if (options.rows) textarea.rows = options.rows;
  textarea.setValue = (value) => {
    textarea.value = value == null ? "" : String(value);
    return textarea.value;
  };
  textarea.getValue = () => textarea.value;
  const onChange = options.onChange;
  if (typeof onChange === "function") {
    textarea.addEventListener("input", () => onChange(textarea.value, textarea));
  }
  return textarea;
}
function createTextarea(options = {}) {
  return applyComponentOptions(buildTextarea(options), options);
}
function buildInputGroup(options) {
  const group = $tag("div", { class: "prestige-input-group" });
  if (options.prefix) appendContent(group, options.prefix);
  const inputOptions = {};
  if (options.placeholder !== void 0) inputOptions.placeholder = options.placeholder;
  if (options.value !== void 0) inputOptions.value = options.value;
  const input = createInput(options.input ?? inputOptions);
  group.appendChild(input);
  if (options.suffix) appendContent(group, options.suffix);
  group.input = input;
  group.setValue = (value) => {
    input.value = value == null ? "" : String(value);
    return input.value;
  };
  group.getValue = () => input.value;
  return group;
}
function createInputGroup(options = {}) {
  return applyComponentOptions(buildInputGroup(options), options);
}
function buildSegmentedControl(options) {
  var _a;
  const items = Array.isArray(options.items) ? options.items : [];
  let value = options.value === void 0 && items.length ? (_a = items[0]) == null ? void 0 : _a.value : options.value;
  const root = $tag("div", { class: "prestige-segmented-control", role: "group", "aria-label": options.label ?? "Segmented control" });
  const setValue = (next, notify) => {
    value = next;
    root.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-selected", button.getAttribute("data-value") === String(value));
    });
    if (notify && typeof options.onChange === "function") options.onChange(value, root);
    return value;
  };
  items.forEach((item, index) => {
    const itemValue = item.value === void 0 ? String(index) : item.value;
    const button = createBtn(item.label ?? String(itemValue), { variant: "ghost", size: "sm", type: "button", disabled: !!item.disabled });
    button.setAttribute("data-value", String(itemValue));
    button.addEventListener("click", () => setValue(itemValue, true));
    root.appendChild(button);
  });
  root.setValue = (next) => setValue(next, false);
  root.getValue = () => value;
  setValue(value === void 0 ? "" : value, false);
  return root;
}
function createSegmentedControl(options = {}) {
  return applyComponentOptions(buildSegmentedControl(options), options);
}
function buildSearchInput(options) {
  const root = $tag("div", { class: "prestige-search-input" });
  const input = $tag("input", { class: "form-input", type: "search", placeholder: options.placeholder ?? "" });
  input.setAttribute("aria-label", options.ariaLabel ?? options.placeholder ?? "Search");
  if (options.value !== void 0) input.value = options.value;
  const clear = createBtn("×", { variant: "ghost", size: "sm", type: "button", className: "prestige-search-clear" });
  const refresh = () => {
    clear.hidden = !input.value;
  };
  input.addEventListener("input", () => {
    refresh();
    if (typeof options.onChange === "function") options.onChange(input.value, input);
  });
  clear.addEventListener("click", () => {
    input.value = "";
    refresh();
    input.focus();
    if (typeof options.onChange === "function") options.onChange("", input);
  });
  root.append(input, clear);
  root.input = input;
  root.setValue = (value) => {
    input.value = value == null ? "" : String(value);
    refresh();
    return input.value;
  };
  root.getValue = () => input.value;
  refresh();
  return root;
}
function createSearchInput(options = {}) {
  return applyComponentOptions(buildSearchInput(options), options);
}
function buildFileInput(options) {
  const root = $tag("label", { class: "prestige-file-input" });
  const input = $tag("input", { type: "file", accept: options.accept ?? "", name: options.name ?? "" });
  input.multiple = !!options.multiple;
  input.hidden = true;
  const label = $tag("span", { class: "btn btn-ghost btn-sm" }, [$text(options.label ?? "Choose file")]);
  const filename = $tag("span", { class: "prestige-file-name" }, [$text(options.placeholder ?? "No file selected")]);
  input.addEventListener("change", () => {
    const files = Array.prototype.slice.call(input.files ?? []);
    filename.textContent = files.length ? files.map((file) => file.name).join(", ") : options.placeholder ?? "No file selected";
    if (typeof options.onChange === "function") options.onChange(files, input);
  });
  root.append(input, label, filename);
  root.input = input;
  root.getFiles = () => Array.prototype.slice.call(input.files ?? []);
  return root;
}
function createFileInput(options = {}) {
  return applyComponentOptions(buildFileInput(options), options);
}
function createToast(options, host) {
  const toastType = options.type ?? "info";
  const timeout = options.duration === void 0 ? 3500 : Number(options.duration);
  let hostEl = options.container ?? (host._query ? host._query("#prestige-toast-container") : null);
  if (!hostEl) {
    hostEl = $tag("div", { id: "prestige-toast-container", class: "prestige-toast-container", "aria-live": "polite", "aria-atomic": "true" });
    if (host._mountNode) host._mountNode(hostEl);
    else document.body.appendChild(hostEl);
  }
  const toast = $tag("div", { class: `prestige-toast prestige-toast-${toastType}`, role: options.role ?? (toastType === "error" ? "alert" : "status") });
  appendContent(toast, options.content === void 0 ? String(options.message ?? "") : options.content, host, options.html === true);
  hostEl.appendChild(toast);
  const close = once((reason) => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
    if (typeof options.onClose === "function") options.onClose(reason, toast);
  });
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  const timer = timeout > 0 ? window.setTimeout(() => close("timeout"), timeout) : null;
  return {
    element: toast,
    close: () => {
      if (timer !== null) window.clearTimeout(timer);
      close("manual");
    }
  };
}
const customModalStack = [];
function isTopmostCustomModal(overlay) {
  var _a;
  while (customModalStack.length && !((_a = customModalStack[customModalStack.length - 1]) == null ? void 0 : _a.isConnected)) customModalStack.pop();
  return customModalStack[customModalStack.length - 1] === overlay;
}
function removeCustomModal(overlay) {
  const index = customModalStack.lastIndexOf(overlay);
  if (index !== -1) customModalStack.splice(index, 1);
}
function createModal(options, host) {
  const buttons = Array.isArray(options.buttons) && options.buttons.length ? options.buttons : [{ label: "Close", variant: "primary", value: true }];
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const overlay = $tag("div", { class: "modal-overlay active prestige-custom-modal-overlay", role: "presentation" });
    const modal = $tag("div", { class: "modal prestige-custom-modal", role: "dialog", "aria-modal": "true", "aria-label": options.ariaLabel ?? options.title ?? "Dialog" });
    if (options.width) modal.style.maxWidth = `${String(options.width)}px`;
    const title = $tag("h3", { class: "prestige-custom-modal-title" }, [$text(options.title ?? "Custom Modal")]);
    const body = $tag("div", { class: "prestige-custom-modal-body" });
    const actions = $tag("div", { class: "modal-actions" });
    modal.append(title, body, actions);
    overlay.appendChild(modal);
    if (host._mountNode) host._mountNode(overlay);
    else document.body.appendChild(overlay);
    appendContent(body, options.body, host, options.trustedHtml === true);
    customModalStack.push(overlay);
    let stopWatchingDetach = () => {
    };
    const settle = once((value, reason) => {
      document.removeEventListener("keydown", onKeydown);
      stopWatchingDetach();
      removeCustomModal(overlay);
      overlay.classList.remove("active");
      resolve(value);
      const finish = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (previousFocus instanceof HTMLElement && typeof previousFocus.focus === "function") previousFocus.focus();
        if (typeof options.onClose === "function") options.onClose(value, reason);
      };
      if (reason === "detach") finish();
      else window.setTimeout(finish, 200);
    });
    const onKeydown = (event) => {
      if (!isTopmostCustomModal(overlay)) return;
      if (event.key === "Escape" && options.closeOnEscape !== false) settle(options.closeValue, "escape");
      else trapFocusWithin(modal, event);
    };
    if (host._listen) host._listen(document, "keydown", onKeydown);
    else document.addEventListener("keydown", onKeydown);
    stopWatchingDetach = selfCleanupOnDetach(overlay, () => settle(options.closeValue, "detach"));
    if (options.closeOnBackdrop !== false) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) settle(options.closeValue, "backdrop");
      });
    }
    buttons.forEach((config) => {
      const button = createBtn(config.label ?? "Close", { variant: config.variant ?? "ghost", type: "button", disabled: !!config.disabled });
      button.addEventListener("click", () => settle(config.value, "action"));
      actions.appendChild(button);
    });
    const focusTarget = modal.querySelector("[autofocus], button, input, select, textarea");
    if (focusTarget) requestAnimationFrame(() => focusTarget.focus());
  });
}
function createDrawer(options, host) {
  const side = options.side === "left" ? "left" : "right";
  const overlay = $tag("div", { class: `prestige-drawer-overlay prestige-drawer-overlay-${side}`, role: "presentation" });
  const drawer = $tag("aside", { class: `prestige-drawer prestige-drawer-${side}`, role: "dialog", "aria-modal": "true", "aria-label": options.ariaLabel ?? options.title ?? "Details" });
  const header = $tag("div", { class: "prestige-drawer-header" });
  const heading = $tag("h3", {}, [$text(options.title ?? "Details")]);
  const closeButton = createBtn("×", { variant: "ghost", size: "sm", type: "button", className: "prestige-drawer-close" });
  const body = $tag("div", { class: "prestige-drawer-body" });
  drawer.style.width = `${String(options.width || 380)}px`;
  header.append(heading, closeButton);
  drawer.append(header, body);
  overlay.appendChild(drawer);
  if (host._mountNode) host._mountNode(overlay);
  else document.body.appendChild(overlay);
  appendContent(body, options.content, host, options.trustedHtml === true);
  let stopWatchingDetach = () => {
  };
  const onKeydown = (event) => {
    if (event.key === "Escape" && options.closeOnEscape !== false) close("escape");
    else trapFocusWithin(drawer, event);
  };
  const close = once((reason) => {
    document.removeEventListener("keydown", onKeydown);
    stopWatchingDetach();
    overlay.classList.remove("is-open");
    const finish = () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (typeof options.onClose === "function") options.onClose(reason);
    };
    if (reason === "detach") finish();
    else window.setTimeout(finish, 300);
  });
  closeButton.addEventListener("click", () => close("button"));
  if (options.closeOnBackdrop !== false) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close("backdrop");
    });
  }
  if (host._listen) host._listen(document, "keydown", onKeydown);
  else document.addEventListener("keydown", onKeydown);
  stopWatchingDetach = selfCleanupOnDetach(overlay, () => close("detach"));
  requestAnimationFrame(() => overlay.classList.add("is-open"));
  return {
    element: drawer,
    container: body,
    close: () => close("api"),
    isOpen: () => overlay.classList.contains("is-open")
  };
}
defaultRegistry.register("progress", (options) => createProgress(options));
defaultRegistry.register("tabs", (options, instance) => createTabs(void 0, { ...options, ...instance ? { instance } : {} }));
defaultRegistry.register("alert", (options, instance) => createAlert({ ...options, ...instance ? { instance } : {} }));
defaultRegistry.register("switch", (options) => createSwitch(options));
defaultRegistry.register("accordion", (options, instance) => createAccordion({ ...options, ...instance ? { instance } : {} }));
defaultRegistry.register("pagination", (options) => createPagination(options));
defaultRegistry.register("skeleton", (options) => createSkeleton(options));
defaultRegistry.register("emptyState", (options) => createEmptyState(options));
defaultRegistry.register("avatar", (options) => createAvatar(options));
defaultRegistry.register("breadcrumb", (options) => createBreadcrumb(options));
defaultRegistry.register("tooltip", (options) => createTooltip(options));
defaultRegistry.register("dropdown", (options, instance) => createDropdown(options, instance));
defaultRegistry.register("stepper", (options) => createStepper(options));
defaultRegistry.register("dataTable", (options, instance) => createDataTable({ ...options, ...instance ? { instance } : {} }));
defaultRegistry.register("checkbox", (options) => createCheckbox(options));
defaultRegistry.register("radioGroup", (options) => createRadioGroup(options));
defaultRegistry.register("select", (options) => createSelect(options));
defaultRegistry.register("textarea", (options) => createTextarea(options));
defaultRegistry.register("inputGroup", (options) => createInputGroup(options));
defaultRegistry.register("segmentedControl", (options) => createSegmentedControl(options));
defaultRegistry.register("searchInput", (options) => createSearchInput(options));
defaultRegistry.register("fileInput", (options) => createFileInput(options));
defaultRegistry.register("button", (options) => createBtn(options.label ?? "", options));
defaultRegistry.register("card", (options) => createCard(options.title, options.body ?? null, options));
defaultRegistry.register("input", (options) => createInput(options));
defaultRegistry.register("badge", (options) => createBadge(options.label ?? "", options.variant));
defaultRegistry.register("table", (options) => createTable(options.headers, options.rows));
const DIALOG_DEFAULT_ICONS = {
  info: "info",
  warning: "warning",
  danger: "danger",
  alert: "info",
  confirm: "question",
  prompt: "question",
  save: "save",
  open: "open"
};
const CANCEL_TYPES = /* @__PURE__ */ new Set(["confirm", "prompt", "save", "open"]);
const modalStack = [];
function isTopmostModal(modal) {
  var _a;
  while (modalStack.length && !((_a = modalStack[modalStack.length - 1]) == null ? void 0 : _a.isConnected)) modalStack.pop();
  return modalStack[modalStack.length - 1] === modal;
}
function removeModal(modal) {
  const index = modalStack.lastIndexOf(modal);
  if (index !== -1) modalStack.splice(index, 1);
}
function cancelResult(type) {
  if (type === "confirm") return false;
  if (type === "prompt" || type === "open") return null;
  if (type === "save") return { filename: null, confirmed: false };
  return true;
}
function unmount(host, node) {
  var _a;
  if (host._unmountNode) host._unmountNode(node);
  else (_a = node == null ? void 0 : node.parentNode) == null ? void 0 : _a.removeChild(node);
}
function normalizeStringOrOptions(value) {
  return typeof value === "string" ? { message: value } : value;
}
function dialogShow(host, opts = {}) {
  const options = {
    confirmText: "OK",
    cancelText: "Cancel",
    defaultValue: "",
    placeholder: "",
    noOverlay: false,
    danger: false,
    width: 420,
    multiple: false,
    accept: "",
    ...opts
  };
  const type = options.type ?? "info";
  const icon = options.icon ?? DIALOG_DEFAULT_ICONS[type] ?? "info";
  const hasCancel = CANCEL_TYPES.has(type);
  return new Promise((resolve) => {
    var _a;
    const previousFocus = document.activeElement;
    let overlay = null;
    if (!options.noOverlay) {
      overlay = $tag("div", { class: "modal-overlay" });
      const bg = $tag("div", {
        style: {
          position: "absolute",
          inset: "0",
          background: "var(--prestige-glass-65)",
          backdropFilter: "blur(12px)"
        }
      });
      Object.assign(bg.style, { WebkitBackdropFilter: "blur(12px)" });
      overlay.appendChild(bg);
      host._mountNode(overlay);
      requestAnimationFrame(() => overlay == null ? void 0 : overlay.classList.add("active"));
    }
    const dlg = $tag("div", { class: "prestige-dialog", "data-type": type, role: "dialog", "aria-modal": "true", "aria-label": options.title ?? "Dialog", tabindex: "-1" });
    dlg.style.width = `${Math.min(options.width, window.innerWidth - 40)}px`;
    dlg.style.maxHeight = `${window.innerHeight - 80}px`;
    const header = $tag("div", { class: "prestige-dialog-header" });
    const iconEl = $tag("div", { class: "prestige-dialog-icon" });
    const svg = dialogIcon(icon);
    iconEl.appendChild(svg.cloneNode(true));
    header.appendChild(iconEl);
    header.appendChild($tag("h3", { class: "prestige-dialog-title" }, [$text(options.title ?? "")]));
    dlg.appendChild(header);
    const body = $tag("div", { class: "prestige-dialog-body" });
    body.appendChild($tag("p", { class: "prestige-dialog-message" }, [$text(options.message ?? "")]));
    let inputEl = null;
    if (type === "prompt") {
      inputEl = $tag("input", {
        class: "prestige-dialog-input",
        type: "text",
        placeholder: options.placeholder,
        "aria-label": ((_a = options.title) == null ? void 0 : _a.trim()) || "Input"
      });
      inputEl.value = options.defaultValue;
      body.appendChild(inputEl);
    } else if (type === "save") {
      inputEl = $tag("input", { class: "prestige-dialog-input", type: "text", placeholder: "filename.ext", "aria-label": "Filename" });
      inputEl.value = options.defaultValue || "untitled.txt";
      body.appendChild(inputEl);
    } else if (type === "open") {
      inputEl = $tag("input", { class: "prestige-dialog-input", type: "file", "aria-label": options.multiple ? "Files" : "File" });
      if (options.multiple) inputEl.multiple = true;
      if (options.accept) inputEl.accept = options.accept;
      body.appendChild(inputEl);
    }
    dlg.appendChild(body);
    const footer = $tag("div", { class: "prestige-dialog-footer" });
    let settled = false;
    let detachObserver = null;
    const dismiss = (result) => {
      if (settled) return;
      settled = true;
      detachObserver == null ? void 0 : detachObserver.disconnect();
      document.removeEventListener("keydown", keyHandler);
      removeModal(dlg);
      if (overlay) {
        overlay.classList.remove("active");
        window.setTimeout(() => unmount(host, overlay), 200);
      }
      if (!overlay) unmount(host, dlg);
      else dlg.remove();
      if (previousFocus instanceof HTMLElement && typeof previousFocus.focus === "function") previousFocus.focus();
      resolve(result);
    };
    if (hasCancel) {
      const btnCancel = createBtn(options.cancelText, { variant: "ghost" });
      btnCancel.classList.add("prestige-dialog-btn");
      btnCancel.addEventListener("click", () => {
        if (type === "confirm") dismiss(false);
        else if (type === "prompt") dismiss(null);
        else if (type === "save") dismiss({ filename: null, confirmed: false });
        else if (type === "open") dismiss(null);
      });
      footer.appendChild(btnCancel);
    }
    const btnConfirm = createBtn(options.confirmText, { variant: options.danger ? "danger" : "primary" });
    btnConfirm.classList.add("prestige-dialog-btn", "prestige-dialog-btn-primary");
    btnConfirm.addEventListener("click", () => {
      switch (type) {
        case "info":
        case "warning":
        case "danger":
        case "alert":
          dismiss(true);
          break;
        case "confirm":
          dismiss(true);
          break;
        case "prompt":
          dismiss((inputEl == null ? void 0 : inputEl.value) ?? "");
          break;
        case "save":
          dismiss({ filename: (inputEl == null ? void 0 : inputEl.value) ?? "", confirmed: true });
          break;
        case "open": {
          const files = (inputEl == null ? void 0 : inputEl.files) ?? null;
          dismiss(files && files.length ? files : null);
          break;
        }
      }
    });
    footer.appendChild(btnConfirm);
    dlg.appendChild(footer);
    if (inputEl && type !== "open") {
      requestAnimationFrame(() => {
        inputEl == null ? void 0 : inputEl.focus();
        inputEl == null ? void 0 : inputEl.select();
      });
    } else {
      requestAnimationFrame(() => btnConfirm.focus());
    }
    const keyHandler = (event) => {
      var _a2;
      if (!isTopmostModal(dlg)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        if (hasCancel) {
          const cancelBtn = (_a2 = btnConfirm.parentElement) == null ? void 0 : _a2.querySelector(".btn:not(.prestige-dialog-btn-primary)");
          cancelBtn == null ? void 0 : cancelBtn.click();
        } else {
          dismiss(true);
        }
      } else if (event.key === "Enter" && (!inputEl || inputEl.type !== "file")) {
        event.preventDefault();
        btnConfirm.click();
      } else {
        trapFocusWithin(dlg, event);
      }
    };
    modalStack.push(dlg);
    host._listen(document, "keydown", keyHandler);
    if (overlay) overlay.appendChild(dlg);
    else host._mountNode(dlg);
    if (typeof MutationObserver !== "undefined") {
      detachObserver = new MutationObserver(() => {
        if (!dlg.isConnected) dismiss(cancelResult(type));
      });
      detachObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
}
function dialogInfo(host, o = {}) {
  return dialogShow(host, { type: "info", title: "Info", confirmText: "OK", ...normalizeStringOrOptions(o) });
}
function dialogWarning(host, o = {}) {
  return dialogShow(host, { type: "warning", title: "Warning", confirmText: "OK", ...normalizeStringOrOptions(o) });
}
function dialogDanger(host, o = {}) {
  return dialogShow(host, { type: "danger", title: "Error", confirmText: "OK", danger: true, ...normalizeStringOrOptions(o) });
}
function dialogAlert(host, o = {}) {
  return dialogShow(host, { type: "alert", title: "Alert", confirmText: "OK", ...normalizeStringOrOptions(o) });
}
function dialogConfirm(host, o = {}) {
  return dialogShow(host, { type: "confirm", title: "Confirm", confirmText: "Confirm", cancelText: "Cancel", ...normalizeStringOrOptions(o) });
}
function dialogPrompt(host, o = {}) {
  return dialogShow(host, { type: "prompt", title: "Input", confirmText: "OK", cancelText: "Cancel", defaultValue: "", placeholder: "", ...normalizeStringOrOptions(o) });
}
function dialogSave(host, o = {}) {
  return dialogShow(host, { type: "save", title: "Save", confirmText: "Save", cancelText: "Cancel", defaultValue: "untitled.txt", ...normalizeStringOrOptions(o) });
}
function dialogOpen(host, o = {}) {
  return dialogShow(host, { type: "open", title: "Open", confirmText: "Open", cancelText: "Cancel", ...normalizeStringOrOptions(o) });
}
const SECURITY_PLANE_Z_INDEX = "999999";
function isObscuredByInertOverlay(target, x, y) {
  const protectedOverlay = target.closest(".prestige-security-overlay");
  let candidates = [];
  try {
    candidates = document.querySelectorAll("*");
  } catch {
    return true;
  }
  for (const el of candidates) {
    if (el === target || target.contains(el) || el.contains(target)) continue;
    if (protectedOverlay == null ? void 0 : protectedOverlay.contains(el)) continue;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
      const style = window.getComputedStyle(el);
      if (style.pointerEvents !== "none") continue;
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") continue;
      if (style.opacity !== "" && Number(style.opacity) <= 0) continue;
      return true;
    } catch {
      return true;
    }
  }
  return false;
}
function isElementVisuallySafe(element) {
  const style = window.getComputedStyle(element);
  if (style.visibility === "hidden" || style.visibility === "collapse") return false;
  if (style.opacity !== "" && Number(style.opacity) <= 0) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const points = [
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    { x: rect.left + 2, y: rect.top + 2 },
    { x: rect.right - 2, y: rect.top + 2 },
    { x: rect.left + 2, y: rect.bottom - 2 },
    { x: rect.right - 2, y: rect.bottom - 2 }
  ];
  return points.every((pt) => {
    const topmost = document.elementFromPoint(pt.x, pt.y);
    const ownChrome = topmost === element || topmost !== null && (element.contains(topmost) || topmost.contains(element));
    if (!ownChrome) return false;
    return !isObscuredByInertOverlay(element, pt.x, pt.y);
  });
}
function web3TransactionGuard(host, txDetails) {
  return new Promise((resolve) => {
    var _a, _b;
    const previousFocus = document.activeElement;
    const expectedDisplay = Object.freeze({
      title: `Confirm ${String(txDetails.action)}`,
      to: String(txDetails.to),
      value: `${txDetails.value.toString()} wei`,
      data: txDetails.data ? String(txDetails.data) : null,
      chain: String(txDetails.chainId)
    });
    const overlay = $tag("div", {
      class: "prestige-web3-guard prestige-security-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": expectedDisplay.title
    });
    overlay.style.zIndex = SECURITY_PLANE_Z_INDEX;
    const card = $tag("div", { class: "prestige-web3-guard-card" });
    const titleEl = $tag("h3", { class: "prestige-web3-guard-title" }, [$text(expectedDisplay.title)]);
    card.appendChild(titleEl);
    const details = $tag("dl", { class: "prestige-web3-guard-details" });
    details.appendChild($tag("dt", {}, [$text("To")]));
    const toEl = $tag("dd", { class: "prestige-web3-guard-mono" }, [$text(expectedDisplay.to)]);
    details.appendChild(toEl);
    details.appendChild($tag("dt", {}, [$text("Value")]));
    const valueEl = $tag("dd", { class: "prestige-web3-guard-mono" }, [$text(expectedDisplay.value)]);
    details.appendChild(valueEl);
    let dataEl = null;
    if (expectedDisplay.data) {
      details.appendChild($tag("dt", {}, [$text("Data")]));
      dataEl = $tag("dd", { class: "prestige-web3-guard-mono" }, [$text(expectedDisplay.data)]);
      details.appendChild(dataEl);
    }
    details.appendChild($tag("dt", {}, [$text("Chain")]));
    const chainEl = $tag("dd", {}, [$text(expectedDisplay.chain)]);
    details.appendChild(chainEl);
    card.appendChild(details);
    const displayedValues = [
      [titleEl, expectedDisplay.title],
      [toEl, expectedDisplay.to],
      [valueEl, expectedDisplay.value],
      ...dataEl && expectedDisplay.data ? [[dataEl, expectedDisplay.data]] : [],
      [chainEl, expectedDisplay.chain]
    ];
    const actions = $tag("div", { class: "prestige-web3-guard-actions" });
    const rejectBtn = createBtn("Reject", { variant: "ghost", type: "button", className: "prestige-web3-guard-reject" });
    const confirmBtn = createBtn("Confirm", { variant: "danger", type: "button", className: "prestige-web3-guard-confirm" });
    actions.append(rejectBtn, confirmBtn);
    card.appendChild(actions);
    overlay.appendChild(card);
    host._mountNode(overlay);
    let settled = false;
    let observer = null;
    let detachObserver = null;
    const clickjackCheck = ((_b = (_a = host.config) == null ? void 0 : _a.security) == null ? void 0 : _b.clickjackCheck) !== false;
    const onKeydown = (event) => {
      if (!isTopmostModal(overlay)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        settle(false);
        return;
      }
      trapFocusWithin(card, event);
    };
    document.addEventListener("keydown", onKeydown);
    const settle = (accepted) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKeydown);
      removeModal(overlay);
      if (observer) observer.disconnect();
      detachObserver == null ? void 0 : detachObserver.disconnect();
      unmount(host, overlay);
      if (previousFocus instanceof HTMLElement && typeof previousFocus.focus === "function") previousFocus.focus();
      resolve(accepted);
    };
    rejectBtn.addEventListener("click", () => settle(false));
    confirmBtn.addEventListener("click", () => {
      const hasPendingTamper = ((observer == null ? void 0 : observer.takeRecords().length) ?? 0) > 0;
      const displayIsIntact = displayedValues.every(([element, expected]) => overlay.contains(element) && element.textContent === expected);
      const visuallySafe = !clickjackCheck || isElementVisuallySafe(confirmBtn);
      settle(!hasPendingTamper && displayIsIntact && visuallySafe);
    });
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => settle(false));
      observer.observe(overlay, { childList: true, subtree: true, attributes: true, characterData: true });
      observer.observe(document.head, { childList: true, subtree: true });
      detachObserver = new MutationObserver(() => {
        if (!overlay.isConnected) settle(false);
      });
      detachObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    modalStack.push(overlay);
  });
}
const FEATURE_DEFAULTS = {
  gpuAcceleration: true,
  animations: true,
  particleExplosion: true,
  dock: true,
  topdock: true,
  clock: true,
  session: true,
  search: true,
  windowSwitcher: true,
  dockDragDrop: true,
  expose: true,
  xray: true,
  snap: true,
  grid: false,
  lockScreen: false,
  tiling: false,
  minimizedPreview: true,
  toastCenter: true
};
const PLACEMENTS = ["dock", "topdock", "hidden", "both"];
const _Prestige = class _Prestige {
  constructor(config = {}) {
    __publicField(this, "config");
    __publicField(this, "user");
    __publicField(this, "root");
    __publicField(this, "_ownedRoot");
    __publicField(this, "_ownedNodes", /* @__PURE__ */ new Set());
    __publicField(this, "_listenerController", null);
    __publicField(this, "_destroyed", false);
    __publicField(this, "_initialized", false);
    __publicField(this, "_animationsEnabled", true);
    __publicField(this, "_listeners", /* @__PURE__ */ Object.create(null));
    __publicField(this, "_gpuAcceleration", FEATURE_DEFAULTS.gpuAcceleration);
    __publicField(this, "_animations", FEATURE_DEFAULTS.animations);
    __publicField(this, "_particleExplosion", FEATURE_DEFAULTS.particleExplosion);
    __publicField(this, "_dock", FEATURE_DEFAULTS.dock);
    __publicField(this, "_topdock", FEATURE_DEFAULTS.topdock);
    __publicField(this, "_clock", FEATURE_DEFAULTS.clock);
    __publicField(this, "_session", FEATURE_DEFAULTS.session);
    __publicField(this, "_search", FEATURE_DEFAULTS.search);
    __publicField(this, "_windowSwitcher", FEATURE_DEFAULTS.windowSwitcher);
    __publicField(this, "_dockDragDrop", FEATURE_DEFAULTS.dockDragDrop);
    __publicField(this, "_expose", FEATURE_DEFAULTS.expose);
    __publicField(this, "_xray", FEATURE_DEFAULTS.xray);
    __publicField(this, "_snap", FEATURE_DEFAULTS.snap);
    __publicField(this, "_grid", FEATURE_DEFAULTS.grid);
    __publicField(this, "_lockScreen", FEATURE_DEFAULTS.lockScreen);
    __publicField(this, "_tiling", FEATURE_DEFAULTS.tiling);
    __publicField(this, "_minimizedPreview", FEATURE_DEFAULTS.minimizedPreview);
    __publicField(this, "_toastCenter", FEATURE_DEFAULTS.toastCenter);
    __publicField(this, "_wm");
    __publicField(this, "_dragWasDrag", false);
    __publicField(this, "_switcherEl", null);
    __publicField(this, "_switcherActive", false);
    __publicField(this, "_switcherIndex", -1);
    __publicField(this, "_searchEl", null);
    __publicField(this, "_searchEscListener", null);
    __publicField(this, "_xrayActive", false);
    __publicField(this, "_exposeActive", false);
    __publicField(this, "_exposeSavedRects", []);
    __publicField(this, "_hotCornerCooldown", false);
    __publicField(this, "_contentCache", /* @__PURE__ */ Object.create(null));
    __publicField(this, "_clockInterval", null);
    __publicField(this, "_lockActive", false);
    __publicField(this, "_lockInterval", null);
    __publicField(this, "_toasts", null);
    __publicField(this, "_tileActive", false);
    __publicField(this, "_tileSaved", []);
    __publicField(this, "_previewWin", null);
    __publicField(this, "_previewSection", null);
    __publicField(this, "_previewOrigin", null);
    __publicField(this, "_store", null);
    __publicField(this, "_ctxMenuEl", null);
    __publicField(this, "_ctxMenuHandler", null);
    __publicField(this, "_ctxMenuKeyHandler", null);
    __publicField(this, "_ctxMenuPreviousFocus", null);
    __publicField(this, "_DOCK_ORDER_KEY", "prestige_dock_order");
    __publicField(this, "_TOPDOCK_ORDER_KEY", "prestige_topdock_order");
    var _a;
    const apps = /* @__PURE__ */ Object.create(null);
    for (const appId of Object.keys(config.apps ?? {})) {
      assertSafeAppId(appId);
      const manifest = (_a = config.apps) == null ? void 0 : _a[appId];
      if (manifest) apps[appId] = Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), manifest));
    }
    const security = Object.prototype.hasOwnProperty.call(config, "security") ? this._validateSecurityConfig(config.security) : void 0;
    const safeConfig = Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), config, { apps, security }));
    this.config = safeConfig;
    this.user = safeConfig;
    this.root = safeConfig.container ?? document;
    if (!this.root || typeof this.root.querySelector !== "function") {
      throw new Error("Prestige config.container must be a Document or Element.");
    }
    this._ownedRoot = safeConfig.container ?? null;
    for (const key of Object.keys(FEATURE_DEFAULTS)) {
      const value = safeConfig[key];
      this[`_${key}`] = value === void 0 ? FEATURE_DEFAULTS[key] : value;
    }
    this._wm = new WindowManager(this);
  }
  /**
   * Validate the `security` options block at construction. Enforces the
   * "no fake crypto" rule (encryption requires an app-owned, persistable key)
   * and emits a loud `console.warn` for any option that weakens a secure
   * default.
   */
  _validateSecurityConfig(source) {
    if (!source) return void 0;
    const KNOWN_KEYS = /* @__PURE__ */ new Set(["sanitizer", "storage", "storageKeyProvider", "postTargetOrigin", "clickjackCheck"]);
    const sec = {};
    for (const key of Object.keys(source)) {
      if (KNOWN_KEYS.has(key)) sec[key] = source[key];
      else console.warn(`[Prestige] Unknown security option "${key}" ignored.`);
    }
    const validated = sec;
    if (validated.clickjackCheck === false) {
      console.warn("[Prestige] security.clickjackCheck is disabled — the web3 transaction guard will not verify visual safety before confirming.");
    }
    if (validated.storage === "encrypted" && !validated.storageKeyProvider) {
      throw new Error('Prestige refuses security.storage="encrypted" without a security.storageKeyProvider. The library never generates a key that would be lost on reload — provide an app-owned key (e.g. PBKDF2-derived).');
    }
    if (validated.storageKeyProvider && validated.storage !== "encrypted") {
      console.warn('[Prestige] security.storageKeyProvider is ignored unless security.storage is "encrypted".');
    }
    return Object.freeze(sec);
  }
  /* ── Host surface (used by WindowManager / Dialogs) ───────── */
  get animationsEnabled() {
    return this._animationsEnabled;
  }
  _query(selector) {
    return this.root.querySelector(selector);
  }
  _queryAll(selector) {
    return this.root.querySelectorAll(selector);
  }
  _listen(target, type, listener, options) {
    if (!this._listenerController) this._listenerController = new AbortController();
    let settings;
    if (typeof options === "boolean") {
      settings = { capture: options, signal: this._listenerController.signal };
    } else {
      settings = Object.assign({}, options ?? {}, { signal: this._listenerController.signal });
    }
    target.addEventListener(type, listener, settings);
  }
  _mountNode(node) {
    const doc = this.root instanceof Document ? this.root : null;
    const mount = this._ownedRoot ?? (doc ? doc.body : document.body);
    mount.appendChild(node);
    this._ownedNodes.add(node);
    return node;
  }
  _unmountNode(node) {
    if (!node) return;
    if (node.parentNode) node.parentNode.removeChild(node);
    this._ownedNodes.delete(node);
  }
  /* ── Event emitter ────────────────────────────────────────── */
  on(event, fn) {
    var _a;
    ((_a = this._listeners)[event] ?? (_a[event] = [])).push(fn);
    return this;
  }
  off(event, fn) {
    const list = this._listeners[event];
    if (!list) return this;
    if (!fn) {
      delete this._listeners[event];
      return this;
    }
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === fn) list.splice(i, 1);
    }
    return this;
  }
  _emit(event, payload) {
    const list = this._listeners[event];
    if (!list) return;
    for (const fn of list) {
      try {
        fn(payload);
      } catch (_e) {
      }
    }
  }
  /* ── Lifecycle ────────────────────────────────────────────── */
  init() {
    if (this._destroyed) throw new Error("Cannot initialize a destroyed Prestige instance. Create a new instance instead.");
    if (this._initialized) return this;
    this._initialized = true;
    const html = document.documentElement;
    this._animationsEnabled = html.getAttribute("data-animations") !== "false" && this._animations;
    if (!this._gpuAcceleration) html.setAttribute("data-gpu", "false");
    if (this._grid) this._createGrid();
    this._applyInitialPlacements();
    if (this._dock) this.bindDock();
    if (this._topdock) this.bindTopDock();
    if (this._dock) this._setDataColors();
    if (this._dockDragDrop) {
      this._restoreDockOrder();
      this._restoreTopdockOrder();
      this._initDockDragDrop();
    }
    if (this._dock) this.bindDockScroll();
    this.bindCanvasClick();
    if (this._search || this._windowSwitcher || this._xray || this._expose || this._lockScreen || this._tiling || this._snap) this.bindKeyboard();
    if (this._clock) this.startClock();
    if (this._toastCenter) {
      const mbRight = this._query(".menubar-right");
      if (mbRight && !this._query("#toast-bell")) {
        const bell = $tag("button", { id: "toast-bell", class: "menubar-btn", title: "Notifications" }, [$tag("i", { "data-prestige-icon": "bell" })]);
        bell.addEventListener("click", () => this._toggleToastCenter());
        mbRight.insertBefore(bell, mbRight.firstChild);
        renderIcons();
      }
    }
    if (this._expose) {
      this._listen(document, "mousemove", ((e) => {
        this.checkHotCorners(e);
      }));
    }
    if (this._dock) {
      const dockEl = this._query("#dock");
      this._listen(window, "resize", (() => {
        this.updateDockScrollButtons();
      }));
      this.updateDockScrollButtons();
      if (dockEl && this._minimizedPreview) {
        this._listen(dockEl, "mouseover", ((e) => {
          const target = e.target;
          const btn = target ? target.closest(".dock-item.has-minimized") : null;
          if (btn) this._showMinimizedPreview(btn, btn.getAttribute("data-section") ?? "");
        }), true);
        this._listen(dockEl, "mouseleave", (() => {
          this._hideMinimizedPreview();
        }));
      }
    }
    if (this._topdock) {
      const topdock = this._query("#topdock");
      if (topdock) {
        this._listen(topdock, "mouseover", ((e) => {
          const target = e.target;
          const btn = target ? target.closest(".menubar-dock-item.has-minimized") : null;
          if (btn) this._showMinimizedPreview(btn, btn.getAttribute("data-section") ?? "");
        }), true);
        this._listen(topdock, "mouseleave", (() => {
          this._hideMinimizedPreview();
        }));
      }
    }
    this._restoreSession();
    renderIcons(this.root);
    return this;
  }
  _createGrid() {
    if (this._query(".desktop-grid")) return;
    const grid = document.createElement("div");
    grid.className = "desktop-grid";
    (this._ownedRoot ?? document.body).appendChild(grid);
  }
  _setDataColors() {
    this._queryAll(".dock-item[data-color]").forEach((el) => {
      const c = el.getAttribute("data-color");
      if (c && el instanceof HTMLElement) {
        el.style.setProperty("--c1", c);
        el.style.setProperty("--c2", c);
      }
    });
  }
  /* ── Dock bindings ────────────────────────────────────────── */
  bindDock() {
    const dock = this._query("#dock");
    if (!dock) return;
    this._listen(dock, "click", ((e) => {
      if (this._dragWasDrag) {
        this._dragWasDrag = false;
        return;
      }
      const target = e.target;
      const btn = target ? target.closest(".dock-item") : null;
      if (!btn) return;
      e.preventDefault();
      const section = btn.getAttribute("data-section");
      const icon = btn.getAttribute("data-icon");
      const label = btn.getAttribute("data-label") ?? section;
      if (!section) return;
      this.openWindow(section, icon ?? void 0, label ?? void 0, btn);
    }));
    this._listen(dock, "dblclick", ((e) => {
      const target = e.target;
      const btn = target ? target.closest(".dock-item") : null;
      if (!btn) return;
      e.preventDefault();
      const section = btn.getAttribute("data-section");
      if (!section) return;
      const rec = this._wm.getOpenWindow(section);
      if (rec && rec.el && rec.el.isConnected) {
        this.closeWindow(rec.el);
        btn.classList.remove("has-minimized");
      }
    }));
    this._listen(dock, "contextmenu", ((e) => {
      const target = e.target;
      const btn = target ? target.closest(".dock-item") : null;
      if (!btn) return;
      e.preventDefault();
      this._showDockPlacementMenu(btn, e.clientX, e.clientY);
    }));
  }
  bindTopDock() {
    const topdock = this._query("#topdock");
    if (!topdock) return;
    this._listen(topdock, "click", ((e) => {
      const target = e.target;
      const btn = target ? target.closest(".menubar-dock-item") : null;
      if (!btn) return;
      e.preventDefault();
      const section = btn.getAttribute("data-section");
      const icon = btn.getAttribute("data-icon");
      const label = btn.getAttribute("data-label") ?? section;
      if (!section) return;
      this.openWindow(section, icon ?? void 0, label ?? void 0, btn);
    }));
    this._listen(topdock, "dblclick", ((e) => {
      const target = e.target;
      const btn = target ? target.closest(".menubar-dock-item") : null;
      if (!btn) return;
      e.preventDefault();
      const section = btn.getAttribute("data-section");
      if (!section) return;
      const rec = this._wm.getOpenWindow(section);
      if (rec && rec.el && rec.el.isConnected) {
        this.closeWindow(rec.el);
        btn.classList.remove("has-minimized");
      }
    }));
    this._listen(topdock, "contextmenu", ((e) => {
      const target = e.target;
      const btn = target ? target.closest(".menubar-dock-item") : null;
      if (!btn) return;
      e.preventDefault();
      this._showDockPlacementMenu(btn, e.clientX, e.clientY);
    }));
  }
  _saveDockOrder() {
    const order = [];
    this._queryAll("#dock .dock-item").forEach((btn) => {
      const s = btn.getAttribute("data-section");
      if (s) order.push(s);
    });
    try {
      localStorage.setItem(this._DOCK_ORDER_KEY, JSON.stringify(order));
    } catch (error) {
      this._emit("storage:error", { key: this._DOCK_ORDER_KEY, error });
    }
  }
  _saveTopdockOrder() {
    const order = [];
    this._queryAll("#topdock .menubar-dock-item").forEach((btn) => {
      const s = btn.getAttribute("data-section");
      if (s) order.push(s);
    });
    try {
      localStorage.setItem(this._TOPDOCK_ORDER_KEY, JSON.stringify(order));
    } catch (error) {
      this._emit("storage:error", { key: this._TOPDOCK_ORDER_KEY, error });
    }
  }
  _restoreOrder(key, selector, groupSelector) {
    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (_e) {
      return;
    }
    if (!raw) return;
    let order;
    try {
      order = JSON.parse(raw);
    } catch (_e) {
      return;
    }
    if (!Array.isArray(order) || order.length === 0) return;
    const group = this._query(groupSelector);
    if (!group) return;
    const map = /* @__PURE__ */ Object.create(null);
    group.querySelectorAll(selector).forEach((btn) => {
      const s = btn.getAttribute("data-section");
      if (s) map[s] = btn;
    });
    const frag = document.createDocumentFragment();
    const seen = /* @__PURE__ */ Object.create(null);
    for (const s of order) {
      const btn = map[s];
      if (btn && !seen[s]) {
        frag.appendChild(btn);
        seen[s] = true;
      }
    }
    group.querySelectorAll(selector).forEach((btn) => {
      const s = btn.getAttribute("data-section");
      if (s && !seen[s]) frag.appendChild(btn);
    });
    while (group.firstChild) group.removeChild(group.firstChild);
    group.appendChild(frag);
  }
  _restoreDockOrder() {
    this._restoreOrder(this._DOCK_ORDER_KEY, ".dock-item", "#dock .dock-group");
  }
  _restoreTopdockOrder() {
    this._restoreOrder(this._TOPDOCK_ORDER_KEY, ".menubar-dock-item", "#topdock");
  }
  _initDockDragDrop() {
    const dock = this._query("#dock");
    const topdock = this._query("#topdock");
    const menubar = this._query(".menubar");
    if (!dock) return;
    let dragItem = null;
    let dragSource = null;
    let dragActive = false;
    let startX = 0;
    let startY = 0;
    let dragGhost = null;
    const getDropZone = (cx, cy) => {
      const t = 30;
      if (dock) {
        const dr = dock.getBoundingClientRect();
        if (cy >= dr.top - t && cy <= dr.bottom + t && cx >= dr.left - t && cx <= dr.right + t) return "dock";
      }
      if (menubar) {
        const mr = menubar.getBoundingClientRect();
        if (cy >= mr.top && cy <= mr.bottom + t) return "topdock";
      }
      return null;
    };
    const setZoneHighlight = (zone) => {
      dock == null ? void 0 : dock.classList.toggle("is-drop-target", zone === "dock");
      menubar == null ? void 0 : menubar.classList.toggle("is-drop-target", zone === "topdock");
    };
    const getDropTarget = (cx, container) => {
      const items = container.querySelectorAll(".dock-item");
      for (const item of items) {
        if (item === dragItem) continue;
        const r = item.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right) {
          return { el: item, before: cx < r.left + r.width / 2 };
        }
      }
      return null;
    };
    const getTopdockDropTarget = (cx) => {
      if (!topdock) return null;
      const items = topdock.querySelectorAll(".menubar-dock-item");
      for (const item of items) {
        if (item === dragItem) continue;
        const r = item.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right) {
          return { el: item, before: cx < r.left + r.width / 2 };
        }
      }
      return null;
    };
    const clearDragStyles = () => {
      dock == null ? void 0 : dock.querySelectorAll(".dock-item").forEach((el) => {
        el.classList.remove("is-dragging", "drag-over", "drag-over-left", "drag-over-right");
      });
      dock == null ? void 0 : dock.classList.remove("is-dragging-active", "is-drop-target");
      menubar == null ? void 0 : menubar.classList.remove("is-drop-target");
      topdock == null ? void 0 : topdock.querySelectorAll(".menubar-dock-item").forEach((el) => {
        el.classList.remove("is-dragging", "drag-over");
      });
    };
    this._listen(document, "mousedown", ((e) => {
      if (e.button !== 0) return;
      const target = e.target;
      const btn = target ? target.closest(".dock-item, .menubar-dock-item") : null;
      if (!btn) return;
      dragItem = btn;
      dragActive = false;
      startX = e.clientX;
      startY = e.clientY;
      dragSource = btn.classList.contains("dock-item") ? "dock" : "topdock";
    }));
    this._listen(document, "mousemove", ((e) => {
      if (!dragItem) return;
      if (!dragActive) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (dx * dx + dy * dy < 25) return;
        dragActive = true;
        dragItem.classList.add("is-dragging");
        dragGhost = this._createDragGhost(dragItem);
        if (dock && dragSource === "dock") dock.classList.add("is-dragging-active");
      }
      if (dragGhost) {
        dragGhost.style.left = `${e.clientX}px`;
        dragGhost.style.top = `${e.clientY}px`;
      }
      const zone = getDropZone(e.clientX, e.clientY);
      setZoneHighlight(zone);
      dock == null ? void 0 : dock.querySelectorAll(".dock-item").forEach((el) => el.classList.remove("drag-over", "drag-over-left", "drag-over-right"));
      topdock == null ? void 0 : topdock.querySelectorAll(".menubar-dock-item").forEach((el) => el.classList.remove("drag-over"));
      if (dragSource === "dock" && zone === "dock") {
        const t = getDropTarget(e.clientX, dock);
        if (t && t.el !== dragItem) {
          t.el.classList.add("drag-over");
          t.el.classList.add(t.before ? "drag-over-left" : "drag-over-right");
        }
      } else if (dragSource === "topdock" && zone === "topdock") {
        const t = getTopdockDropTarget(e.clientX);
        if (t && t.el !== dragItem) t.el.classList.add("drag-over");
      }
    }));
    this._listen(document, "mouseup", ((e) => {
      var _a;
      if (!dragItem) return;
      if (dragActive) {
        this._dragWasDrag = true;
        const section = dragItem.getAttribute("data-section");
        const zone = getDropZone(e.clientX, e.clientY);
        if (dragSource === "dock" && zone === "topdock") {
          if (section) this.setAppPlacement(section, "topdock");
        } else if (dragSource === "topdock" && zone === "dock") {
          if (section) this.setAppPlacement(section, "dock");
        } else if (dragSource === "dock" && zone === "dock") {
          const t = getDropTarget(e.clientX, dock);
          if (t && t.el !== dragItem) {
            (_a = t.el.parentNode) == null ? void 0 : _a.insertBefore(dragItem, t.before ? t.el : t.el.nextSibling);
            this._saveDockOrder();
            this.updateDockScrollButtons();
          }
        } else if (dragSource === "topdock" && zone === "topdock") {
          const t = getTopdockDropTarget(e.clientX);
          if (t && t.el !== dragItem && topdock) {
            topdock.insertBefore(dragItem, t.before ? t.el : t.el.nextSibling);
            this._saveTopdockOrder();
          }
        }
      }
      clearDragStyles();
      dragItem.classList.remove("is-dragging");
      this._removeDragGhost();
      dragItem = null;
      dragActive = false;
      dragSource = null;
    }));
  }
  _createDragGhost(btn) {
    this._removeDragGhost();
    const ghost = document.createElement("div");
    ghost.className = "dock-drag-ghost";
    const icon = btn.querySelector("svg[data-prestige-icon], i[data-prestige-icon]");
    if (icon) {
      ghost.appendChild(icon.cloneNode(true));
      if (icon.tagName !== "svg") renderIcons(ghost);
    } else {
      const fallback = $tag("i", { "data-prestige-icon": "circle" });
      ghost.appendChild(fallback);
      renderIcons(ghost);
    }
    (this._ownedRoot ?? document.body).appendChild(ghost);
    return ghost;
  }
  _removeDragGhost() {
    var _a;
    (_a = document.querySelector(".dock-drag-ghost")) == null ? void 0 : _a.remove();
  }
  bindDockScroll() {
    this._queryAll("[data-dock-scroll]").forEach((btn) => {
      const dir = btn.getAttribute("data-dock-scroll");
      this._listen(btn, "click", (() => {
        const dock2 = this._query("#dock");
        if (!dock2) return;
        dock2.scrollBy({ left: dir === "left" ? -220 : 220, behavior: "smooth" });
      }));
    });
    const dock = this._query("#dock");
    if (dock) this._listen(dock, "scroll", (() => {
      this.updateDockScrollButtons();
    }));
  }
  updateDockScrollButtons() {
    const dock = this._query("#dock");
    if (!dock) return;
    const left = this._query('[data-dock-scroll="left"]');
    const right = this._query('[data-dock-scroll="right"]');
    if (!left || !right) return;
    const maxScroll = dock.scrollWidth - dock.clientWidth;
    if (maxScroll <= 4) {
      left.classList.remove("is-visible");
      right.classList.remove("is-visible");
      return;
    }
    left.classList.toggle("is-visible", dock.scrollLeft > 4);
    right.classList.toggle("is-visible", dock.scrollLeft < maxScroll - 4);
  }
  bindCanvasClick() {
    const canvas = this._query("#desktop-canvas");
    if (!canvas) return;
    this._listen(canvas, "mousedown", ((e) => {
      const target = e.target;
      if (target && target.closest(".window")) return;
      this._queryAll(".window.is-focused").forEach((w) => {
        this._emit("window:blur", { win: w });
        w.classList.remove("is-focused");
      });
      const titleEl = this._query("#active-window-title");
      if (titleEl) titleEl.textContent = "No windows open";
    }));
    this._listen(canvas, "dblclick", ((e) => {
      const target = e.target;
      if (target && target.closest(".window")) return;
      this.closeAllWindows();
    }));
  }
  /* ── Keyboard shortcuts ───────────────────────────────────── */
  bindKeyboard() {
    if (this._xray) this._listen(window, "blur", (() => {
      this.disableXRay();
    }));
    this._listen(document, "keydown", ((e) => {
      const target = e.target;
      const tag = target ? target.tagName : "";
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || target instanceof HTMLElement && target.isContentEditable;
      if (this._xray && e.altKey && (e.code === "KeyX" || e.key === "x" || e.key === "X") && !e.repeat) {
        if (!isTyping) {
          e.preventDefault();
          this.enableXRay();
          return;
        }
      }
      if (this._search && (e.ctrlKey || e.metaKey) && e.code === "Space") {
        e.preventDefault();
        this.showSearch();
        return;
      }
      if (this._windowSwitcher && (e.ctrlKey || e.metaKey) && !e.altKey && !isTyping && (e.code === "Backquote" || e.key === "`")) {
        e.preventDefault();
        const windows = this._wm._getSwitcherWindows();
        if (windows.length < 2) return;
        if (!this._switcherActive) {
          this._switcherActive = true;
          this._showSwitcher(windows);
        }
        const dir = e.shiftKey ? -1 : 1;
        this._switcherIndex = (this._switcherIndex + dir + windows.length) % windows.length;
        this._highlightSwitcher(this._switcherIndex);
      }
      if (e.key === "Escape") {
        if (this._expose && this._exposeActive) {
          e.preventDefault();
          this.toggleExpose(false);
          return;
        }
        if (this._xray && this._xrayActive) {
          this.disableXRay();
          return;
        }
        if (this._windowSwitcher && this._switcherActive) {
          e.preventDefault();
          this._hideSwitcher();
          this._switcherActive = false;
          this._switcherIndex = -1;
        }
      }
      if (this._lockScreen && e.key === "l" && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && !isTyping) {
        e.preventDefault();
        this.lock();
        return;
      }
      if (this._tiling && e.key === "t" && (e.ctrlKey || e.metaKey) && e.altKey && !isTyping) {
        e.preventDefault();
        this._tileWindows();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && !isTyping) {
        const focused = this._getFocusedWindow();
        if (focused) {
          if (e.key === "ArrowLeft" && this._snap) {
            e.preventDefault();
            this._wm._applySnapOnRelease(focused, "left");
            return;
          }
          if (e.key === "ArrowRight" && this._snap) {
            e.preventDefault();
            this._wm._applySnapOnRelease(focused, "right");
            return;
          }
        }
      }
      if (this._windowSwitcher && (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && !isTyping && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const windows = this._wm._getSwitcherWindows();
        if (windows.length > 1) {
          const focused = this._getFocusedWindow();
          if (focused !== null) {
            const idx = windows.indexOf(focused);
            const next = idx >= 0 ? (idx + (e.key === "ArrowRight" ? 1 : -1) + windows.length) % windows.length : 0;
            this.focusWindow(windows[next]);
          }
        }
        return;
      }
    }));
    this._listen(document, "keyup", ((e) => {
      if (this._xray && (e.key === "Alt" || e.code === "KeyX" || e.key === "x" || e.key === "X")) this.disableXRay();
      if (this._windowSwitcher && !e.ctrlKey && !e.metaKey && this._switcherActive) {
        const windows = this._wm._getSwitcherWindows();
        const idx = this._switcherIndex >= 0 ? this._switcherIndex : 0;
        if (windows[idx]) this.focusWindow(windows[idx]);
        this._hideSwitcher();
        this._switcherActive = false;
        this._switcherIndex = -1;
      }
    }));
  }
  /* ── X-Ray ────────────────────────────────────────────────── */
  enableXRay() {
    if (this._xrayActive) return;
    this._xrayActive = true;
    this._emit("xray:enable", {});
    this._queryAll(".window").forEach((win) => {
      if (!win.classList.contains("is-focused")) win.classList.add("is-xray-dimmed");
    });
  }
  disableXRay() {
    if (!this._xrayActive) return;
    this._xrayActive = false;
    this._emit("xray:disable", {});
    this._queryAll(".window.is-xray-dimmed").forEach((win) => win.classList.remove("is-xray-dimmed"));
  }
  peekXRay() {
    if (this._xrayActive) this.disableXRay();
    else this.enableXRay();
  }
  /* ── Exposé / hot corners ─────────────────────────────────── */
  checkHotCorners(e) {
    if (this._exposeActive || this._hotCornerCooldown) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const hit = e.clientX <= 12 && e.clientY <= 12 || e.clientX >= w - 12 && e.clientY <= 12 || e.clientX <= 12 && e.clientY >= h - 12 || e.clientX >= w - 12 && e.clientY >= h - 12;
    if (hit) {
      this._hotCornerCooldown = true;
      this.toggleExpose(true);
      window.setTimeout(() => {
        this._hotCornerCooldown = false;
      }, 1200);
    }
  }
  toggleExpose(enable) {
    if (enable === void 0) enable = !this._exposeActive;
    if (enable && this._exposeActive) return;
    if (!enable && !this._exposeActive) return;
    const visibleWins = this._wm._getSwitcherWindows();
    if (enable && visibleWins.length === 0) return;
    const canvas = this._query("#desktop-canvas");
    if (!canvas) return;
    if (enable) {
      this._exposeActive = true;
      this._emit("expose:open", {});
      this._exposeSavedRects = [];
      const backdrop = $tag("div", { id: "expose-backdrop", class: "expose-backdrop" });
      canvas.appendChild(backdrop);
      const bounds = this._wm.getSafeBounds();
      const total = visibleWins.length;
      const cols = Math.ceil(Math.sqrt(total));
      const rows = Math.ceil(total / cols);
      const canvasW = canvas.clientWidth;
      const canvasH = bounds.bottom - bounds.top;
      const gap = 24;
      const cellW = (canvasW - gap * (cols + 1)) / cols;
      const cellH = (canvasH - gap * (rows + 1)) / rows;
      visibleWins.forEach((win, idx) => {
        this._exposeSavedRects.push({
          win,
          left: win.style.left,
          top: win.style.top,
          width: win.style.width,
          height: win.style.height,
          transform: win.style.transform,
          zIndex: win.style.zIndex
        });
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        win.classList.add("is-in-expose");
        win.style.transition = "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";
        win.style.left = `${gap + c * (cellW + gap)}px`;
        win.style.top = `${bounds.top + gap + r * (cellH + gap)}px`;
        win.style.width = `${cellW}px`;
        win.style.height = `${cellH}px`;
        const onClick = (event) => {
          event.stopPropagation();
          event.preventDefault();
          this.focusWindow(win);
          this.toggleExpose(false);
        };
        win._exposeClickHandler = onClick;
        win.addEventListener("click", onClick, true);
      });
      backdrop.addEventListener("click", () => this.toggleExpose(false));
    } else {
      this._exposeActive = false;
      this._emit("expose:close", {});
      this._unmountNode(this._query("#expose-backdrop"));
      this._exposeSavedRects.forEach((item) => {
        const win = item.win;
        win.classList.remove("is-in-expose");
        win.style.transition = "all 0.3s ease";
        win.style.left = item.left;
        win.style.top = item.top;
        win.style.width = item.width;
        win.style.height = item.height;
        win.style.transform = item.transform ?? "";
        if (win._exposeClickHandler) {
          win.removeEventListener("click", win._exposeClickHandler, true);
          delete win._exposeClickHandler;
        }
        window.setTimeout(() => {
          if (!win.classList.contains("is-in-expose")) win.style.transition = "";
        }, 300);
      });
      this._exposeSavedRects = [];
    }
  }
  /* ── Close all / particle explosion ───────────────────────── */
  _removeAllWindows(suppressSessionSave) {
    for (const section of this._wm.getOpenWindowKeys()) {
      const rec = this._wm.getOpenWindow(section);
      if (rec) this._wm.removeWindowRecord(rec, true);
    }
    if (!suppressSessionSave) this._saveSession();
  }
  closeAllWindows() {
    if (this._animationsEnabled && this._particleExplosion) {
      this.explodeAndCloseAll();
    } else {
      this._removeAllWindows(false);
    }
  }
  explodeAndCloseAll() {
    if (!this._animationsEnabled) {
      this._removeAllWindows(false);
      return;
    }
    const entries = [];
    for (const section of this._wm.getOpenWindowKeys()) {
      const rec = this._wm.getOpenWindow(section);
      if (rec && rec.el && rec.el.parentNode && !this._wm.isMinimized(rec)) entries.push({ section, rec });
    }
    if (entries.length === 0) {
      this._removeAllWindows(false);
      return;
    }
    let canvas = this._query("#explosion-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "explosion-canvas";
      canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99999;";
      (this._ownedRoot ?? document.body).appendChild(canvas);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      this._removeAllWindows(false);
      return;
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const focalLength = 380;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--prestige-accent").trim() || "#fbe482";
    const textColor = getComputedStyle(document.documentElement).getPropertyValue("--prestige-text").trim() || "#000000";
    const colors = [accent, textColor, accent, textColor, accent, textColor];
    const particles = [];
    let pendingRemovals = entries.length;
    entries.forEach(({ rec }) => {
      var _a;
      const win = rec.el;
      const rect = win.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const cols = 32;
      const rows = 24;
      const cellW = rect.width / cols;
      const cellH = rect.height / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = rect.left + c * cellW + cellW / 2;
          const py = rect.top + r * cellH + cellH / 2;
          const angle = Math.atan2(py - centerY, px - centerX) + (Math.random() - 0.5) * 0.5;
          const speed = 4 + Math.random() * 10;
          particles.push({
            x: px,
            y: py,
            z: (Math.random() - 0.5) * 30,
            vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 3,
            vy: Math.sin(angle) * speed - (1 + Math.random() * 5),
            vz: (Math.random() - 0.5) * 16,
            size: 0.4 + Math.random() * 0.8,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            decay: 0.016 + Math.random() * 0.018,
            gravity: 0.26
          });
        }
      }
      win.style.opacity = "0";
      win.style.transform = "scale(0.88)";
      win.style.transition = "opacity 0.08s ease, transform 0.08s ease";
      if (rec.btn) rec.btn.classList.remove("is-open", "has-minimized");
      (_a = win._disposal) == null ? void 0 : _a.setTimeout(() => {
        this._wm.removeWindowRecord(rec, true);
        pendingRemovals -= 1;
        if (pendingRemovals === 0) this._saveSession();
      }, 80);
    });
    for (const sec of this._wm.getOpenWindowKeys()) {
      const rec = this._wm.getOpenWindow(sec);
      if (rec && rec.el && rec.el.parentNode && this._wm.isMinimized(rec)) {
        this._wm.removeWindowRecord(rec, true);
      }
    }
    const renderLoop = () => {
      var _a;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let activeCount = 0;
      const batch = {};
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        activeCount += 1;
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;
        p.vy += p.gravity;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.vz *= 0.97;
        p.alpha -= p.decay;
        const scale = focalLength / (focalLength + p.z);
        if (scale <= 0) continue;
        const projX = (p.x - canvas.width / 2) * scale + canvas.width / 2;
        const projY = (p.y - canvas.height / 2) * scale + canvas.height / 2;
        const projSize = Math.max(0.3, p.size * scale);
        if (p.alpha > 0) {
          (batch[_a = p.color] ?? (batch[_a] = [])).push({ x: projX, y: projY, r: projSize, a: Math.max(0, p.alpha) });
        }
      }
      for (const color of Object.keys(batch)) {
        ctx.fillStyle = color;
        for (const d of batch[color]) {
          ctx.globalAlpha = d.a;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (activeCount > 0) requestAnimationFrame(renderLoop);
      else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.remove();
      }
    };
    requestAnimationFrame(renderLoop);
  }
  /* ── Tiling ───────────────────────────────────────────────── */
  _tileWindows() {
    if (this._tileActive) {
      this._untileWindows();
      return;
    }
    const visible = this._wm._getSwitcherWindows();
    if (visible.length < 2) return;
    const canvas = this._query("#desktop-canvas");
    if (!canvas) return;
    const bounds = this._wm.getSafeBounds();
    const canvasW = canvas.clientWidth;
    const canvasH = bounds.bottom - bounds.top;
    const gap = 6;
    const total = visible.length;
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    const cellW = (canvasW - gap * (cols + 1)) / cols;
    const cellH = (canvasH - gap * (rows + 1)) / rows;
    if (cellW < 420 || cellH < 280) return;
    this._tileActive = true;
    this._tileSaved = [];
    visible.forEach((win, idx) => {
      this._tileSaved.push({ win, left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height });
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      win.classList.remove("is-zoomed", "is-snapped");
      this._wm.setWindowLogicalState(win, void 0, false);
      win.style.transition = "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
      win.style.left = `${gap + c * (cellW + gap)}px`;
      win.style.top = `${bounds.top + gap + r * (cellH + gap)}px`;
      win.style.width = `${cellW}px`;
      win.style.height = `${cellH}px`;
    });
    this._emit("tiling:enable", {});
  }
  _untileWindows() {
    if (!this._tileActive) return;
    this._tileActive = false;
    this._tileSaved.forEach((item) => {
      const win = item.win;
      if (!win || !win.isConnected) return;
      win.style.transition = "all 0.25s ease";
      win.style.left = item.left;
      win.style.top = item.top;
      win.style.width = item.width;
      win.style.height = item.height;
      window.setTimeout(() => {
        if (win && win.isConnected) win.style.transition = "";
      }, 250);
    });
    this._tileSaved = [];
    this._emit("tiling:disable", {});
  }
  /* ── Minimized preview ────────────────────────────────────── */
  _showMinimizedPreview(btn, section) {
    if (!this._minimizedPreview) return;
    if (this._previewSection === section) return;
    this._hideMinimizedPreview();
    const rec = this._wm.getOpenWindow(section);
    if (!rec || !rec.el || !this._wm.isMinimized(rec)) return;
    const win = rec.el;
    this._previewOrigin = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
    win.classList.remove("is-minimized", "is-gone");
    win.classList.add("is-preview");
    const btnRect = btn.getBoundingClientRect();
    const isTopdock = btn.classList.contains("menubar-dock-item");
    const scale = 0.28;
    const winW = parseFloat(win.style.width) || 760;
    const winH = parseFloat(win.style.height) || 540;
    let left = btnRect.left + btnRect.width / 2 - winW / 2;
    if (left < 10) left = 10;
    const top = isTopdock ? btnRect.bottom + 10 : btnRect.top - winH * scale - 10;
    win.style.left = `${left}px`;
    win.style.top = `${Math.max(10, top)}px`;
    win.style.width = `${winW}px`;
    win.style.height = `${winH}px`;
    this._previewWin = win;
    this._previewSection = section;
  }
  _hideMinimizedPreview() {
    if (!this._previewWin) return;
    const win = this._previewWin;
    const section = win.getAttribute("data-section") ?? "";
    if (this._previewOrigin) {
      win.style.left = this._previewOrigin.left;
      win.style.top = this._previewOrigin.top;
      win.style.width = this._previewOrigin.width;
      win.style.height = this._previewOrigin.height;
    }
    this._previewOrigin = null;
    win.classList.remove("is-preview");
    const rec = this._wm.getOpenWindow(section);
    if (rec && rec.el === win && this._wm.isMinimized(rec)) win.classList.add("is-minimized", "is-gone");
    this._previewWin = null;
    this._previewSection = null;
  }
  /* ── Toast / notification center ──────────────────────────── */
  notify(type, title, message) {
    if (!this._toastCenter) return;
    this._toasts ?? (this._toasts = []);
    this._toasts.unshift({ type, title: title ?? "", message: message ?? "", time: Date.now() });
    if (this._toasts.length > 50) this._toasts.length = 50;
    this._renderToastCenter();
  }
  _toggleToastCenter() {
    const el = this._query("#toast-center");
    if (el) {
      el.classList.toggle("is-open");
      if (el.classList.contains("is-open")) this._renderToastCenter();
    } else {
      this._createToastCenter();
      this._renderToastCenter();
    }
  }
  _createToastCenter() {
    var _a;
    this._unmountNode(this._query("#toast-center"));
    const el = $tag("div", { id: "toast-center", class: "toast-center", role: "region", "aria-label": "Notifications" });
    const header = $tag("div", { class: "toast-center-header" });
    header.append($tag("span", {}, [$text("Notifications")]), $tag("button", { class: "toast-center-clear", id: "toast-clear-all" }, [$text("Clear all")]));
    const list = $tag("div", { class: "toast-center-list", id: "toast-center-list", "aria-live": "polite" });
    el.append(header, list);
    this._mountNode(el);
    el.addEventListener("click", ((e) => {
      var _a2;
      const target = e.target;
      const item = target ? target.closest(".toast-item") : null;
      if (item && item.dataset && item.dataset.idx !== void 0) {
        (_a2 = this._toasts) == null ? void 0 : _a2.splice(parseInt(item.dataset.idx, 10), 1);
        this._renderToastCenter();
      }
    }));
    (_a = el.querySelector("#toast-clear-all")) == null ? void 0 : _a.addEventListener("click", () => {
      this._toasts = [];
      this._renderToastCenter();
    });
    window.setTimeout(() => el.classList.add("is-open"), 10);
    this._listen(document, "click", ((e) => {
      if (!el.classList.contains("is-open")) return;
      const target = e.target;
      if (target && el.contains(target)) return;
      if (target instanceof Element && target.closest("#toast-bell")) return;
      el.classList.remove("is-open");
    }));
  }
  _renderToastCenter() {
    const list = this._query("#toast-center-list");
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!this._toasts || this._toasts.length === 0) {
      list.appendChild($tag("div", { class: "toast-center-empty" }, [$text("No notifications yet")]));
      return;
    }
    const icons = { info: "ℹ", success: "✓", warning: "⚠", error: "✖" };
    this._toasts.forEach((t, i) => {
      const item = $tag("div", { class: "toast-item", "data-idx": String(i) });
      item.append(
        $tag("div", { class: `toast-item-icon is-${t.type}` }, [$text(icons[t.type] ?? "ℹ")]),
        $tag("div", { class: "toast-item-body" }, [
          $tag("div", { class: "toast-item-title" }, [$text(t.title)]),
          $tag("div", { class: "toast-item-msg" }, [$text(t.message)]),
          $tag("div", { class: "toast-item-time" }, [$text(this._timeAgo(t.time))])
        ]),
        $tag("button", { class: "toast-item-dismiss", "data-idx": String(i), "aria-label": `Dismiss notification: ${t.title}` }, [$text("×")])
      );
      list.appendChild(item);
    });
  }
  _timeAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1e3);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hrs = Math.floor(min / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
  /* ── App registration & placement ─────────────────────────── */
  registerApp(appId, manifest) {
    if (typeof appId !== "string") throw new Error("Prestige app IDs must be strings.");
    assertSafeAppId(appId);
    const apps = this.config.apps;
    const previous = Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : void 0;
    apps[appId] = Object.freeze(Object.assign(/* @__PURE__ */ Object.create(null), previous ?? {}, manifest));
    const placement = this._getAppPlacement(appId);
    this._setAppPlacement(appId, placement, false);
    renderIcons(this.root);
    this._emit("app:register", { appId, manifest });
    return this;
  }
  _applyInitialPlacements() {
    const configuredIds = new Set(Object.keys(this.config.apps ?? {}));
    const appIds = new Set(configuredIds);
    this._queryAll(".dock-item[data-section], .menubar-dock-item[data-section]").forEach((el) => {
      const appId = el.getAttribute("data-section");
      if (appId) appIds.add(appId);
    });
    for (const appId of appIds) {
      try {
        assertSafeAppId(appId);
        const override = this._getPersistedPlacement(appId);
        if (configuredIds.has(appId) || override) this._setAppPlacement(appId, override ?? this._getAppPlacement(appId), false);
      } catch (_e) {
      }
    }
  }
  _buildDockItem(appId, manifest) {
    const el = document.createElement("button");
    el.className = "dock-item";
    el.setAttribute("data-section", appId);
    el.setAttribute("data-app-id", appId);
    el.setAttribute("data-label", manifest.title ?? manifest.label ?? appId);
    el.setAttribute("data-icon", manifest.icon ?? "");
    if (manifest.c1) {
      el.setAttribute("data-color", manifest.c1);
      el.style.setProperty("--c1", manifest.c1);
    }
    if (manifest.c2) el.style.setProperty("--c2", manifest.c2);
    el.append(
      $tag("span", { class: "dock-icon" }, [$tag("i", { "data-prestige-icon": manifest.icon ?? "circle" })]),
      $tag("span", { class: "dock-label" }, [$text(manifest.title ?? manifest.label ?? appId)]),
      $tag("span", { class: "dock-dot" })
    );
    return el;
  }
  _readAppMeta(appId) {
    const meta = { icon: "", label: "", c1: "", c2: "" };
    const el = this._query(`[data-section="${appId}"].dock-item`) ?? this._query(`[data-section="${appId}"].menubar-dock-item`);
    if (el) {
      meta.icon = el.getAttribute("data-icon") ?? "";
      meta.label = el.getAttribute("data-label") ?? appId;
      meta.c1 = el.getAttribute("data-color") ?? "";
    }
    const apps = this.config.apps;
    const manifest = apps && Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : void 0;
    if (manifest) {
      if (manifest.icon) meta.icon = manifest.icon;
      meta.label = manifest.title ?? manifest.label ?? meta.label ?? appId;
      if (manifest.c1) meta.c1 = manifest.c1;
      if (manifest.c2) meta.c2 = manifest.c2;
    }
    return meta;
  }
  setAppPlacement(appId, placement) {
    return this._setAppPlacement(appId, placement, true);
  }
  /** Reset an app to its manifest-declared placement (clears the persisted override). */
  resetAppPlacement(appId) {
    try {
      const saved = JSON.parse(localStorage.getItem("prestige_placements") ?? "{}");
      delete saved[appId];
      localStorage.setItem("prestige_placements", JSON.stringify(saved));
    } catch (error) {
      this._emit("storage:error", { key: "prestige_placements", error });
    }
    const apps = this.config.apps;
    const manifest = apps && Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : void 0;
    return this._setAppPlacement(appId, (manifest == null ? void 0 : manifest.placement) ?? "dock", false);
  }
  /** Internal placement application. Persists the override only when `persist` is set. */
  _setAppPlacement(appId, placement, persist) {
    var _a, _b, _c, _d;
    if (typeof appId !== "string") throw new Error("Prestige app IDs must be strings.");
    assertSafeAppId(appId);
    if (!PLACEMENTS.includes(placement)) throw new Error("Invalid Prestige app placement.");
    if (persist) {
      try {
        const saved = JSON.parse(localStorage.getItem("prestige_placements") ?? "{}");
        saved[appId] = placement;
        localStorage.setItem("prestige_placements", JSON.stringify(saved));
      } catch (error) {
        this._emit("storage:error", { key: "prestige_placements", error });
      }
    }
    const meta = this._readAppMeta(appId);
    const dock = this._query("#dock");
    const mb = this._query(".menubar");
    const escapedId = CSS.escape(appId);
    (_a = dock == null ? void 0 : dock.querySelector(`[data-section="${escapedId}"]`)) == null ? void 0 : _a.remove();
    (_b = mb == null ? void 0 : mb.querySelector(`[data-section="${escapedId}"].menubar-dock-item`)) == null ? void 0 : _b.remove();
    if (placement === "dock" || placement === "both") {
      this._appendToDock(this._buildDockItem(appId, { icon: meta.icon, label: meta.label, c1: meta.c1, c2: meta.c2 }));
    }
    if (placement === "topdock" || placement === "both") {
      this._addTopdockItem(appId, meta);
    }
    const rec = this._wm.getOpenWindow(appId);
    if (rec) {
      rec.btn = this._query(`.dock-item[data-section="${escapedId}"]`) ?? this._query(`.menubar-dock-item[data-section="${escapedId}"]`);
      (_c = rec.btn) == null ? void 0 : _c.classList.add("is-open");
      (_d = rec.btn) == null ? void 0 : _d.classList.toggle("has-minimized", this._wm.isMinimized(rec));
    }
    renderIcons(this.root);
    this._emit("placement:changed", { appId, placement });
    return this;
  }
  /** Resolve an app's effective placement: persisted override, then manifest, then 'dock'. */
  _getAppPlacement(appId) {
    const override = this._getPersistedPlacement(appId);
    if (override) return override;
    const apps = this.config.apps;
    const manifest = apps && Object.prototype.hasOwnProperty.call(apps, appId) ? apps[appId] : void 0;
    const placement = (manifest == null ? void 0 : manifest.placement) ?? "dock";
    return PLACEMENTS.includes(placement) ? placement : "dock";
  }
  _getPersistedPlacement(appId) {
    try {
      const saved = JSON.parse(localStorage.getItem("prestige_placements") ?? "{}");
      if (Object.prototype.hasOwnProperty.call(saved, appId) && PLACEMENTS.includes(saved[appId])) {
        return saved[appId];
      }
    } catch (_e) {
    }
    return null;
  }
  /** Right-click placement menu for dock / topdock items (change or reset placement). */
  _showDockPlacementMenu(btn, x, y) {
    const section = btn.getAttribute("data-section");
    if (!section) return;
    const current = this._getAppPlacement(section);
    const placementItem = (value, label) => ({
      label,
      checked: current === value,
      onclick: () => {
        this.setAppPlacement(section, value);
      }
    });
    this.showContextMenu({
      x,
      y,
      items: [
        placementItem("dock", "Dock"),
        placementItem("topdock", "Top Dock"),
        placementItem("hidden", "Hidden"),
        { sep: true },
        { label: "Reset to default", onclick: () => {
          this.resetAppPlacement(section);
        } }
      ]
    });
  }
  _appendToDock(el) {
    const dock = this._query("#dock");
    if (!dock) return;
    const group = dock.querySelector(".dock-group");
    if (group) group.appendChild(el);
    else dock.appendChild(el);
  }
  _addTopdockItem(appId, meta) {
    let topdock = this._query("#topdock");
    if (!topdock) {
      const mb = this._query(".menubar");
      if (!mb) return;
      topdock = document.createElement("div");
      topdock.className = "menubar-center";
      topdock.id = "topdock";
      const right = mb.querySelector(".menubar-right");
      if (right) mb.insertBefore(topdock, right);
      else mb.appendChild(topdock);
    }
    if (topdock.querySelector(`[data-section="${appId}"]`)) return;
    const el = document.createElement("button");
    el.className = "menubar-dock-item";
    el.setAttribute("data-section", appId);
    el.setAttribute("data-app-id", appId);
    el.setAttribute("data-icon", meta.icon ?? "");
    el.setAttribute("data-label", meta.label ?? appId);
    if (meta.c1) el.setAttribute("data-color", meta.c1);
    el.title = meta.label ?? appId;
    el.appendChild($tag("i", { "data-prestige-icon": meta.icon ?? "circle" }));
    topdock.appendChild(el);
  }
  /* ── Window switcher ──────────────────────────────────────── */
  _showSwitcher(windows) {
    const overlay = $tag("div", { class: "switcher-overlay" });
    overlay.addEventListener("click", () => {
      this._hideSwitcher();
      this._switcherActive = false;
      this._switcherIndex = -1;
    });
    overlay.addEventListener("contextmenu", (e) => e.preventDefault());
    const panel = $tag("div", { class: "switcher-panel" });
    windows.forEach((win, i) => {
      var _a;
      const card = $tag("div", { class: "switcher-card", "data-index": String(i) });
      const title = win.querySelector(".window-title");
      const labelText = ((_a = title == null ? void 0 : title.textContent) == null ? void 0 : _a.trim()) ?? win.getAttribute("data-section") ?? "Window";
      const icon = win.querySelector(".window-title-icon");
      if (icon) {
        const wrap = $tag("span");
        wrap.style.display = "inline-flex";
        wrap.style.marginRight = "8px";
        wrap.appendChild(icon.cloneNode(true));
        card.appendChild(wrap);
      }
      card.appendChild($tag("span", {}, [$text(labelText)]));
      const thumb = $tag("div", { class: "switcher-thumb" });
      const contentClone = win.querySelector(".window-content-main");
      if (contentClone) {
        const clone = contentClone.cloneNode(true);
        clone.style.padding = "8px";
        clone.style.fontSize = "6px";
        clone.style.overflow = "hidden";
        thumb.appendChild(clone);
      }
      card.appendChild(thumb);
      panel.appendChild(card);
    });
    overlay.appendChild(panel);
    this._mountNode(overlay);
    requestAnimationFrame(() => overlay.classList.add("active"));
    this._switcherEl = overlay;
  }
  _highlightSwitcher(index) {
    var _a;
    if (!this._switcherEl) return;
    const cards = this._switcherEl.querySelectorAll(".switcher-card");
    cards.forEach((c, i) => c.classList.toggle("is-selected", i === index));
    (_a = cards[index]) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }
  _hideSwitcher() {
    const el = this._switcherEl;
    if (el) {
      el.classList.remove("active");
      window.setTimeout(() => this._unmountNode(el), 180);
      this._switcherEl = null;
    }
  }
  /* ── Spotlight search ─────────────────────────────────────── */
  showSearch() {
    var _a, _b, _c;
    if (this._searchEl) {
      (_a = this._searchEl.querySelector(".search-input")) == null ? void 0 : _a.focus();
      return;
    }
    const overlay = $tag("div", { class: "search-overlay" });
    const backdrop = $tag("div", { class: "search-backdrop" });
    const dialog = $tag("div", { class: "search-dialog" });
    const field = $tag("div", { class: "search-field" });
    const input = $tag("input", { class: "search-input", type: "text", placeholder: "Search pages, settings, fields…", spellcheck: "false", autofocus: true });
    const closeBtn = $tag("button", { class: "search-close", title: "Close search" }, [$text("×")]);
    const resultsEl = $tag("div", { class: "search-results" });
    const footer = $tag("div", { class: "search-footer" }, [
      $tag("span", {}, [$tag("kbd", {}, [$text("Esc")]), $text(" close")]),
      $tag("span", {}, [$tag("kbd", {}, [$text("↑")]), $tag("kbd", {}, [$text("↓")]), $text(" navigate")]),
      $tag("span", {}, [$tag("kbd", {}, [$text("↵")]), $text(" open")])
    ]);
    field.append($tag("i", { "data-prestige-icon": "search", class: "search-icon" }), input, closeBtn);
    dialog.append(field, resultsEl, footer);
    overlay.append(backdrop, dialog);
    this._mountNode(overlay);
    const searchData = [];
    const apps = this.config.apps ?? {};
    for (const key of Object.keys(apps)) {
      searchData.push({ label: ((_b = apps[key]) == null ? void 0 : _b.label) ?? key, section: key, path: `/${key}` });
    }
    this._queryAll(".dock-item[data-section], .menubar-dock-item[data-section]").forEach((el) => {
      const s = el.getAttribute("data-section");
      const l = el.getAttribute("data-label") ?? s ?? "";
      if (s && !searchData.some((d) => d.section === s)) {
        searchData.push({ label: l, section: s, path: `/${s}` });
      }
    });
    let lastResults = [];
    let selectedIndex = -1;
    const doSearch = () => {
      var _a2;
      selectedIndex = -1;
      const q = input.value.trim().toLowerCase();
      if (!q) {
        replaceContent(resultsEl, $tag("div", { class: "search-empty" }, [$text("Type to search…")]), false, (_a2 = this.config.security) == null ? void 0 : _a2.sanitizer);
        lastResults = [];
        return;
      }
      const filtered = searchData.filter((item) => item.label.toLowerCase().includes(q) || item.section.includes(q));
      lastResults = filtered;
      while (resultsEl.firstChild) resultsEl.removeChild(resultsEl.firstChild);
      if (filtered.length === 0) {
        resultsEl.appendChild($tag("div", { class: "search-empty" }, [$text("No results found")]));
        return;
      }
      resultsEl.appendChild($tag("div", { class: "search-group-label" }, [$text("Pages")]));
      filtered.forEach((item, i) => {
        const row = $tag("div", { class: "search-result", "data-section": item.section });
        row.append(
          $tag("span", { class: "search-result-label" }, [$text(item.label)]),
          $tag("span", { class: "search-result-path" }, [$text(item.path)])
        );
        row.addEventListener("click", () => this._searchNavigate(lastResults[i]));
        resultsEl.appendChild(row);
      });
      renderIcons(overlay);
    };
    let debounceTimer = null;
    input.addEventListener("input", () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(doSearch, 150);
    });
    input.addEventListener("keydown", ((e) => {
      const items = resultsEl.querySelectorAll(".search-result");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length) {
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          this._searchHighlight(items, selectedIndex);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length) {
          selectedIndex = Math.max(selectedIndex - 1, 0);
          this._searchHighlight(items, selectedIndex);
        }
      } else if (e.key === "Enter" && selectedIndex >= 0 && lastResults[selectedIndex]) {
        e.preventDefault();
        this._searchNavigate(lastResults[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._closeSearch();
      }
    }));
    closeBtn.addEventListener("click", () => this._closeSearch());
    backdrop.addEventListener("click", () => this._closeSearch());
    this._searchEscListener = ((e) => {
      if (e.key === "Escape") this._closeSearch();
    });
    this._listen(document, "keydown", this._searchEscListener);
    requestAnimationFrame(() => overlay.classList.add("active"));
    window.setTimeout(() => input.focus(), 100);
    this._searchEl = overlay;
    this._emit("search:open", {});
    replaceContent(resultsEl, $tag("div", { class: "search-empty" }, [$text("Type to search…")]), false, (_c = this.config.security) == null ? void 0 : _c.sanitizer);
    renderIcons(overlay);
  }
  _searchHighlight(items, index) {
    var _a;
    items.forEach((el, i) => el.classList.toggle("is-selected", i === index));
    (_a = items[index]) == null ? void 0 : _a.scrollIntoView({ block: "nearest" });
  }
  _searchNavigate(result) {
    this._closeSearch();
    const btn = this._query(`.dock-item[data-section="${CSS.escape(result.section)}"]`);
    const icon = btn instanceof HTMLElement ? btn.getAttribute("data-icon") ?? void 0 : void 0;
    this.openWindow(result.section, icon, result.label, btn instanceof HTMLElement ? btn : null);
  }
  _closeSearch() {
    const el = this._searchEl;
    if (el) {
      el.classList.remove("active");
      window.setTimeout(() => this._unmountNode(el), 200);
      this._searchEl = null;
    }
    if (this._searchEscListener) {
      document.removeEventListener("keydown", this._searchEscListener);
      this._searchEscListener = null;
    }
    this._emit("search:close", {});
  }
  /* ── Clock ────────────────────────────────────────────────── */
  startClock() {
    const el = this._query("#menubar-clock");
    if (!el) return;
    const tick = () => {
      const d = /* @__PURE__ */ new Date();
      el.textContent = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    tick();
    this._clockInterval = window.setInterval(tick, 30 * 1e3);
  }
  /* ── Content cache ────────────────────────────────────────── */
  cacheContent(key, value) {
    this._contentCache[key] = value;
  }
  getCachedContent(key) {
    return this._contentCache[key] ?? null;
  }
  clearContentCache(key) {
    if (key) delete this._contentCache[key];
    else this._contentCache = /* @__PURE__ */ Object.create(null);
  }
  /* ── Session state ────────────────────────────────────────── */
  getState() {
    const out = [];
    for (const id of this._wm.getOpenWindowKeys()) {
      const rec = this._wm.getOpenWindow(id);
      if (rec && rec.el) {
        out.push({
          id,
          x: parseFloat(rec.el.style.left) || 0,
          y: parseFloat(rec.el.style.top) || 0,
          w: parseFloat(rec.el.style.width) || 760,
          h: parseFloat(rec.el.style.height) || 540,
          minimized: this._wm.isMinimized(rec),
          zoomed: this._wm.isZoomed(rec),
          title: rec.label ?? "",
          icon: rec.icon ?? ""
        });
      }
    }
    return out;
  }
  setState(states) {
    if (!Array.isArray(states)) return;
    const normalized = states.map((state) => {
      if (!state || typeof state.id !== "string") throw new Error("Prestige window state IDs must be strings.");
      const id = assertSafeAppId(state.id);
      const apps = this.config.apps;
      const manifest = apps && Object.prototype.hasOwnProperty.call(apps, id) ? apps[id] : void 0;
      const persisted = state;
      const meta = this._readAppMeta(id);
      return {
        state,
        id,
        icon: persisted.icon ?? (manifest == null ? void 0 : manifest.icon) ?? meta.icon,
        title: state.title || (manifest == null ? void 0 : manifest.title) || (manifest == null ? void 0 : manifest.label) || meta.label || id
      };
    });
    this._removeAllWindows(true);
    let lastVisible = null;
    for (const { state, id, icon, title } of normalized) {
      const trigger = this._query(`.dock-item[data-section="${CSS.escape(id)}"]`) ?? this._query(`.menubar-dock-item[data-section="${CSS.escape(id)}"]`);
      const win = this._wm.openWindow(id, icon || void 0, title, trigger instanceof HTMLElement ? trigger : null, {
        animate: false,
        focus: false,
        save: false,
        applyManifestMaximized: false
      });
      if (win) {
        win.style.left = `${Number.isFinite(state.x) ? state.x : 0}px`;
        win.style.top = `${Number.isFinite(state.y) ? state.y : 0}px`;
        win.style.width = `${Number.isFinite(state.w) ? state.w : 760}px`;
        win.style.height = `${Number.isFinite(state.h) ? state.h : 540}px`;
        this._wm.setWindowLogicalState(win, state.minimized === true, state.zoomed === true);
        if (!state.minimized) lastVisible = win;
      }
    }
    if (lastVisible) this.focusWindow(lastVisible);
    this._saveSession();
  }
  _saveSession() {
    if (!this._session) return;
    try {
      localStorage.setItem("prestige_session", JSON.stringify(this.getState()));
    } catch (error) {
      this._emit("storage:error", { key: "prestige_session", error });
    }
  }
  _restoreSession() {
    if (!this._session) return;
    try {
      const raw = localStorage.getItem("prestige_session");
      if (!raw) return;
      const states = JSON.parse(raw);
      if (Array.isArray(states) && states.length > 0) this.setState(states);
    } catch (_e) {
    }
  }
  /* ── Lock screen ──────────────────────────────────────────── */
  lock() {
    if (!this._lockScreen || this._lockActive) return;
    this._lockActive = true;
    this._unmountNode(this._query("#lock-screen"));
    const overlay = $tag("div", { class: "lock-screen", id: "lock-screen" });
    const now = /* @__PURE__ */ new Date();
    overlay.append(
      $tag("div", { class: "lock-clock", id: "lock-clock" }, [$text(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))]),
      $tag("div", { class: "lock-date" }, [$text(now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }))]),
      $tag("input", { class: "lock-input", id: "lock-input", type: "password", placeholder: "Password", autocomplete: "off" }),
      $tag("div", { class: "lock-error", id: "lock-error" })
    );
    this._mountNode(overlay);
    this._lockInterval = window.setInterval(() => {
      const el = document.getElementById("lock-clock");
      if (el) el.textContent = (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }, 1e4);
    const input = this._query("#lock-input");
    if (input) {
      window.setTimeout(() => input.focus(), 100);
      input.addEventListener("keydown", ((e) => {
        if (e.key === "Enter") this.unlock(input.value);
      }));
    }
    this._emit("screen:lock", {});
  }
  unlock(password) {
    if (!this._lockActive) return;
    const expected = this.config.lockPassword ?? "prestige";
    const errorEl = this._query("#lock-error");
    if (password !== expected) {
      if (errorEl instanceof HTMLElement) {
        errorEl.textContent = "Incorrect password";
        errorEl.style.animation = "lockShake 0.3s ease";
        window.setTimeout(() => {
          if (errorEl instanceof HTMLElement) errorEl.style.animation = "";
          const input = this._query("#lock-input");
          if (input instanceof HTMLInputElement) {
            input.value = "";
            input.focus();
          }
        }, 300);
      }
      return;
    }
    this._unmountNode(this._query("#lock-screen"));
    if (this._lockInterval !== null) {
      window.clearInterval(this._lockInterval);
      this._lockInterval = null;
    }
    this._lockActive = false;
    this._emit("screen:unlock", {});
  }
  /* ── Store / URL sync ─────────────────────────────────────── */
  get store() {
    var _a, _b;
    if (!this._store) {
      const keyProvider = (_a = this.config.security) == null ? void 0 : _a.storageKeyProvider;
      this._store = new PrestigeStore({
        storage: ((_b = this.config.security) == null ? void 0 : _b.storage) ?? "deny-secrets",
        ...keyProvider ? { keyProvider } : {}
      });
    }
    return this._store;
  }
  syncUrlState() {
    const updateUrl = () => {
      const openIds = this._wm.getOpenWindowKeys().filter((sec) => {
        const rec = this._wm.getOpenWindow(sec);
        return rec && rec.el && !this._wm.isMinimized(rec);
      });
      const url = new URL(window.location.href);
      if (openIds.length > 0) url.searchParams.set("windows", openIds.join(","));
      else url.searchParams.delete("windows");
      window.history.replaceState({}, "", url.toString());
    };
    this.on("window:open", updateUrl);
    this.on("window:close", updateUrl);
    this.on("window:minimize", updateUrl);
    this.on("window:restore", updateUrl);
    const restored = [];
    const params = new URLSearchParams(window.location.search);
    const initialWindows = params.get("windows");
    if (initialWindows) {
      initialWindows.split(",").forEach((id) => {
        const cleanId = id.trim();
        const apps = this.config.apps;
        const app = apps && Object.prototype.hasOwnProperty.call(apps, cleanId) ? apps[cleanId] : void 0;
        if (!cleanId || !app) return;
        const trigger = this._query(`.dock-item[data-section="${CSS.escape(cleanId)}"]`);
        this.openWindow(cleanId, app.icon ?? "", app.title ?? app.label ?? cleanId, trigger instanceof HTMLElement ? trigger : null);
        restored.push(cleanId);
      });
    }
    return restored;
  }
  /* ── Window manager delegation ────────────────────────────── */
  openWindow(section, icon, label, dockBtn) {
    this._hideMinimizedPreview();
    return this._wm.openWindow(section, icon, label, dockBtn);
  }
  closeWindow(win) {
    this._wm.closeWindow(win);
  }
  minimizeWindow(win) {
    this._wm.minimizeWindow(win);
  }
  restoreWindow(win) {
    this._wm.restoreWindow(win);
  }
  toggleMaximize(win) {
    this._wm.toggleMaximize(win);
  }
  focusWindow(win) {
    this._wm.focusWindow(win);
  }
  setWindowTitle(win, title) {
    this._wm.setWindowTitle(win, title);
  }
  setWindowContent(win, content) {
    this._wm.setWindowContent(win, content);
  }
  getWindowContent(win) {
    return this._wm.getWindowContent(win);
  }
  ownResource(win, resource, disposer) {
    return this._wm.ownResource(win, resource, disposer);
  }
  ownSocket(win, url, protocols) {
    return this._wm.ownSocket(win, url, protocols);
  }
  toggleBounce(section) {
    this._wm.toggleBounce(section);
  }
  /* ── Dialog delegation (DialogHost) ───────────────────────── */
  dialogShow(opts) {
    return dialogShow(this, opts);
  }
  dialogInfo(o = {}) {
    return dialogInfo(this, o);
  }
  dialogWarning(o = {}) {
    return dialogWarning(this, o);
  }
  dialogDanger(o = {}) {
    return dialogDanger(this, o);
  }
  dialogAlert(o = {}) {
    return dialogAlert(this, o);
  }
  dialogConfirm(o = {}) {
    return dialogConfirm(this, o);
  }
  dialogPrompt(o = {}) {
    return dialogPrompt(this, o);
  }
  dialogSave(o = {}) {
    return dialogSave(this, o);
  }
  dialogOpen(o = {}) {
    return dialogOpen(this, o);
  }
  /* ── Toast / modal / drawer delegation ────────────────────── */
  toast(message, type, duration) {
    if (typeof message === "object" && message !== null) {
      return createToast(message, this);
    }
    const options = { message };
    if (type !== void 0) options.type = type;
    if (duration !== void 0) options.duration = duration;
    return createToast(options, this);
  }
  customModal(options) {
    return createModal(options, this);
  }
  drawer(options) {
    return createDrawer(options, this);
  }
  /* ── Context menu (src/context-menu.js) ───────────────────── */
  showContextMenu(opts) {
    this.hideContextMenu();
    const items = opts.items;
    if (!items) return;
    const options = Object.assign({ x: 0, y: 0 }, opts);
    const menu = $tag("div", { class: "ctx-menu", role: "menu" });
    menu.style.left = `${options.x}px`;
    menu.style.top = `${options.y}px`;
    items.forEach((item) => {
      if (item.sep) {
        menu.appendChild($tag("div", { class: "ctx-sep", role: "separator" }));
        return;
      }
      const el = $tag("div", { class: "ctx-item", role: "menuitem", tabindex: "-1" });
      if (item.checked !== void 0) {
        const check = $tag("span", { class: "ctx-check" });
        check.textContent = item.checked ? "✓" : "";
        el.appendChild(check);
        el.setAttribute("aria-checked", item.checked ? "true" : "false");
      }
      el.appendChild($tag("span", {}, [$text(item.label ?? "")]));
      if (item.kbd) el.appendChild($tag("span", { class: "ctx-kbd" }, [$text(item.kbd)]));
      if (item.disabled) {
        el.classList.add("disabled");
        el.setAttribute("aria-disabled", "true");
      }
      const onClick = item.onclick;
      if (onClick) {
        el.addEventListener("click", ((e) => {
          e.stopPropagation();
          if (!item.disabled) {
            onClick();
            this.hideContextMenu();
          }
        }));
      }
      menu.appendChild(el);
    });
    this._mountNode(menu);
    const mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth) menu.style.left = `${(options.x ?? 0) - mr.width}px`;
    if (mr.bottom > window.innerHeight) menu.style.top = `${(options.y ?? 0) - mr.height}px`;
    this._ctxMenuEl = menu;
    this._ctxMenuPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this._ctxMenuKeyHandler = ((event) => {
      const enabled = Array.from(menu.querySelectorAll(".ctx-item")).filter((it) => !it.classList.contains("disabled"));
      if (enabled.length === 0) return;
      const idx = enabled.indexOf(document.activeElement);
      const move = (next) => {
        var _a;
        event.preventDefault();
        (_a = enabled[next]) == null ? void 0 : _a.focus();
      };
      switch (event.key) {
        case "ArrowDown":
          move(idx < 0 || idx === enabled.length - 1 ? 0 : idx + 1);
          break;
        case "ArrowUp":
          move(idx <= 0 ? enabled.length - 1 : idx - 1);
          break;
        case "Home":
          move(0);
          break;
        case "End":
          move(enabled.length - 1);
          break;
        case "Escape":
          event.preventDefault();
          this.hideContextMenu();
          break;
        case "Enter":
        case " ":
          if (idx >= 0) {
            event.preventDefault();
            enabled[idx].click();
          }
          break;
      }
    });
    document.addEventListener("keydown", this._ctxMenuKeyHandler);
    window.setTimeout(() => {
      this._ctxMenuHandler = (() => this.hideContextMenu());
      this._listen(document, "click", this._ctxMenuHandler, { once: true });
    }, 0);
  }
  hideContextMenu() {
    if (this._ctxMenuEl) {
      this._unmountNode(this._ctxMenuEl);
      this._ctxMenuEl = null;
    }
    if (this._ctxMenuKeyHandler) {
      document.removeEventListener("keydown", this._ctxMenuKeyHandler);
      this._ctxMenuKeyHandler = null;
    }
    if (this._ctxMenuHandler) {
      document.removeEventListener("click", this._ctxMenuHandler);
      this._ctxMenuHandler = null;
    }
    if (this._ctxMenuPreviousFocus) {
      this._ctxMenuPreviousFocus.focus();
      this._ctxMenuPreviousFocus = null;
    }
  }
  /* ── Cleanup ──────────────────────────────────────────────── */
  destroy() {
    var _a;
    if (this._destroyed) return;
    this._destroyed = true;
    (_a = this._listenerController) == null ? void 0 : _a.abort();
    if (this._clockInterval !== null) {
      window.clearInterval(this._clockInterval);
      this._clockInterval = null;
    }
    if (this._lockInterval !== null) {
      window.clearInterval(this._lockInterval);
      this._lockInterval = null;
    }
    this._animationsEnabled = false;
    this.closeAllWindows();
    this._wm.disposeSnapPreview();
    this._unmountNode(this._searchEl);
    this._searchEl = null;
    this._unmountNode(this._switcherEl);
    this._switcherEl = null;
    this._ownedNodes.forEach((node) => {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    this._ownedNodes.clear();
    this._tileSaved = [];
    this._tileActive = false;
    this._toasts = null;
    this.clearContentCache();
    this.hideContextMenu();
    this._queryAll(".desktop-grid, #expose-backdrop, #explosion-canvas, #lock-screen, #toast-center").forEach((el) => this._unmountNode(el));
    this._listeners = /* @__PURE__ */ Object.create(null);
  }
  /* ── Static factory ───────────────────────────────────────── */
  static create(config) {
    const instance = new _Prestige(config);
    instance.init();
    return instance;
  }
  static mixin(descriptor) {
    Object.assign(_Prestige.prototype, descriptor);
  }
  /** Register a component factory. */
  static registerComponent(name, factory, options) {
    defaultRegistry.register(name, factory, options);
    return _Prestige;
  }
  /** Unregister a component factory. */
  static unregisterComponent(name) {
    defaultRegistry.unregister(name);
    return _Prestige;
  }
  /** Check whether a component is registered. */
  static hasComponent(name) {
    return defaultRegistry.has(name);
  }
  /** Retrieve a registered component factory. */
  static getComponent(name) {
    return defaultRegistry.get(name);
  }
  /** List all registered component names. */
  static listComponents() {
    return defaultRegistry.list();
  }
  /** Instantiate a registered component via the shared registry. */
  createComponent(name, options = {}) {
    return defaultRegistry.create(name, options, this);
  }
  /* ── Internal helpers ─────────────────────────────────────── */
  _getFocusedWindow() {
    const el = this._query(".window.is-focused");
    return el instanceof HTMLElement ? el : null;
  }
};
/* ── Component registry (parity with vanilla Prestige.components) ── */
/** Shared component registry (drop-in for the vanilla `Prestige.components`). */
__publicField(_Prestige, "components", defaultRegistry);
let Prestige = _Prestige;
export {
  $id,
  $tag,
  $text,
  ComponentRegistry,
  DIALOG_ICON_NAMES,
  DisposalStack,
  ICONS,
  Owned,
  Prestige,
  PrestigeStore,
  WindowManager,
  applyComponentOptions,
  assertSafeAppId,
  createAccordion,
  createAlert,
  createAvatar,
  createBadge,
  createBreadcrumb,
  createBtn,
  createCard,
  createCheckbox,
  createDataTable,
  createDrawer,
  createDropdown,
  createEmptyState,
  createField,
  createFileInput,
  createIcon,
  createInput,
  createInputGroup,
  createModal,
  createPagination,
  createProgress,
  createProgressBar,
  createRadioGroup,
  createSearchInput,
  createSegmentedControl,
  createSelect,
  createSkeleton,
  createStatCard,
  createStepper,
  createSwitch,
  createTable,
  createTabs,
  createTextarea,
  createToast,
  createTooltip,
  Prestige as default,
  defaultRegistry,
  dialogAlert,
  dialogConfirm,
  dialogDanger,
  dialogIcon,
  dialogInfo,
  dialogOpen,
  dialogPrompt,
  dialogSave,
  dialogShow,
  dialogWarning,
  escapeHtml,
  focusablesWithin,
  isElementVisuallySafe,
  isSafeAppId,
  isSafeIframeSrc,
  isSafeUrl,
  isolatedPostTargetOrigin,
  renderIcons,
  replaceContent,
  sanitizeHtml,
  sanitizeWith,
  setSafeAttribute,
  trapFocusWithin,
  web3TransactionGuard
};
//# sourceMappingURL=prestige.js.map
