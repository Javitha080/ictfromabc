// ==UserScript==
// @name         ICTFromABC auto-relogin delta v3.1 (headless companion for the test-bed browser)
// @namespace    ictfromabc.local
// @version      3.1.1
// @description  Companion injector for browsers whose userscripts arrive via context init scripts. Watches authenticated /api calls (relative and absolute URLs) for 401 and takes the session back with the pinned fingerprint. Supersedes older delta copies: migrates the legacy creds key so v1/v2 cannot log in anymore. Canonicalizes apex documents to www so the two per-origin storages stop revoking each other's single session. Always reloads after a relogin so the SPA adopts the fresh token. No UI, top windows only.
// @match        https://ictfromabc.com/*
// @match        https://www.ictfromabc.com/*
// @run-at       document-start
// ==/UserScript==
(function () {
  'use strict';
  try {
    if (window.top !== window) return;

    // One canonical document origin: the server keeps exactly one live session
    // and localStorage is per-origin, so an apex tab and a www tab would keep
    // revoking each other's token on every boot. Documents live on www; the
    // API base (https://ictfromabc.com/api) is untouched.
    if (location.host === 'ictfromabc.com') {
      location.replace('https://www.ictfromabc.com' + location.pathname + location.search + location.hash);
      return;
    }

    // Init-script contexts have no @match enforcement — stay on the site only.
    if (!/^(www\.)?ictfromabc\.com$/.test(location.hostname)) return;

    if (window.__ICT_DELTA && window.__ICT_DELTA.v >= 3.1) return;

    // Older copies: v1 reads its cooldown off this shared object (pin it so it
    // never acts again); v1 and v2 read the legacy creds key at relogin time,
    // which is migrated below and removed, so neither can attempt a login.
    if (window.__ICT_DELTA && window.__ICT_DELTA.v < 3.1) {
      window.__ICT_DELTA.v = 3.1;
      window.__ICT_DELTA.lastAttempt = 9007199254740991;
    }

    var CREDS_KEY = 'ict_delta_creds_v31';
    var LEGACY_CREDS_KEY = 'ict_delta_creds';
    try {
      if (!localStorage.getItem(CREDS_KEY) && localStorage.getItem(LEGACY_CREDS_KEY)) {
        localStorage.setItem(CREDS_KEY, localStorage.getItem(LEGACY_CREDS_KEY));
      }
      localStorage.removeItem(LEGACY_CREDS_KEY);
    } catch (e) {}

    // The enrolled identity (last enrollment wins; 6+ live logins, zero pauses).
    // Prefer a re-pinned pair if one was stored on this origin.
    var VISITOR = localStorage.getItem('ict_pin') || 'CWUriseStUq30ANV6hIt';
    var CONF = parseFloat(localStorage.getItem('ict_conf') || '0.82') || 0.82;

    function creds() {
      try {
        var raw = atob(localStorage.getItem(CREDS_KEY) || '');
        var i = raw.indexOf('\n');
        if (i < 1) return null;
        var p = raw.slice(0, i), w = raw.slice(i + 1);
        return (p && w) ? { phone: p, pass: w } : null;
      } catch (e) { return null; }
    }

    var log = function (msg, level) {
      var color = level === 'error' ? '#ff6b6b' : level === 'success' ? '#00e676' : level === 'warn' ? '#ffb84d' : '#8ab4f8';
      console.log('%c[ICT-DELTA] ' + msg + ' color:' + color, 'font-weight:bold');
    };

    var busy = false, lastAttempt = 0, fails = 0, relogins = 0;
    window.__ICT_DELTA = window.__ICT_DELTA || {};
    window.__ICT_DELTA.v = 3.1;
    // State lives under a fresh writable key: v2 left 'stats' behind as a
    // non-configurable getter on the shared object, and redefining it threw
    // "Cannot redefine property: stats" in every later copy.
    function sync() {
      window.__ICT_DELTA.v31 = { relogins: relogins, fails: fails, busy: busy, lastAttempt: lastAttempt };
    }
    sync();

    log('armed v3.1 (fp ' + VISITOR + '/' + CONF + ', ' + (creds() ? 'creds present' : 'no creds on this origin yet') + ')');

    function saveSession(j) {
      try {
        localStorage.setItem('token', j.token);
        if (j.role) localStorage.setItem('role', j.role);
        if (j.user) localStorage.setItem('user', JSON.stringify(j.user));
      } catch (e) {}
    }

    async function reauth(reason) {
      var c = creds();
      if (!c || busy) return false;
      var now = Date.now();
      if (now - lastAttempt < 45000) return false;
      if (fails >= 5) { if (fails === 5) { fails++; sync(); log('stopped: 5 failed attempts this page - check the pin or credentials', 'error'); } return false; }
      // Account on pause: do not hammer the login gate.
      if (/\/blocked/.test(location.pathname)) { log('on /blocked - skipping relogin', 'warn'); return false; }
      busy = true;
      lastAttempt = now;
      fails++;
      sync();
      log('taking the session back (' + reason + ') ...');
      try {
        var r = await fetch('https://ictfromabc.com/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ phoneNumber: c.phone, password: c.pass, visitorId: VISITOR, confidenceScore: CONF })
        });
        var txt = '';
        try { txt = await r.text(); } catch (e) {}
        var j = null; try { j = JSON.parse(txt); } catch (e) {}
        if (r.status === 200 && j && j.token) {
          saveSession(j);
          relogins++;
          fails = 0;
          sync();
          log('session restored (' + String(j.token).slice(0, 8) + '...) - reloading so the app adopts the fresh token', 'success');
          // Always reload: the SPA's in-memory store still holds the dead token, and
          // its next 401 would let the wrapper wipe the fresh one from localStorage.
          location.reload();
          return true;
        } else if (r.status === 422) {
          log('422 - fingerprint rejected; refresh the pin (localStorage ict_pin) from a live login', 'error');
        } else if (r.status === 429) {
          log('429 - rate limited; 45 s cooldown applies', 'warn');
        } else {
          log('HTTP ' + r.status + ' - ' + String(txt).slice(0, 100), 'error');
        }
      } catch (e) {
        log('failed: ' + (e.message || e), 'error');
      }
      busy = false;
      sync();
      return true;
    }

    // Watch every /api response for revocation. Resolve the URL properly so the
    // SPA's relative '/api/...' calls are seen, and match the exact hosts so
    // lookalike hosts can never trigger a login.
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      var p = origFetch.apply(this, arguments);
      try {
        var U = new URL(typeof input === 'string' ? input : ((input && (input.url || input.href)) || ''), location.href);
        if ((U.host === 'ictfromabc.com' || U.host === 'www.ictfromabc.com') &&
            U.pathname.indexOf('/api/') === 0 &&
            U.pathname !== '/api/login') {
          p.then(function (resp) {
            try {
              if (resp.status === 401) reauth('401 ' + U.pathname);
            } catch (e) {}
          }).catch(function () {});
        }
      } catch (e) {}
      return p;
    };
  } catch (e) {
    try { console.error('[ICT-DELTA] init failed', e); } catch (x) {}
  }
})();
