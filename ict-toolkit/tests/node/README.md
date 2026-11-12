# Offline Node test suite for `userpannel/ictfromabc-bypass.user.js`

In-memory `node:vm` sandbox tests for the **v3.0.2** userscript. **Everything is
offline**: the only `fetch` inside the sandbox is a recorder stub that answers
from a canned queue; no real socket is ever opened (and no test constructs a URL
that anything tries to fetch).

## Run

```powershell
# from the suite directory (default discovery)
cd D:\Pentesting\ictfromabc\ict-toolkit\tests\node
node --test

# or point at the suite with a glob (recommended on this box — a bare
# directory argument is treated as a module by this Node build)
node --test "D:\Pentesting\ictfromabc\ict-toolkit\tests\node\*.test.mjs"
```

or a single file:

```powershell
node --test D:\Pentesting\ictfromabc\ict-toolkit\tests\node\reauth.test.mjs
```

Set `ICT_BYPASS_TEST_DEBUG=1` to also echo the userscript's console output
while tests run, and `ICT_BYPASS_SRC=<path>` to test a different copy of the
source. The userscript itself is **never modified** — it is read, placed in a
fresh `vm` context per test, and instrumented from the outside.

## Files

| file | what it locks down |
|---|---|
| `helpers/sandbox.mjs` | the fake browser world + loader (`makeSandbox`, `loadBypass`) |
| `rewrite.test.mjs` | pinned-fingerprint body rewrite (JSON, nested, no-pin, non-login, urlencoded-in-place, GET) |
| `request-object.test.mjs` | REGRESSION: Request-input path never double-sends; fail-closed on unreadable bodies (sync AND async) |
| `pause.test.mjs` | synthetic-200 pause suppression (302, empty-body 302, `redirect_url→/blocked`), 422 diagnostics, first-wins auto-pin |
| `reauth.test.mjs` | auto-relogin: creds gate, pinned login POST, 45 s cooldown, 5-fail cap, `/blocked` skip |
| `apimap.test.mjs` | `__ICT_API` surface (13 methods) + 86-entry API map + `parseSpec` + 10-path quick battery |
| `guard.test.mjs` | exact-path `/blocked` pushState/replaceState suppression + popstate bounce-back |
| `idempotence.test.mjs` | double-load in one sandbox is a clean no-op |
| `xhr.test.mjs` | XHR twin: body rewrite, 401 relogin, pause neutralized, token backup |

## What the sandbox stubs

- **fetch** — recorder + `__nextResponses` queue (or `__stubResponder`), returns
  `ResponseLite` (`status`, `headers.get`, `text()`, `json()`, `clone()`,
  `ok`, `url`). The stub constructs its responses directly — it does not go
  through `sandbox.Response`.
- **Response** — `sandbox.Response` is `ResponseStd`, a standard-init class
  (`new Response(body, { status, headers })` like browsers): the v3 hook builds
  its synthetic pause-suppression 200 through it, so tests can `await
  resp.json()` on the suppressed answer.
- **Request / Headers** — minimal lite classes. `Request` records
  `url/method/headers/body` and supports `clone().text()`; set
  `req.__ictNoClone = true` (or shadow `.clone`) to simulate disturbed bodies.
- **XMLHttpRequest** — `open/send/addEventListener` recorders; the hook adds a
  `load` listener, tests dispatch it with `xhr.__ictFire('load')` after setting
  `status/responseText/responseURL`.
- **localStorage / sessionStorage** — `Map` backends; preset via
  `makeSandbox({ localStorage: { ict_pin: '…', ict_conf: '0.91' } })`.
- **GM_\*** — in-memory `Map` + recorders exposed as `__gm`, `__gmEvents`,
  `__notifications`, `__menu`, `__clipboard()`.
- **console** — spy at `__ictConsole` (helpers `logText`, `findLog`).
- **location** — plain object with derived `href`, recorder `reload()` (`__reloads`).
- **history** — recorder `pushState/replaceState/back` (`__historyCalls`, `__st.historyBack`).
- **Date** — real epoch by default, controllable via `sandbox.__clock.advance(ms)`
  (needed for the 45 s cooldown / fail-cap timing).
- **timers** — immediate-run `setTimeout` by default (recorded in `__st.timerRuns`);
  `setInterval` **registers without firing** — the v3 watchdog schedules at boot
  but never ticks in tests.
- **document, navigator.clipboard, alert/prompt/confirm, atob/btoa, URL,
  URLSearchParams** — minimal offline stand-ins.

## v2 bugs → v3 fixes (each locked down by its test)

The v2 suite run surfaced six real bugs. All six are fixed in v3 and every fix
has a regression test:

1. **urlencoded logins leaked the raw fingerprint** — v2's `rewriteBody()`
   rejected any non-JSON string, so the `URLSearchParams` branch was dead code.
   v3 rewrites `visitorId`/`confidenceScore` in place, keeps the urlencoded
   encoding, and does not override Content-Type (`rewrite.test.mjs` 1e).
2. **async clone-failure fallback re-sent the ORIGINAL unpinned Request** —
   v3 is fail-closed: the rejection propagates and **zero** backend calls
   happen (`request-object.test.mjs` 2b).
3. **a sync `clone()` throw crashed the caller's fetch** — v3 catches inside
   the hook, logs `request suppressed (fail-closed)`, and rejects with a
   fingerprint-protection TypeError (`request-object.test.mjs` 2c).
4. **the navigation guard over-blocked** — `/\/blocked\b/` also matched
   `/onboarding/blocked-notice`. v3 uses exact-path matching
   (`isBlockedPath`/`isBlockedRedirect`) (`guard.test.mjs` 6d).
5. **a 200 with both `token` and `redirect_url:'/blocked'` returned at the
   token branch** — v3 checks the bounce FIRST, in both the inspector and the
   shared response observer (`pause.test.mjs` 3b).
6. **auto-pin captured the most recent observed attempt** — v3 is first-wins
   with a `consumed` flag: the first unconsumed attempt is the one captured
   (`pause.test.mjs` 3d).

New v3 behavior covered by the suite:

- Pause answers reach the fetch caller as a **synthetic 200
  `{suppressed:true}`** — the real 302/redirect never escapes the hook — and
  `__ICT_API.pin().pauseBlocks` counts them (`pause.test.mjs` 3a/3a-2/3b).
- **Request-input logins go through the same response observer** as init-style
  calls (v2 bypassed inspection entirely): pause suppression, 401 relogin and
  token backup now apply to Request-path calls too.
- **Watchdog** defaults ON at 5 min in standalone mode (register-only in the
  sandbox), `__ICT_API.watchdog()` + menu toggle, off/delegated in headless
  mode (`__ICT_DELTA`).
- Console surface: `.lesson()` / `.allowed()` / `.pdfs()` / `.pastPapers()` /
  `.watchdog()` / `.debug()` / `.log()`, 12 menu commands, 86-entry endpoint
  map (folded in from `analysis/RECON_FULL.md`), 10-path quick battery.
- XHR listener still logs pause interception through its own catch
  (`xhr.test.mjs` 8c).

No network is used at any point; do not add tests that reach out.
