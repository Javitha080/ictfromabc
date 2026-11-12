// ==UserScript==
// @name         ICTFromABC Suite v2 - device pin + session transplant + lesson downloader
// @namespace    ictfromabc.local
// @version      2.3.1
// @description  Pins the account-bound FingerprintJS identity on every login, survives the "Account on Pause" bounce, backs up/restores the Bearer session, maps authenticated /api calls, and resolves lesson videos (Bunny HLS / YouTube) with a segment downloader. v2.2: seeds the 619330 pull zone and reports a token takeover (one active session) instead of a generic 401. v2.3: auto-relogin - stores credentials locally and logs back in with the pinned fingerprint whenever the single-session revocation kills the token. v2.3.1: canonicalizes apex documents to www so the two per-origin sessions stop revoking each other's single token.
// @author       local workspace
// @match        https://ictfromabc.com/*
// @match        https://www.ictfromabc.com/*
// @match        https://iframe.mediadelivery.net/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      ictfromabc.com
// @connect      www.ictfromabc.com
// @connect      iframe.mediadelivery.net
// @connect      mediadelivery.net
// @connect      b-cdn.net
// @connect      *.b-cdn.net
// @connect      video.bunnycdn.com
// @connect      metrics.ictfromabc.com
// ==/UserScript==

/*
  WHAT THIS DOES
  --------------
  The site binds a student account to one FingerprintJS Pro visitorId. A login
  from a device with a different visitorId on a different network can flip the
  account into "Account on Pause" (server-side, staff-only unlock).

  This script rewrites the visitorId + confidenceScore in POST /api/login and
  POST /api/login/otp before the request leaves the browser, so every equipped
  device presents the same identity. It also backs up the Bearer token so a
  pause wipe or a 401 does not cost you the session.

  FIRST RUN (on the device that currently logs in successfully)
    1. Open the site -> Alt+I -> Access tab.
    2. [Read this device] (best effort) or [Capture next login], then log in once.
       The observed visitorId + confidenceScore are stored and pinned.
    3. [Export session] and keep the JSON somewhere private, or use
       [Copy token] for the CLI.
  EVERY OTHER DEVICE
    4. Install this script, open the panel, [Import session] (or paste the FP
       with [Set FP]), then log in normally.

  The old generic harvester (userpannel/userscript.js) must NOT run on this
  origin: it perturbs navigator/Date/Function surfaces and can change the
  fingerprint it is supposed to preserve. Disable it for ictfromabc.com.
  Also disable the retired v1 bypass (userpannel/ictfromabc-bypass.user.js):
  its 5-second token rescue re-injects stale tokens and causes 401 loops.
*/

(function () {
  'use strict';

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const D = document;

  // ------------------------------------------------------------------
  // Bunny frame mode: relay media URLs to the top page, then stop.
  // ------------------------------------------------------------------
  if (W.self !== W.top) {
    try {
      const relay = (url) => {
        try {
          const s = String(url || '');
          if (!s) return;
          W.parent.postMessage({ __ictMedia: true, url: s }, '*');
        } catch (e) {}
      };
      const MEDIA_RE = /\.(?:m3u8|mpd|mp4|ts)(?:[?#]|$)|playlist/i;
      const origFetch = W.fetch;
      if (typeof origFetch === 'function') {
        W.fetch = function (input) {
          try {
            const u = typeof input === 'string' ? input : (input && input.url) || '';
            if (MEDIA_RE.test(u)) relay(u);
          } catch (e) {}
          return origFetch.apply(this, arguments);
        };
      }
      const XO = W.XMLHttpRequest && W.XMLHttpRequest.prototype.open;
      if (XO) {
        W.XMLHttpRequest.prototype.open = function (m, u) {
          try { if (MEDIA_RE.test(String(u))) relay(u); } catch (e) {}
          return XO.apply(this, arguments);
        };
      }
    } catch (e) {}
    return;
  }

  // ------------------------------------------------------------------
  // One canonical document origin: the server allows exactly one live
  // session and localStorage is per-origin, so an apex tab and a www tab
  // would keep revoking each other's token on every boot. Documents live
  // on www; the API base (https://ictfromabc.com/api) is untouched.
  // ------------------------------------------------------------------
  if (W.location.host === 'ictfromabc.com') {
    W.location.replace('https://www.ictfromabc.com' + W.location.pathname + W.location.search + W.location.hash);
    return;
  }

  // ------------------------------------------------------------------
  // Storage + config
  // ------------------------------------------------------------------
  const K = {
    fp: 'ict_fp',
    conf: 'ict_conf',
    pin: 'ict_pin',
    captureNext: 'ict_capture_next',
    tokenBackup: 'ict_token_backup',
    lastOk: 'ict_last_ok',
    pullZones: 'ict_pullzones',
    ka: 'ict_keepalive',
    lastCourse: 'ict_last_course',
    auto: 'ict_auto_reauth',
    creds: 'ict_creds',
    reauth: 'ict_reauth_at'
  };

  function storeGet(key, fallback) {
    try {
      const v = GM_getValue(key, null);
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  }
  function storeSet(key, value) {
    try { GM_setValue(key, value); } catch (e) {}
  }

  const CFG = {
    fp: String(storeGet(K.fp, '')),
    conf: String(storeGet(K.conf, '')),
    pin: storeGet(K.pin, true) !== false,
    captureNext: storeGet(K.captureNext, false) === true
  };
  function saveConfig() {
    storeSet(K.fp, CFG.fp);
    storeSet(K.conf, CFG.conf);
    storeSet(K.pin, CFG.pin);
    storeSet(K.captureNext, CFG.captureNext);
  }

  const API_BASE = 'https://ictfromabc.com/api';
  const SITE_ORIGIN = 'https://ictfromabc.com';
  const DEFAULT_REFERER = 'https://ictfromabc.com/';

  // Library id -> pull-zone host, learned from captured player traffic.
  // Unknown libraries are resolved by reading the signed embed page or by the
  // frame sniffer, so this is only a fast path.
  const PULL_ZONES = Object.assign({
    '415489': 'vz-0d705596-3d4.b-cdn.net',
    '619330': 'vz-842e9805-ddc.b-cdn.net'
  }, storeGet(K.pullZones, {}) || {});

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const apiLog = [];           // {t, method, path, status, ms, reqKeys, resKeys}
  const findings = [];         // {kind, url, src, t}
  const logs = [];             // {t, msg, level}
  const resolved = new Map();  // videoId -> {id,title,kind,embed,signed,hls,expires,error}
  const seen = new Set();
  const blobUrls = new Map();
  let panel = null;
  let panelOpen = false;
  let renderQueued = false;
  let paused = false;
  let lastPauseUrl = '';
  let scanBusy = false;

  function log(msg, level) {
    const entry = { t: Date.now(), msg: String(msg), level: level || 'info' };
    logs.unshift(entry);
    if (logs.length > 200) logs.pop();
    try {
      const color = level === 'error' ? '#ff6b6b'
        : level === 'success' ? '#3ddc84'
        : level === 'warn' ? '#ffb84d' : '#9ad1ff';
      console.log('%c[ICT] ' + entry.msg, 'color:' + color);
    } catch (e) {}
    scheduleRender();
  }

  function scheduleRender() {
    if (!panelOpen || renderQueued) return;
    renderQueued = true;
    W.requestAnimationFrame(() => {
      renderQueued = false;
      renderPanel();
    });
  }

  function note(kind, url, src) {
    const s = String(url || '');
    if (!s) return;
    const key = kind + '|' + s;
    if (seen.has(key)) return;
    seen.add(key);
    findings.unshift({ kind, url: s, src: src || '', t: Date.now() });
    if (findings.length > 150) findings.pop();
    scheduleRender();
  }

  // ------------------------------------------------------------------
  // URL helpers / logging
  // ------------------------------------------------------------------
  function absolute(u) {
    try { return new URL(u, location.href).href; } catch (e) { return String(u || ''); }
  }

  function apiPath(u) {
    try {
      const x = new URL(u, location.href);
      if (x.origin === location.origin && x.pathname.indexOf('/api/') === 0) {
        return x.pathname.replace(/\/$/, '');
      }
      return x.host + x.pathname;
    } catch (e) { return String(u || '').slice(0, 160); }
  }

  function isApi(u) {
    try {
      const x = new URL(u, location.href);
      return x.origin === location.origin && x.pathname.indexOf('/api/') === 0;
    } catch (e) { return false; }
  }

  function recordApi(method, url, status, ms, reqKeys, resKeys) {
    if (!isApi(url)) return;
    const entry = {
      t: Date.now(),
      method: String(method || 'GET').toUpperCase(),
      path: apiPath(url),
      status: Number(status) || 0,
      ms: Math.max(0, Math.round(ms || 0)),
      reqKeys: reqKeys || null,
      resKeys: resKeys || null
    };
    apiLog.push(entry);
    if (apiLog.length > 1200) apiLog.shift();
    scheduleRender();
  }

  function bodyKeys(body) {
    try {
      if (typeof body === 'string' && body.length < 200000) {
        const j = JSON.parse(body);
        if (j && typeof j === 'object' && !Array.isArray(j)) {
          return Object.keys(j).slice(0, 24);
        }
      }
    } catch (e) {}
    return null;
  }

  // ------------------------------------------------------------------
  // Session backup / restore
  // ------------------------------------------------------------------
  function readSession() {
    try {
      return {
        token: W.localStorage.getItem('token') || '',
        role: W.localStorage.getItem('role') || '',
        user: W.localStorage.getItem('user') || ''
      };
    } catch (e) { return { token: '', role: '', user: '' }; }
  }

  function backupSession(session, source) {
    if (!session || !session.token) return;
    try {
      storeSet(K.tokenBackup, JSON.stringify({
        token: session.token,
        role: session.role || '',
        user: session.user || '',
        skippable: session.skippable != null ? session.skippable : '',
        course_id: session.course_id || '',
        at: Date.now(),
        fp: CFG.fp,
        source: source || ''
      }));
    } catch (e) {}
  }

  function backupSessionFromStorage(source) {
    backupSession(readSession(), source);
  }

  function restoreBackup(silent) {
    try {
      const raw = storeGet(K.tokenBackup, '');
      if (!raw) {
        if (!silent) log('No token backup stored yet.', 'warn');
        return false;
      }
      const j = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!j || !j.token) return false;
      W.localStorage.setItem('token', j.token);
      if (j.role) W.localStorage.setItem('role', j.role);
      if (j.user) W.localStorage.setItem('user', j.user);
      log('Token + role restored from backup (' + new Date(j.at).toLocaleString() + ').', 'success');
      return true;
    } catch (e) {
      if (!silent) log('Restore failed: ' + e.message, 'error');
      return false;
    }
  }

  function tokenStatus() {
    const s = readSession();
    if (!s.token) return 'none';
    return s.token.slice(0, 10) + '... / ' + (s.role || '?');
  }

  // ------------------------------------------------------------------
  // Fingerprint pinning
  // ------------------------------------------------------------------
  function rewriteLoginBody(body, url) {
    if (!body || typeof body !== 'string') return body;
    if (body.indexOf('visitorId') === -1) return body;

    let j;
    try { j = JSON.parse(body); } catch (e) { return body; }
    if (!j || typeof j !== 'object' || !('visitorId' in j)) return body;

    if (CFG.captureNext && j.visitorId) {
      CFG.fp = String(j.visitorId);
      CFG.conf = String(j.confidenceScore == null ? '' : j.confidenceScore);
      CFG.captureNext = false;
      CFG.pin = true;
      saveConfig();
      log('Captured this device: ' + CFG.fp.slice(0, 12) + '... / ' + CFG.conf + '. Pinning is active.', 'success');
    }

    if (!CFG.pin || !CFG.fp) return body;

    j.visitorId = CFG.fp;
    const c = parseFloat(CFG.conf);
    if (!isNaN(c)) j.confidenceScore = c;
    return JSON.stringify(j);
  }

  function rewriteFormData(fd) {
    try {
      if (!CFG.pin || !CFG.fp) return fd;
      if (fd && typeof fd.has === 'function' && fd.has('visitorId')) {
        fd.set('visitorId', CFG.fp);
        const c = parseFloat(CFG.conf);
        if (!isNaN(c) && fd.has('confidenceScore')) fd.set('confidenceScore', String(c));
      }
    } catch (e) {}
    return fd;
  }

  // ------------------------------------------------------------------
  // Response processing
  // ------------------------------------------------------------------
  function addSessionFromJson(j, source) {
    if (!j || !j.token) return false;
    try {
      W.localStorage.setItem('token', j.token);
      if (j.role) W.localStorage.setItem('role', j.role);
      if (j.user) W.localStorage.setItem('user', JSON.stringify(j.user));
    } catch (e) {}
    backupSession({
      token: j.token,
      role: j.role || '',
      user: j.user ? JSON.stringify(j.user) : '',
      skippable: j.skippable,
      course_id: j.course_id || ''
    }, source);
    storeSet(K.lastOk, JSON.stringify({
      at: Date.now(),
      fp: CFG.fp,
      conf: CFG.conf,
      role: j.role || '',
      skippable: j.skippable != null ? j.skippable : '',
      course_id: j.course_id || '',
      source: source || ''
    }));
    return true;
  }

  async function handlePause(resp) {
    let txt = '';
    try { txt = await resp.clone().text(); } catch (e) { return resp; }
    let j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    const target = (j && (j.redirect_url || j.redirectUrl)) || '';
    if (target) lastPauseUrl = target;

    if (j && j.token) {
      addSessionFromJson(j, 'pause-302');
      log('Pause response carried a token - converted to a 200 login.', 'success');
      try {
        const h = new W.Headers();
        resp.headers.forEach((v, k) => {
          const kl = k.toLowerCase();
          if (kl !== 'content-length' && kl !== 'content-encoding' && kl !== 'transfer-encoding') h.set(k, v);
        });
        h.set('content-type', 'application/json');
        return new W.Response(JSON.stringify(j), { status: 200, statusText: 'OK', headers: h });
      } catch (e) { return resp; }
    }

    paused = true;
    log('PAUSE (302): ' + (target || 'redirect') + '. The account is server-paused; call staff, then re-capture the fingerprint.', 'error');
    return resp;
  }

  function processJson(j, url, status) {
    const path = apiPath(url);
    if (status >= 200 && status < 300) {
      if (/^\/api\/login(?:\/otp)?$/.test(path)) {
        if (j && j.token) {
          addSessionFromJson(j, path);
          const extra = j.otp_required ? ' OTP required.' : '';
          log('LOGIN OK - token backed up. Role ' + (j.role || '?') + '.' + extra, 'success');
        } else if (j && j.otp_required) {
          log('Login accepted; OTP required.', 'info');
        } else if (j && (j.msg || j.message)) {
          log('Login: ' + (j.msg || j.message), 'info');
        }
      }

      let m = path.match(/^\/api\/videos\/(\d+)\/generate-token$/);
      if (m && j && j.token) {
        const item = resolved.get(Number(m[1]));
        if (item) {
          item.token = j.token;
          item.expires = j.expires;
          scheduleRender();
        }
        note('token', path + ' -> expires ' + j.expires, 'api');
      }

      m = path.match(/^\/api\/videos\/(\d+)$/);
      if (m && j && j.video_url) {
        const id = Number(m[1]);
        let item = resolved.get(id);
        if (!item) {
          item = { id, title: 'Video ' + id, kind: kindOf(j.video_url), embed: j.video_url, signed: '', hls: '' };
          resolved.set(id, item);
        }
        item.embed = j.video_url;
        item.kind = kindOf(j.video_url);
        if (item.token) item.signed = appendToken(j.video_url, item.token, item.expires);
        note(item.kind === 'youtube' ? 'youtube' : 'video', j.video_url, 'api');
        scheduleRender();
      }

      m = path.match(/^\/api\/lessons\/(\d+)$/);
      if (m && j && Array.isArray(j.videos)) {
        log('Lesson ' + m[1] + ': ' + j.videos.length + ' video(s).', 'success');
        for (const v of j.videos) {
          if (!v || v.id == null) continue;
          if (!resolved.has(Number(v.id))) {
            resolved.set(Number(v.id), {
              id: Number(v.id), title: v.title || ('Video ' + v.id),
              kind: 'unknown', embed: '', signed: '', hls: ''
            });
          }
        }
        scheduleRender();
      }

      if (j && j.user && path === '/api/user') {
        try { W.localStorage.setItem('user', JSON.stringify(j.user)); } catch (e) {}
      }
    } else if (status === 422) {
      const errs = j && j.errors ? Object.keys(j.errors).join(', ') : (j && (j.msg || j.message)) || 'validation error';
      log('422 on ' + path + ': ' + errs, 'warn');
    }
  }

  async function handleResponse(resp, meta) {
    const url = resp.url || meta.url || '';
    const status = resp.status;
    const ct = (() => { try { return resp.headers.get('content-type') || ''; } catch (e) { return ''; } })();

    if (status === 302) {
      const out = await handlePause(resp);
      recordApi(meta.method, url, 302, performance.now() - meta.started, meta.reqKeys, null);
      return out;
    }

    let resKeys = null;
    if (isApi(url) && /json/i.test(ct)) {
      try {
        const txt = await resp.clone().text();
        if (txt.length < 3000000) {
          const j = JSON.parse(txt);
          if (j && typeof j === 'object' && !Array.isArray(j)) resKeys = Object.keys(j).slice(0, 24);
          processJson(j, url, status);
        }
      } catch (e) {}
    } else if (isApi(url) && /pdf/i.test(ct)) {
      try {
        const b = await resp.clone().blob();
        const u = W.URL.createObjectURL(b);
        blobUrls.set(u, b);
        note('pdf', u, url);
      } catch (e) {}
    } else if (/json|html/i.test(ct) && String(url).length < 2000000) {
      try {
        const txt = await resp.clone().text();
        scanText(txt, url);
      } catch (e) {}
    }

    if (isApi(url)) {
      recordApi(meta.method, url, status, performance.now() - meta.started, meta.reqKeys, resKeys);
      if (status === 401) {
        const s = readSession();
        if (!s.token) log('401 on ' + apiPath(url) + ' - token was wiped. Use [Restore token] if this was not a real logout.', 'warn');
        else log('401 on ' + apiPath(url) + ' - a newer login replaced this token (one active session per account). Auto-relogin will take it back if armed.', 'warn');
        autoReauth('401 ' + apiPath(url));
      }
      if (status === 429) {
        let lim = '';
        try { lim = resp.headers.get('X-RateLimit-Limit') || ''; } catch (e) {}
        log('429 on ' + apiPath(url) + ' - rate limited' + (lim ? ' (server limit ' + lim + '/min)' : ' (60/min general, 20/min phone validation)') + '. Slow down.', 'warn');
      }
    }
    return resp;
  }

  // ------------------------------------------------------------------
  // Text scanning (Bunny embeds, HLS, PDFs, YouTube)
  // ------------------------------------------------------------------
  function scanText(text, src) {
    if (!text || text.length > 2000000) return;
    let m;
    const embed = /(?:https?:)?\/\/iframe\.mediadelivery\.net\/embed\/\d+\/[0-9a-f-]{36}[^\s"'\\]*/gi;
    while ((m = embed.exec(text))) note('video', absolute(m[0]), src);

    const cdn = /(?:https?:)?\/\/[a-z0-9.-]+\.b-cdn\.net\/[^\s"'\\]*(?:\.m3u8|\.mp4)[^\s"'\\]*/gi;
    while ((m = cdn.exec(text))) note('video', absolute(m[0]), src);

    const pdf = /https?:\/\/[^\s"'\\]+\.pdf[^\s"'\\]*/gi;
    while ((m = pdf.exec(text))) note('pdf', m[0], src);

    const yt = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:embed|watch)|youtu\.be)\/[^\s"'\\]*/gi;
    while ((m = yt.exec(text))) note('youtube', m[0], src);
  }

  // ------------------------------------------------------------------
  // Hooks
  // ------------------------------------------------------------------
  (function hookFetch() {
    const orig = W.fetch;
    if (typeof orig !== 'function') return;
    W.fetch = function (input, init) {
      let method = 'GET';
      let url = '';
      let reqBody = null;
      try {
        if (typeof input === 'string') url = input;
        else if (input && input.url) { url = input.url; method = input.method || 'GET'; }
        if (init && init.method) method = init.method;
        if (init && init.body != null) reqBody = init.body;
      } catch (e) {}

      let reqKeys = bodyKeys(reqBody);
      try {
        if (typeof reqBody === 'string' && reqBody.indexOf('visitorId') !== -1) {
          const rewritten = rewriteLoginBody(reqBody, url);
          if (rewritten !== reqBody) {
            init = Object.assign({}, init, { body: rewritten });
            reqKeys = bodyKeys(rewritten);
            log('Login body rewritten with the pinned visitorId.', 'info');
          }
        } else if (reqBody && typeof W.FormData !== 'undefined' && reqBody instanceof W.FormData) {
          rewriteFormData(reqBody);
        }
      } catch (e) {}

      const started = performance.now();
      const p = orig.call(W, input, init);
      return Promise.resolve(p).then(resp => handleResponse(resp, {
        method, url: url || resp.url, started, reqKeys
      })).catch(err => {
        if (isApi(url)) recordApi(method, url, 0, performance.now() - started, reqKeys, null);
        throw err;
      });
    };
  })();

  (function hookXhr() {
    const XO = W.XMLHttpRequest && W.XMLHttpRequest.prototype.open;
    const XS = W.XMLHttpRequest && W.XMLHttpRequest.prototype.send;
    if (!XO || !XS) return;
    W.XMLHttpRequest.prototype.open = function (method, url) {
      this.__ict = { method: String(method || 'GET').toUpperCase(), url: String(url || ''), started: 0 };
      return XO.apply(this, arguments);
    };
    W.XMLHttpRequest.prototype.send = function (body) {
      try {
        if (this.__ict && typeof body === 'string' && body.indexOf('visitorId') !== -1) {
          const rewritten = rewriteLoginBody(body, this.__ict.url);
          if (rewritten !== body) body = rewritten;
        }
      } catch (e) {}
      if (this.__ict) this.__ict.started = performance.now();
      this.addEventListener('load', () => {
        try {
          const meta = this.__ict || {};
          const ct = (this.getResponseHeader && this.getResponseHeader('content-type')) || '';
          if (isApi(meta.url)) {
            recordApi(meta.method, meta.url, this.status, performance.now() - meta.started, null,
              /json/i.test(ct) ? null : null);
            if (this.status === 302) {
              try {
                const j = JSON.parse(this.responseText);
                if (j && j.token) {
                  addSessionFromJson(j, 'xhr-302');
                  log('XHR pause 302 carried a token - stored. The page may still bounce; token is safe.', 'success');
                }
              } catch (e) {}
            }
          }
          if (/json|html/i.test(ct)) scanText(this.responseText || '', meta.url);
        } catch (e) {}
      });
      return XS.call(this, body);
    };
  })();

  (function guardBlocked() {
    try {
      const ps = W.history.pushState;
      const rs = W.history.replaceState;
      const block = (u) => String(u || '').indexOf('/blocked') !== -1;
      W.history.pushState = function (s, t, u) {
        if (block(u)) {
          log('Blocked navigation to /blocked. The pause flag is client-side; the token is kept.', 'warn');
          paused = true;
          return;
        }
        return ps.apply(this, arguments);
      };
      W.history.replaceState = function (s, t, u) {
        if (block(u)) {
          log('Blocked replaceState to /blocked.', 'warn');
          paused = true;
          return;
        }
        return rs.apply(this, arguments);
      };
    } catch (e) {}
  })();

  W.addEventListener('message', (ev) => {
    try {
      const d = ev.data;
      if (d && d.__ictMedia && d.url) note('video', d.url, 'player-frame');
    } catch (e) {}
  });

  // ------------------------------------------------------------------
  // Network helpers for API + media
  // ------------------------------------------------------------------
  function authHeaders() {
    const h = { 'Accept': 'application/json' };
    const s = readSession();
    if (s.token) h['Authorization'] = 'Bearer ' + s.token;
    return h;
  }

  async function apiJson(path, options) {
    const opts = Object.assign({ method: 'GET', headers: authHeaders() }, options || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const res = await W.fetch(API_BASE + path, opts);
    let j = null;
    try { j = await res.json(); } catch (e) {}
    if (!res.ok) {
      const msg = (j && (j.msg || j.message)) || ('HTTP ' + res.status);
      throw new Error(msg + ' (' + path + ')');
    }
    return j;
  }

  // Raw console call: returns status + text instead of throwing, so 4xx/5xx bodies stay visible.
  async function apiRaw(method, path, body) {
    const opts = { method: method || 'GET', headers: authHeaders() };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = body; }
    const res = await W.fetch(API_BASE + (path.charAt(0) === '/' ? path : '/' + path), opts);
    let text = '';
    try { text = await res.text(); } catch (e) {}
    return { status: res.status, text };
  }

  function gmText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 45000,
        headers: { 'Referer': DEFAULT_REFERER, 'Origin': SITE_ORIGIN, 'Accept': '*/*' },
        onload: (r) => resolve(r.responseText || ''),
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout'))
      });
    });
  }

  function gmBin(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 90000,
        responseType: 'arraybuffer',
        headers: { 'Referer': DEFAULT_REFERER, 'Origin': SITE_ORIGIN, 'Accept': '*/*' },
        onload: (r) => resolve(r.response),
        onerror: () => reject(new Error('network error')),
        ontimeout: () => reject(new Error('timeout'))
      });
    });
  }

  async function fetchText(url) {
    try {
      const r = await W.fetch(url, { credentials: 'omit', cache: 'no-store' });
      if (r.ok) return await r.text();
      throw new Error('HTTP ' + r.status);
    } catch (e) {
      return gmText(url);
    }
  }

  async function fetchBin(url) {
    try {
      const r = await W.fetch(url, { credentials: 'omit', cache: 'no-store' });
      if (r.ok) return await r.arrayBuffer();
      throw new Error('HTTP ' + r.status);
    } catch (e) {
      return gmBin(url);
    }
  }

  // ------------------------------------------------------------------
  // Teaching helpers (video resolution)
  // ------------------------------------------------------------------
  function appendToken(url, token, expires) {
    if (!url || !token) return url;
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    return url + sep + 'token=' + encodeURIComponent(token) + '&expires=' + encodeURIComponent(expires);
  }

  function kindOf(url) {
    const s = String(url || '');
    if (/youtube\.com|youtu\.be/i.test(s)) return 'youtube';
    if (/iframe\.mediadelivery\.net\/embed/i.test(s)) return 'bunny';
    if (/\.m3u8/i.test(s)) return 'hls';
    if (/\.mp4/i.test(s)) return 'mp4';
    return 'other';
  }

  function lessonIdFromLocation() {
    const m = location.pathname.match(/\/(?:lessons|myLessons)\/(\d+)(?:\/|$)/)
      || location.pathname.match(/\/(\d+)\/videos(?:\/|$)/);
    return m ? Number(m[1]) : 0;
  }

  async function resolveOneVideo(id) {
    const item = resolved.get(Number(id)) || { id: Number(id), title: 'Video ' + id, kind: 'unknown' };
    try {
      const tok = await apiJson('/videos/' + id + '/generate-token');
      if (!tok || !tok.token) throw new Error('No token returned');
      item.token = tok.token;
      item.expires = tok.expires;
      const info = await apiJson('/videos/' + id);
      if (!info || !info.video_url) throw new Error('No video_url returned');
      item.embed = info.video_url;
      item.kind = kindOf(info.video_url);
      item.signed = appendToken(info.video_url, item.token, item.expires);
      item.error = '';
      resolved.set(Number(id), item);
      if (item.kind === 'bunny') learnPullZone(item);
      note(item.kind === 'youtube' ? 'youtube' : 'video', info.video_url, 'resolved');
      log('Resolved ' + id + ': ' + item.title + ' [' + item.kind + ']', 'success');
      return item;
    } catch (e) {
      item.error = e.message;
      resolved.set(Number(id), item);
      log('Resolve ' + id + ' failed: ' + e.message, 'error');
      return item;
    }
  }

  function learnPullZone(item) {
    try {
      const m = String(item.embed || '').match(/embed\/(\d+)\/([0-9a-f-]{36})/i);
      if (!m) return;
      const lib = m[1];
      if (!PULL_ZONES[lib] && item.hls) {
        try {
          const host = new URL(item.hls).host;
          if (/\.b-cdn\.net$/i.test(host)) {
            PULL_ZONES[lib] = host;
            storeSet(K.pullZones, PULL_ZONES);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  async function scanLesson() {
    if (scanBusy) return;
    const id = lessonIdFromLocation();
    if (!id) {
      log('Open a lesson page first (URL must contain /lessons/<id> or /myLessons/<id>).', 'warn');
      return;
    }
    scanBusy = true;
    log('Scanning lesson ' + id + ' ...', 'info');
    try {
      const j = await apiJson('/lessons/' + id);
      const videos = (j && j.videos) || [];
      if (!videos.length) { log('Lesson has no videos.', 'warn'); return; }
      for (const v of videos) {
        resolved.set(Number(v.id), {
          id: Number(v.id),
          title: v.title || ('Video ' + v.id),
          kind: 'unknown', embed: '', signed: '', hls: ''
        });
      }
      scheduleRender();
      for (const v of videos) {
        await resolveOneVideo(v.id);
        await new Promise(r => setTimeout(r, 250));
      }
      log('Lesson scan complete: ' + videos.length + ' video(s).', 'success');
    } catch (e) {
      log('Lesson scan failed: ' + e.message, 'error');
    } finally {
      scanBusy = false;
    }
  }

  async function bunnyHls(item) {
    if (item.hls) return item.hls;
    const m = String(item.embed || '').match(/embed\/(\d+)\/([0-9a-f-]{36})/i);
    if (!m) throw new Error('Not a Bunny embed URL');
    const lib = m[1];
    const guid = m[2];

    const known = PULL_ZONES[lib];
    if (known) {
      const candidate = 'https://' + known + '/' + guid + '/playlist.m3u8';
      try {
        const txt = await fetchText(candidate);
        if (txt.indexOf('#EXTM3U') === 0) {
          item.hls = candidate;
          storeSet(K.pullZones, PULL_ZONES);
          return candidate;
        }
      } catch (e) {}
    }

    // Read the signed embed page; it contains the pull-zone playlist URL.
    if (item.signed) {
      try {
        const html = await gmText(item.signed);
        let mm = html.match(/(?:https?:)?\/\/([a-z0-9.-]+\.b-cdn\.net)\/([0-9a-f-]{36})\/playlist\.m3u8/i);
        if (!mm) {
          const host = html.match(/[a-z0-9-]+\.b-cdn\.net/i);
          if (host) mm = [null, host[0], guid];
        }
        if (mm) {
          const candidate = 'https://' + mm[1] + '/' + (mm[2] || guid) + '/playlist.m3u8';
          const txt = await fetchText(candidate);
          if (txt.indexOf('#EXTM3U') === 0) {
            item.hls = candidate;
            PULL_ZONES[lib] = mm[1];
            storeSet(K.pullZones, PULL_ZONES);
            return candidate;
          }
        }
      } catch (e) {}
    }

    throw new Error('Could not find the HLS pull zone. Open the video player once, then use the captured .m3u8 in Findings.');
  }

  // ------------------------------------------------------------------
  // HLS parser + downloader
  // ------------------------------------------------------------------
  function parseHls(text, base) {
    const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) throw new Error('Empty playlist');
    if (lines.some(l => l.indexOf('#EXT-X-STREAM-INF') === 0)) {
      const variants = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('#EXT-X-STREAM-INF') !== 0) continue;
        const res = /RESOLUTION=(\d+)x(\d+)/i.exec(lines[i]);
        const bw = /BANDWIDTH=(\d+)/i.exec(lines[i]);
        let u = '';
        for (let k = i + 1; k < lines.length; k++) {
          if (lines[k] && lines[k].charAt(0) !== '#') { u = lines[k]; i = k; break; }
        }
        if (u) variants.push({
          url: new URL(u, base).href,
          height: res ? Number(res[2]) : 0,
          bandwidth: bw ? Number(bw[1]) : 0
        });
      }
      variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
      return { master: true, variants };
    }

    const parts = [];
    let key = null;
    let map = null;
    let seq = 0;
    let segIndex = 0;
    for (const line of lines) {
      if (line.indexOf('#EXT-X-MEDIA-SEQUENCE:') === 0) {
        seq = Number(line.split(':')[1]) || 0;
      } else if (line.indexOf('#EXT-X-KEY:') === 0) {
        if (/METHOD=NONE/i.test(line)) { key = null; continue; }
        const method = (/METHOD=([^,]+)/i.exec(line) || [])[1] || '';
        const uri = (/URI="([^"]+)"/i.exec(line) || [])[1] || '';
        const iv = (/IV=0x([0-9a-f]+)/i.exec(line) || [])[1] || '';
        key = method.toUpperCase() === 'AES-128' && uri
          ? { uri: new URL(uri, base).href, iv: iv ? hexToBytes(iv) : null }
          : null;
      } else if (line.indexOf('#EXT-X-MAP:') === 0) {
        const mm = (/URI="([^"]+)"/i.exec(line) || [])[1];
        if (mm) map = new URL(mm, base).href;
      } else if (line.charAt(0) !== '#') {
        parts.push({
          url: new URL(line, base).href,
          key,
          iv: key ? (key.iv || sequenceIv(seq + segIndex)) : null
        });
        segIndex++;
      }
    }
    const encrypted = parts.some(p => !!p.key);
    const isFmp4 = /\.m4s|\.mp4|init\.mp4/i.test(parts.map(p => p.url).join(' ')) || !!map;
    return { master: false, parts, map, encrypted, ext: isFmp4 ? 'mp4' : 'ts' };
  }

  function hexToBytes(hex) {
    const s = String(hex || '').replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function sequenceIv(n) {
    const iv = new Uint8Array(16);
    let x = BigInt(n || 0);
    for (let i = 15; i >= 0; i--) { iv[i] = Number(x & 255n); x >>= 8n; }
    return iv;
  }

  async function decryptSegment(buf, keyInfo) {
    if (!keyInfo || !keyInfo.keyBytes) return buf;
    const subtle = W.crypto && W.crypto.subtle;
    if (!subtle) throw new Error('WebCrypto unavailable; use ffmpeg');
    const key = await subtle.importKey('raw', keyInfo.keyBytes, { name: 'AES-CBC' }, false, ['decrypt']);
    return subtle.decrypt({ name: 'AES-CBC', iv: keyInfo.iv }, key, buf);
  }

  async function loadKey(keyInfo, cache) {
    if (!keyInfo) return null;
    if (cache.has(keyInfo.uri)) {
      keyInfo.keyBytes = cache.get(keyInfo.uri);
      return keyInfo;
    }
    const buf = await fetchBin(keyInfo.uri);
    const bytes = new Uint8Array(buf);
    cache.set(keyInfo.uri, bytes);
    keyInfo.keyBytes = bytes;
    return keyInfo;
  }

  async function downloadHls(url, name, quality, onProgress) {
    const masterText = await fetchText(url);
    const master = parseHls(masterText, url);
    let mediaUrl = url;
    let media = master;
    if (master.master) {
      if (!master.variants.length) throw new Error('Master playlist has no variants');
      const pick = quality
        ? (master.variants.find(v => v.height === Number(quality))
          || master.variants.find(v => v.height <= Number(quality))
          || master.variants[0])
        : master.variants[0];
      mediaUrl = pick.url;
      log('Quality ' + (pick.height || pick.bandwidth) + 'p (' + master.variants.length + ' variants).', 'info');
      media = parseHls(await fetchText(mediaUrl), mediaUrl);
      if (media.master) throw new Error('Nested master playlist not supported');
    }

    if (!media.parts.length) throw new Error('Playlist has no segments');
    if (media.encrypted) log('AES-128 HLS detected; decrypting segments in-browser.', 'info');

    const total = media.parts.length + (media.map ? 1 : 0);
    const keyCache = new Map();
    const results = new Array(media.parts.length);
    let done = 0;
    let next = 0;
    let failed = false;

    const work = async () => {
      while (!failed) {
        const i = next++;
        if (i >= media.parts.length) return;
        const part = media.parts[i];
        let buf = null;
        let lastErr = null;
        for (let attempt = 0; attempt < 4 && !failed; attempt++) {
          try {
            buf = await fetchBin(part.url);
            if (part.key) {
              const k = await loadKey(part.key, keyCache);
              buf = await decryptSegment(buf, k);
            }
            break;
          } catch (e) {
            lastErr = e;
            await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
          }
        }
        if (!buf) {
          failed = true;
          throw lastErr || new Error('Segment failed: ' + part.url);
        }
        results[i] = buf;
        done++;
        if (onProgress) onProgress(done, total);
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(4, media.parts.length); i++) workers.push(work());
    await Promise.all(workers);

    const chunks = [];
    if (media.map) chunks.push(await fetchBin(media.map));
    for (const r of results) chunks.push(r);
    const blob = new Blob(chunks, { type: media.ext === 'mp4' ? 'video/mp4' : 'video/mp2t' });
    saveBlob(blob, safeName(name) + '.' + media.ext);
    log('Saved ' + name + '.' + media.ext + ' (' + (blob.size / 1048576).toFixed(1) + ' MB).', 'success');
    return { blob, ext: media.ext, size: blob.size };
  }

  function safeName(s) {
    return String(s || 'video')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90) || 'video';
  }

  function saveBlob(blob, name) {
    const a = D.createElement('a');
    const u = W.URL.createObjectURL(blob);
    a.href = u;
    a.download = name;
    a.style.display = 'none';
    D.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { W.URL.revokeObjectURL(u); } catch (e) {} }, 60000);
  }

  async function downloadResolved(item, quality) {
    if (!item) return;
    try {
      if (item.kind === 'youtube') {
        log('YouTube video: use the [YT] command (yt-dlp).', 'warn');
        return;
      }
      let hls = item.hls;
      if (!hls && item.kind === 'bunny') hls = await bunnyHls(item);
      if (!hls && /\.m3u8/i.test(item.embed || '')) hls = item.embed;
      if (!hls) throw new Error('No HLS URL. Open the player once, then use the captured .m3u8.');
      log('Downloading ' + item.title + ' ...', 'info');
      await downloadHls(hls, item.title, quality, (d, t) => {
        if (d === t || d % 10 === 0) log('Segments ' + d + '/' + t + '.', 'info');
      });
    } catch (e) {
      log('Download failed: ' + e.message, 'error');
    }
  }

  function ffmpegCommand(item) {
    if (!item) return '';
    if (item.kind === 'youtube') {
      return 'yt-dlp -f "bv*+ba/b" --merge-output-format mp4 "' + item.embed + '"';
    }
    const url = item.hls || item.embed;
    return 'ffmpeg -y -headers "Referer: ' + DEFAULT_REFERER + '\r\nOrigin: ' + SITE_ORIGIN
      + '" -i "' + url + '" -c copy -bsf:a aac_adtstoasc "' + safeName(item.title) + '.mp4"';
  }

  // ------------------------------------------------------------------
  // Fingerprint capture (best effort)
  // ------------------------------------------------------------------
  async function readThisDevice() {
    log('Reading this browser fingerprint ...', 'info');
    const candidates = [];
    try {
      for (const e of performance.getEntriesByType('resource')) {
        if (/\/_app\/immutable\/chunks\/[^/]+\.js/i.test(e.name) && /uv04|finger|fpjs/i.test(e.name)) {
          candidates.push(e.name);
        }
      }
    } catch (e) {}
    candidates.push(location.origin + '/_app/immutable/chunks/uv04NaUW.js');

    for (const u of candidates) {
      try {
        const mod = await import(u);
        if (mod && typeof mod.getFingerprint === 'function') {
          const fp = await mod.getFingerprint();
          if (fp && fp.visitorId) {
            CFG.fp = String(fp.visitorId);
            CFG.conf = String(fp.confidenceScore == null ? '' : fp.confidenceScore);
            CFG.pin = true;
            saveConfig();
            log('This device: ' + CFG.fp + ' / ' + CFG.conf + '. Pinned.', 'success');
            renderPanel();
            return;
          }
        }
      } catch (e) {}
    }
    log('Could not load the fingerprint module. Use [Capture next login] or paste the values from F12 > Network.', 'warn');
  }

  function setFingerprintFlow() {
    const v = prompt('visitorId (from a successful POST /api/login payload):', CFG.fp);
    if (v === null) return;
    const c = prompt('confidenceScore (e.g. 0.97):', CFG.conf);
    if (c === null) return;
    CFG.fp = v.trim();
    CFG.conf = c.trim();
    CFG.pin = true;
    saveConfig();
    log('Fingerprint set and pinned: ' + CFG.fp + ' / ' + CFG.conf, 'success');
    renderPanel();
  }

  function captureNextFlow() {
    CFG.captureNext = true;
    saveConfig();
    log('Capture armed. Log in once from this device; the next login payload will be enrolled.', 'warn');
    renderPanel();
  }

  // ------------------------------------------------------------------
  // Session export / import
  // ------------------------------------------------------------------
  function exportSession() {
    const s = readSession();
    if (!s.token) { log('No token in localStorage. Log in first.', 'warn'); return; }
    let backup = null;
    try { backup = JSON.parse(storeGet(K.tokenBackup, 'null')); } catch (e) {}
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      baseUrl: SITE_ORIGIN,
      token: s.token,
      role: s.role,
      user: s.user ? JSON.parse(s.user) : null,
      fingerprint: { visitorId: CFG.fp, confidenceScore: CFG.conf },
      lastOk: backup
    };
    saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'ict-session.json');
    log('Session exported. Treat the file as a password: it contains a live Bearer token.', 'warn');
  }

  function importSessionFlow() {
    const input = D.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const j = JSON.parse(String(reader.result || ''));
          if (!j || !j.token) throw new Error('No token field');
          W.localStorage.setItem('token', j.token);
          if (j.role) W.localStorage.setItem('role', j.role);
          if (j.user) W.localStorage.setItem('user', JSON.stringify(j.user));
          if (j.fingerprint && j.fingerprint.visitorId) {
            CFG.fp = String(j.fingerprint.visitorId);
            CFG.conf = String(j.fingerprint.confidenceScore == null ? '' : j.fingerprint.confidenceScore);
            CFG.pin = true;
            saveConfig();
          }
          backupSession({
            token: j.token, role: j.role || '',
            user: j.user ? JSON.stringify(j.user) : ''
          }, 'import');
          log('Session imported. Reloading ...', 'success');
          setTimeout(() => location.reload(), 500);
        } catch (e) {
          log('Import failed: ' + e.message, 'error');
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  function copyToken() {
    const s = readSession();
    if (!s.token) { log('No token to copy.', 'warn'); return; }
    try { GM_setClipboard(s.token); log('Token copied (sensitive).', 'warn'); } catch (e) {}
  }

  // ------------------------------------------------------------------
  // API map export
  // ------------------------------------------------------------------
  function uniqueApiRows() {
    const m = new Map();
    for (const e of apiLog) {
      const key = e.method + ' ' + e.path;
      const cur = m.get(key);
      if (cur) {
        cur.count++;
        cur.status[e.status] = (cur.status[e.status] || 0) + 1;
      } else {
        m.set(key, { method: e.method, path: e.path, count: 1, status: { [e.status]: 1 } });
      }
    }
    return Array.from(m.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  function exportApiJson() {
    saveBlob(new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(),
      baseUrl: SITE_ORIGIN,
      fingerprint: { visitorId: CFG.fp, confidenceScore: CFG.conf },
      entries: apiLog
    }, null, 2)], { type: 'application/json' }), 'ict-api-log.json');
    log('API log exported (' + apiLog.length + ' entries).', 'success');
  }

  function exportApiMarkdown() {
    const rows = uniqueApiRows();
    const lines = [
      '# ictfromabc API log',
      '',
      'Exported: ' + new Date().toISOString(),
      'Entries: ' + apiLog.length + ' | unique: ' + rows.length,
      '',
      '| Method | Path | Calls | Statuses |',
      '|---|---|---:|---|'
    ];
    for (const r of rows) {
      const st = Object.entries(r.status).map(([k, v]) => k + '×' + v).join(', ');
      lines.push('| ' + r.method + ' | `' + r.path + '` | ' + r.count + ' | ' + st + ' |');
    }
    saveBlob(new Blob([lines.join('\n')], { type: 'text/markdown' }), 'ict-api-log.md');
    log('API markdown exported.', 'success');
  }

  function copyApiPaths() {
    const text = uniqueApiRows().map(r => r.method + ' ' + r.path).join('\n');
    try { GM_setClipboard(text); log('Unique API paths copied (' + uniqueApiRows().length + ').', 'success'); } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Request console + course PDFs + keep-alive (v2.1)
  // ------------------------------------------------------------------
  let consoleResp = { status: 0, text: '' };

  const QUICK_CALLS = [
    ['GET', '/user', 'own profile (auth, live-verified)'],
    ['GET', '/courses', 'course catalog {al, ol} (public, live-verified)'],
    ['GET', '/institutes', 'institutes (public, live-verified)'],
    ['GET', '/public/tutes', 'tute catalog (public, live-verified)'],
    ['GET', '/telegram', 'telegram invites (public, live-verified)'],
    ['GET', '/events', 'events feed (public, live-verified)'],
    ['GET', '/admin/courses', 'RBAC check (student -> 403)'],
    ['GET', '/validate-phone-number/0710000000', 'phone oracle (20/min limit)'],
    ['POST', '/logout', 'logout {} (auth) - wipes the live session'],
    ['POST', '/notifications/read-all', 'mark all notifications read (auth)']
  ];

  async function runConsole() {
    if (!panel) return;
    const m = panel.querySelector('#ict-cmethod').value;
    const path = panel.querySelector('#ict-cpath').value.trim();
    let body = panel.querySelector('#ict-cbody').value.trim();
    if (!path) { log('Console: enter a path, e.g. /courses.', 'warn'); return; }
    if (body && m !== 'GET' && m !== 'DELETE') {
      try { body = JSON.stringify(JSON.parse(body)); }
      catch (e) { log('Console: body is not valid JSON.', 'error'); return; }
    } else body = '';
    log('Console: ' + m + ' ' + path + ' ...');
    try {
      const r = await apiRaw(m, path, body);
      let shown = r.text || '';
      try {
        const j = JSON.parse(shown);
        if (j && j.token) shown = shown.replace(/"token":"[^"]+"/, '"token":"' + String(j.token).slice(0, 8) + '..."');
        else shown = JSON.stringify(j, null, 2);
      } catch (e) {}
      consoleResp = { status: r.status, text: String(shown).slice(0, 4000) };
      log('Console: HTTP ' + r.status, r.status >= 200 && r.status < 300 ? 'success' : 'error');
    } catch (e) {
      consoleResp = { status: 0, text: String(e.message || e) };
      log('Console failed: ' + (e.message || e), 'error');
    }
    renderPanel();
  }

  async function fetchCoursePdfs() {
    const course = prompt('Course id (e.g. 2027-al, al-2028, 2025-ol):', storeGet(K.lastCourse, '2027-al'));
    if (!course) return;
    const cid = course.trim();
    storeSet(K.lastCourse, cid);
    log('Fetching PDFs for course ' + cid + ' ...');
    try {
      const r = await apiRaw('GET', '/pdfs/' + cid, '');
      if (r.status !== 200) { log('PDFs HTTP ' + r.status + ' for ' + cid + '.', 'error'); renderPanel(); return; }
      const j = JSON.parse(r.text || 'null');
      const arr = Array.isArray(j) ? j : (j && (j.data || j.pdfs)) || [];
      let n = 0;
      for (const p of arr) {
        const u = typeof p === 'string' ? p : ((p && (p.url || p.pdf_url || p.file_url || p.file)) || '');
        if (u) { note('pdf', u, 'pdfs/' + cid); n++; }
      }
      log('Course ' + cid + ': ' + n + ' PDF entries captured.', n ? 'success' : 'warn');
    } catch (e) {
      log('PDF list failed: ' + (e.message || e), 'error');
    }
    renderPanel();
  }

  let kaTimer = null;
  let kaDeadToken = '';

  function startKeepalive() {
    stopKeepalive();
    kaTimer = setInterval(async () => {
      const s = readSession();
      if (!s.token || s.token === kaDeadToken) return;
      try {
        const r = await apiRaw('GET', '/user', '');
        if (r.status === 200) log('Keep-alive: session alive.', 'info');
        else if (r.status === 401) {
          kaDeadToken = s.token;
          log('Keep-alive: 401 - a newer login took over the session. Use [Relogin now] to take it back; auto-relogin fires on real activity, not idle polls.', 'error');
        } else log('Keep-alive: HTTP ' + r.status + '.', 'info');
      } catch (e) {}
    }, 60 * 1000);
    log('Keep-alive ON (GET /user every 60 s). Tokens die by cross-device login revocation, not a fixed timer.', 'success');
  }

  function stopKeepalive() {
    if (kaTimer) { clearInterval(kaTimer); kaTimer = null; }
  }

  // ------------------------------------------------------------------
  // Auto-relogin (v2.3): the server enforces one active session per
  // account, so a login elsewhere (or a new login here) revokes every
  // older token. When that happens, log back in with the pinned
  // fingerprint and locally-stored credentials. Pinned logins never
  // trip the device lock (verified: 3 logins, zero pauses).
  // ------------------------------------------------------------------
  let reauthBusy = false;
  let reauthFails = 0;

  function loadCreds() {
    try {
      const raw = atob(storeGet(K.creds, ''));
      const i = raw.indexOf('\n');
      if (i < 1) return null;
      const phone = raw.slice(0, i);
      const pass = raw.slice(i + 1);
      return (phone && pass) ? { phone: phone, pass: pass } : null;
    } catch (e) { return null; }
  }

  function saveLoginFlow() {
    const phone = prompt('Phone number for auto-relogin:', '');
    if (!phone) return;
    const pass = prompt('Password (stored in this browser only, never sent anywhere but /api/login):', '');
    if (!pass) return;
    try { storeSet(K.creds, btoa(phone.trim() + '\n' + pass)); }
    catch (e) { log('Could not store credentials (non-ASCII password not supported).', 'error'); return; }
    storeSet(K.auto, '1');
    log('Auto-relogin armed for ' + phone.trim() + '. When the token dies, this device takes the session back with the pinned fingerprint.', 'success');
    renderPanel();
  }

  function clearLoginFlow() {
    storeSet(K.creds, '');
    storeSet(K.auto, '0');
    log('Auto-relogin disabled and stored credentials cleared.', 'info');
    renderPanel();
  }

  async function autoReauth(reason) {
    if (storeGet(K.auto, '') !== '1' || reauthBusy) return false;
    const c = loadCreds();
    if (!c) return false;
    if (paused) { log('Auto-relogin skipped: account is on pause - not hammering the login gate.', 'warn'); return false; }
    if (!CFG.pin || !CFG.fp) { log('Auto-relogin needs a pinned fingerprint first (Session tab: Import session or Read this device).', 'error'); return false; }
    const now = Date.now();
    const last = parseInt(storeGet(K.reauth, '0'), 10) || 0;
    if (now - last < 45000) { log('Auto-relogin: cooling down (' + Math.ceil((45000 - (now - last)) / 1000) + 's) after the last attempt.', 'info'); return false; }
    if (reauthFails >= 5) { log('Auto-relogin stopped: 5 failed attempts this page. Check credentials or the pin manually.', 'error'); return false; }
    reauthBusy = true;
    storeSet(K.reauth, String(now));
    log('Auto-relogin: taking the session back (' + reason + ') ...');
    try {
      const r = await apiRaw('POST', '/login', JSON.stringify({
        phoneNumber: c.phone,
        password: c.pass,
        visitorId: CFG.fp,
        confidenceScore: parseFloat(CFG.conf) || 0.82
      }));
      if (r.status === 200) {
        let j = null;
        try { j = JSON.parse(r.text); } catch (e) {}
        if (j && j.token && addSessionFromJson(j, 'auto-relogin')) {
          reauthFails = 0;
          reauthBusy = false;
          log('Auto-relogin: session restored (' + String(j.token).slice(0, 8) + '...) - reloading so the app adopts the new token.', 'success');
          // Always reload: the SPA's in-memory store still holds the dead token,
          // and its next 401 would let the wrapper wipe the fresh one.
          W.location.reload();
          return true;
        }
        log('Auto-relogin: 200 but no token in the response body.', 'error');
      } else if (r.status === 422) {
        log('Auto-relogin: 422 - fingerprint rejected. Re-import the session export to refresh the pin.', 'error');
      } else if (r.status === 429) {
        log('Auto-relogin: 429 - rate limited; the 45s cooldown applies before the next attempt.', 'warn');
      } else {
        log('Auto-relogin: HTTP ' + r.status + ' - ' + String(r.text || '').slice(0, 120), 'error');
      }
      reauthFails++;
    } catch (e) {
      log('Auto-relogin failed: ' + (e.message || e), 'error');
      reauthFails++;
    }
    reauthBusy = false;
    return false;
  }

  // ------------------------------------------------------------------
  // Panel
  // ------------------------------------------------------------------
  const CSS = `
    #ict-fab{position:fixed;top:10px;right:10px;z-index:2147483000;background:#0f1720;color:#dbeafe;
      border:1px solid #31465c;border-radius:18px;padding:6px 12px;font:12px/1.2 system-ui;cursor:pointer;
      box-shadow:0 4px 18px rgba(0,0,0,.35)}
    #ict-panel{position:fixed;top:48px;right:10px;z-index:2147483001;width:390px;max-height:82vh;overflow:auto;
      background:#0c1219;color:#dbe7f3;border:1px solid #2a3d52;border-radius:10px;font:12px/1.35 system-ui;
      box-shadow:0 12px 40px rgba(0,0,0,.55);display:none}
    #ict-panel .hd{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;
      border-bottom:1px solid #22364a;font-weight:700}
    #ict-panel .tabs{display:flex;gap:4px;padding:6px 8px;border-bottom:1px solid #22364a}
    #ict-panel .tabs button{flex:1;background:#16222e;border:1px solid #2a3d52;color:#cfe3f7;border-radius:5px;
      padding:4px 0;font:11px system-ui;cursor:pointer}
    #ict-panel .tabs button.on{background:#24425f;border-color:#3d6a94;color:#fff}
    #ict-panel .bd{padding:8px 10px}
    #ict-panel .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:5px 0}
    #ict-panel .muted{color:#8ba3b9}
    #ict-panel .good{color:#43d17c}
    #ict-panel .bad{color:#ff6b6b}
    #ict-panel .warn{color:#ffc266}
    #ict-panel button.act{background:#1b2a39;border:1px solid #35506a;color:#dbe7f3;border-radius:5px;
      padding:3px 7px;font:11px system-ui;cursor:pointer}
    #ict-panel button.act:hover{background:#254057}
    #ict-panel button.primary{background:#1f4e78;border-color:#2f74ad;color:#fff}
    #ict-panel input[type=text],#ict-panel input[type=number]{background:#0a1118;border:1px solid #2a3d52;
      color:#dbe7f3;border-radius:4px;padding:4px 6px;font:11px system-ui;min-width:0}
    #ict-panel ul{list-style:none;margin:4px 0;padding:0}
    #ict-panel li{border-bottom:1px solid #182636;padding:5px 0}
    #ict-panel .u{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a9c6e2}
    #ict-panel .tag{display:inline-block;font-size:9px;padding:1px 5px;border-radius:3px;background:#24384c;
      color:#9fd0ff;margin-right:4px;text-transform:uppercase}
    #ict-panel .tag.bunny{background:#3b2a4d;color:#e2b8ff}
    #ict-panel .tag.youtube{background:#4d2a2a;color:#ffb8b8}
    #ict-panel .tag.hls{background:#2a4d3b;color:#b8ffd6}
    #ict-panel .sec{margin:10px 0 2px;font-weight:700;color:#8fbde6}
    #ict-panel .tiny{font-size:10px;color:#829bb1}
    #ict-panel .logline{display:block;padding:2px 0;border-bottom:1px solid #142231}
    #ict-panel select,#ict-panel textarea{background:#0a1118;border:1px solid #2a3d52;color:#dbe7f3;
      border-radius:4px;padding:4px 6px;font:11px system-ui}
    #ict-panel textarea{width:100%;min-height:56px;box-sizing:border-box}
    #ict-panel pre{background:#0a1118;border:1px solid #22364a;border-radius:5px;padding:6px;
      max-height:200px;overflow:auto;font:10px/1.35 Consolas,monospace;color:#cfe3f5;
      white-space:pre-wrap;word-break:break-all;margin:4px 0}
    #ict-panel .path{flex:1;min-width:180px}
    #ict-panel label{display:flex;gap:5px;align-items:center}
  `;

  function el(tag, cls, text) {
    const n = D.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(label, fn, cls) {
    const b = el('button', 'act' + (cls ? ' ' + cls : ''), label);
    b.type = 'button';
    b.onclick = fn;
    return b;
  }

  function short(u) {
    try {
      const x = new URL(u, location.href);
      return x.host + x.pathname.slice(0, 60) + (x.search ? '?' + x.search.slice(0, 18) : '');
    } catch (e) { return String(u).slice(0, 80); }
  }

  function renderPanel() {
    if (!panel) return;
    const q = (s) => panel.querySelector(s);
    const fpEl = q('#ict-fp');
    const tokEl = q('#ict-token');
    const lastEl = q('#ict-last');
    const pauseEl = q('#ict-pause');
    if (fpEl) fpEl.textContent = CFG.fp ? (CFG.fp + ' / ' + (CFG.conf || '?')) : 'not set';
    if (tokEl) tokEl.textContent = tokenStatus();
    if (lastEl) {
      let txt = 'never';
      try {
        const j = JSON.parse(storeGet(K.lastOk, 'null'));
        if (j) {
          txt = new Date(j.at).toLocaleString() + ' (role ' + (j.role || '?') +
            (j.skippable != null && j.skippable !== '' ? ', skippable ' + j.skippable : '') +
            (j.course_id ? ', course ' + j.course_id : '') + ')';
        }
      } catch (e) {}
      lastEl.textContent = txt;
    }
    if (pauseEl) pauseEl.textContent = paused ? ('PAUSED ' + lastPauseUrl) : 'ok';

    const vEl = q('#ict-videos');
    if (vEl) {
      vEl.textContent = '';
      const items = Array.from(resolved.values());
      if (!items.length) vEl.appendChild(el('li', 'muted', 'No resolved videos. Open a lesson and press [Scan lesson].'));
      for (const item of items.slice(0, 40)) {
        const li = el('li');
        const head = el('div', 'row');
        head.appendChild(el('span', 'tag ' + item.kind, item.kind));
        head.appendChild(el('span', 'u', item.title + '  #' + item.id));
        li.appendChild(head);
        const row = el('div', 'row');
        if (item.kind === 'youtube') {
          row.appendChild(button('Copy', () => GM_setClipboard(item.embed)));
          row.appendChild(button('YT cmd', () => GM_setClipboard(ffmpegCommand(item))));
        } else {
          row.appendChild(button('DL', () => downloadResolved(item, 720), 'primary'));
          row.appendChild(button('DL 1080', () => downloadResolved(item, 1080)));
          row.appendChild(button('HLS', async () => {
            try {
              const h = item.hls || (item.kind === 'bunny' ? await bunnyHls(item) : item.embed);
              GM_setClipboard(h);
              log('HLS URL copied.', 'success');
            } catch (e) { log(e.message, 'error'); }
          }));
          row.appendChild(button('ffmpeg', () => GM_setClipboard(ffmpegCommand(item))));
        }
        if (item.error) row.appendChild(el('span', 'tiny bad', item.error));
        li.appendChild(row);
        vEl.appendChild(li);
      }
    }

    const fEl = q('#ict-findings');
    if (fEl) {
      fEl.textContent = '';
      for (const f of findings.slice(0, 30)) {
        const li = el('li');
        const row = el('div', 'row');
        row.appendChild(el('span', 'tag ' + f.kind, f.kind));
        row.appendChild(el('span', 'u', short(f.url)));
        li.appendChild(row);
        const acts = el('div', 'row');
        acts.appendChild(button('Copy', () => GM_setClipboard(f.url)));
        if (f.kind === 'video' || f.kind === 'hls') {
          acts.appendChild(button('DL', () => downloadHls(f.url, 'video', 720, (d, t) => {
            if (d === t) log('Done ' + t + ' segments.', 'success');
          })));
        }
        if (f.kind === 'pdfblob') {
          acts.appendChild(button('Save', () => {
            const b = blobUrls.get(f.url);
            if (b) saveBlob(b, 'document.pdf');
          }));
        }
        li.appendChild(acts);
        fEl.appendChild(li);
      }
    }

    const aEl = q('#ict-api');
    if (aEl) {
      aEl.textContent = '';
      const rows = uniqueApiRows().slice(-60).reverse();
      for (const r of rows) {
        const li = el('li');
        const row = el('div', 'row');
        row.appendChild(el('span', 'tag', r.method));
        row.appendChild(el('span', 'u', r.path));
        row.appendChild(el('span', 'tiny', String(r.count)));
        li.appendChild(row);
        aEl.appendChild(li);
      }
    }

    const cEl = q('#ict-cresp');
    if (cEl) cEl.textContent = consoleResp.text ? ('HTTP ' + consoleResp.status + '\n' + consoleResp.text) : '(no response yet)';

    const lEl = q('#ict-log');
    if (lEl) {
      lEl.textContent = '';
      for (const l of logs.slice(0, 60)) {
        const s = el('span', 'logline ' + (l.level === 'error' ? 'bad' : l.level === 'success' ? 'good' : l.level === 'warn' ? 'warn' : ''));
        s.textContent = new Date(l.t).toLocaleTimeString() + '  ' + l.msg;
        lEl.appendChild(s);
      }
    }
  }

  function tab(name) {
    if (!panel) return;
    panel.querySelectorAll('.tabs button').forEach(b => {
      b.classList.toggle('on', b.getAttribute('data-tab') === name);
    });
    panel.querySelectorAll('.pane').forEach(p => {
      p.style.display = p.getAttribute('data-pane') === name ? 'block' : 'none';
    });
    renderPanel();
  }

  function buildPanel() {
    try {
      const st = D.createElement('style');
      st.textContent = CSS;
      (D.head || D.documentElement).appendChild(st);

      const fab = el('button', '', 'ICT');
      fab.id = 'ict-fab';
      fab.title = 'ICTFromABC Suite (Alt+I)';
      fab.onclick = () => togglePanel();
      D.body.appendChild(fab);

      panel = el('div');
      panel.id = 'ict-panel';
      panel.innerHTML = `
        <div class="hd"><span>ICTFromABC Suite v2.1</span><span id="ict-close" style="cursor:pointer">x</span></div>
        <div class="tabs">
          <button data-tab="access" class="on">Access</button>
          <button data-tab="videos">Videos</button>
          <button data-tab="api">API</button>
          <button data-tab="console">Console</button>
          <button data-tab="log">Log</button>
        </div>
        <div class="bd">
          <div class="pane" data-pane="access">
            <div class="sec">Device identity</div>
            <div class="row">visitorId: <b id="ict-fp">-</b></div>
            <div class="row"><span class="muted">Pinned:</span> <b id="ict-pin">-</b></div>
            <div class="row">
              <button class="act primary" id="ict-read">Read this device</button>
              <button class="act" id="ict-setfp">Set FP</button>
              <button class="act" id="ict-capture">Capture next login</button>
              <button class="act" id="ict-pintoggle">Pin on/off</button>
              <button class="act" id="ict-clearfp">Clear</button>
            </div>
            <div class="sec">Session</div>
            <div class="row">token: <b id="ict-token">-</b></div>
            <div class="row">Last OK login: <span id="ict-last" class="muted">-</span></div>
            <div class="row">Pause: <span id="ict-pause" class="muted">ok</span></div>
            <div class="row"><label><input type="checkbox" id="ict-ka"> Keep-alive (GET /user every 60 s)</label></div>
            <div class="row">
              <button class="act" id="ict-restore">Restore token</button>
              <button class="act" id="ict-copytok">Copy token</button>
              <button class="act" id="ict-export">Export session</button>
              <button class="act" id="ict-import">Import session</button>
            </div>
            <div class="row"><label><input type="checkbox" id="ict-auto"> Auto-relogin on token death</label></div>
            <div class="row">
              <button class="act" id="ict-savelogin">Save login</button>
              <button class="act" id="ict-relogin">Relogin now</button>
              <button class="act" id="ict-clearlogin">Clear saved</button>
            </div>
            <div class="tiny">The export file contains a live Bearer token. Keep it private.</div>
          </div>
          <div class="pane" data-pane="videos" style="display:none">
            <div class="row">
              <button class="act primary" id="ict-scan">Scan lesson</button>
              <span class="tiny">Lesson id from /lessons/&lt;id&gt;/videos</span>
            </div>
            <div class="row">
              <button class="act" id="ict-pdfs">Course PDFs</button>
              <span class="tiny">GET /pdfs/&lt;course&gt; -&gt; Findings</span>
            </div>
            <ul id="ict-videos"></ul>
            <div class="sec">Captured media</div>
            <ul id="ict-findings"></ul>
          </div>
          <div class="pane" data-pane="api" style="display:none">
            <div class="row">
              <button class="act" id="ict-api-json">Export JSON</button>
              <button class="act" id="ict-api-md">Export Markdown</button>
              <button class="act" id="ict-api-copy">Copy paths</button>
            </div>
            <div class="tiny">Only same-origin /api calls are recorded; values are not stored.</div>
            <ul id="ict-api"></ul>
          </div>
          <div class="pane" data-pane="console" style="display:none">
            <div class="row">
              <select id="ict-cmethod"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select>
              <input type="text" id="ict-cpath" class="path" placeholder="/courses">
            </div>
            <div class="row">
              <button class="act primary" id="ict-csend">Send</button>
              <button class="act" id="ict-ccopy">Copy response</button>
            </div>
            <textarea id="ict-cbody" placeholder="JSON body (POST/PUT/PATCH only)"></textarea>
            <div class="sec">Quick calls (live-verified)</div>
            <div class="row" id="ict-quick"></div>
            <div class="sec">Response</div>
            <pre id="ict-cresp">(no response yet)</pre>
          </div>
          <div class="pane" data-pane="log" style="display:none">
            <ul id="ict-log"></ul>
          </div>
        </div>`;
      D.body.appendChild(panel);

      panel.querySelector('#ict-close').onclick = () => togglePanel(false);
      panel.querySelectorAll('.tabs button').forEach(b => {
        b.onclick = () => tab(b.getAttribute('data-tab'));
      });
      panel.querySelector('#ict-read').onclick = readThisDevice;
      panel.querySelector('#ict-setfp').onclick = setFingerprintFlow;
      panel.querySelector('#ict-capture').onclick = captureNextFlow;
      panel.querySelector('#ict-pintoggle').onclick = () => {
        CFG.pin = !CFG.pin;
        saveConfig();
        log('Pinning ' + (CFG.pin ? 'ON' : 'OFF') + '.', 'warn');
        renderPanel();
      };
      panel.querySelector('#ict-clearfp').onclick = () => {
        CFG.fp = ''; CFG.conf = ''; CFG.captureNext = false; saveConfig();
        log('Fingerprint cleared.', 'warn');
        renderPanel();
      };
      panel.querySelector('#ict-restore').onclick = () => { if (restoreBackup(false)) setTimeout(() => location.reload(), 400); };
      panel.querySelector('#ict-copytok').onclick = copyToken;
      panel.querySelector('#ict-export').onclick = exportSession;
      panel.querySelector('#ict-import').onclick = importSessionFlow;
      panel.querySelector('#ict-scan').onclick = scanLesson;
      panel.querySelector('#ict-api-json').onclick = exportApiJson;
      panel.querySelector('#ict-api-md').onclick = exportApiMarkdown;
      panel.querySelector('#ict-api-copy').onclick = copyApiPaths;
      panel.querySelector('#ict-csend').onclick = runConsole;
      panel.querySelector('#ict-ccopy').onclick = () => GM_setClipboard(consoleResp.text || '');
      panel.querySelector('#ict-pdfs').onclick = fetchCoursePdfs;
      panel.querySelector('#ict-ka').checked = storeGet(K.ka, '1') !== '0';
      panel.querySelector('#ict-ka').onchange = (e) => {
        storeSet(K.ka, e.target.checked ? '1' : '0');
        if (e.target.checked) startKeepalive();
        else { stopKeepalive(); log('Keep-alive OFF.', 'info'); }
      };

      const qWrap = panel.querySelector('#ict-quick');
      for (const qc of QUICK_CALLS) {
        const b = button(qc[0] + ' ' + qc[1], () => {
          panel.querySelector('#ict-cmethod').value = qc[0];
          panel.querySelector('#ict-cpath').value = qc[1];
          panel.querySelector('#ict-cbody').value = '';
          tab('console');
          runConsole();
        });
        b.title = qc[2];
        qWrap.appendChild(b);
      }

      const autoEl = panel.querySelector('#ict-auto');
      if (autoEl) {
        autoEl.checked = storeGet(K.auto, '') === '1';
        autoEl.onchange = (e) => {
          if (e.target.checked && !loadCreds()) {
            e.target.checked = false;
            saveLoginFlow();
            e.target.checked = storeGet(K.auto, '') === '1';
          } else {
            storeSet(K.auto, e.target.checked ? '1' : '0');
            log('Auto-relogin ' + (e.target.checked ? 'ON - logs back in with the pinned fingerprint when the token is revoked.' : 'OFF.'), 'info');
          }
          renderPanel();
        };
      }
      const slEl = panel.querySelector('#ict-savelogin');
      if (slEl) slEl.onclick = saveLoginFlow;
      const rlEl = panel.querySelector('#ict-relogin');
      if (rlEl) rlEl.onclick = () => { storeSet(K.reauth, '0'); autoReauth('manual'); };
      const clEl = panel.querySelector('#ict-clearlogin');
      if (clEl) clEl.onclick = clearLoginFlow;

      W.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'i' || e.key === 'I')) {
          e.preventDefault();
          togglePanel();
        }
      });

      const pinEl = panel.querySelector('#ict-pin');
      if (pinEl) pinEl.textContent = CFG.pin ? 'yes' : 'no';
      log('Suite ready. ' + (CFG.fp ? 'Pinned ' + CFG.fp : 'No fingerprint set - use [Read this device] or [Capture next login].'),
        CFG.fp ? 'success' : 'warn');
      renderPanel();
    } catch (e) {
      try { console.error('[ICT] panel build failed', e); } catch (x) {}
    }
  }

  function togglePanel(force) {
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : panel.style.display !== 'block';
    panel.style.display = open ? 'block' : 'none';
    panelOpen = open;
    if (open) renderPanel();
  }

  function watchDom() {
    try {
      const mo = new MutationObserver(() => {
        const frames = D.querySelectorAll('iframe[src*="mediadelivery.net"], iframe[src*="b-cdn.net"], iframe[src*="youtube.com/embed"]');
        frames.forEach(f => note('video', f.src, 'iframe'));
      });
      mo.observe(D.documentElement || D, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    } catch (e) {}
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  try {
    GM_registerMenuCommand('ICT: set fingerprint', setFingerprintFlow);
    GM_registerMenuCommand('ICT: read this device', readThisDevice);
    GM_registerMenuCommand('ICT: capture next login', captureNextFlow);
    GM_registerMenuCommand('ICT: scan lesson', scanLesson);
    GM_registerMenuCommand('ICT: export API log', exportApiJson);
    GM_registerMenuCommand('ICT: course PDFs', fetchCoursePdfs);
    GM_registerMenuCommand('ICT: keep-alive on', startKeepalive);
    GM_registerMenuCommand('ICT: keep-alive off', stopKeepalive);
    GM_registerMenuCommand('ICT: auto-relogin on/off', () => {
      if (storeGet(K.auto, '') === '1') { storeSet(K.auto, '0'); log('Auto-relogin OFF.', 'info'); }
      else if (loadCreds()) { storeSet(K.auto, '1'); log('Auto-relogin ON.', 'success'); }
      else saveLoginFlow();
    });
    GM_registerMenuCommand('ICT: relogin now', () => { storeSet(K.reauth, '0'); autoReauth('manual'); });
    GM_registerMenuCommand('ICT: clear saved login', clearLoginFlow);
  } catch (e) {}

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', () => { buildPanel(); watchDom(); backupSessionFromStorage('init'); });
  } else {
    buildPanel();
    watchDom();
    backupSessionFromStorage('init');
  }

  if (storeGet(K.ka, '1') !== '0') startKeepalive();

  // Page loaded without a token but auto-relogin is armed -> take the session back.
  if (!readSession().token && storeGet(K.auto, '') === '1' && loadCreds()) {
    setTimeout(() => autoReauth('page load without token'), 2500);
  }
})();
