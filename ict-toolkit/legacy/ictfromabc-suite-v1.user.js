// ==UserScript==
// @name         ICTFromABC Suite - device-lock bypass + API console + video/PDF harvester
// @namespace    pentest.ictfromabc
// @version      1.3.0
// @description  v1.3 (live-verified + bundle-decoded): Forces the account-bound FingerprintJS identity on every login (password + OTP variants); one-click device fingerprint probe via the site's own getFingerprint() module; multi-profile fingerprint manager; intercepts 302 "Account on Pause"; guards /blocked; backs up token/role/skippable/course_id; session keep-alive; API console with live-verified quick calls; NEW: lesson video auto-capture from API JSON + one-click signed-URL resolver (calls /videos/{id}/generate-token and appends Bunny token+expires params - the site's own signing scheme); PDF enumeration via /pdfs/{course} + authenticated secure-file download; rate-limit awareness; Bunny Stream + PDF harvester with HLS download queue.
// @author       ictfromabc pentest workspace
// @match        https://www.ictfromabc.com/*
// @match        https://ictfromabc.com/*
// @match        https://iframe.mediadelivery.net/*
// @match        https://*.mediadelivery.net/*
// @match        https://*.b-cdn.net/*
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @connect      ictfromabc.com
// @connect      mediadelivery.net
// @connect      b-cdn.net
// @connect      bunnycdn.net
// @connect      *
// ==/UserScript==

/*
  QUICKSTART
  1. Unlock first: if the account is currently "On Pause", call staff (071 455 5513).
     No client-side trick can clear a server-side pause.
  2. On any device: Alt+I -> Status -> [Probe device FP]. The suite imports the site's
     own FingerprintJS module and shows what THIS device computes (visitorId + confidence)
     with zero login attempts. Save it as a profile if you want this device's identity.
  3. On the PC that logs in fine: log in once with the suite installed -> it captures the
     bound pair automatically (or F12 -> Network -> POST /api/login -> visitorId/confidenceScore).
  4. Alt+I -> Status -> select/activate the profile. Every device must use the SAME profile.
     Export [Copy profile JSON] from PC, [Import] on phone (Android: Firefox/Kiwi + Tampermonkey).
  5. Rules: log in ONLY from script-equipped browsers. The native Median app has its own
     device ID and can rebind the account -> avoid it, or re-capture after using it.
  Works alongside your generic harvester script (it only chains fetch hooks).
*/

(function () {
  'use strict';

  const W = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const D = document;
  const API_BASE = 'https://ictfromabc.com/api';
  const FP_API_KEY = 'rDaS5GdGD0S43aJ8ry6f';

  // ---------------- frame mode: sniff the Bunny player iframe ----------------
  if (W.self !== W.top) {
    try {
      const post = u => { try { W.parent.postMessage({ __suiteMedia: true, url: String(u) }, '*'); } catch (e) {} };
      const re = /\.(m3u8|mp4)(\?|$)|playlist/i;
      const of = W.fetch;
      W.fetch = function (...args) {
        try {
          const u = (typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '');
          if (re.test(u)) post(u);
        } catch (e) {}
        return of.apply(this, args);
      };
      const xo = W.XMLHttpRequest.prototype.open;
      W.XMLHttpRequest.prototype.open = function (m, u) {
        try { if (re.test(String(u))) post(u); } catch (e) {}
        return xo.apply(this, arguments);
      };
    } catch (e) {}
    return; // frames stop here
  }

  // ---------------- storage helpers ----------------
  const store = {
    get(k, d) { try { const v = GM_getValue(k, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { GM_setValue(k, v); } catch (e) {} }
  };

  // ---------------- fingerprint profiles ----------------
  // profile: {id, label, visitorId, confidence, addedAt, lastOk}
  function profiles() {
    try { const p = JSON.parse(store.get('suite_profiles', '[]')); return Array.isArray(p) ? p : []; }
    catch (e) { return []; }
  }
  function setProfiles(ps) { store.set('suite_profiles', JSON.stringify(ps)); renderPanel(); }
  function activeProfile() {
    const ps = profiles();
    const id = store.get('suite_active', '');
    return ps.find(p => p.id === id) || ps[0] || null;
  }
  // migrate legacy v1.0 keys into a profile
  (function migrate() {
    if (!store.get('suite_profiles', '') && store.get('suite_visitorId', '')) {
      const ps = [{ id: 'p' + Date.now(), label: 'imported v1.0', visitorId: store.get('suite_visitorId', ''), confidence: store.get('suite_confidence', ''), addedAt: Date.now(), lastOk: null }];
      setProfiles(ps);
      store.set('suite_active', ps[0].id);
      store.set('suite_visitorId', '');
    }
  })();

  function activeFp() {
    const p = activeProfile();
    return p ? { visitorId: p.visitorId, confidence: p.confidence, label: p.label } : null;
  }

  // ---------------- state ----------------
  const apiLog = [];        // {t, url, status}
  let findings = [];        // {kind: video|pdf|pdfblob|youtube, url, src, t}
  const logLines = [];      // {t, msg, level}
  const downloads = [];     // {id, name, done, total, status}
  let observedFp = null;    // {visitorId, confidenceScore, url, at} - device's own FP seen in a login body
  let probedFp = null;      // {visitorId, confidenceScore, at} - from the site's getFingerprint()
  let lastApiResponse = { status: 0, text: '' };
  let lastKa401Token = '';
  let kaTimer = null;
  let fpModule = null;      // imported site FP module (getFingerprint)
  let fpChunkUrl = null;
  const seen = new Set();
  let panelEl = null;
  let persistT = null;

  // restore persisted findings + api log (blob URLs die with the session, skip those)
  try {
    findings = JSON.parse(store.get('suite_findings', '[]')).filter(f => f.kind !== 'pdfblob');
    const al = JSON.parse(store.get('suite_apilog', '[]'));
    if (Array.isArray(al)) apiLog.push(...al);
  } catch (e) {}

  function schedulePersist() {
    if (persistT) return;
    persistT = setTimeout(() => {
      persistT = null;
      try {
        store.set('suite_findings', JSON.stringify(findings.filter(f => f.kind !== 'pdfblob').slice(0, 100)));
        store.set('suite_apilog', JSON.stringify(apiLog.slice(-300)));
      } catch (e) {}
    }, 1200);
  }

  function pushLog(msg, level) {
    logLines.unshift({ t: Date.now(), msg: String(msg), level: level || 'info' });
    if (logLines.length > 150) logLines.pop();
    try { console.log('[ICT-Suite] ' + msg); } catch (e) {}
    renderPanel();
  }
  function logApi(url, status) {
    if (apiLog.length >= 500) apiLog.shift();
    apiLog.push({ t: Date.now(), url, status });
    schedulePersist();
  }
  function note(kind, url, src) {
    const key = kind + '|' + url;
    if (seen.has(key)) return;
    seen.add(key);
    findings.unshift({ kind, url: String(url), src: src || '', t: Date.now() });
    if (findings.length > 200) findings.pop();
    schedulePersist();
    renderPanel();
  }

  // ---------------- fingerprint forcing (the device-lock bypass) ----------------
  function forcedBodyString(s) {
    const fp = activeFp();
    if (!fp || !fp.visitorId) return null;
    try {
      const j = JSON.parse(s);
      if (j && typeof j === 'object' && ('visitorId' in j)) {
        j.visitorId = fp.visitorId;
        const c = parseFloat(fp.confidence);
        if (!isNaN(c)) j.confidenceScore = c;
        return JSON.stringify(j);
      }
    } catch (e) {}
    return null;
  }
  function forceFormData(fd) {
    const fp = activeFp();
    try {
      if (fp && fp.visitorId && fd && typeof fd.has === 'function' && fd.has('visitorId')) {
        fd.set('visitorId', fp.visitorId);
        const c = parseFloat(fp.confidence);
        if (!isNaN(c) && fd.has('confidenceScore')) fd.set('confidenceScore', String(c));
      }
    } catch (e) {}
    return fd;
  }
  // snapshot the device's own fingerprint from any outgoing login-ish body (pre-rewrite)
  function observeFp(s, url) {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === 'object' && j.visitorId) {
        observedFp = { visitorId: String(j.visitorId), confidenceScore: j.confidenceScore != null ? String(j.confidenceScore) : '', url: url || '', at: Date.now() };
        store.set('suite_observed_fp', JSON.stringify(observedFp));
      }
    } catch (e) {}
  }

  // ---------------- direct FP probe: import the site's own getFingerprint module ----------------
  // The site bundles FingerprintJS Pro v3.9.6 as a SvelteKit chunk and exports getFingerprint()
  // from it. We find that chunk (hashes change per deploy) and reuse the site's own agent.
  async function discoverFpModule() {
    if (fpModule) return { mod: fpModule, url: fpChunkUrl };
    const cached = store.get('suite_fpchunk', '');
    if (cached) {
      try {
        const m = await import(cached);
        if (m && typeof m.getFingerprint === 'function') { fpModule = m; fpChunkUrl = cached; return { mod: m, url: cached }; }
      } catch (e) { store.set('suite_fpchunk', ''); } // stale hash after deploy
    }
    // collect candidate chunk URLs: performance entries + current HTML + login page HTML + app entry
    const urls = new Set();
    try {
      (W.performance && W.performance.getEntriesByType ? W.performance.getEntriesByType('resource') : [])
        .forEach(r => { const n = (r && r.name) || ''; if (n.indexOf('/_app/immutable/') !== -1 && /\.js(\?|$)/.test(n)) urls.add(n); });
    } catch (e) {}
    const add = txt => { const re = /\/_app\/immutable\/(?:chunks|nodes|entry)\/[A-Za-z0-9_.-]+\.js/g; let m; while ((m = re.exec(txt))) urls.add(m[0]); };
    try { add(D.documentElement.outerHTML); } catch (e) {}
    try { add(await fetch('/auth/login').then(r => r.text())); } catch (e) {}
    for (const u of Array.from(urls)) {
      if (/entry\/(start|app)\./.test(u)) { try { add(await fetch(u).then(r => r.text())); } catch (e) {} }
    }
    // the FP chunk is the only one containing the FP API key literal
    for (const u of urls) {
      try {
        const t = await fetch(u).then(r => r.text());
        if (t.indexOf(FP_API_KEY) !== -1) {
          const m = await import(u);
          if (m && typeof m.getFingerprint === 'function') {
            fpModule = m; fpChunkUrl = u; store.set('suite_fpchunk', u);
            return { mod: m, url: u };
          }
        }
      } catch (e) {}
    }
    return null;
  }

  async function probeDeviceFp() {
    pushLog('Probing device fingerprint via the site module...');
    const d = await discoverFpModule();
    if (!d) {
      pushLog('FP module not found (deploy changed?). Capture manually: log in once and [Save observed].', 'error');
      return null;
    }
    try {
      const r = await d.mod.getFingerprint();
      probedFp = { visitorId: String(r.visitorId || ''), confidenceScore: r.confidenceScore != null ? String(r.confidenceScore) : '', at: Date.now() };
      pushLog('Device FP probe: ' + probedFp.visitorId + ' (confidence ' + probedFp.confidenceScore + ')', 'success');
      renderPanel();
      return probedFp;
    } catch (e) {
      pushLog('FP probe failed: ' + (e && e.message || e), 'error');
      return null;
    }
  }

  function saveProbedFlow() {
    if (!probedFp || !probedFp.visitorId) { pushLog('No probe result yet - use [Probe device FP] first.', 'warning'); return; }
    const label = prompt('Profile label for this device identity:', 'device-' + new Date().toISOString().slice(0, 10));
    const p = { id: 'p' + Date.now(), label: (label || 'device').trim(), visitorId: probedFp.visitorId, confidence: probedFp.confidenceScore || '', addedAt: Date.now(), lastOk: null };
    setProfiles(profiles().concat([p]));
    store.set('suite_active', p.id);
    pushLog('Probed fingerprint saved as profile + activated: ' + p.label, 'success');
  }

  // ---------------- response handling ----------------
  async function convertPause(resp, url) {
    let txt = '';
    try { txt = await resp.clone().text(); } catch (e) { return resp; }
    let j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    if (j && j.token) {
      try {
        W.localStorage.setItem('token', j.token);
        if (j.role) W.localStorage.setItem('role', j.role);
        store.set('suite_token_backup', JSON.stringify({ token: j.token, role: j.role || '', skippable: j.skippable, course_id: j.course_id, at: Date.now(), fp: (activeFp() || {}).visitorId || '' }));
      } catch (e) {}
      pushLog('Pause 302 carried a TOKEN - converted to 200 and stored. No pause.', 'success');
      const h = new Headers();
      try {
        resp.headers.forEach((v, k) => {
          const kl = k.toLowerCase();
          if (kl !== 'content-length' && kl !== 'content-encoding' && kl !== 'transfer-encoding') h.set(k, v);
        });
      } catch (e) {}
      h.set('content-type', 'application/json');
      return new Response(JSON.stringify(j), { status: 200, statusText: 'OK', headers: h });
    }
    pushLog('PAUSE: server 302 ' + ((j && j.redirect_url) || '') + ' - no token in body. Account is server-paused: call 071 455 5513, then re-capture the fingerprint.', 'error');
    return resp;
  }

  function captureLogin(txt) {
    try {
      const j = JSON.parse(txt);
      // verified response shape: {msg:"Login Successful", token, role, skippable, course_id}
      if (j && j.token) {
        const fp = activeFp();
        store.set('suite_token_backup', JSON.stringify({ token: j.token, role: j.role || '', skippable: j.skippable, course_id: j.course_id || '', at: Date.now(), fp: fp ? fp.visitorId : '' }));
        if (fp) {
          const ps = profiles();
          const p = ps.find(x => x.id === (store.get('suite_active', '') || (ps[0] && ps[0].id)));
          if (p) { p.lastOk = Date.now(); setProfiles(ps); }
        }
        pushLog('LOGIN OK - token + role + skippable=' + (j.skippable != null ? j.skippable : '?') + ' + course_id=' + (j.course_id || '?') + ' backed up' + (fp ? ' (profile ' + fp.label + ')' : ' (NO profile active - device fingerprint sent as-is)'), fp ? 'success' : 'warning');
      }
    } catch (e) {}
  }

  const blobStore = new Map();
  function capturePdfResponse(resp, url) {
    try {
      resp.clone().blob().then(b => {
        const oURL = W.URL.createObjectURL(b);
        blobStore.set(oURL, b);
        note('pdfblob', oURL, url);
      }).catch(() => {});
    } catch (e) {}
  }

  function hookResponse(resp) {
    try {
      const url = resp.url || '';
      logApi(url, resp.status);
      if (resp.status === 302) return convertPause(resp, url);
      if (resp.status === 401) pushLog('401 on ' + url + ' - the app wrapper wipes token+role from localStorage on 401. Use [Restore token] if that was not a real expiry.', 'warning');
      if (resp.status === 429) pushLog('429 on ' + url + ' - rate limited (server: 60/min general, 20/min phone validation). Slow down.', 'warning');
      let ct = '';
      try { ct = resp.headers.get('content-type') || ''; } catch (e) {}
      if (/json|html/i.test(ct)) {
        resp.clone().text().then(t => {
          scanBody(t, url);
          let j = null;
          try { j = JSON.parse(t); } catch (e) {}
          if (j) scanStructured(j, url);
          if (resp.status === 200 && (/\/api\/login(\?|$)|\/api\/login\/otp/.test(url))) captureLogin(t);
        }).catch(() => {});
      } else if (/pdf/i.test(ct)) {
        capturePdfResponse(resp, url);
      }
    } catch (e) {}
    return resp;
  }

  // ---------------- body scanning ----------------
  function scanBody(text, srcUrl) {
    try {
      if (!text || text.length > 3000000) return;
      let m;
      const embedRe = /(?:https?:)?\/\/iframe\.mediadelivery\.net\/embed\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)[^\s"'\\]*/g;
      while ((m = embedRe.exec(text))) note('video', m[0].charAt(0) === '/' ? 'https:' + m[0] : m[0], srcUrl);
      const mediaRe = /(?:https?:)?\/\/[^\s"'\\]*(?:mediadelivery\.net|b-cdn\.net|bunnycdn\.net)[^\s"'\\]*(?:\.m3u8|\.mp4|playlist)[^\s"'\\]*/g;
      while ((m = mediaRe.exec(text))) note('video', m[0].charAt(0) === '/' ? 'https:' + m[0] : m[0], srcUrl);
      const fieldRe = /"(libraryId|videoId|video_id|library_id|embedUrl|embed_url|playbackUrl|playback_url|videoUrl|video_url|videoPath|pdfUrl|pdf_url|fileUrl|file_url)"\s*:\s*"?([^"\s,}]+)"?/g;
      while ((m = fieldRe.exec(text))) {
        const v = m[2];
        if (/^https?:/i.test(v)) {
          if (/\.pdf(\?|$)/i.test(v) || /pdf/i.test(m[1])) note('pdf', v, srcUrl);
          else note('video', v, srcUrl);
        }
      }
      const pdfRe = /https?:\/\/[^\s"'\\]+\.pdf[^\s"'\\]*/gi;
      while ((m = pdfRe.exec(text))) note('pdf', m[0], srcUrl);
      const ytRe = /https?:\/\/(?:www\.)?youtube\.com\/(?:embed|watch)[^\s"'\\]*/g;
      while ((m = ytRe.exec(text))) note('youtube', m[0], srcUrl);
    } catch (e) {}
  }

  // ---------------- structured JSON scan: lesson video entries ----------------
  // verified shapes: GET /lessons/{id} -> {lesson, videos:[{id, video_id, video_url,
  // thumbnail_url, preview_url, video_type}], live}; admin videos add video_type 1=YouTube
  function scanStructured(j, srcUrl) {
    try {
      if (!j || typeof j !== 'object') return;
      const walkVideo = v => {
        if (!v || typeof v !== 'object') return;
        const id = v.video_id || v.id;
        if (!id) return;
        const key = 'lessonvid|' + id;
        if (seen.has(key)) return;
        seen.add(key);
        findings.unshift({
          kind: 'lessonvid',
          url: v.video_url || v.preview_url || '',
          src: srcUrl || '',
          t: Date.now(),
          vid: { id: String(id), url: v.video_url || '', title: v.title || (v.lesson && v.lesson.title) || '', yt: v.video_type === 1 || /youtube/.test(String(v.video_url || '')) }
        });
        if (findings.length > 200) findings.pop();
        schedulePersist();
        renderPanel();
      };
      const walk = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 4) return;
        if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return; }
        if (node.video_id != null || node.video_url != null) walkVideo(node);
        for (const k in node) walk(node[k], depth + 1);
      };
      walk(j, 0);
    } catch (e) {}
  }

  // ---------------- signed-URL resolver (the site's own signing scheme) ----------------
  // GET /videos/{id}/generate-token -> {token, expires}; Bunny URLs get
  // ?token=<token>&expires=<expires> appended client-side (verified in BgTg2qdf.js).
  function signVideoId(videoRowId) {
    return new Promise(res => {
      gmApi('GET', '/videos/' + videoRowId + '/generate-token', null, (status, text) => {
        try {
          if (status !== 200) { pushLog('generate-token HTTP ' + status + ' for video ' + videoRowId, 'error'); return res(null); }
          const j = JSON.parse(text);
          if (j && j.token) {
            pushLog('Token OK for video ' + videoRowId + ' (expires ' + (j.expires ? new Date(j.expires * 1000).toLocaleTimeString() : '?') + ')', 'success');
            return res(j);
          }
          res(null);
        } catch (e) { res(null); }
      });
    });
  }
  function appendToken(url, tok) {
    const sep = String(url).indexOf('?') !== -1 ? '&' : '?';
    return url + sep + 'token=' + tok.token + '&expires=' + tok.expires;
  }
  async function resolveSigned(f) {
    const vid = f.vid || {};
    if (!vid.id) { pushLog('No video id on this entry.', 'warning'); return null; }
    if (vid.yt) { pushLog('YouTube video - token not required: ' + (vid.url || ''), 'info'); if (vid.url) note('youtube', vid.url, 'sign'); return vid.url || null; }
    const tok = await signVideoId(vid.id);
    if (!tok) return null;
    let url = vid.url;
    if (!url) {
      url = await new Promise(res => gmApi('GET', '/videos/' + vid.id, null, (s, t) => {
        try { const j = JSON.parse(t); res(s === 200 && j && j.video_url ? j.video_url : null); } catch (e) { res(null); }
      }));
      if (!url) { pushLog('No video_url from GET /videos/' + vid.id, 'error'); return null; }
    }
    const signed = appendToken(url, tok);
    const key = 'signed|' + vid.id;
    if (!seen.has(key)) {
      seen.add(key);
      findings.unshift({ kind: 'signed', url: signed, src: 'video ' + vid.id, t: Date.now() });
      schedulePersist();
      renderPanel();
    }
    GM_setClipboard(signed);
    pushLog('Signed URL copied: ' + signed.slice(0, 100) + '...', 'success');
    return signed;
  }

  // ---------------- course PDF enumeration ----------------
  async function fetchCoursePdfs() {
    const course = prompt('Course id (e.g. 2027-al, al-2028, 2025-ol):', store.get('suite_lastcourse', '2027-al'));
    if (!course) return;
    store.set('suite_lastcourse', course.trim());
    pushLog('Fetching PDFs for course ' + course + '...');
    await new Promise(res => gmApi('GET', '/pdfs/' + course.trim(), null, (status, text) => {
      try {
        if (status !== 200) { pushLog('PDFs HTTP ' + status + ' for ' + course, 'error'); return res(); }
        const j = JSON.parse(text);
        const arr = Array.isArray(j) ? j : (j.data || j.pdfs || []);
        let n = 0;
        (Array.isArray(arr) ? arr : []).forEach(p => {
          const u = typeof p === 'string' ? p : (p.url || p.pdf_url || p.file_url || p.file || '');
          if (u) { note('pdf', u, 'pdfs/' + course); n++; }
        });
        pushLog('Course ' + course + ': ' + n + ' PDF entries captured (Findings tab).', n ? 'success' : 'warning');
      } catch (e) { pushLog('PDF list parse failed: ' + (e && e.message || e), 'error'); }
      res();
    }));
  }

  // ---------------- hooks (page context) ----------------
  (function patchFetch() {
    const origFetch = W.fetch;
    W.fetch = function (input, init) {
      let myInit = init;
      try {
        if (myInit && myInit.body) {
          if (typeof myInit.body === 'string' && myInit.body.indexOf('visitorId') !== -1) {
            observeFp(myInit.body, (typeof input === 'string' ? input : (input && input.url) || ''));
            const nb = forcedBodyString(myInit.body);
            if (nb) myInit = Object.assign({}, myInit, { body: nb });
          } else if (myInit.body instanceof W.FormData) {
            forceFormData(myInit.body);
          }
        }
      } catch (e) {}
      let pr;
      try { pr = origFetch.call(W, input, myInit); }
      catch (e) { pushLog('fetch failed: ' + e.message, 'error'); throw e; }
      return Promise.resolve(pr).then(hookResponse);
    };
  })();

  (function patchXHR() {
    const XO = W.XMLHttpRequest.prototype.open;
    const XS = W.XMLHttpRequest.prototype.send;
    W.XMLHttpRequest.prototype.open = function (method, url) {
      this.__suite = { method, url };
      return XO.apply(this, arguments);
    };
    W.XMLHttpRequest.prototype.send = function (body) {
      try {
        if (typeof body === 'string' && body.indexOf('visitorId') !== -1) {
          observeFp(body, (this.__suite && this.__suite.url) || '');
          const nb = forcedBodyString(body);
          if (nb) body = nb;
        }
      } catch (e) {}
      const self = this;
      this.addEventListener('load', function () {
        try {
          const u = (self.__suite && self.__suite.url) || '';
          logApi(u, self.status);
          const ct = (self.getResponseHeader && self.getResponseHeader('content-type')) || '';
          if (/json|html/i.test(ct)) scanBody(self.responseText || '', u);
        } catch (e) {}
      });
      return XS.call(this, body);
    };
  })();

  (function guardBlocked() {
    try {
      const ps = W.history.pushState;
      const rs = W.history.replaceState;
      W.history.pushState = function (s, t, u) {
        try {
          if (String(u || '').indexOf('/blocked') !== -1) {
            pushLog('Blocked navigation to /blocked (pause screen).', 'warning');
            return;
          }
        } catch (e) {}
        return ps.apply(this, arguments);
      };
      W.history.replaceState = function (s, t, u) {
        try {
          if (String(u || '').indexOf('/blocked') !== -1) {
            pushLog('Blocked (replace) navigation to /blocked.', 'warning');
            return;
          }
        } catch (e) {}
        return rs.apply(this, arguments);
      };
    } catch (e) {}
  })();

  W.addEventListener('message', ev => {
    try {
      const d = ev.data;
      if (d && d.__suiteMedia && d.url) note('video', d.url, 'player-frame');
    } catch (e) {}
  });

  try {
    const o = store.get('suite_observed_fp', '');
    if (o) observedFp = JSON.parse(o);
  } catch (e) {}

  // ---------------- GM helpers ----------------
  // authenticated same-origin API URLs need the Bearer token (secure files, PDFs)
  function authHeaderFor(url) {
    try {
      if (String(url).indexOf(API_BASE) === 0) {
        const t = lsToken();
        if (t) return { 'Authorization': 'Bearer ' + t };
      }
    } catch (e) {}
    return {};
  }
  function gmText(url) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 30000,
        headers: Object.assign({ 'Referer': 'https://www.ictfromabc.com/' }, authHeaderFor(url)),
        onload: r => res(r.responseText || ''),
        onerror: () => rej(new Error('network error')),
        ontimeout: () => rej(new Error('timeout'))
      });
    });
  }
  function gmBin(url) {
    return new Promise((res, rej) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 60000, responseType: 'arraybuffer',
        headers: Object.assign({ 'Referer': 'https://www.ictfromabc.com/' }, authHeaderFor(url)),
        onload: r => res(r.response),
        onerror: () => rej(new Error('network error')),
        ontimeout: () => rej(new Error('timeout'))
      });
    });
  }
  // authenticated API call via GM (does not touch the page session)
  function gmApi(method, path, bodyJson, cb) {
    let url = path;
    if (!/^https?:/i.test(path)) url = API_BASE + (path.charAt(0) === '/' ? path : '/' + path);
    const token = lsToken();
    const headers = { 'Accept': 'application/json', 'Referer': 'https://www.ictfromabc.com/' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (bodyJson) headers['Content-Type'] = 'application/json';
    GM_xmlhttpRequest({
      method, url, headers, data: bodyJson || undefined, timeout: 30000,
      onload: r => cb(r.status, r.responseText || ''),
      onerror: () => cb(0, '{"error":"network error"}'),
      ontimeout: () => cb(0, '{"error":"timeout"}')
    });
  }
  function lsToken() { try { return W.localStorage.getItem('token') || ''; } catch (e) { return ''; } }
  function lsRole() { try { return W.localStorage.getItem('role') || ''; } catch (e) { return ''; } }

  function safeName(s) {
    return String(s || 'video').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'video';
  }
  function saveBlob(blob, name) {
    const a = D.createElement('a');
    const oURL = W.URL.createObjectURL(blob);
    a.href = oURL;
    a.download = name;
    D.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => { try { W.URL.revokeObjectURL(oURL); } catch (e) {} }, 30000);
  }

  // ---------------- HLS resolution + download queue ----------------
  function parseHls(txt, base) {
    const lines = txt.split(/\r?\n/).map(s => s.trim());
    if (lines.some(l => l.indexOf('#EXT-X-STREAM-INF') === 0)) {
      const variants = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('#EXT-X-STREAM-INF') !== 0) continue;
        const res = /RESOLUTION=(\d+)x(\d+)/.exec(lines[i]);
        const bw = /BANDWIDTH=(\d+)/.exec(lines[i]);
        let u = null;
        for (let k = i + 1; k < lines.length; k++) {
          const l = lines[k];
          if (l && l.charAt(0) !== '#') { u = new URL(l, base).href; i = k; break; }
        }
        if (u) variants.push({ url: u, height: res ? +res[2] : 0, bandwidth: bw ? +bw[1] : 0 });
      }
      variants.sort((a, b) => (b.height || b.bandwidth) - (a.height || a.bandwidth));
      return { master: true, variants };
    }
    const enc = lines.some(l => l.indexOf('#EXT-X-KEY') === 0 && l.indexOf('METHOD=NONE') === -1);
    const parts = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('#EXT-X-MAP') === 0) {
        const mm = /URI="([^"]+)"/.exec(lines[i]);
        if (mm) parts.push(new URL(mm[1], base).href);
        continue;
      }
      if (!lines[i] || lines[i].charAt(0) === '#') continue;
      parts.push(new URL(lines[i], base).href);
    }
    const ext = /\.m4s|init\.mp4|\.mp4/i.test(txt) ? 'mp4' : 'ts';
    return { master: false, parts, encrypted: enc, ext };
  }

  async function resolveStreams(embedUrl) {
    const html = await gmText(embedUrl);
    const out = [];
    const push = u => { if (u && out.indexOf(u) === -1) out.push(u); };
    let m;
    const re1 = /(?:https?:)?\/\/[^\s"'<>\\]+\.(?:m3u8|mp4)[^\s"'<>\\]*/gi;
    while ((m = re1.exec(html))) push(m[0].charAt(0) === '/' ? 'https:' + m[0] : m[0]);
    const re2 = /"(?:playlist|playbackUrl|playback_url|url|source)"\s*:\s*"(https?:[^"]+\.(?:m3u8|mp4)[^"]*)"/gi;
    while ((m = re2.exec(html))) push(m[1]);
    if (!out.length) pushLog('No m3u8/mp4 in the embed page - open the player and let the frame sniffer catch the playlist URL.', 'warning');
    return out;
  }

  const MAX_CONCURRENT = 2;
  let activeDl = 0;
  const dlQueue = [];

  function enqueueDl(fn) {
    dlQueue.push(fn);
    pumpDl();
  }
  function pumpDl() {
    while (activeDl < MAX_CONCURRENT && dlQueue.length) {
      activeDl++;
      const fn = dlQueue.shift();
      Promise.resolve().then(fn).catch(e => pushLog('Download error: ' + e.message, 'error'))
        .finally(() => { activeDl--; pumpDl(); renderPanel(); });
    }
  }

  async function runDlJob(job, streamUrl) {
    const txt = await gmText(streamUrl);
    const p = parseHls(txt, streamUrl);
    if (p.master) {
      if (!p.variants.length) { job.status = 'no variants'; renderPanel(); return; }
      const best = p.variants[0];
      pushLog('Master playlist: ' + p.variants.length + ' qualities; downloading best (' + (best.height || best.bandwidth) + ')...', 'success');
      return runDlJob(job, best.url);
    }
    if (p.encrypted) pushLog('HLS is AES-encrypted - copy the manifest URL and use N_m3u8DL-RE / ffmpeg instead.', 'error');
    job.total = p.parts.length;
    const bufs = [];
    let done = 0;
    for (const u of p.parts) {
      if (job.cancel) { job.status = 'cancelled'; renderPanel(); return; }
      bufs.push(await gmBin(u));
      done++;
      job.done = done;
      if (done % 5 === 0 || done === p.parts.length) renderPanel();
    }
    let total = 0;
    for (const b of bufs) total += b.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const b of bufs) { out.set(new Uint8Array(b), off); off += b.byteLength; }
    saveBlob(new Blob([out]), job.name + '.' + p.ext);
    job.status = 'done';
    pushLog('Saved: ' + job.name + '.' + p.ext, 'success');
  }

  function dlVideo(url) {
    const job = { id: 'j' + Date.now() + Math.random().toString(36).slice(2, 6), name: 'video', done: 0, total: 0, status: 'resolving', cancel: false };
    try { const u = new URL(url); const seg = u.pathname.split('/').filter(Boolean); job.name = safeName(seg[seg.length - 1] || seg[seg.length - 2] || 'video'); } catch (e) {}
    downloads.unshift(job);
    if (downloads.length > 30) downloads.pop();
    renderPanel();
    enqueueDl(async () => {
      try {
        let streamUrls = [url];
        if (/iframe\.mediadelivery\.net\/embed/.test(url)) {
          job.status = 'resolving';
          renderPanel();
          streamUrls = await resolveStreams(url);
        }
        if (!streamUrls.length) { job.status = 'no streams'; renderPanel(); return; }
        await runDlJob(job, streamUrls[0]);
      } catch (e) {
        job.status = 'failed: ' + e.message;
        renderPanel();
      }
    });
  }

  function exportApiLog() {
    const data = {
      exported: new Date().toISOString(),
      activeProfile: activeProfile(),
      profiles: profiles(),
      probedFp, observedFp,
      apiLog, findings, log: logLines, downloads
    };
    saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'ictfromabc-api-log.json');
    pushLog('API log exported.', 'success');
  }

  // ---------------- session keep-alive ----------------
  function startKeepalive() {
    stopKeepalive();
    kaTimer = setInterval(() => {
      const t = lsToken();
      if (!t) return;
      if (t === lastKa401Token) return; // token known dead - wait for a new login
      gmApi('GET', '/user', null, (status) => {
        if (status === 200) pushLog('keepalive: session alive (200)', 'info');
        else if (status === 401) { lastKa401Token = t; pushLog('keepalive: 401 - token dead. Log in again (expect auto-wipe; restore afterwards if needed).', 'error'); }
        else pushLog('keepalive: ' + status, 'info');
      });
    }, 10 * 60 * 1000);
  }
  function stopKeepalive() { if (kaTimer) { clearInterval(kaTimer); kaTimer = null; } }
  if (store.get('suite_keepalive', '1') === '1') startKeepalive();

  // ---------------- panel ----------------
  const CSS = `
    #ict-suite-float{position:fixed;top:8px;right:8px;z-index:2147483000;background:#101418;color:#e6eef7;
      border:1px solid #2a3540;border-radius:20px;padding:6px 12px;font:12px system-ui;cursor:pointer}
    #ict-suite{position:fixed;top:44px;right:8px;z-index:2147483001;width:370px;max-height:80vh;overflow:auto;
      background:#101418;color:#e6eef7;border:1px solid #2a3540;border-radius:10px;font:12px system-ui;
      box-shadow:0 8px 30px rgba(0,0,0,.5);display:none}
    #ict-suite .hd{padding:8px 10px;font-weight:700;border-bottom:1px solid #2a3540;display:flex;justify-content:space-between;align-items:center}
    #ict-suite .tabs{display:flex;border-bottom:1px solid #2a3540}
    #ict-suite .tabs button{flex:1;background:none;border:none;border-right:1px solid #2a3540;color:#8fb8dc;
      padding:6px 0;font:12px system-ui;cursor:pointer}
    #ict-suite .tabs button.act{background:#1c2530;color:#e6eef7;font-weight:700}
    #ict-suite .bd{padding:8px 10px}
    #ict-suite .row{margin:4px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
    #ict-suite button{background:#1c2530;color:#e6eef7;border:1px solid #3a4a58;border-radius:6px;
      padding:3px 8px;font:11px system-ui;cursor:pointer}
    #ict-suite button:hover{background:#263342}
    #ict-suite input[type=text],#ict-suite select,#ict-suite textarea{background:#0b0f13;color:#e6eef7;
      border:1px solid #3a4a58;border-radius:6px;padding:4px 6px;font:11px system-ui}
    #ict-suite textarea{width:100%;min-height:56px;box-sizing:border-box}
    #ict-suite .path{flex:1;min-width:200px}
    #ict-suite ul{margin:4px 0;padding-left:0;list-style:none;max-height:200px;overflow:auto}
    #ict-suite li{padding:3px 0;border-bottom:1px solid #1b232c;display:flex;gap:4px;align-items:center;flex-wrap:wrap}
    #ict-suite .u{flex:1 1 130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bcd3ea}
    #ict-suite .lvl-error{color:#ff6b6b}#ict-suite .lvl-success{color:#3ddc84}
    #ict-suite .lvl-warning{color:#ffb84d}
    #ict-suite .tag{font-size:10px;padding:1px 5px;border-radius:4px;background:#26313d;color:#9ad1ff}
    #ict-suite pre{background:#0b0f13;border:1px solid #2a3540;border-radius:6px;padding:6px;max-height:180px;
      overflow:auto;font:10px/1.35 Consolas,monospace;color:#cfe3f5;white-space:pre-wrap;word-break:break-all;margin:4px 0}
    #ict-suite .sec{margin-top:8px;font-weight:700;color:#8fb8dc}
    #ict-suite .muted{color:#7d93a8}
  `;

  function shortUrl(u) {
    try { const x = new URL(u, location.href); return x.host + x.pathname.slice(0, 48) + (x.search ? '?' + x.search.slice(0, 20) : ''); }
    catch (e) { return String(u).slice(0, 70); }
  }
  function el(tag, cls, text) {
    const e = D.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderPanel() {
    if (!panelEl) return;
    const q = s => panelEl.querySelector(s);
    if (!q('#suite-fp')) return;

    // ----- status tab -----
    const fp = activeFp();
    q('#suite-fp').textContent = fp ? (fp.label + ': ' + fp.visitorId.slice(0, 10) + '... / ' + (fp.confidence || '-')) : 'NOT SET';
    q('#suite-tok').textContent = lsToken() ? (lsToken().slice(0, 8) + '... (' + (lsRole() || 'role?') + ')') : 'none';

    const sel = q('#suite-prof');
    if (sel) {
      const cur = store.get('suite_active', '');
      sel.innerHTML = '';
      const ps = profiles();
      if (!ps.length) {
        const o = el('option', null, '(no profiles - capture one)');
        sel.appendChild(o);
      }
      ps.forEach(p => {
        const o = el('option', null, p.label + ' (' + p.visitorId.slice(0, 8) + '...)');
        o.value = p.id;
        if (p.id === cur || (!cur && p === ps[0])) o.selected = true;
        sel.appendChild(o);
      });
    }
    const pl = q('#suite-proflist');
    if (pl) {
      pl.innerHTML = '';
      profiles().forEach(p => {
        const li = el('li');
        const sp = el('span', 'u', p.label + ' - ' + p.visitorId.slice(0, 10) + '...' + (p.lastOk ? ' - ok ' + new Date(p.lastOk).toLocaleDateString() : ''));
        li.appendChild(sp);
        const bU = el('button', null, 'Use');
        bU.onclick = () => { store.set('suite_active', p.id); pushLog('Active fingerprint profile: ' + p.label, 'success'); renderPanel(); };
        const bC = el('button', null, 'Copy JSON');
        bC.onclick = () => GM_setClipboard(JSON.stringify(p));
        const bD = el('button', null, 'Del');
        bD.onclick = () => { setProfiles(profiles().filter(x => x.id !== p.id)); };
        li.appendChild(bU); li.appendChild(bC); li.appendChild(bD);
        pl.appendChild(li);
      });
      const pr = q('#suite-probed');
      if (pr) {
        pr.textContent = probedFp ? ('Probed device FP: ' + probedFp.visitorId + ' (conf ' + probedFp.confidenceScore + ')') : 'Probed device FP: none yet - hit [Probe device FP]';
      }
      const obs = q('#suite-observed');
      if (obs) {
        obs.textContent = observedFp ? ('Observed (login) device FP: ' + observedFp.visitorId.slice(0, 12) + '... conf ' + (observedFp.confidenceScore || '?')) : 'Observed (login) device FP: none yet';
      }
    }

    // ----- findings tab -----
    const fEl = q('#suite-findings');
    if (fEl) {
      fEl.innerHTML = '';
      findings.slice(0, 40).forEach(f => {
        const li = el('li');
        li.appendChild(el('span', 'tag', f.kind));
        const u = el('span', 'u', shortUrl(f.url));
        u.title = f.url;
        li.appendChild(u);
        const mk = (label, fn) => { const b = el('button', null, label); b.onclick = fn; li.appendChild(b); };
        if (f.kind === 'lessonvid') { mk('Sign+DL', async () => { const u = await resolveSigned(f); if (u) dlVideo(u); }); mk('Sign>Copy', () => resolveSigned(f)); }
        else if (f.kind === 'signed') { mk('DL', () => dlVideo(f.url)); mk('Copy', () => GM_setClipboard(f.url)); }
        else if (f.kind === 'video') { mk('Copy', () => GM_setClipboard(f.url)); mk('DL', () => dlVideo(f.url)); }
        else if (f.kind === 'pdfblob') { mk('Save', () => { const b = blobStore.get(f.url); if (b) saveBlob(b, safeName('lesson') + '.pdf'); }); }
        else { mk('Copy', () => GM_setClipboard(f.url)); }
        fEl.appendChild(li);
      });
      if (!findings.length) fEl.appendChild(el('li', null, 'Nothing captured yet - open a lesson.'));
    }
    const dEl = q('#suite-dls');
    if (dEl) {
      dEl.innerHTML = '';
      downloads.slice(0, 10).forEach(j => {
        const li = el('li');
        const pct = j.total ? Math.round((j.done / j.total) * 100) : 0;
        li.appendChild(el('span', 'u', j.name + ' ' + (j.status === 'done' ? 'DONE' : j.status === 'resolving' ? 'resolving' : j.status === 'cancelled' ? 'cancelled' : pct + '%')));
        if (j.status !== 'done' && j.status !== 'cancelled' && j.total === 0) {
          const b = el('button', null, 'Cancel');
          b.onclick = () => { j.cancel = true; };
          li.appendChild(b);
        }
        dEl.appendChild(li);
      });
      if (!downloads.length) dEl.appendChild(el('li', null, 'No downloads.'));
    }

    // ----- console tab -----
    const rEl = q('#suite-resp');
    if (rEl) rEl.textContent = lastApiResponse.text ? ('HTTP ' + lastApiResponse.status + '\n' + lastApiResponse.text) : '(no response yet)';

    // ----- log tab -----
    const lEl = q('#suite-log');
    if (lEl) {
      lEl.innerHTML = '';
      logLines.slice(0, 40).forEach(l => {
        const li = el('li');
        const s = el('span', 'lvl-' + (l.level || 'info'), new Date(l.t).toLocaleTimeString() + ' ' + l.msg);
        li.appendChild(s);
        lEl.appendChild(li);
      });
    }
  }

  function switchTab(name) {
    if (!panelEl) return;
    ['status', 'findings', 'console', 'log'].forEach(t => {
      const body = panelEl.querySelector('#suite-tab-' + t);
      const btn = panelEl.querySelector('#suite-tbtn-' + t);
      if (body) body.style.display = t === name ? 'block' : 'none';
      if (btn) btn.className = t === name ? 'act' : '';
    });
    renderPanel();
  }

  function setFingerprintFlow() {
    const v = prompt('Paste visitorId (from POST /api/login request payload):', activeFp() ? activeFp().visitorId : '');
    if (v === null) return;
    const c = prompt('Paste confidenceScore (e.g. 0.995):', activeFp() ? activeFp().confidence : '');
    if (c === null) return;
    const label = prompt('Profile label (e.g. "PC-Edge" or "phone"):', 'profile-' + (profiles().length + 1));
    const p = { id: 'p' + Date.now(), label: (label || 'profile').trim() || 'profile', visitorId: v.trim(), confidence: c.trim(), addedAt: Date.now(), lastOk: null };
    setProfiles(profiles().concat([p]));
    store.set('suite_active', p.id);
    pushLog('Fingerprint profile saved + activated: ' + p.label, 'success');
  }

  function saveObservedFlow() {
    if (!observedFp || !observedFp.visitorId) { pushLog('Nothing observed yet. Log in once with no active profile - the suite snapshots the fingerprint this device computes.', 'warning'); return; }
    const label = prompt('Profile label for this device:', 'device-' + new Date().toISOString().slice(0, 10));
    const p = { id: 'p' + Date.now(), label: (label || 'device').trim(), visitorId: observedFp.visitorId, confidence: observedFp.confidenceScore || '', addedAt: Date.now(), lastOk: null };
    setProfiles(profiles().concat([p]));
    store.set('suite_active', p.id);
    pushLog('Observed fingerprint saved as profile + activated: ' + p.label, 'success');
  }

  function importProfileFlow() {
    const raw = prompt('Paste profile JSON (from [Copy JSON] on the other device):');
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (!p.visitorId) throw new Error('no visitorId');
      p.id = 'p' + Date.now();
      p.label = (p.label || 'imported') + ' (imported)';
      setProfiles(profiles().concat([p]));
      store.set('suite_active', p.id);
      pushLog('Profile imported + activated: ' + p.label, 'success');
    } catch (e) { pushLog('Import failed: ' + e.message, 'error'); }
  }

  function restoreTokenFlow() {
    try {
      const raw = store.get('suite_token_backup', '');
      if (!raw) { pushLog('No backup token stored yet.', 'warning'); return; }
      const j = JSON.parse(raw);
      W.localStorage.setItem('token', j.token);
      if (j.role) W.localStorage.setItem('role', j.role);
      pushLog('Token + role restored from backup. Reloading...', 'success');
      setTimeout(() => location.reload(), 600);
    } catch (e) { pushLog('Restore failed: ' + e.message, 'error'); }
  }

  function runConsole() {
    const m = panelEl.querySelector('#suite-cmethod').value;
    const path = panelEl.querySelector('#suite-cpath').value.trim();
    let body = panelEl.querySelector('#suite-cbody').value.trim();
    if (!path) { pushLog('Console: enter a path, e.g. /courses', 'warning'); return; }
    if (body && m !== 'GET' && m !== 'DELETE') {
      try { body = JSON.stringify(JSON.parse(body)); } catch (e) { pushLog('Console: body is not valid JSON', 'error'); return; }
    } else body = '';
    pushLog('Console: ' + m + ' ' + path + ' ...');
    gmApi(m, path, body, (status, text) => {
      lastApiResponse = { status, text };
      logApi(API_BASE + path, status);
      let short = text;
      try {
        const j = JSON.parse(text);
        if (j && j.token) short = text.replace(/"token":"[^"]{8}[^"]*"/, '"token":"' + j.token.slice(0, 8) + '..."');
        else short = JSON.stringify(j, null, 2).slice(0, 4000);
      } catch (e) { short = String(text).slice(0, 4000); }
      lastApiResponse.text = short;
      pushLog('Console: HTTP ' + status, status >= 200 && status < 300 ? 'success' : 'error');
      renderPanel();
    });
  }

  const QUICK_CALLS = [
    ['GET', '/user', 'own profile (auth) - verified live'],
    ['GET', '/courses', 'course catalog {al:[], ol:[]} (public, verified)'],
    ['GET', '/institutes', 'institutes (public, verified)'],
    ['GET', '/public/tutes', 'tute catalog (public, verified)'],
    ['GET', '/telegram', 'telegram invites (public, verified)'],
    ['GET', '/events', 'events feed (public, verified live - new)'],
    ['GET', '/admin/courses', 'RBAC check (student -> 403)'],
    ['GET', '/validate-phone-number/0710000000', 'phone oracle (20/min limit)'],
    ['POST', '/logout', 'logout {} (auth)'],
    ['POST', '/notifications/read-all', 'mark all notifications read (auth)']
  ];

  function buildPanel() {
    try {
      const st = D.createElement('style');
      st.textContent = CSS;
      (D.head || D.documentElement).appendChild(st);

      const fl = el('button');
      fl.id = 'ict-suite-float';
      fl.textContent = 'ICT Suite';
      fl.onclick = () => {
        const p = D.getElementById('ict-suite');
        p.style.display = p.style.display === 'block' ? 'none' : 'block';
        renderPanel();
      };
      D.body.appendChild(fl);

      const p = D.createElement('div');
      p.id = 'ict-suite';
      p.innerHTML = `
        <div class="hd"><span>ICT Suite v1.2</span><span id="suite-close" style="cursor:pointer">x</span></div>
        <div class="tabs">
          <button id="suite-tbtn-status">Status</button>
          <button id="suite-tbtn-findings">Findings</button>
          <button id="suite-tbtn-console">Console</button>
          <button id="suite-tbtn-log">Log</button>
        </div>
        <div class="bd">
          <div id="suite-tab-status">
            <div class="row">FP: <b id="suite-fp">-</b></div>
            <div class="row"><button id="suite-newfp">New FP</button><button id="suite-probe">Probe device FP</button><button id="suite-saveprobed">Save probed</button></div>
            <div class="row"><button id="suite-saveobs">Save observed</button><button id="suite-imp">Import</button></div>
            <div class="row"><span id="suite-probed" class="muted">Probed device FP: none yet</span></div>
            <div class="row"><span id="suite-observed" class="muted">Observed (login) device FP: none yet</span></div>
            <div class="row"><select id="suite-prof" style="flex:1"></select></div>
            <div class="row">Token: <b id="suite-tok">-</b></div>
            <div class="row"><button id="suite-restore">Restore token</button><button id="suite-copytok">Copy token</button></div>
            <div class="row"><label><input type="checkbox" id="suite-ka"> Keep-alive ping /api/user every 10 min</label></div>
            <div class="row"><label><input type="checkbox" id="suite-auto"> Auto-resolve new video embeds</label></div>
            <div class="sec">Profiles</div>
            <ul id="suite-proflist"></ul>
          </div>
          <div id="suite-tab-findings" style="display:none">
            <div class="row"><button id="suite-pdfs">Course PDFs</button><span class="muted">GET /pdfs/{course} -> Findings</span></div>
            <div class="sec">Captured media / PDFs</div>
            <ul id="suite-findings"></ul>
            <div class="sec">Downloads</div>
            <ul id="suite-dls"></ul>
          </div>
          <div id="suite-tab-console" style="display:none">
            <div class="row"><select id="suite-cmethod"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select>
              <input type="text" id="suite-cpath" class="path" placeholder="/courses"></div>
            <div class="row"><button id="suite-csend">Send</button><button id="suite-ccopy">Copy response</button></div>
            <textarea id="suite-cbody" placeholder='JSON body (POST/PUT/PATCH only)'></textarea>
            <div class="sec">Quick calls (live-verified)</div>
            <div class="row" id="suite-quick"></div>
            <div class="sec">Response</div>
            <pre id="suite-resp">(no response yet)</pre>
          </div>
          <div id="suite-tab-log" style="display:none">
            <div class="row"><button id="suite-export">Export API log (JSON)</button></div>
            <ul id="suite-log"></ul>
          </div>
        </div>`;
      D.body.appendChild(p);
      panelEl = p;

      p.querySelector('#suite-close').onclick = () => p.style.display = 'none';
      ['status', 'findings', 'console', 'log'].forEach(t => {
        p.querySelector('#suite-tbtn-' + t).onclick = () => switchTab(t);
      });
      p.querySelector('#suite-newfp').onclick = setFingerprintFlow;
      p.querySelector('#suite-probe').onclick = () => { switchTab('status'); probeDeviceFp(); };
      p.querySelector('#suite-saveprobed').onclick = saveProbedFlow;
      p.querySelector('#suite-saveobs').onclick = saveObservedFlow;
      p.querySelector('#suite-imp').onclick = importProfileFlow;
      p.querySelector('#suite-restore').onclick = restoreTokenFlow;
      p.querySelector('#suite-copytok').onclick = () => { GM_setClipboard(lsToken() || ''); pushLog('Token copied.', 'success'); };
      p.querySelector('#suite-export').onclick = exportApiLog;
      p.querySelector('#suite-ccopy').onclick = () => GM_setClipboard(lastApiResponse.text || '');
      p.querySelector('#suite-csend').onclick = runConsole;
      p.querySelector('#suite-ka').checked = store.get('suite_keepalive', '1') === '1';
      p.querySelector('#suite-ka').onchange = e => {
        store.set('suite_keepalive', e.target.checked ? '1' : '0');
        if (e.target.checked) { startKeepalive(); pushLog('Keep-alive ON (10 min).', 'success'); }
        else { stopKeepalive(); pushLog('Keep-alive OFF.', 'info'); }
      };
      p.querySelector('#suite-auto').checked = store.get('suite_autoresolve', '0') === '1';

      const qWrap = p.querySelector('#suite-quick');
      QUICK_CALLS.forEach(([m, path, note_]) => {
        const b = el('button', null, m + ' ' + path);
        b.title = note_;
        b.onclick = () => {
          p.querySelector('#suite-cmethod').value = m;
          p.querySelector('#suite-cpath').value = path;
          p.querySelector('#suite-cbody').value = '';
          runConsole();
          switchTab('console');
        };
        qWrap.appendChild(b);
      });

      W.addEventListener('keydown', e => {
        if (e.altKey && (e.key === 'i' || e.key === 'I')) {
          const elp = D.getElementById('ict-suite');
          elp.style.display = elp.style.display === 'block' ? 'none' : 'block';
          renderPanel();
        }
      });

      switchTab('status');
      if (!activeFp()) {
        pushLog('No fingerprint profile active. Hit [Probe device FP] to see what this device computes (no login), or log in once and [Save observed].', 'warning');
      } else {
        pushLog('Fingerprint forcing active (profile: ' + activeFp().label + '). Every login presents as the bound device.', 'success');
      }
    } catch (e) {}
  }

  function watchDom() {
    try {
      const mo = new MutationObserver(() => {
        try {
          D.querySelectorAll('iframe[src*="mediadelivery.net"], iframe[src*="b-cdn.net"], iframe[src*="youtube.com/embed"]')
            .forEach(f => note('video', f.src, 'iframe'));
        } catch (e) {}
      });
      mo.observe(D.documentElement || D, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    } catch (e) {}
  }

  // ---------------- init ----------------
  try {
    GM_registerMenuCommand('Probe device fingerprint', () => probeDeviceFp());
    GM_registerMenuCommand('New fingerprint profile', setFingerprintFlow);
    GM_registerMenuCommand('Save observed fingerprint', saveObservedFlow);
    GM_registerMenuCommand('Restore token', restoreTokenFlow);
    GM_registerMenuCommand('Export API log', exportApiLog);
  } catch (e) {}

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', () => { buildPanel(); watchDom(); });
  } else {
    buildPanel(); watchDom();
  }
})();
