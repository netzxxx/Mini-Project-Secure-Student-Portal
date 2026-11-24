// Small API client shared by the login page and the app page.
// The JWT is kept in sessionStorage (cleared when the tab is closed).
const Api = (() => {
    const TOKEN_KEY = 'portal.token';

    function token() {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    function setToken(value) {
        if (value) sessionStorage.setItem(TOKEN_KEY, value);
        else sessionStorage.removeItem(TOKEN_KEY);
    }

    async function request(method, path, body) {
        const headers = { 'Accept': 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (token()) headers['Authorization'] = 'Bearer ' + token();

        const res = await fetch(path, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        let data = null;
        const text = await res.text();
        if (text) {
            try { data = JSON.parse(text); } catch { data = text; }
        }
        if (!res.ok) {
            const err = new Error((data && (data.error || data.message)) || ('HTTP ' + res.status));
            err.status = res.status;
            err.retryAfter = Number(res.headers.get('Retry-After')) || 0;
            throw err;
        }
        return data;
    }

    // Only the HTTP status of a GET request; 403 is an expected answer here, not an error.
    async function probe(path) {
        const res = await fetch(path, { headers: { 'Authorization': 'Bearer ' + token() }, cache: 'no-store' });
        return res.status;
    }

    // Payload of the JWT, for display only. The signature is verified by the server.
    function claims() {
        try {
            return JSON.parse(atob(token().split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        } catch { return {}; }
    }

    async function showBuild(el) {
        try {
            const info = await request('GET', '/api/info');
            el.textContent = info.build === 'v2-fixed' ? 'v2 · fixed build' : 'v1 · vulnerable build';
            el.classList.add(info.build === 'v2-fixed' ? 'ok' : 'warn');
            el.classList.remove('hidden');
        } catch { /* badge is optional */ }
    }

    return {
        token, setToken, showBuild, probe, claims,
        get: (p) => request('GET', p),
        post: (p, b) => request('POST', p, b),
        put: (p, b) => request('PUT', p, b),
        patch: (p, b) => request('PATCH', p, b),
    };
})();

// Builds DOM nodes with textContent only, so data from the API is never parsed as HTML (no XSS).
function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (k === 'class') node.className = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}
