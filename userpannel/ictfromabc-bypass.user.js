// ==UserScript==
// @name         ICTFromABC — Device-Lock Bypass & API Suite v3
// @namespace    http://tampermonkey.net/
// @version      3.0.2
// @description  Standalone device-lock bypass + COMPLETE API toolkit (full-surface recon of 2026-11-12: 202 endpoint pairs, 9 categories, admin namespace mapped as RBAC-403 groups). Pins the enrolled FingerprintJS identity on every login (JSON AND urlencoded bodies — the raw fingerprint must never leave the device), intercepts the 302 -> /blocked pause bounce (login responses get a synthetic 200, navigation guard drops /blocked pushes, exact-path matching), canonicalizes apex -> www documents, backs up the Bearer token, auto-relogins with the pinned fingerprint on real 401s (45 s cooldown, 5-fail cap, always reloads), plus a token-health WATCHDOG (default 5 min, toggleable). Console explorer window.__ICT_API: .list() / .call() / .quick() / .resolveVideo() (Bunny GUID -> playlist candidates + ffmpeg command) / .lesson() / .allowed() / .pdfs() / .pastPapers() / .watchdog() / .pin() / .debug() / .log() / .help(). In browsers where the delta companion runs (window.__ICT_DELTA), relogin and watchdog are delegated to it to keep exactly one responder.
// @author       local workspace
// @match        https://ictfromabc.com/*
// @match        https://www.ictfromabc.com/*
// @match        https://metrics.ictfromabc.com/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      ictfromabc.com
// @connect      www.ictfromabc.com
// ==/UserScript==

(function () {
    'use strict';
    try {

    const VERSION = '3.0.2';
    const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    // Idempotence: never double-arm (the test bed may inject this file AND an
    // addInitScript copy of the same content).
    if (W.__ICT_BYPASS) return;
    W.__ICT_BYPASS = { v: VERSION, armedAt: Date.now() };

    const IS_METRICS = location.hostname === 'metrics.ictfromabc.com';
    if (IS_METRICS) {
        console.log('%c[ICT-BYPASS] metrics.ictfromabc.com hit (fingerprint ingress) — observing only', 'color:#8ab4f8');
        return;
    }

    // Origin canonicalization (parity with suite v2.3.1): the server keeps ONE
    // live session, but localStorage is per-origin — an apex tab and a www tab
    // would revoke each other's token forever. Canonicalize every document to
    // www before anything else runs.
    if (location.hostname === 'ictfromabc.com') {
        const to = 'https://www.ictfromabc.com' + location.pathname + location.search + location.hash;
        console.log('%c[ICT-BYPASS] apex → www canonicalization', 'color:#8ab4f8', to);
        try { location.replace(to); } catch (e) { location.href = to; }
        return;
    }

    // Init-script contexts have no @match enforcement — stay on the site only.
    if (!/^(www\.)?ictfromabc\.com$/.test(location.hostname)) return;

    // Single-responder coordination: when the delta companion is present (test
    // bed), it owns auto-relogin — this script stays headless and only provides
    // the pin rewrite, pause interception, backup and the console API.
    const DELTA_V = (function () {
        try { return (W.__ICT_DELTA && W.__ICT_DELTA.v >= 3) ? W.__ICT_DELTA.v : 0; } catch (e) { return 0; }
    })();
    const MODE = DELTA_V ? ('headless (relogin delegated to delta v' + DELTA_V + ')') : 'standalone';
    // API lives on the APEX origin only. Live-verified 2026-11-12: the same
    // Bearer token gets 200 from https://ictfromabc.com/api/* (which sends
    // access-control-allow-origin: https://www.ictfromabc.com — that is how
    // the SPA itself works) but 401 from https://www.ictfromabc.com/api/*,
    // which serves public routes fine yet rejects authed tokens. The old
    // "same-origin only" conclusion (v2's location.origin base) is falsified;
    // www /api/authed calls were the 401s seen in the live battery. Documents
    // always run on www (apex canonicalized above), the API is always apex.
    const API_BASE = 'https://ictfromabc.com';

    // ─────────────────────────────────────────────────────────────
    // STORE — GM-backed, with localStorage fallbacks for the pin
    // (the delta/suite keep ict_pin/ict_conf in raw localStorage).
    // ─────────────────────────────────────────────────────────────
    function gmGet(k, d) { try { const v = GM_getValue(k, d); return v === undefined ? d : v; } catch (e) { return d; } }
    function gmSet(k, v) { try { GM_setValue(k, v); } catch (e) {} }
    function gmDel(k) { try { GM_deleteValue(k); } catch (e) {} }

    const Store = {
        get pin() {
            try {
                const p = JSON.parse(gmGet('ict_pin', 'null'));
                if (p && p.visitorId) return p;
            } catch (e) {}
            // Fallback: the raw localStorage keys maintained by the delta/suite.
            try {
                const v = W.localStorage.getItem('ict_pin');
                if (v) return { visitorId: v, confidenceScore: parseFloat(W.localStorage.getItem('ict_conf') || '0.82') || 0.82, source: 'localStorage (delta/suite)' };
            } catch (e) {}
            return null;
        },
        set pin(v) { gmSet('ict_pin', JSON.stringify(v)); },
        clearPin() { gmDel('ict_pin'); },
        get backup() {
            try { return JSON.parse(gmGet('ict_backup_token', 'null')) || null; } catch (e) { return null; }
        },
        set backup(v) { gmSet('ict_backup_token', JSON.stringify(v)); },
        log(msg, data) {
            let arr = [];
            try { arr = JSON.parse(gmGet('ict_log2', '[]')); } catch (e) {}
            arr.unshift({ t: Date.now(), msg: msg, data: data === undefined ? null : data });
            if (arr.length > 100) arr = arr.slice(0, 100);
            gmSet('ict_log2', JSON.stringify(arr));
            console.log('%c[ICT-BYPASS] ' + msg, 'color:#00c853;font-weight:bold', data === undefined ? '' : data);
        }
    };

    function notify(text) { try { GM_notification({ title: 'ICT Bypass v3', text: text, timeout: 4000 }); } catch (e) {} }

    // ─────────────────────────────────────────────────────────────
    // BODY REWRITER — the single choke point: every JSON body that
    // carries visitorId/confidenceScore gets the pinned values.
    // ─────────────────────────────────────────────────────────────
    function rewriteBody(raw) {
        if (typeof raw !== 'string' || raw.length === 0) return { body: raw, changed: false };
        if (raw[0] === '{' || raw[0] === '[') return rewriteJsonBody(raw);
        // urlencoded branch: a login sent as a=1&visitorId=x must be pinned
        // too — shipping it raw is exactly the fingerprint leak the rewriter
        // exists to prevent (caught by the v3 test suite).
        if (raw.indexOf('visitorId=') >= 0) {
            try {
                const params = new URLSearchParams(raw);
                if (params.has('visitorId')) {
                    const pin = Store.pin;
                    let changed = false;
                    if (pin && pin.visitorId && params.get('visitorId') !== pin.visitorId) {
                        params.set('visitorId', pin.visitorId); changed = true;
                    }
                    if (pin && pin.confidenceScore != null && params.has('confidenceScore') &&
                        String(pin.confidenceScore) !== params.get('confidenceScore')) {
                        params.set('confidenceScore', String(pin.confidenceScore)); changed = true;
                    }
                    const obj = {
                        phoneNumber: params.get('phoneNumber'),
                        visitorId: params.get('visitorId'),
                        confidenceScore: parseFloat(params.get('confidenceScore') || '0')
                    };
                    return { body: params.toString(), changed: changed, obj: obj };
                }
            } catch (e) {}
        }
        return { body: raw, changed: false };
    }

    function rewriteJsonBody(raw) {
        let obj;
        try { obj = JSON.parse(raw); } catch (e) { return { body: raw, changed: false }; }
        const pin = Store.pin;
        let changed = false;
        const walk = function (o) {
            if (!o || typeof o !== 'object') return;
            if ('visitorId' in o) {
                if (pin && pin.visitorId && o.visitorId !== pin.visitorId) { o.visitorId = pin.visitorId; changed = true; }
                if ('confidenceScore' in o && pin && pin.confidenceScore != null && o.confidenceScore !== pin.confidenceScore) {
                    o.confidenceScore = pin.confidenceScore; changed = true;
                }
            }
            for (const k of Object.keys(o)) {
                const v = o[k];
                if (v && typeof v === 'object') walk(v);
            }
        };
        walk(obj);
        return { body: JSON.stringify(obj), changed: changed, obj: obj };
    }

    function noteLoginAttempt(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (!('phoneNumber' in obj) || !('visitorId' in obj)) return;
        // First-wins until a response consumes it: a second attempt with a
        // different visitorId must not overwrite the one that may succeed
        // (the auto-pin would otherwise capture the wrong fingerprint).
        if (STATE.lastLogin && !STATE.lastLogin.consumed) return;
        STATE.lastLogin = {
            visitorId: obj.visitorId,
            confidenceScore: obj.confidenceScore,
            phone: obj.phoneNumber,
            at: Date.now(),
            consumed: false
        };
        Store.log('login attempt observed', {
            visitorId: obj.visitorId,
            confidenceScore: obj.confidenceScore,
            phone: String(obj.phoneNumber).replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
            pinnedByRewrite: !!(Store.pin && Store.pin.visitorId === obj.visitorId)
        });
    }

    const STATE = { lastLogin: null, blockedNavigations: 0, pauseBlocks: 0 };

    function PauseBounceError(url, kind) {
        this.name = 'PauseBounceError';
        this.url = url;
        this.kind = kind;
    }
    PauseBounceError.prototype = Object.create(Error.prototype);

    // Exact-path /blocked matching — the old /\/blocked\b/ regex also matched
    // paths like /onboarding/blocked-notice and silently dropped legitimate
    // SPA navigations (caught by the v3 test suite).
    function isBlockedPath(p) {
        return p === '/blocked' || p.indexOf('/blocked/') === 0;
    }
    function isBlockedRedirect(u) {
        return typeof u === 'string' && (u.indexOf('/blocked') === 0 || u.indexOf('/blocked?') === 0 ||
            /^https?:\/\/[^/]*ictfromabc\.com\/blocked(\/|\?|$)/.test(u));
    }

    // ─────────────────────────────────────────────────────────────
    // RESPONSE INSPECTOR — pause bounce FIRST (a 200 can carry both a
    // token and a /blocked redirect_url — the bounce wins), then
    // 200 -> auto-pin (first ever login), then 422 diagnostics.
    // ─────────────────────────────────────────────────────────────
    function inspectLoginResponse(status, bodyText, finalUrl) {
        let j = null;
        try { j = JSON.parse(bodyText); } catch (e) {}

        if (status === 302 || isBlockedRedirect(j && j.redirect_url)) {
            Store.log('PAUSE BOUNCE intercepted', { status: status, redirect_url: j && j.redirect_url, finalUrl: finalUrl });
            notify('Pause bounce intercepted — /blocked navigation blocked. Token preserved.');
            throw new PauseBounceError((j && j.redirect_url) || '/blocked', status === 302 ? 'status-302' : 'body.redirect_url');
        }

        if (status === 200 && j && j.token) {
            if (!Store.pin && STATE.lastLogin) {
                STATE.lastLogin.consumed = true;
                Store.pin = {
                    visitorId: STATE.lastLogin.visitorId,
                    confidenceScore: STATE.lastLogin.confidenceScore,
                    boundAt: Date.now(),
                    source: 'auto-captured from successful login'
                };
                notify('Pinned visitorId captured. Menu → Export pin, then Import on every other device BEFORE logging in there.');
                Store.log('auto-pin captured', { visitorId: STATE.lastLogin.visitorId });
            }
            return;
        }

        if (status === 422 && j && j.errors) {
            const fpErr = (j.errors.visitorId || j.errors.confidenceScore || [])[0];
            if (fpErr && /browser|fingerprint|check your browser/i.test(fpErr)) {
                Store.log('422 fingerprint rejection', j.errors);
                notify('422 fingerprint rejection: "' + fpErr + '" — ' + (Store.pin ? 'pin set but rejected; verify it matches the bound device.' : 'no pin set; import one first (menu → Import).'));
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // TOKEN BACKUP — copy token/role/user to GM storage when seen.
    // v2 NEVER auto-restores a stale copy (that was the v1 401-loop);
    // the backup exists for Export, and fresh sessions come from the
    // pinned auto-relogin instead.
    // ─────────────────────────────────────────────────────────────
    function backupTokens() {
        try {
            const token = W.localStorage.getItem('token');
            if (!token) return;
            const prev = Store.backup;
            if (!prev || prev.token !== token) {
                Store.backup = {
                    token: token,
                    role: W.localStorage.getItem('role'),
                    user: W.localStorage.getItem('user'),
                    savedAt: Date.now()
                };
                Store.log('token backed up', { role: W.localStorage.getItem('role') });
            }
        } catch (e) {}
    }

    // ─────────────────────────────────────────────────────────────
    // AUTO-RELOGIN (standalone mode only) — fresh pinned login when
    // a real 401 fires: 45 s cooldown, 5-fail cap, busy guard, skip
    // on /blocked, ALWAYS reload after success so the SPA adopts the
    // fresh token instead of wiping it with a stale in-memory one.
    // ─────────────────────────────────────────────────────────────
    const CREDS_KEY = 'ict_bypass_creds';
    function creds() {
        try {
            const raw = atob(gmGet(CREDS_KEY, ''));
            const i = raw.indexOf('\n');
            if (i < 1) return null;
            const p = raw.slice(0, i), w = raw.slice(i + 1);
            return (p && w) ? { phone: p, pass: w } : null;
        } catch (e) { return null; }
    }

    let reBusy = false, reLast = 0, reFails = 0, reOk = 0;

    async function reauth(reason) {
        if (DELTA_V) return false; // delta owns relogin in this browser
        const c = creds();
        if (!c || reBusy) return false;
        const now = Date.now();
        if (now - reLast < 45000) return false;
        if (reFails >= 5) { if (reFails === 5) { reFails++; Store.log('auto-relogin stopped: 5 failed attempts — check pin/credentials', {}); } return false; }
        if (isBlockedPath(location.pathname)) { Store.log('on /blocked — skipping relogin (paused accounts need staff unlock)', {}); return false; }
        const pin = Store.pin;
        if (!pin || !pin.visitorId) { Store.log('auto-relogin skipped: no pinned fingerprint (import one first)', {}); return false; }
        reBusy = true; reLast = now; reFails++;
        Store.log('taking the session back (' + reason + ') ...', {});
        try {
            const r = await fetch(API_BASE + '/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ phoneNumber: c.phone, password: c.pass, visitorId: pin.visitorId, confidenceScore: pin.confidenceScore })
            });
            let txt = ''; try { txt = await r.text(); } catch (e) {}
            let j = null; try { j = JSON.parse(txt); } catch (e) {}
            if (r.status === 200 && j && j.token) {
                try {
                    W.localStorage.setItem('token', j.token);
                    if (j.role) W.localStorage.setItem('role', j.role);
                    if (j.user) W.localStorage.setItem('user', JSON.stringify(j.user));
                } catch (e) {}
                reOk++; reFails = 0;
                backupTokens();
                Store.log('session restored (' + String(j.token).slice(0, 8) + '...) — reloading so the app adopts the fresh token', {});
                location.reload();
                return true;
            } else if (r.status === 422) {
                Store.log('auto-relogin got 422 — fingerprint rejected; refresh the pin', {});
            } else if (r.status === 429) {
                Store.log('auto-relogin got 429 — rate limited; 45 s cooldown applies', {});
            } else if (r.status === 302) {
                Store.log('auto-relogin got 302 — ACCOUNT ON PAUSE; staff unlock required', { url: j && j.redirect_url });
                notify('Account on Pause detected at login — staff unlock required.');
            } else {
                Store.log('auto-relogin HTTP ' + r.status, { body: String(txt).slice(0, 120) });
            }
        } catch (e) {
            Store.log('auto-relogin failed: ' + (e.message || e), {});
        }
        reBusy = false;
        return true;
    }

    function saveLogin() {
        const phone = window.prompt('Phone number:', creds() ? creds().phone : '');
        if (phone === null) return;
        const pass = window.prompt('Password (stored locally in this browser only):', '');
        if (pass === null) return;
        if (!phone || !pass) { notify('Save login cancelled.'); return; }
        gmSet(CREDS_KEY, btoa(phone + '\n' + pass));
        notify('Login saved. Auto-relogin armed — it fires on real 401s only (45 s cooldown).');
        Store.log('credentials saved', { phone: String(phone).replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') });
    }

    function clearLogin() { gmDel(CREDS_KEY); notify('Saved login cleared; auto-relogin disarmed.'); }

    // ─────────────────────────────────────────────────────────────
    // FETCH HOOK — rewrite login/OTP bodies, inspect /api responses
    // for the pause bounce, watch 401s for auto-relogin, back up the
    // token as it appears.
    // ─────────────────────────────────────────────────────────────
    function resolveUrl(input) {
        try {
            return new URL(typeof input === 'string' ? input : ((input && (input.url || input.href)) || ''), location.href);
        } catch (e) { return null; }
    }

    function installFetchHook() {
        const origFetch = W.fetch;
        if (typeof origFetch !== 'function' || origFetch.__ictHooked) return;

        // Shared response observer for every /api call: 401 → reauth,
        // 200 → token backup, login paths → pause suppression with a
        // synthetic 200 (the caller never sees the pause) + inspection.
        function observe(sent, U, url, isLoginPath) {
            return sent.then(function (resp) {
                if (resp.status === 401 && !isLoginPath) reauth('401 ' + U.pathname);
                if (resp.status === 200) backupTokens();
                if (!isLoginPath && resp.status !== 302) return resp;
                let clone = null;
                try { clone = resp.clone(); } catch (e) {}
                if (!clone) return resp;
                return clone.text().then(function (text) {
                    let j = null; try { j = JSON.parse(text); } catch (e) {}
                    if (isLoginPath && (resp.status === 302 || isBlockedRedirect(j && j.redirect_url))) {
                        STATE.pauseBlocks++;
                        Store.log('PAUSE BOUNCE suppressed → synthetic 200 (caller never sees the pause)', { status: resp.status, redirect_url: j && j.redirect_url });
                        notify('Pause bounce suppressed — token preserved.');
                        try {
                            return new W.Response(JSON.stringify({ suppressed: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
                        } catch (e) { return resp; }
                    }
                    try { inspectLoginResponse(resp.status, text, (clone && clone.url) || url); }
                    catch (e) { if (e instanceof PauseBounceError) Store.log('pause bounce on non-login path neutralized', { url: url.slice(0, 120) }); }
                    return resp;
                }).catch(function () { return resp; });
            }).catch(function () { return sent; });
        }

        const hooked = function (input, init) {
            try {
                const U = resolveUrl(input);
                const url = U ? U.href : '';
                const isLogin = U ? (U.pathname === '/api/login' || U.pathname === '/api/login/otp') : /\/api\/login/.test(url);

                // Request-object logins: clone, read, rewrite, rebuild. Never
                // double-send, never send raw — a raw fingerprint login is the
                // one thing that re-enrolls and re-locks the account.
                if (isLogin && input instanceof Request && !(init && init.body)) {
                    const self = this;
                    let cloned = null;
                    try { cloned = input.clone(); } catch (e) { cloned = null; }
                    if (!cloned) {
                        // Fail-closed: an unreadable login body must NOT go out
                        // raw (the v2 async fallback did exactly that).
                        Store.log('login Request body unreadable — request suppressed (fail-closed)', { url: url.slice(0, 120) });
                        return Promise.reject(new TypeError('[ICT-BYPASS] unreadable login body — suppressed to protect the fingerprint'));
                    }
                    return cloned.text().then(function (text) {
                        const r = rewriteBody(text);
                        if (r.obj) noteLoginAttempt(r.obj);
                        let req = input;
                        if (r.changed) {
                            req = new Request(url, {
                                method: input.method, headers: input.headers, body: r.body,
                                mode: input.mode, credentials: input.credentials, cache: input.cache,
                                redirect: input.redirect, referrer: input.referrer, integrity: input.integrity
                            });
                            Store.log('rewrote Request body', { url: url.slice(0, 120) });
                        }
                        const sent = origFetch.call(self, req, init);
                        if (U && (U.host === 'ictfromabc.com' || U.host === 'www.ictfromabc.com') && U.pathname.indexOf('/api/') === 0) {
                            return observe(sent, U, url, true);
                        }
                        return sent;
                    });
                }

                let newInit = init;
                if (init && typeof init.body === 'string' && init.body.length) {
                    const r = rewriteBody(init.body);
                    if (r.changed) {
                        newInit = Object.assign({}, init, { body: r.body });
                        Store.log('rewrote request body', { url: url.slice(0, 120) });
                    }
                    if (isLogin && r.obj) noteLoginAttempt(r.obj);
                } else if (isLogin && init && init.body instanceof URLSearchParams) {
                    const r = rewriteBody(init.body.toString());
                    if (r.changed) {
                        newInit = Object.assign({}, init, { body: r.body });
                        Store.log('rewrote urlencoded login body (kept urlencoded)', {});
                    }
                    if (r.obj) noteLoginAttempt(r.obj);
                }

                const sent = origFetch.apply(this, input instanceof Request && newInit && newInit.body !== undefined && newInit.body !== init?.body
                    ? [new Request(url, newInit), undefined]
                    : [input, newInit]);

                if (U && (U.host === 'ictfromabc.com' || U.host === 'www.ictfromabc.com') && U.pathname.indexOf('/api/') === 0) {
                    return observe(sent, U, url, U.pathname === '/api/login' || U.pathname === '/api/login/otp');
                }
                return sent;
            } catch (err) {
                // The hook must never break the page: internal errors fall
                // through to the original fetch with the caller's own args.
                // The deliberate fail-closed login rejection above never lands
                // here (it returns before the try can be re-entered).
                try { Store.log('hook internal error — falling through to original fetch', { err: String((err && err.message) || err) }); } catch (e) {}
                return origFetch.apply(this, [input, init]);
            }
        };
        hooked.__ictHooked = true;
        W.fetch = hooked;
        Store.log('fetch hook installed', {});
    }

    // ─────────────────────────────────────────────────────────────
    // XHR HOOK — same rewrite + inspection for XMLHttpRequest users.
    // ─────────────────────────────────────────────────────────────
    function installXhrHook() {
        const proto = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
        if (!proto || proto.__ictHooked) return;
        const origOpen = proto.open;
        const origSend = proto.send;
        proto.open = function (method, url) {
            this.__ictUrl = url;
            this.__ictMethod = method;
            return origOpen.apply(this, arguments);
        };
        proto.send = function (body) {
            const rawUrl = String(this.__ictUrl || '');
            let U = null; try { U = new URL(rawUrl, location.href); } catch (e) {}
            const path = U ? U.pathname : rawUrl;
            const isLogin = path === '/api/login' || path === '/api/login/otp';
            let sendBody = body;
            if (typeof body === 'string' && body.length) {
                const r = rewriteBody(body);
                if (r.changed) {
                    sendBody = r.body;
                    Store.log('rewrote XHR body', { url: rawUrl.slice(0, 120) });
                }
                if (isLogin && r.obj) noteLoginAttempt(r.obj);
            }
            if (U && (U.host === 'ictfromabc.com' || U.host === 'www.ictfromabc.com') && U.pathname.indexOf('/api/') === 0) {
                this.addEventListener('load', function () {
                    try {
                        if (this.status === 401 && !isLogin) reauth('401 ' + path + ' (xhr)');
                        else if (this.status === 200) backupTokens();
                        inspectLoginResponse(this.status, this.responseText, this.responseURL);
                    } catch (e) {
                        if (e instanceof PauseBounceError) Store.log('XHR pause bounce neutralized', { url: path });
                    }
                });
            }
            return origSend.call(this, sendBody);
        };
        proto.__ictHooked = true;
        Store.log('XHR hook installed', {});
    }

    // ─────────────────────────────────────────────────────────────
    // NAVIGATION GUARD — drop SPA router pushes to /blocked (the
    // token wipe runs on arrival, so stopping arrival stops it).
    // ─────────────────────────────────────────────────────────────
    function installNavigationGuard() {
        const wrap = function (name) {
            const orig = W.history[name];
            if (!orig || orig.__ictHooked) return;
            const hooked = function (state, title, url) {
                try {
                    const abs = new URL(url, location.href);
                    if (isBlockedPath(abs.pathname)) {
                        STATE.blockedNavigations++;
                        Store.log('blocked navigation to /blocked via history.' + name, {});
                        notify('Blocked bounce to /blocked (token preserved).');
                        return;
                    }
                } catch (e) {}
                return orig.apply(this, arguments);
            };
            hooked.__ictHooked = true;
            W.history[name] = hooked;
        };
        wrap('pushState');
        wrap('replaceState');
        W.addEventListener('popstate', function () {
            if (isBlockedPath(location.pathname) && (Store.pin || Store.backup)) {
                Store.log('popstate landed on /blocked — bouncing back', {});
                try { W.history.back(); } catch (e) {}
            }
        });
    }

    // ─────────────────────────────────────────────────────────────
    // COMPLETE API MAP — student-facing surface, from
    // analysis/API_MAP_CURRENT.md (build of 2026-11-12).
    // c=category, m=method, p=path template, a=needs Bearer,
    // d=description/shape notes.
    // ─────────────────────────────────────────────────────────────
    const API_MAP = [
        // Auth
        { c: 'Auth', m: 'POST', p: '/login', a: false, d: 'Body {phoneNumber,password,visitorId,confidenceScore} → 200 {msg,user,token,role,authenticated,skippable,course_id}; 302 = pause; 422 = validation. Rewritten to the pinned fingerprint by this script.' },
        { c: 'Auth', m: 'POST', p: '/login/otp', a: false, d: 'Login for OTP-enabled accounts: same body + otp.' },
        { c: 'Auth', m: 'POST', p: '/logout', a: true, d: 'Invalidates the current Bearer token.' },
        { c: 'Auth', m: 'POST', p: '/register', a: false, d: 'Account registration, multipart/form-data (all fields appended). Found by full recon (RECON_FULL.md); absent from earlier maps.' },
        // User
        { c: 'User', m: 'GET', p: '/user', a: true, d: 'Student profile object (name, contact, course_id, institute_id, ...).' },
        { c: 'User', m: 'PUT', p: '/user', a: true, d: 'Profile update.' },
        { c: 'User', m: 'POST', p: '/user', a: true, d: 'DUAL USE: password change {oldPassword,newPassword,newPassword_confirmation,_method:"PATCH"} (wrapper never uses it for avatar — that is POST /user/id).' },
        { c: 'User', m: 'POST', p: '/user/id', a: true, d: 'ID document upload.' },
        { c: 'User', m: 'POST', p: '/user/delete', a: true, d: 'Account deletion; body {password}.' },
        // OTP / password reset
        { c: 'OTP/Reset', m: 'POST', p: '/request-otp-v2/{phone}', a: false, d: 'Request login OTP for a phone.' },
        { c: 'OTP/Reset', m: 'POST', p: '/validate-otp-v2/{phone}', a: false, d: 'Body {otp}.' },
        { c: 'OTP/Reset', m: 'GET', p: '/validate-phone-number/{phone}', a: false, d: 'Phone format/availability check.' },
        { c: 'OTP/Reset', m: 'POST', p: '/forgot-password/request-otp/phone/{phone}', a: false, d: 'Password reset OTP (phone branch).' },
        { c: 'OTP/Reset', m: 'POST', p: '/forgot-password/validate-otp/phone/{phone}', a: false, d: 'Body {otp}.' },
        { c: 'OTP/Reset', m: 'POST', p: '/forgot-password/reset/phone/{phone}', a: false, d: 'Body {otp,password,password_confirmation}.' },
        { c: 'OTP/Reset', m: 'POST', p: '/forgot-password/request-otp/email', a: false, d: 'Body {email}.' },
        { c: 'OTP/Reset', m: 'POST', p: '/forgot-password/validate-otp/email', a: false, d: 'Body {email,otp}.' },
        { c: 'OTP/Reset', m: 'POST', p: '/forgot-password/reset/email', a: false, d: 'Body {email,otp,password,password_confirmation}.' },
        { c: 'OTP/Reset', m: 'GET', p: '/email/resend', a: true, d: 'Resend verification email.' },
        // Courses & lessons
        { c: 'Courses', m: 'GET', p: '/courses', a: true, d: 'Grouped catalogue {al:[...],ol:[...],pdfs:[...]} — ids like "2027-al", pdf groups like "tute".' },
        { c: 'Courses', m: 'GET', p: '/courses/{courseId}', a: true, d: 'Single course.' },
        { c: 'Courses', m: 'GET', p: '/courses/grades', a: true, d: 'Grade list.' },
        { c: 'Courses', m: 'GET', p: '/courses/ol-lessons', a: true, d: 'O/L lessons.' },
        { c: 'Courses', m: 'GET', p: '/public/courses/{courseId}', a: false, d: 'Public course view.' },
        { c: 'Courses', m: 'GET', p: '/public/courses/ol-lessons', a: false, d: 'Public O/L lessons.' },
        { c: 'Courses', m: 'GET', p: '/public/tutes', a: false, d: 'Public tute catalogue {tutes:[{id,title,description,price,type,low_count_status,url}],types}.' },
        { c: 'Lessons', m: 'GET', p: '/lessons', a: true, d: 'Full lesson catalogue (course-filtered).' },
        { c: 'Lessons', m: 'GET', p: '/lessons/allowed', a: true, d: 'Lessons this account may open — downloader entry point; items {id,title,description,thumbnail_url,preview_url,created_at}.' },
        { c: 'Lessons', m: 'GET', p: '/lessons/{lessonId}', a: true, d: '{lesson, videos:[{id,title,video_url,thumbnail_url,preview_url,created_at}], live}. video_url = Bunny embed | YouTube | HLS; no media token in it.' },
        { c: 'Lessons', m: 'GET', p: '/tutes', a: true, d: 'Tute catalogue.' },
        { c: 'Lessons', m: 'GET', p: '/tutes/purchased?page=N', a: true, d: 'Purchased tutes, paginated.' },
        // Videos
        { c: 'Videos', m: 'GET', p: '/videos/{videoId}', a: true, d: '{video_url} — player source (Bunny embed / YouTube / HLS). Use resolveVideo() for the token flow.' },
        { c: 'Videos', m: 'GET', p: '/videos/{videoId}/generate-token', a: true, d: '{message,token(64hex),expires(unix)} — appended to embed/thumbnail URLs; does NOT gate the Bunny pull zone.' },
        // PDFs & files
        { c: 'PDFs', m: 'GET', p: '/pdfs/{type}', a: true, d: 'List PDFs by tute TYPE: tute | lesson-pp | paper-book (400 "Tute Type not found" otherwise) → {pdfs:[{id,title,description,...}]}.' },
        { c: 'PDFs', m: 'GET', p: '/pdfs/{id}', a: true, d: 'PDF delivery by id (Bearer).' },
        { c: 'PDFs', m: 'GET', p: '/files/secure/{a}/{b}', a: true, d: 'Secure file delivery.' },
        // Papers
        { c: 'Papers', m: 'GET', p: '/papers', a: true, d: 'Papers list.' },
        { c: 'Papers', m: 'GET', p: '/papers/leaderboard/{paperId}', a: true, d: 'Leaderboard for a paper.' },
        { c: 'Papers', m: 'POST', p: '/papers/upload/{paperId}', a: true, d: 'Multipart file upload.' },
        { c: 'Papers', m: 'GET', p: '/model-papers', a: true, d: 'Model papers list.' },
        { c: 'Papers', m: 'GET', p: '/model-papers/availability', a: true, d: '{availability:true|false}.' },
        { c: 'Papers', m: 'POST', p: '/model-papers/upload/{id}', a: true, d: 'Multipart file upload.' },
        { c: 'Papers', m: 'GET', p: '/practical-sessions', a: true, d: 'Practical sessions list.' },
        { c: 'Papers', m: 'GET', p: '/practical-sessions/availability', a: true, d: 'Availability flag.' },
        { c: 'Papers', m: 'POST', p: '/practical-sessions/{id}', a: true, d: 'Register.' },
        { c: 'Papers', m: 'DELETE', p: '/practical-sessions/{id}', a: true, d: 'Deregister.' },
        { c: 'Papers', m: 'GET', p: '/past-papers/{slug}', a: false, d: 'PUBLIC past-paper index, slug al|ol — {year:[papers]} map. The ONLY call in the SPA that bypasses the auth wrapper (hardcoded base, no Bearer).' },
        // Events & purchases
        { c: 'Events', m: 'GET', p: '/events', a: false, d: 'Events list — PUBLIC (live 200 logged out).' },
        { c: 'Events', m: 'GET', p: '/events/{id}', a: false, d: 'Single event — public.' },
        { c: 'Events', m: 'GET', p: '/events/{id}/my-purchases', a: true, d: 'My purchases for an event.' },
        { c: 'Events', m: 'GET', p: '/events/{id}/purchases/{purchaseId}/status', a: true, d: 'Purchase status.' },
        { c: 'Events', m: 'POST', p: '/events/{id}/purchases', a: true, d: 'Body {numberOfTickets} → {redirect_url} payment-gateway hop.' },
        { c: 'Events', m: 'POST', p: '/events/{id}/purchases/guest', a: false, d: 'Guest purchase (name/email/tickets) → {redirect_url}.' },
        { c: 'Events', m: 'GET', p: '/student/events', a: true, d: 'Student events list.' },
        { c: 'Events', m: 'GET', p: '/student/events/{id}', a: true, d: 'Single student event.' },
        { c: 'Events', m: 'GET', p: '/purchases/bands/free-eligibility', a: true, d: 'Free band eligibility.' },
        { c: 'Events', m: 'POST', p: '/purchases/bands/{id}', a: true, d: 'Buy band.' },
        { c: 'Events', m: 'POST', p: '/purchases/bank-transfer/{id}', a: true, d: 'Multipart file (slip).' },
        { c: 'Events', m: 'POST', p: '/purchases/bank-transfer/0', a: true, d: 'Multipart file + tute_ids[].' },
        { c: 'Events', m: 'POST', p: '/purchases/online-transfer/{id}', a: true, d: 'Online transfer purchase.' },
        { c: 'Events', m: 'POST', p: '/v2/purchases/online-transfer/{id}', a: true, d: 'v2 online transfer.' },
        { c: 'Events', m: 'POST', p: '/tutes/delivery-fee', a: true, d: 'Multipart + tute_ids[] — delivery fee quote {postal_fee,tute_fee}.' },
        { c: 'Events', m: 'GET', p: '/purchases/tutes', a: true, d: 'My tute purchases.' },
        // Notifications
        { c: 'Notifications', m: 'GET', p: '/notifications', a: true, d: 'Paginated {data,next_page_url}.' },
        { c: 'Notifications', m: 'POST', p: '/notifications/{id}', a: true, d: 'Mark one read.' },
        { c: 'Notifications', m: 'POST', p: '/notifications/read-all', a: true, d: 'Mark all read.' },
        { c: 'Notifications', m: 'DELETE', p: '/notifications/delete-all', a: true, d: 'Delete all notifications.' },
        // Misc
        { c: 'Misc', m: 'GET', p: '/telegram', a: false, d: '{data,msg,status} — telegram groups/links. PUBLIC (live 200 logged out).' },
        { c: 'Misc', m: 'GET', p: '/zoom/{id}/add-registrant', a: true, d: 'Zoom registrant link → {join_url}.' },
        { c: 'Misc', m: 'POST', p: '/reviews', a: true, d: 'Submit a review.' },
        { c: 'Misc', m: 'GET', p: '/public-reviews', a: false, d: 'Public reviews.' },
        { c: 'Misc', m: 'GET', p: '/institutes', a: false, d: 'Institute list — public (id 6 filtered client-side).' },
        { c: 'Misc', m: 'GET', p: '/admins', a: false, d: 'PUBLIC admin cards to any visitor (NO /admin prefix — used by register/profile flows).' },
        // Admin — role-gated ADMIN/SUPER_ADMIN; STUDENT verified 403 live.
        // Listed for completeness from the full recon (RECON_FULL.md), grouped
        // here; none of these are exercised by this toolkit.
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/courses', a: true, d: 'RBAC GATE verified live: STUDENT → 403 {"msg":"Unauthorized"} — keep token (403 does not wipe it). Entry point for the whole 131-pair /admin/* namespace below.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/courses*|lessons*|videos*', a: true, d: 'Course/lesson/video CRUD: GET+POST /admin/courses(+{id},order,toggle-status-all) · /admin/lessons(+{id},students,toggle) · POST/PATCH/DELETE /admin/videos(+toggle-status) · GET /admin/lessons/{id}/students.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/users*', a: true, d: 'Student management: GET /admin/user · /admin/users/{id} · PATCH {id}(toggle) · PATCH {id}/reset-password · /users/search/{q} · /users/blocked · /users/unverified-nic · /users/unverified-email · /users/pending-student-calls.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/admins*', a: true, d: 'Admin management: GET /admin/admins(+/{id},all-admins) · POST /admin/add-admin · POST /admin/admins/{id}(FormData+_method=PUT) · POST /admin/admins/role{title} · DELETE /admin/admins/{id}.' },
        { c: 'Admin (403 for STUDENT)', m: 'POST', p: '/admin/id|check|applied/{id}/{status}', a: true, d: 'Verification actions: POST /admin/id/{id}/{status} (NIC) · /admin/check/{id}/{status} (payment) · /admin/applied/{id}/{status} — all {comments:""} · GET /admin/check/{id} (slip/NIC blob) · GET /admin/ids/unverified.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/purchases*|slips*', a: true, d: 'Payments: GET /admin/purchases/{studentId} · /accepted · /online · /admin/slips/{status} · POST /admin/purchases/{studentId} (FormData items[]={lesson_id,status} = grant access).' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/tutes*', a: true, d: 'Tute ops: GET /admin/tutes(+{id},{id}/students,inventory,inventory/{id},packed,unpacked) · POST /admin/tutes(+{id},csv,package,pdf,transfer) · PATCH/DELETE /admin/tutes/{id}.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/model-papers*|papers*', a: true, d: 'Paper marking: GET /admin/model-papers/{marked,unmarked,user/{id}} · POST/DELETE variants · GET /admin/papers(+{id}/marked|unmarked-submissions) · POST/UPLOAD/PATCH(toggle-answer-script)/DELETE.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/past-papers*|tags*', a: true, d: 'GET/POST /admin/past-papers(+{id}) · GET/POST/PUT/DELETE /admin/tags(+{id}) · GET /admin/tags/student/{userId}.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/call-responses*', a: true, d: 'GET /admin/call-responses(+{id},{id}/students,active) · POST /admin/call-responses · PUT {id} · PATCH {id}/toggle-status · POST /admin/student-calls.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/events*|tickets*', a: true, d: 'GET /admin/events(+{id},{id}/purchases) · POST/DELETE · POST /admin/event-purchases/{id}/resend · POST /admin/event-tickets/{code}/check (door) · GET/POST /admin/new-year-purchases(+resend) · GET/POST/PATCH /admin/tickets(+{id}/status) · GET/POST /admin/ticket-categories.' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/insights*|sms*', a: true, d: 'GET /admin/insights(+lapsed-export) · GET /admin/sms/sender-options · POST /admin/sms/{send,send-csv,test} · GET/POST/PATCH/DELETE /admin/practical-sessions(+{id}).' },
        { c: 'Admin (403 for STUDENT)', m: 'GET', p: '/admin/reviews*|zoom*|dashboard', a: true, d: 'GET /admin/reviews?status · PATCH /admin/reviews/{id} · GET /admin/zoom · POST /admin/zoom/ (TRAILING SLASH literal) · DELETE /admin/zoom/{id} · GET /admin/dashboard.' }
    ];

    // Live-verified battery (verified 200 on 2026-11-12 with a live session,
    // except the deliberate RBAC check which is 403; /past-papers/al and
    // /events are public and always answer).
    const QUICK_PATHS = ['/user', '/lessons/allowed', '/notifications', '/courses', '/pdfs/tute', '/model-papers/availability', '/institutes', '/past-papers/al', '/events', '/admin/courses'];

    // ─────────────────────────────────────────────────────────────
    // WATCHDOG — periodic token-health check. Default ON, 5 min.
    // 401 → the relogin machinery fires (cooldown + caps apply).
    // No token + creds saved → startup-style recovery. In headless
    // mode the watchdog stays off: the delta owns recovery there.
    // ─────────────────────────────────────────────────────────────
    const WD_KEY = 'ict_watchdog_min';
    let wdTimer = null;
    function watchdogMinutes() {
        const n = parseInt(gmGet(WD_KEY, '5'), 10);
        return (n >= 1 && n <= 60) ? n : 5;
    }
    function wdTick() {
        let token = null;
        try { token = W.localStorage.getItem('token'); } catch (e) {}
        if (!token) {
            if (!DELTA_V && creds() && !isBlockedPath(location.pathname)) reauth('watchdog: no token');
            return;
        }
        fetch(API_BASE + '/api/user', { headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token } })
            .then(function (r) {
                if (r.status === 401) reauth('watchdog: token dead');
                else if (r.status === 200) Store.log('watchdog: token healthy', {});
            }).catch(function () {});
    }
    function watchdogSet(on, silent) {
        try { if (wdTimer) { clearInterval(wdTimer); wdTimer = null; } } catch (e) {}
        if (!on || DELTA_V) {
            gmSet(WD_KEY, on ? String(watchdogMinutes()) : '0');
            if (!silent) Store.log('watchdog off' + (DELTA_V ? ' — delta owns recovery in this browser' : ''), {});
            return;
        }
        gmSet(WD_KEY, String(watchdogMinutes()));
        wdTimer = setInterval(wdTick, watchdogMinutes() * 60000);
        if (!silent) Store.log('watchdog on (' + watchdogMinutes() + ' min)', {});
    }
    function watchdogAuto() {
        if (DELTA_V) return;
        const n = parseInt(gmGet(WD_KEY, '5'), 10);
        watchdogSet(n > 0, true);
    }

    // ─────────────────────────────────────────────────────────────
    // CONSOLE API — window.__ICT_API (works in every mode)
    // ─────────────────────────────────────────────────────────────
    function getBearer() {
        try { return W.localStorage.getItem('token') || (Store.backup && Store.backup.token) || null; } catch (e) { return null; }
    }

    function parseSpec(spec) {
        const s = String(spec || '').trim();
        const mm = s.match(/^(\w+)\s+(\/.*)$/);
        if (mm) return { method: mm[1].toUpperCase(), path: mm[2] };
        return { method: 'GET', path: s };
    }

    async function apiCall(spec, body) {
        const spec2 = parseSpec(spec);
        const url = API_BASE + '/api' + (spec2.path.charAt(0) === '/' ? spec2.path : '/' + spec2.path);
        const token = getBearer();
        const headers = { 'Accept': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
        const init = { method: spec2.method, headers: headers };
        if (body !== undefined && body !== null) init.body = typeof body === 'string' ? body : JSON.stringify(body);
        const resp = await fetch(url, init);
        let parsed = null;
        const ct = resp.headers.get('content-type') || '';
        if (ct.indexOf('json') >= 0) { try { parsed = await resp.json(); } catch (e) { parsed = null; } }
        if (parsed === null) { try { parsed = (await resp.text()).slice(0, 600); } catch (e) { parsed = null; } }
        const out = { status: resp.status, body: parsed };
        console.log('%c[ICT-API] ' + spec2.method + ' ' + spec2.path + ' → ' + resp.status, 'color:#00d4ff;font-weight:bold', parsed);
        return out;
    }

    function buildConsoleApi() {
        const api = {
            version: VERSION,
            mode: MODE,
            help() {
                const lines = [
                    'ICTFromABC Bypass v' + VERSION + ' — console API (mode: ' + MODE + ')',
                    '',
                    '__ICT_API.list(filter?)        complete API map, ' + API_MAP.length + ' entries (filter: category/method/path substring)',
                    '__ICT_API.call(spec, body?)    run one call; spec = "GET /user" | "/user" | "POST /events/12/purchases"',
                    '__ICT_API.quick()              10-call battery (9×200 + the deliberate /admin/courses 403)',
                    '__ICT_API.resolveVideo(id)     video_url + token + Bunny playlist candidates + ffmpeg command',
                    '__ICT_API.lesson(id)           GET /lessons/{id} (videos list)',
                    '__ICT_API.allowed()            GET /lessons/allowed (downloader entry point)',
                    '__ICT_API.pdfs(type?)          GET /pdfs/{tute|lesson-pp|paper-book}',
                    '__ICT_API.pastPapers(slug?)    GET /past-papers/{al|ol} — PUBLIC, no Bearer needed',
                    '__ICT_API.watchdog(on?)        token-health watchdog status / toggle (default on, 5 min)',
                    '__ICT_API.pin()                pinned fingerprint + session state',
                    '__ICT_API.debug()              full state dump (reauth counters, watchdog, map size)',
                    '__ICT_API.log()                recent activity log',
                    '',
                    'Rate limits: 60/min general, 30/min on /login. 401 → someone logged in elsewhere;',
                    'auto-relogin (standalone mode) takes the session back with the pinned fingerprint.'
                ];
                const text = lines.join('\n');
                console.log('%c' + text, 'color:#00d4ff');
                return text;
            },
            list(filter) {
                const f = (filter || '').toLowerCase();
                const rows = API_MAP.filter(function (e) {
                    if (!f) return true;
                    return (e.c + ' ' + e.m + ' ' + e.p + ' ' + e.d).toLowerCase().indexOf(f) >= 0;
                });
                console.group('%c[ICT-API] ' + rows.length + ' endpoint(s)' + (f ? ' matching "' + filter + '"' : ''), 'color:#00d4ff;font-weight:bold');
                rows.forEach(function (e) {
                    console.log('%c' + e.m.padEnd(7) + '%c ' + e.p + '%c  [' + e.c + (e.a ? ' ·auth' : ' ·public') + ']  ' + e.d,
                        'color:#ffb74d;font-weight:bold', 'color:#00d4ff;font-weight:bold', 'color:inherit');
                });
                console.groupEnd();
                return rows.map(function (e) { return e.m + ' ' + e.p; });
            },
            call: apiCall,
            async quick() {
                const out = [];
                for (const path of QUICK_PATHS) {
                    try {
                        const r = await apiCall(path);
                        out.push({ path: path, status: r.status });
                    } catch (e) {
                        out.push({ path: path, status: 'ERR ' + (e.message || e) });
                    }
                }
                console.table(out);
                return out;
            },
            async resolveVideo(videoId) {
                const v = await apiCall('/videos/' + videoId);
                if (v.status !== 200) return v;
                const t = await apiCall('/videos/' + videoId + '/generate-token');
                const videoUrl = (v.body && v.body.video_url) || null;
                const token = (t.status === 200 && t.body) ? t.body.token : null;
                const expires = (t.status === 200 && t.body) ? t.body.expires : null;
                let withToken = null;
                if (videoUrl && token) {
                    withToken = videoUrl + (videoUrl.indexOf('?') >= 0 ? '&' : '?') + 'token=' + token + '&expires=' + expires;
                }
                // Bunny embed → direct pull-zone playlist candidates. The pull
                // zone ignores the token entirely (Referer-only gate), but the
                // library→zone mapping cannot be derived, so known pairs are
                // built in and unknown ones get a hint (VIDEO_PIPELINE.md).
                const m = videoUrl ? videoUrl.match(/mediadelivery\.net\/embed\/(\d+)\/([0-9a-f-]{36})/i) : null;
                const zones = { '415489': 'vz-0d705596-3d4.b-cdn.net', '619330': 'vz-842e9805-ddc.b-cdn.net' };
                const candidates = [];
                let ffmpegCmd = null;
                if (m) {
                    const zone = zones[m[1]];
                    if (zone) {
                        candidates.push('https://' + zone + '/' + m[2] + '/playlist.m3u8');
                        ffmpegCmd = 'ffmpeg -y -headers "Referer: https://ictfromabc.com/' + '\r\nOrigin: https://ictfromabc.com\r\n" -i "' + candidates[0] + '" -c copy -bsf:a aac_adtstoasc out.mp4';
                    } else {
                        candidates.push('library ' + m[1] + ' zone unknown — open the player once, or run: node ict-toolkit\\cli\\ict.mjs resolve ' + videoId);
                    }
                }
                const out = {
                    video_url: videoUrl,
                    libraryId: m ? m[1] : null,
                    guid: m ? m[2] : null,
                    token: token,
                    expires: expires,
                    embed_with_token: withToken,
                    playlist_candidates: candidates,
                    ffmpeg_cmd: ffmpegCmd,
                    youtube: videoUrl ? /youtube\.com|youtu\.be/.test(videoUrl) : false
                };
                if (out.youtube) console.log('%c[ICT-API] YouTube-hosted lesson — download with yt-dlp', 'color:#8ab4f8');
                else if (candidates.length) {
                    console.log('%c[ICT-API] playlist: ' + candidates[0], 'color:#8ab4f8');
                    console.log('%c[ICT-API] pull zone needs only Referer: https://ictfromabc.com/ — the token does NOT gate it', 'color:#8ab4f8');
                }
                return out;
            },
            lesson(lessonId) { return apiCall('/lessons/' + lessonId); },
            allowed() { return apiCall('/lessons/allowed'); },
            pdfs(type) { return apiCall('/pdfs/' + (type || 'tute')); },
            pastPapers(slug) { return apiCall('/past-papers/' + String(slug || 'al').toLowerCase()); },
            watchdog(on) {
                if (!DELTA_V) {
                    if (on === undefined) return { running: !!wdTimer, minutes: watchdogMinutes() };
                    watchdogSet(!!on);
                }
                return { running: !!wdTimer, minutes: watchdogMinutes(), delegated: !!DELTA_V };
            },
            debug() {
                const out = {
                    version: VERSION,
                    mode: MODE,
                    href: location.href,
                    pin: Store.pin,
                    backup: Store.backup ? { token: String(Store.backup.token).slice(0, 12) + '…', role: Store.backup.role, savedAt: Store.backup.savedAt } : null,
                    credsSaved: !!creds(),
                    reauth: { busy: reBusy, lastAgo: reLast ? Math.round((Date.now() - reLast) / 1000) + 's ago' : null, fails: reFails, successes: reOk },
                    watchdog: wdTimer ? ('on, ' + watchdogMinutes() + ' min') : 'off',
                    lastLogin: STATE.lastLogin ? { visitorId: STATE.lastLogin.visitorId, at: new Date(STATE.lastLogin.at).toISOString(), consumed: STATE.lastLogin.consumed } : null,
                    pauseBlocks: STATE.pauseBlocks,
                    blockedNavigations: STATE.blockedNavigations,
                    mapEntries: API_MAP.length,
                    battery: QUICK_PATHS.length
                };
                console.log('%c[ICT-BYPASS] debug', 'color:#ffaa00;font-weight:bold', out);
                return out;
            },
            log() {
                let arr = [];
                try { arr = JSON.parse(gmGet('ict_log2', '[]')); } catch (e) {}
                console.table(arr.slice(0, 30).map(function (e) { return { time: new Date(e.t).toLocaleTimeString(), msg: e.msg }; }));
                return arr;
            },
            pin() {
                const pin = Store.pin;
                const b = Store.backup;
                let live = null; try { live = W.localStorage.getItem('token'); } catch (e) {}
                const out = {
                    mode: MODE,
                    pinnedVisitorId: pin ? pin.visitorId : 'NOT SET',
                    confidenceScore: pin ? pin.confidenceScore : null,
                    pinSource: pin ? (pin.source || 'auto') : null,
                    liveToken: live ? live.slice(0, 12) + '…' : 'none',
                    backupToken: b ? b.token.slice(0, 12) + '…' : 'none',
                    autoRelogin: DELTA_V ? 'delegated to delta v' + DELTA_V : (creds() ? 'armed' : 'no creds saved'),
                    watchdog: wdTimer ? 'on (' + watchdogMinutes() + ' min)' : 'off',
                    pauseBlocks: STATE.pauseBlocks,
                    blockedBounces: STATE.blockedNavigations
                };
                console.log('%c[ICT-BYPASS] state', 'color:#ffaa00;font-weight:bold', out);
                return out;
            }
        };
        return api;
    }

    // ─────────────────────────────────────────────────────────────
    // MENU
    // ─────────────────────────────────────────────────────────────
    function exportBundle() {
        const pin = Store.pin;
        const b = Store.backup;
        const bundle = {
            visitorId: pin ? pin.visitorId : null,
            confidenceScore: pin ? pin.confidenceScore : null,
            boundAt: pin ? pin.boundAt : null,
            token: b ? b.token : null,
            role: b ? b.role : null,
            exportedAt: Date.now()
        };
        const json = JSON.stringify(bundle, null, 2);
        try { GM_setClipboard(json); notify('Bundle copied to clipboard (pin' + (bundle.token ? ' + token' : '') + ').'); } catch (e) {}
        console.log('[ICT-BYPASS] export bundle:\n' + json);
        return json;
    }

    async function importBundle() {
        let text = '';
        try { text = await navigator.clipboard.readText(); } catch (e) { text = window.prompt('Paste the exported JSON bundle:') || ''; }
        if (!text) { notify('Nothing pasted.'); return; }
        let b;
        try { b = JSON.parse(text); } catch (e) { notify('Invalid JSON.'); return; }
        if (b.visitorId) {
            Store.pin = { visitorId: b.visitorId, confidenceScore: b.confidenceScore != null ? b.confidenceScore : 0.99, boundAt: b.boundAt || Date.now(), source: 'imported' };
        }
        if (b.token) {
            Store.backup = { token: b.token, role: b.role || null, user: null, savedAt: Date.now() };
            try {
                W.localStorage.setItem('token', b.token);
                if (b.role) W.localStorage.setItem('role', b.role);
                Store.log('imported token applied to localStorage', { role: b.role });
            } catch (e) {}
        }
        notify('Imported: ' + (b.visitorId ? 'pin ✓ ' : 'pin ✗ ') + (b.token ? 'token ✓' : 'token ✗'));
        Store.log('bundle imported', { hasPin: !!b.visitorId, hasToken: !!b.token });
    }

    function installMenu() {
        const cmds = [
            ['1 · Status / pin / session', function () { window.alert('__ICT_API.pin() → see console\n\n' + JSON.stringify(api.pin(), null, 2)); }],
            ['2 · Export pin + token (copy)', exportBundle],
            ['3 · Import pin + token (paste)', importBundle],
            ['4 · Save login (auto-relogin creds)', function () { if (DELTA_V) { alert('This browser delegates auto-relogin to the delta companion.'); return; } saveLogin(); }],
            ['5 · Relogin now', function () { reauth('manual'); }],
            ['6 · Clear saved login', clearLogin],
            ['7 · Full API map → console', function () { api.list(); }],
            ['8 · API quick battery → console', function () { api.quick(); }],
            ['9 · API help', function () { api.help(); }],
            ['10 · Clear pinned visitorId', function () { Store.clearPin(); notify('Pin cleared. Next successful login captures a fresh one.'); }],
            ['11 · Watchdog on/off', function () { const s = api.watchdog(!wdTimer); notify('Watchdog ' + (s.running ? 'ON (' + s.minutes + ' min)' : 'OFF') + (DELTA_V ? ' — delta owns recovery' : '')); }],
            ['12 · Debug dump → console', function () { console.clear && console.clear(); api.debug(); api.log(); }]
        ];
        for (const c of cmds) {
            try { GM_registerMenuCommand(c[0], c[1]); } catch (e) {}
        }
    }

    // ─────────────────────────────────────────────────────────────
    // BOOT
    // ─────────────────────────────────────────────────────────────
    installFetchHook();
    installXhrHook();
    installNavigationGuard();
    backupTokens();
    try { document.addEventListener('DOMContentLoaded', backupTokens); } catch (e) {}

    const api = buildConsoleApi();
    W.__ICT_API = api;

    // Watchdog: default on in standalone mode (stores '5'); stays off when the
    // delta owns recovery.
    watchdogAuto();

    // Standalone mode: startup attempt when the page loads without a token
    // (e.g. after a wipe on /auth) — cooldown + caps still apply.
    if (!DELTA_V) {
        if (!getBearer() && creds() && /^\/auth/.test(location.pathname)) {
            setTimeout(function () { reauth('startup: no token on /auth'); }, 800);
        }
    }

    if (isBlockedPath(location.pathname)) {
        Store.log('landed on /blocked — the account needs a staff unlock (071 455 5513); relogin is suppressed here on purpose', {});
    }

    installMenu();

    Store.log('v' + VERSION + ' armed — mode: ' + MODE + ', pin: ' + (Store.pin ? Store.pin.visitorId : 'NOT SET') +
        ', creds: ' + (creds() ? 'saved' : 'none') + ', watchdog: ' + (wdTimer ? watchdogMinutes() + ' min' : 'off') +
        ', map: ' + API_MAP.length + ' entries — console: __ICT_API.help()', {});

    } catch (e) {
        try { console.error('[ICT-BYPASS] init failed', e); } catch (x) {}
    }
})();
