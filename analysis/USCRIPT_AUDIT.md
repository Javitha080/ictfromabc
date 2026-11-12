# USCRIPT_AUDIT.md — Audit of `userpannel\userscript.js`
**Target:** ictfromabc.com pentest workspace · **File:** `D:\Pentesting\ictfromabc\userpannel\userscript.js`
**Identity:** "Ultra Anti-Debug Bypass Pro v17.1 – Enhanced M3U8 Edition" (self-reports v16.0/v18.0 in places)
**Size:** 5,439 lines / 280 KB · Single IIFE · `@run-at document-start` · STATIC ANALYSIS ONLY

---

## 0. P0 fixes APPLIED (2026-11-12, shipped as v17.2)

| # | Fix | Implementation |
|---|---|---|
| P0-1 | Fingerprint stability on target | Added `SITE GUARD` constants (`_IS_TARGET`/`_IS_FP_BEACON`/`_FP_SAFE`) after `'use strict'`. On `metrics.ictfromabc.com` the script now **returns immediately** (zero hooks on the FP beacon origin). On `ictfromabc.com`: `bypassTimingChecks` (Date.now rewind), `bypassVM` (navigator plugins/languages/hardwareConcurrency/webdriver spoofs), `outerWidth/outerHeight` spoof, `Function#toString` forgery, forced-fullscreen noop, and contextmenu/F5/Esc/copy blockers are all **disabled** (`_FP_SAFE` gates). Generic `@match *://*/*` retained so downloads keep working on other sites — scoping traded for functionality (site-guard achieves the lock-prevention goal instead). |
| P0-2 | Error suppression pruned | `_SUPPRESS_PATTERNS` reduced to 9 extension-oriented patterns; removed `player`, `iframe`, `mediadelivery`, `JSON.parse`, `SyntaxError`, `Unexpected token`, `clarity`, `Already loaded`, `object Object`, `is not valid JSON`, `bundles/`, `.min.js`, `postMessage`. The `console.error` wrapper (args.join loss + real-error hiding) **deleted**. |
| P0-3 | Timer guard narrowed | `wrapTimer` now only neutralizes literal `debugger` tokens; the `constructor && apply` heuristic (which silently `return 0`'d real minified bundle callbacks and broke `clearInterval` bookkeeping) was removed. |
| P0-4 | XSS fixed | `FrameMessenger.init` now validates `e.origin` (static allowlist for ictfromabc/mediadelivery/youtube + dynamic origin check against actually-embedded `<iframe>`s) and shape-checks `UADBP_MEDIA_CAPTURED` payloads (string ≤8 KB, media-scheme URL). Added `Utils.escapeAttr` (quote-safe; `textContent→innerHTML` doesn't encode quotes). Escaping applied at all interpolated sinks: `updateMediaList` (data-url attr + url text + tags), `showQualityModal` (data-url attr), `showCommands` (url header), `updateLogs` (log messages). |
| P0-5 | UX blockers gated | contextmenu/keyboard(F5/Esc)/clipboard/`selectstart` blocking and forced-fullscreen noop skipped on the target host (still active elsewhere, honoring existing CONFIG flags). |

Not changed (accepted, P2): Trusted Types pass-through policy (sinks now escape at source), late `DOMContentLoaded` init, `@connect *`, duplicate definitions, dead proxy subsystem — see §4 for rationale.

---

## 1. Feature inventory (subsystems + line ranges)

| # | Subsystem | Lines | Notes |
|---|---|---|---|
| 1 | Metadata / grants | 1–24 | `@match *://*/*` (7), `@grant unsafeWindow` (8), `@connect *` (21), `@require hls.js 1.6.13` (22), `@require dashjs **latest**` (23) |
| 2 | Global error suppression | 29–98 | `_SUPPRESS_PATTERNS` 33–57; `window.onerror` 60–75; `unhandledrejection` 78–86; `console.error` wrapper 89–98 |
| 3 | CONFIG (feature flags, download, proxy, player) | 109–222 | 47 feature toggles 137–189; proxy server list 199–211 |
| 4 | STATE store | 233–267 | mediaUrls, cookies, proxyHealth, webSockets |
| 5 | Utils | 278–435 | `generateId` defined **twice** (279, 363) |
| 6 | EventEmitter bus | 446–535 | priority listeners, wildcard, `emitAsync` |
| 7 | Logger + GM notifications | 546–672 | history/filters/export |
| 8 | **AntiDebugBypass suite** | 683–1025 | `enable()` 696–712 |
| 8a | debugger bypass (eval / `Function` Proxy / timers) | 714–771 | |
| 8b | DevTools detection (console, outerWidth/Height, Firebug, React hook, `Function.prototype.toString`) | 773–828 | |
| 8c | console protection (`console.clear` noop) | 830–853 | |
| 8d | timing protection (`Date.now` rewind) | 855–880 | |
| 8e | source/key blocking (Ctrl+U/F12) | 882–909 | |
| 8f | fullscreen forced-noop | 911–940 | |
| 8g | contextmenu / keyboard / clipboard blocking | 942–963 | |
| 8h | VM/anti-automation spoof (plugins, languages, webdriver) | 966–989 | |
| 8i | Worker proxy (no-op) | 992–1002 | |
| 8j | EME notification hook | 1009–1024 | dead branch (`CONFIG.features.showNotifications` doesn't exist) |
| 9 | **DRM/EME interceptor** | 1036–1683 | EME wrap 1062–1151; setMediaKeys 1153–1165; license fetch/XHR 1171–1234; manifest 1240–1266; PSSH/KID parse 1272–1418; ClearKey key extraction 1424–1449; keyStatuses 1455–1477; export/mp4decrypt cmd 1601–1656 |
| 10 | **Cookie manager** | 1694–2147 | parse 1728–1818; snapshot/diff 1821–1876; poll 1879–1900; `document.cookie` setter hook 1903–1933; XHR/fetch cookie refresh 1936–1967; set/delete/clear 1999–2042; Netscape/JSON/EditThisCookie export + import 2045–2121; curl 2115–2121 |
| 11 | **Header manager + CLI generators** | 2158–2263 | defaults w/ Referer/Origin/UA/Cookie 2164–2173; curl 2194–2204; ffmpeg 2206–2213; yt-dlp 2215–2239; N_m3u8DL-RE 2241–2249; aria2 2251–2260 |
| 12 | **Media analyzer/classifier** | 2274–2450 | ext/MIME patterns 2276–2295; CDN table incl. Bunny 2297–2318; DRM hints 2320–2327; `detect()` 2330–2366; quality/resolution 2385–2415 |
| 13 | **Proxy manager (failover)** | 2461–2630 | `getProxyUrl` 2469; rotation 2474; retry+backoff 2493–2561; `GM_xmlhttpRequest` transport 2563–2611; **duplicate method defs** 2479–2491 vs 2613–2623 |
| 14 | Connection pool (parallelism) | 2641–2696 | max 8 |
| 15 | **HLS downloader + live recorder** | 2707–3123 | `parseM3U8` 2714–2843 (master/variant/audio/subs/AES key/segments); download lifecycle 2845–2992; segment fetch 2898–2918; **byte-concat merge** 2928–2948; live polling recorder 3010–3090; `GM_download`/fallback save 3092–3117 |
| 16 | Frame messenger (cross-iframe) | 3134–3171 | `postMessage('*')`, no origin check |
| 17 | **Media capture** | 3182–3674 | fetch/XHR intercept 3219–3272; blob `createObjectURL` 3274–3292; **WebSocket** 3294–3310; **hls.js `loadSource` hook** 3313–3338; SPA nav auto-clear 3340–3370; auto/DOM/deep scan 3372–3434; iframe relay 3440–3502; `HTMLMediaElement.src` 3564–3582; **PerformanceObserver** 3585–3604; MediaSource hook 3607–3618; content-type/body HLS sniff 3621–3671 |
| 18 | Stream recorder (screen/element → webm) | 3685–3882 | quality presets, pause/resume |
| 19 | **Advanced player** | 3893–4304 | modal 3905–3978; PiP/screenshot/filters/gestures 3980–4098; HLS.js playback + quality/audio/subs 4141–4204; DASH playback 4206–4243 |
| 20 | **UI panel** | 4315–5322 | CSS 4360–4526; panel markup 4544–4720 (Cookies panel 4606–4620); settings save 4731–4777; events 4779–4858; drag 4860–4896; hotkeys 4898–4916; fullscreen re-parent 4924–4937; menus 4969–4975; renders 5019–5187; download/play/commands/export 5191–5266; clipboard 5269–5317; **duplicate `createTrustedHTML`** 4343 & 4528 |
| 21 | Config load + bootstrap + `window.UADBP` | 5334–5439 | `initialize()` 5375–5430; started at DOMContentLoaded 5433–5437 |

**Count: 21 top-level subsystems (≈45 discrete modules).**

---

## 2. How it captures video

**Discovery (7 channels):**
1. `fetch`/`XHR` URL sniff — `MediaCapture.interceptNetwork` 3219–3272 and `interceptNetworkEnhanced` 3621–3671 (content-type `*mpegurl*` 3641–3649; body starts with `#EXTM3U` 3652–3661).
2. hls.js hook — `Hls.prototype.loadSource` wrapper 3313–3338 (polls every 1 s until `window.Hls` appears).
3. `HTMLMediaElement.src` setter 3564–3582; `<video>/<source>`/data-attr/script-content DOM scan 3390–3434 (3 s interval 3212 + 3 s auto-scan 3375 + MutationObserver 3381).
4. `URL.createObjectURL` blob sniff 3274–3292 (video/audio/mpegurl blobs cached in `mediaCapture.blobCache`, 3459–3466).
5. `PerformanceObserver` resource timing 3585–3604.
6. `MediaSource.addSourceBuffer` MIME log 3607–3618.
7. `WebSocket` construct proxy 3294–3310 (+ cross-iframe relay `UADBP_MEDIA_CAPTURED` 3476–3502, 3134–3171).

**Classification:** `MediaAnalyzer.detect` 2330–2366 — ext regex (`.m3u8/.mpd/.mp4/.ts/.vtt`), MIME map, then CDN table (2297–2318: includes `b-cdn.net` 2307, `mediadelivery.net` 2313) then URL hints `/video/|/stream/|/media/` (2361). Priority score HLS 100 > DASH 95 > VIDEO 80 > CDN_STREAM 75 (2379).

**M3U8 handling:** `HLSDownloader.parseM3U8` 2714–2843 — fetch text via ProxyManager (2717), parses `#EXT-X-STREAM-INF` variants (2739–2757), `#EXT-X-MEDIA` audio/subtitles (2760–2789), `#EXT-X-KEY` (2792–2802, stores `keyUrl` but **never decrypts**), `#EXTINF` durations (2805–2808), segment lines (2811–2828). Master → best variant pick 2879–2884.

**Proxy list:** `CONFIG.proxy.servers` 200–206 — `corsproxy.io`, `api.allorigins.win/raw`, `cors-anywhere.herokuapp.com`, `thingproxy.freeboard.io`, `api.codetabs.com`. Rotation on failure 2553–2555, health map `STATE.proxyHealth` 256 (never written).

**Transport:** `_singleFetch` 2563–2611 uses `GM_xmlhttpRequest` (bypasses page CORS) with only `Referer`+`Origin` headers (2566–2570); retry/backoff ×5 2530–2561; text manifests cached 60 s 2519–2523.

**Segment merge:** segments pulled in parallel through `ConnectionPool` (8 workers) 2920–2924 → raw `Uint8Array` concatenation 2928–2936 → `Blob('video/mp2t')` → `GM_download` / `<a download>` 2938–2948, 3092–3117. Live variant: poll playlist every 3 s and append new segments 3043–3090.

**Not implemented:** DASH downloading (flag `dashDownload` 159 is playback-only, 4206–4243), AES-128 decryption, `#EXT-X-MAP`/fMP4 init segments, subtitle muxing.

---

## 3. Access-control / anti-debug behaviour on the target

What it actively defeats (all generic, none ictfromabc-specific):
- `debugger` statements: strips from `eval`/`Function` bodies (716–745) and cancels timer callbacks containing `debugger` (747–767).
- DevTools detection: `outerWidth/outerHeight` spoofed (789–794), `console.log` made non-writable (780–783), Firebug/React-devtools hooks nullified (797–814), `Function.prototype.toString` forged to hide the patches (817–824).
- Timing-based debugger detection: `Date.now()` rewound by accumulated offset (855–880).
- Keyboard/context-menu/clipboard source protection: capture-phase `stopImmediatePropagation` on Ctrl+U/F12/Ctrl+Shift+I/J/C (884–905), contextmenu (943–945), F12/F5/Esc/Ctrl+S/U/P (948–955), copy/cut/paste/selectstart (957–963).
- Forced fullscreen (911–940).
- Bot/VM heuristics: `navigator.plugins/languages/hardwareConcurrency/webdriver` hard-spoofed (966–989).
- DRM: EME chain wrapped so Widevine/PlayReady/FairPlay license requests, PSSH, KIDs, and ClearKey keys are logged/exported (1009–1681).
- Error surfaces: `_SUPPRESS_PATTERNS` 33–57 hides player/iframe/`JSON.parse`/`bundles/`/`.min.js`/`mediadelivery`/`clarity` errors on every site.

**What it does NOT do for ictfromabc.com:** no FingerprintJS interaction, no `/api/login` interception, no 302/422/401 handling, no `/blocked` awareness, no Bearer-token use, no Bunny embed handling (see §5).

---

## 4. Bugs and risks

### Runtime-breaking
1. **`@match *://*/*` + `@connect *` (7, 21)** — installs every override (eval/Function/timers/Date.now/fullscreen/clipboard/plugins) on *every site visited*, in *every iframe*, including `metrics.ictfromabc.com` (the FingerprintJS beacon). Highest blast radius in the file.
2. **Error suppression swallows real errors (33–98)** — `/player/`, `/iframe/`, `/mediadelivery/`, `/JSON.parse/`, `/SyntaxError/`, `/object Object/`, `/bundles\//`, `/\.min\.js/`, `/extension/` are dropped from `window.onerror`, `unhandledrejection` **and** `console.error`. Bunny player crashes and SvelteKit chunk errors become invisible; `console.error` wrapper also stringifies via `args.join(' ')` (89–91), losing stack/objects.
3. **`Date.now` rewind (855–880)** — global clock skew corrupts cache-busting, `iat/exp` validation, telemetry, and FingerprintJS confidence/timing signals; grows unbounded while a tab is backgrounded.
4. **Timer guard false positives (751–764)** — any callback whose source contains both `constructor` **and** `apply` (common in minified bundles) is silently replaced by `return 0`, i.e. hydration/polling code never runs; returned id `0` also breaks `clearInterval` bookkeeping.
5. **`Function.prototype.toString` forgery (817–824)** — returns *eval's* source for `setInterval/setTimeout/eval/Function`, so integrity/anti-tamper checks (exactly what FingerprintJS Pro and SvelteKit do) can either throw or flag the browser as modified.
6. **PostMessage XSS (3141–3151 + 5149–5155 + 4347/4532)** — no `e.origin` check, media URL inserted into `innerHTML` unescaped, and the Trusted Types policy is a pass-through (`createHTML: s => s`). Any cross-origin frame can `postMessage({type:'UADBP_MEDIA_CAPTURED', payload:{url:'"><img src=x onerror=…>'}})` and get script execution in the top page.
7. **Late init defeats `@run-at document-start`** — `initialize()` waits for `DOMContentLoaded` (5433–5437), so *all* anti-debug/capture hooks are installed after the page's own scripts (and the Fingerprint loader) already ran; early resource captures are missed.
8. **Global property clobbering** — `document.onmousemove/onmouseup` assigned (4884–4895) overwrite page handlers; `console.log` redefined non-configurable (780–783) makes logging libraries throw; `console.clear` no-op (849); fullscreen forced to noop breaks legit players (935–939); copy/cut/select blocked site-wide (957–963); F5 blocked (949).

### Dead / duplicated / wrong code
9. **Duplicated definitions:** `Utils.generateId` 279 vs 363 (363 wins → UUID format); `ProxyManager.fetchText/fetchBinary/fetchArrayBuffer` 2479–2491 vs 2613–2623 (2613 wins); `UIPanel.createTrustedHTML` 4343 vs 4528; `window.fetch` wrapped **four** times (1176, 1260, 1961, 3224, 3625) → `STATE.networkStats.requests` double-counted (3226 + 3627).
10. **Proxy subsystem is dead:** `useProxy` defaults to `false` (2499) and no caller sets it → `getProxyUrl` never used, yet `rotateProxy()` still fires on every failure (2553–2555) for *non-proxied* requests; UI "Active Proxy" select (4704–4707, 4751–4752) writes `CONFIG.proxy.currentIndex`, but `ProxyManager` reads its own `this.proxyIndex` (2463) → setting has no effect; `STATE.proxyHealth` (256) never populated; `CONFIG.proxy.healthCheck`/`failoverDelay` unread.
11. **Dead proxies:** `cors-anywhere.herokuapp.com` (203) requires allowlisting → always fails; `thingproxy.freeboard.io` (204) is gone/502; `corsproxy.io` (201) now needs a token; allorigins rate-limits and rewrites bodies. Encoded with `proxy + encodeURIComponent(url)` (2471), which corrupts proxies that want a raw query param.
12. **Cookies tab unreachable:** tabs bar 4567–4573 has no `data-tab="cookies"`, but the panel exists (4606–4620) and `updateCookieList` (5051) references `uadbp-cookie-count-tab` which is never rendered.
13. **GM API issues:** `GM_setValue('panelPos', {…})` stores a raw object (4893) while everything else stores JSON strings (4756–4760) — inconsistent round-trip; `GM_notification` fires on *every* success/error log (599–606) → OS notification spam; `GM_download` blob URL revoked in `onload` only (3099) leaks on error; `typeof GM_* !== 'undefined'` guards are always true under `@grant`, misleading the fallbacks (403, 425, 5275); `unsafeWindow` granted (8) but never used — hooks rely on Chrome main-world injection and would silently not apply on Firefox.
14. **Config written to `localStorage` (4766–4770)** plus `window.UADBP` (5405) and `document.body[data-uadbp-status]` (5398) → deterministic detection oracles for the target site, and they alter the fingerprint surface.
15. **Smaller:** silent `catch (e) {}` on downloads (5216); `updateProgress` no null-guard (5185–5186); HLS hook interval never clears if hls.js absent (3334–3337); `CONFIG.features.showNotifications` doesn't exist (1015) so DRM notify branch is dead; `Utils.notify(msg, 'Protected Content')` passes a title as `type` (1018); `@require dashjs latest` (23) unpinned supply chain; `HeaderManager` freezes Cookie/UA at construction (2171); `_singleFetch` drops `Cookie`/`Authorization` (2566–2570); unescaped `${url}` in commands modal (5251); unconditional `console.log('Raw Saved Config')` (5356).

---

## 5. Integration gaps for ictfromabc.com

*(cross-referenced: `DEVICELOCK_ictfromabc_2026-09-11.md`, `BLUEPRINT_…`, `REPORT_…`, `DEEPDIVE_…`, `PUZZLES_…`)*

1. **No FingerprintJS visitorId pinning — the core problem.** Login sends `POST /api/login {phoneNumber, password, visitorId, confidenceScore}` from FingerprintJS Pro (`chunks/Boci2IdA.js`, endpoint `metrics.ictfromabc.com`, key `rDaS5…`). The script never touches that loader, never pins a visitorId, and — worse — actively perturbs the fingerprint (`navigator.plugins` 969, `languages` 975, `hardwareConcurrency` 978, `webdriver` 981, `Date.now` skew 864, `Function.prototype.toString` 818), so the *same* machine can present a *new* visitorId → trips the device lock. Needs: persist one `visitorId` in `GM_setValue`, hook the FP result promise / `POST /api/login` body and force it.
2. **No `POST /api/login` interception or inspection.** All network hooks filter through `isMedia()` (3228, 3259, 3630) and `MediaAnalyzer.detect` explicitly rejects `.json` (2337) — API bodies are never seen. Missing: log/rewrite `visitorId` + `confidenceScore`, capture the 422 field-error branch (valid creds + tampered FP → `Phone number is required (and 3 more errors)`), and the `X-RateLimit: 30` header.
3. **No 302 → `/blocked` pause-bounce handling.** The API wrapper (`chunks/L4WPQHn8.js`) treats 302 `redirect_url` as a pause flag (`D4Q2u0Xm.js`) → navigate to `/blocked`, which wipes `token` + `user` on leave (but not `role`). The script has zero route/flag awareness: it cannot stall the bounce, preserve the Bearer token, or surface "Account on Pause".
4. **Auth model mismatch: the whole v17 "COOKIE CAPTURE" subsystem (1694–2147) is useless here.** `DEEPDIVE` confirms *no* `Set-Cookie` — auth is a Laravel-Sanctum-style Bearer PAT `id|secret` in `localStorage`. The script should read/attach `Authorization: Bearer …` and `token`/`role` instead of exporting Netscape cookie files. `_singleFetch` doesn't forward Authorization anyway (2566–2570).
5. **Doesn't use the site's own APIs.** Videos are discovered by scraping DOM/network patterns, but lessons/Bunny IDs come from signed API responses (`GET /api/courses`, authenticated lesson endpoints, `GET /api/user`, `/api/notifications`, `/api/public/tutes`). A "pull my lessons → extract `{libraryId}/{videoId}`" path would be far more reliable than waiting for a player to load.
6. **No Bunny/`iframe.mediadelivery.net` handling.** Lesson player injects `assets.mediadelivery.net/playerjs/player-0.1.0.min.js` and an `iframe.mediadelivery.net/embed/{libraryId}/{videoId}`. Gaps: the embed URL only matches the generic `mediadelivery.net` CDN entry (2313) → classified `CDN_STREAM`, and "Download" then runs `parseM3U8` against an HTML page (fails); no hook of the iframe's generated `vz-…/b-cdn.net/*.m3u8` playlist; no Referer pinned to `https://www.ictfromabc.com`; `_SUPPRESS_PATTERNS` hides `/mediadelivery/` errors (50) so failures are invisible; YouTube iframe player not handled at all.
7. **No site-scoped matching.** `@match *://*/*` (7) means no ictfromabc-specific config, and it also runs on `metrics.ictfromabc.com` where its global hooks could corrupt the FP beacon it should be observing.

---

## 6. Concrete upgrade list (prioritized)

### P0 — correctness/safety
1. Replace `@match *://*/*` (L7) with `https://ictfromabc.com/*`, `https://www.ictfromabc.com/*`, `https://metrics.ictfromabc.com/*` (observer-only), `https://iframe.mediadelivery.net/*`; replace `@connect *` (L21) with those hosts + CDN (`*.b-cdn.net`, `assets.mediadelivery.net`).
2. Prune `_SUPPRESS_PATTERNS` (L33–57): drop `player`, `iframe`, `mediadelivery`, `JSON.parse`, `SyntaxError`, `Unexpected token`, `object Object`, `bundles/`, `.min.js`; delete the `console.error` wrapper (L89–98).
3. Delete `bypassTimingChecks` (L855–880) and narrow `wrapTimer` (L747–767) to only strip literal `debugger` tokens; remove the `Function.prototype.toString` forgery (L817–824).
4. Fix the XSS: validate `e.origin`/`e.source` in `FrameMessenger.init` (L3141–3151), `Utils.escapeHtml` the URL in `updateMediaList` (L5149–5155) and `showCommands` (L5251), and make the Trusted Types policy non-pass-through (L4347, L4532).
5. Gate clipboard/contextmenu/keyboard/fullscreen overrides (L911–963) behind an off-by-default toggle; never block F5/Esc/copy.

### P1 — makes it work on ictfromabc.com
6. **Visitor pinning:** add `SiteHooks.fingerprintPin()` — persist `visitorId` via `GM_setValue('ict_visitorId')`, hook the FP loader result (or `fetch`/`XHR` for `/api/login`, reuse L3219/L3621) and overwrite `visitorId`/`confidenceScore` in the JSON body; also disable the perturbing spoofs (L966–989) on this origin so the real device fingerprint stays stable.
7. **Login/API interceptor:** extend `interceptNetworkEnhanced` (L3621–3671) to record non-media JSON: status, `302 {redirect_url}`, `422 {errors{field:[…]}}`, `401/403`, plus `Authorization` headers; stall the pause-flag navigation to `/blocked` and preserve `token`/`user` (log that `role` survives).
8. **Bearer-aware requests:** `HeaderManager.buildDefaultHeaders` (L2164–2173) should read `localStorage.token` → `Authorization: Bearer …`, and `_singleFetch` (L2563–2571) must forward `Authorization` + `Cookie` + a fixed `Referer: https://www.ictfromabc.com`.
9. **Bunny support:** detect `iframe.mediadelivery.net/embed/{lib}/{vid}` (pattern table L2313) → resolve to the underlying tokened `.m3u8` inside the frame (hls.js hook L3313 already runs in iframes — rely on it), and mark `b-cdn.net` playlists as downloadable; add a YouTube-embed note (not downloadable).
10. **Site API mode:** new "Lessons" tab that calls `GET /api/courses` and the authenticated lesson endpoints with the stored token, then emits `{libraryId, videoId}` pairs into `mediaCapture.add()` instead of DOM scraping (L3390–3434).

### P2 — reliability/cleanup
11. Remove dead proxy code (L2499 `useProxy`, L2553 rotation, L4704–4707 selector) or wire `CONFIG.proxy.currentIndex` (L4751) to `ProxyManager.proxyIndex` (L2463) and replace L200–206 with one working relay (GM_xhr makes proxies largely unnecessary).
12. De-duplicate: `Utils.generateId` L279 vs L363; `ProxyManager.fetch*` L2479 vs L2613; `createTrustedHTML` L4343 vs L4528; collapse the 5 `fetch` wrappers into one (L1176/1260/1961/3224/3625) so stats stop double-counting (L3226+L3627).
13. Add the missing Cookies tab button (L4567–4573) or delete the cookie panel (L4606–4620) — and consider replacing it with Bearer-token capture given §5.4.
14. Real DASH download + AES-128 HLS decryption + `#EXT-X-MAP` init segment (L2792–2802, L2928–2936); honor `dashDownload` (L159).
15. Move `initialize()` off `DOMContentLoaded` (L5433–5437) so hooks install at `document-start`; pin `@require` dashjs version (L23); remove detection oracles (`data-uadbp-status` L5398, `window.UADBP` L5405, `localStorage` config L4766) while testing against the target.
16. Use `addEventListener` for drag (L4884–4895), null-guard `updateProgress` (L5185), replace silent `catch {}` in `startDownload` (L5216), stop notification spam (L599–606), drop `console.log('Raw Saved Config')` (L5356).
