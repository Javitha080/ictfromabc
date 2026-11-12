// Offline sandbox for loading userpannel/ictfromabc-bypass.user.js in node:vm.
// NO NETWORK: the only fetch inside the sandbox is the stub below.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const USERSCRIPT_PATH =
  process.env.ICT_BYPASS_SRC || path.resolve(HERE, '..', '..', '..', '..', 'userpannel', 'ictfromabc-bypass.user.js');

export function readSource(p = USERSCRIPT_PATH) {
  return fs.readFileSync(p, 'utf8');
}

const DEBUG = !!process.env.ICT_BYPASS_TEST_DEBUG;

// ── clock ─────────────────────────────────────────────────────────
// Real-epoch by default; tests can advance() to exercise the 45 s
// cooldown and the fail-cap timing without sleeping.
function makeClock(startEpoch) {
  const clock = { base: startEpoch, offset: 0 };
  clock.now = () => clock.base + clock.offset;
  clock.advance = (ms) => { clock.offset += Number(ms) || 0; };
  clock.set = (epoch) => { clock.offset = epoch - clock.base; };
  class FakeDate extends Date {
    constructor(...args) {
      if (args.length === 0) super(clock.now());
      else super(...args);
    }
    static now() { return clock.now(); }
  }
  return { clock, FakeDate };
}

// ── in-memory storage ─────────────────────────────────────────────
class MemStorage {
  constructor(init) { this.__m = new Map(Object.entries(init || {})); }
  getItem(k) { k = String(k); return this.__m.has(k) ? this.__m.get(k) : null; }
  setItem(k, v) { this.__m.set(String(k), String(v)); }
  removeItem(k) { this.__m.delete(String(k)); }
  clear() { this.__m.clear(); }
  key(i) { return [...this.__m.keys()][i] ?? null; }
  get length() { return this.__m.size; }
}

// ── console spy ───────────────────────────────────────────────────
function makeConsole() {
  const logs = [];
  const rec = (level) => (...args) => {
    logs.push({ level, args, text: args.filter((a) => typeof a === 'string').join(' ') });
    if (DEBUG) { try { /* eslint-disable no-console */ console[level === 'group' ? 'log' : level](...args); } catch {} }
  };
  const c = {
    log: rec('log'), error: rec('error'), warn: rec('warn'), info: rec('info'),
    debug: rec('debug'), trace: rec('trace'), dir: rec('dir'),
    group: rec('group'), groupCollapsed: rec('group'), groupEnd: rec('groupEnd'),
    table: rec('table'), time: rec('time'), timeEnd: rec('timeEnd'), count: rec('count'),
  };
  c.__logs = logs;
  return c;
}

// ── event-listener host ───────────────────────────────────────────
function listenerHost() {
  const m = new Map();
  return {
    add(t, fn) { if (!m.has(t)) m.set(t, []); m.get(t).push(fn); },
    remove(t, fn) { const l = m.get(t); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    fire(t, ev) { const out = []; (m.get(t) || []).slice().forEach((fn) => { try { fn(ev || { type: t }); out.push('ok'); } catch (e) { out.push(e); } }); return out; },
    count(t) { return (m.get(t) || []).length; },
  };
}

// ── Request/Response (lite) ───────────────────────────────────────
class HeadersLite {
  constructor(init) { this.__raw = {}; if (init) { if (init instanceof HeadersLite) Object.assign(this.__raw, init.__raw); else for (const [k, v] of typeof init.entries === 'function' ? init.entries() : Object.entries(init)) this.__raw[k] = String(v); } }
  get(n) { const ln = String(n).toLowerCase(); for (const k of Object.keys(this.__raw)) if (k.toLowerCase() === ln) return this.__raw[k]; return null; }
  set(n, v) { this.__raw[String(n)] = String(v); }
  has(n) { return this.get(n) !== null; }
  delete(n) { const ln = String(n).toLowerCase(); for (const k of Object.keys(this.__raw)) if (k.toLowerCase() === ln) delete this.__raw[k]; }
  entries() { return Object.entries(this.__raw)[Symbol.iterator](); }
}

class RequestLite {
  constructor(input, init = {}) {
    this.url = typeof input === 'string' ? input : (input && (input.url || input.href)) || String(input);
    const src = (input && typeof input === 'object' && !(init && 'method' in init)) ? input : {};
    this.method = String((init && init.method) || src.method || 'GET').toUpperCase();
    this.headers = (init && init.headers) || src.headers || {};
    this.body = init && 'body' in init ? init.body : (src.body !== undefined ? src.body : null);
    for (const k of ['mode', 'credentials', 'cache', 'redirect', 'referrer', 'integrity', 'duplex']) {
      this[k] = (init && init[k]) !== undefined ? init[k] : (src[k] !== undefined ? src[k] : k === 'referrer' ? '' : k === 'mode' ? 'cors' : k === 'credentials' ? 'same-origin' : undefined);
    }
    this.__ictNoClone = !!(init && init.__ictNoClone);
  }
  clone() {
    if (this.__ictNoClone) throw new TypeError('Request.clone: body has already been used');
    return new RequestLite(this.url, { method: this.method, headers: this.headers, body: this.body, mode: this.mode, credentials: this.credentials, cache: this.cache, redirect: this.redirect, referrer: this.referrer, integrity: this.integrity });
  }
  text() { return Promise.resolve(typeof this.body === 'string' ? this.body : this.body == null ? '' : String(this.body)); }
}

class ResponseLite {
  // desc: { status, body (object|string), headers, url, noClone }
  constructor(desc = {}, url = '') {
    this.status = desc.status === undefined ? 200 : desc.status;
    this.url = desc.url || url || '';
    const b = desc.body;
    this.__text = typeof b === 'string' ? b : b === undefined || b === null ? '' : JSON.stringify(b);
    const headers = Object.assign({}, desc.headers || {});
    if (typeof b !== 'string' && !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['content-type'] = 'application/json';
    this.headers = new HeadersLite(headers);
    if (desc.noClone) this.__ictNoClone = true;
  }
  get ok() { return this.status >= 200 && this.status < 300; }
  text() { return Promise.resolve(this.__text); }
  json() { return Promise.resolve(JSON.parse(this.__text)); }
  clone() {
    if (this.__ictNoClone) throw new TypeError('Response.clone: body has already been used');
    return new ResponseLite({ status: this.status, body: this.__text, headers: this.headers.__raw, url: this.url });
  }
}

// Standard-init Response: `new Response(body, { status, headers })` as browsers
// construct it. The v3 hook builds its synthetic pause-suppression 200 this way
// inside the sandbox (W.Response === sandbox.Response). ResponseLite keeps its
// desc-object constructor for the stub responder.
class ResponseStd {
  constructor(body = null, init = {}) {
    this.status = init && init.status !== undefined ? init.status : 200;
    this.url = (init && init.url) || '';
    this.__text = typeof body === 'string' ? body : body === undefined || body === null ? '' : String(body);
    this.headers = new HeadersLite((init && init.headers) || {});
    this.__ictNoClone = !!(init && init.__ictNoClone);
  }
  get ok() { return this.status >= 200 && this.status < 300; }
  text() { return Promise.resolve(this.__text); }
  json() { return Promise.resolve(JSON.parse(this.__text)); }
  clone() {
    if (this.__ictNoClone) throw new TypeError('Response.clone: body has already been used');
    return new ResponseStd(this.__text, { status: this.status, headers: this.headers.__raw, url: this.url });
  }
}

// ── XMLHttpRequest (lite) ─────────────────────────────────────────
function makeXhrClass(st) {
  class XMLHttpRequestLite {
    constructor() {
      this.__listeners = Object.create(null);
      this.readyState = 0; this.status = 0; this.statusText = '';
      this.responseText = ''; this.responseURL = ''; this.response = '';
    }
    open(method, url) { this.method = method; this.url = url; this.readyState = 1; }
    send(body) {
      this.__ictSentBody = body;
      st.xhr.push({ method: this.method, url: this.url, body, bodyText: typeof body === 'string' ? body : body && body.toString ? String(body) : undefined, xhr: this });
    }
    addEventListener(t, fn) { (this.__listeners[t] = this.__listeners[t] || []).push(fn); }
    removeEventListener(t, fn) { const l = this.__listeners[t]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
    setRequestHeader() {}
    getAllResponseHeaders() { return ''; }
    getResponseHeader() { return null; }
    abort() {}
    // test hook: dispatch recorded listeners
    __ictFire(type) {
      (this.__listeners[type] || []).slice().forEach((fn) => {
        try { fn.call(this, { type }); } catch (e) { st.xhrErrors.push(e); }
      });
    }
  }
  for (const [k, v] of Object.entries({ UNSENT: 0, OPENED: 1, HEADERS_RECEIVED: 2, LOADING: 3, DONE: 4 })) XMLHttpRequestLite[k] = v;
  return XMLHttpRequestLite;
}

// ── sandbox factory ───────────────────────────────────────────────
export function makeSandbox(opts = {}) {
  const href = opts.href || 'https://www.ictfromabc.com/dashboard';
  const u = new URL(href);
  const { clock, FakeDate } = makeClock(opts.now !== undefined ? opts.now : Date.now());

  const st = {
    reloads: [], replaced: [], assigned: [],
    historyCalls: [], historyBack: false,
    calls: [], nextResponses: (opts.responses || []).slice(),
    xhr: [], xhrErrors: [],
    menu: [], notifications: [], clipboard: null, gmEvents: [], gmXhr: [],
    timerErrors: [], timerRuns: [],
    alerts: [], confirms: [], prompts: [],
  };

  const loc = {
    origin: u.origin, host: u.host, hostname: u.hostname, port: u.port,
    protocol: u.protocol, pathname: u.pathname, search: u.search, hash: u.hash,
  };
  Object.defineProperty(loc, 'href', {
    get() { return loc.origin + loc.pathname + loc.search + loc.hash; },
    set(v) {
      const x = new URL(String(v), loc.href);
      Object.assign(loc, { origin: x.origin, host: x.host, hostname: x.hostname, port: x.port, protocol: x.protocol, pathname: x.pathname, search: x.search, hash: x.hash });
    },
    enumerable: true, configurable: true,
  });
  loc.toString = () => loc.href;
  loc.reload = () => { st.reloads.push(loc.href); };
  loc.replace = (v) => { st.replaced.push(String(v)); loc.href = v; };
  loc.assign = (v) => { st.assigned.push(String(v)); loc.href = v; };

  const history = {
    state: opts.historyState ?? null,
    length: 1,
    pushState(...a) { st.historyCalls.push({ op: 'pushState', args: a }); },
    replaceState(...a) { st.historyCalls.push({ op: 'replaceState', args: a }); },
    back() { st.historyBack = true; },
    forward() {}, go() {},
  };

  const winEvents = listenerHost();
  const docEvents = listenerHost();
  const consoleSpy = makeConsole();

  const gmMap = new Map(Object.entries(opts.gm || {}));

  // ── the one and only fetch: a recorder + canned responder ────────
  function resolveUrlString(input) {
    const raw = typeof input === 'string' ? input : (input && (input.url || input.href)) || String(input);
    let abs = raw;
    try { abs = new URL(raw, loc.href).href; } catch {}
    return { raw, abs };
  }

  function normalizeCall(input, init) {
    const { raw, abs } = resolveUrlString(input);
    let method = 'GET', body, headers;
    if (init) {
      method = String(init.method || (input && input.method) || 'GET').toUpperCase();
      body = init.body !== undefined ? init.body : (input && typeof input === 'object' && input.body !== undefined ? input.body : undefined);
      headers = init.headers;
    } else if (input && typeof input === 'object') {
      method = String(input.method || 'GET').toUpperCase();
      body = input.body;
      headers = input.headers;
    }
    return {
      rawUrl: raw, url: abs, method,
      body, bodyText: typeof body === 'string' ? body : body && body.toString ? String(body) : undefined,
      headers, init, inputRef: input,
      ts: clock.now(),
    };
  }

  async function stubFetch(input, init) {
    const record = normalizeCall(input, init);
    st.calls.push(record);
    let desc;
    if (st.nextResponses.length) desc = st.nextResponses.shift();
    else if (typeof opts.respond === 'function') desc = opts.respond(record);
    else if (sandbox.__stubResponder) desc = sandbox.__stubResponder(record);
    else desc = opts.defaultResponse || { status: 200, body: {} };
    return new ResponseLite(desc, record.abs);
  }

  // ── timers ───────────────────────────────────────────────────────
  const timers = { mode: opts.timers || 'immediate', pending: new Map(), nextId: 1 };
  function setTimeoutFake(fn, ms, ...rest) {
    const id = timers.nextId++;
    if (timers.mode === 'immediate') {
      st.timerRuns.push({ id, ms: ms ?? 0 });
      try { if (typeof fn === 'function') fn(...rest); else if (typeof fn === 'string') (0, eval)(fn); } catch (e) { st.timerErrors.push(e); }
    } else timers.pending.set(id, { fn, ms, args: rest, interval: false });
    return id;
  }
  function clearTimeoutFake(id) { timers.pending.delete(id); }
  function setIntervalFake(fn, ms, ...rest) {
    const id = timers.nextId++;
    timers.pending.set(id, { fn, ms, args: rest, interval: true });
    return id;
  }
  timers.runPending = () => {
    for (const [id, t] of [...timers.pending]) {
      try { t.fn(...t.args); } catch (e) { st.timerErrors.push(e); }
      if (!t.interval) timers.pending.delete(id);
    }
  };

  const sandbox = {
    window: null, // self-assigned below
    self: null,
    location: loc,
    history,
    navigator: {
      userAgent: opts.userAgent || 'Mozilla/5.0 (ICT-BYPASS-Node-Test) Chrome/130',
      clipboard: { readText: async () => opts.clipboardText || '' },
      language: 'en-US', platform: 'Win32',
    },
    document: {
      addEventListener: (t, fn) => docEvents.add(t, fn),
      removeEventListener: (t, fn) => docEvents.remove(t, fn),
      hidden: opts.hidden ?? false,
      readyState: opts.readyState || 'loading',
      title: '',
      body: { appendChild() {}, setAttribute() {} },
      documentElement: { setAttribute() {} },
      createElement(tag) { return { tagName: String(tag).toUpperCase(), style: {}, children: [], setAttribute() {}, appendChild() {}, addEventListener() {}, textContent: '' }; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    console: consoleSpy,
    Date: FakeDate,
    setTimeout: setTimeoutFake,
    setInterval: setIntervalFake,
    clearTimeout: clearTimeoutFake,
    clearInterval: clearTimeoutFake,
    queueMicrotask: (fn) => Promise.resolve().then(fn),
    fetch: stubFetch,
    Request: RequestLite,
    Response: ResponseStd,
    Headers: HeadersLite,
    XMLHttpRequest: makeXhrClass(st),
    URL: URL,
    URLSearchParams: URLSearchParams,
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    alert: (m) => { st.alerts.push(m); },
    confirm: (m) => { st.confirms.push(m); return opts.confirmResult ?? false; },
    prompt: (m, d) => { st.prompts.push(m); return opts.promptResult ?? null; },
    localStorage: new MemStorage(opts.localStorage),
    sessionStorage: new MemStorage(opts.sessionStorage),
    addEventListener: (t, fn) => winEvents.add(t, fn),
    removeEventListener: (t, fn) => winEvents.remove(t, fn),
    dispatchEvent: (ev) => winEvents.fire(ev.type, ev),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    requestAnimationFrame: (fn) => setTimeoutFake(fn, 16),
    // GM* API — in-memory Map + recorders, silent-fallback compatible
    GM_getValue(k, d) { return gmMap.has(k) ? gmMap.get(k) : d; },
    GM_setValue(k, v) { gmMap.set(k, v); st.gmEvents.push({ op: 'set', key: k, value: v }); },
    GM_deleteValue(k) { gmMap.delete(k); st.gmEvents.push({ op: 'delete', key: k }); },
    GM_listValues() { return [...gmMap.keys()]; },
    GM_setClipboard(text) { st.clipboard = text; },
    GM_registerMenuCommand(label, fn) { st.menu.push({ label, fn }); },
    GM_notification(detail) { st.notifications.push(detail); },
    GM_xmlhttpRequest(details) { st.gmXhr.push(details); return { abort() {} }; },
    GM_openInTab() { return {}; },
    __ictLogs: consoleSpy.__logs,
    __ictConsole: consoleSpy,
    __clock: clock,
    __st: st,
    // convenience recorders (test-facing)
    __calls: st.calls,
    __nextResponses: st.nextResponses,
    __stubResponder: null,
    __reloads: st.reloads,
    __xhr: st.xhr,
    __menu: st.menu,
    __notifications: st.notifications,
    __clipboard: () => st.clipboard,
    __gm: gmMap,
    __gmEvents: st.gmEvents,
    __historyCalls: st.historyCalls,
    __fireWindowEvent: (t) => winEvents.fire(t),
    __fireDocumentEvent: (t) => docEvents.fire(t),
    __windowEvents: winEvents,
    __documentEvents: docEvents,
    __timers: timers,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox; // harmless; vm overrides with its own global proxy
  return sandbox;
}

// ── context management (idempotent per sandbox object) ────────────
const ctxBySandbox = new WeakMap();
function contextFor(sandbox) {
  let ctx = ctxBySandbox.get(sandbox);
  if (!ctx) { ctx = vm.createContext(sandbox); ctxBySandbox.set(sandbox, ctx); }
  return ctx;
}

export function loadBypass(sandbox, source = readSource()) {
  const ctx = contextFor(sandbox);
  vm.runInContext(source, ctx, { filename: 'ictfromabc-bypass.user.js' });
  return sandbox;
}

export function runInSandbox(sandbox, code, filename = 'inline.js') {
  return vm.runInContext(code, contextFor(sandbox), { filename });
}

// ── test helpers ──────────────────────────────────────────────────
export async function flush(n = 4) {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
}

export function logText(sandbox) {
  return sandbox.__ictConsole.__logs.map((l) => l.text).join('\n');
}

export function findLog(sandbox, re) {
  return sandbox.__ictConsole.__logs.find((l) => re.test(l.text));
}

export function logsLike(sandbox, re) {
  return sandbox.__ictConsole.__logs.filter((l) => re.test(l.text));
}

export function callsOf(sandbox, { method, urlRe } = {}) {
  return sandbox.__calls.filter((c) =>
    (!method || c.method === method) && (!urlRe || urlRe.test(c.url)));
}

export function initFailedEntry(sandbox) {
  return sandbox.__ictConsole.__logs.find((l) => l.level === 'error' && /init failed/.test(l.text));
}

export function b64(s) {
  return Buffer.from(String(s), 'binary').toString('base64');
}
