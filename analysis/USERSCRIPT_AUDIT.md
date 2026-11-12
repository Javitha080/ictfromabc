# Static Audit — `userpannel/userscript.js`

**Target:** `D:\Pentesting\ictfromabc\userpannel\userscript.js`  
**Declared identity:** *Ultra Anti-Debug Bypass Pro v17.1* (Tampermonkey userscript)  
**Size:** 5,439 lines / ~280 KB  
**Audit type:** Read-only static analysis. The userscript was **not modified**.  
**Date:** 2026-11-12  
**Related site context:** `BLUEPRINT_ictfromabc_2026-09-11.md`, `DEVICELOCK_ictfromabc_2026-09-11.md`, `DEVICELOCK_BYPASS_PLAN.md`, `TODO.md`

---

## 1. Scope and method

The entire file was read from line 1 through 5,439. Findings were cross-checked with `grep`, Node line extraction, and PowerShell counts. Every claim below cites the file's own line numbers. “Confirmed” means the code path and its effect are visible in the source; “runtime-dependent” means the effect depends on browser/site behavior that was not executed during this audit.

The audit answers four questions:

1. **What does the script actually do**, as opposed to what its comments and UI claim?
2. **What is broken, dead, duplicated, or self-defeating?**
3. **What does it expose or transmit**, especially credentials, cookies, tokens, and media URLs?
4. **What is missing for `ictfromabc.com`**, and what should be kept, fixed, or removed?

### 1.1 Limits

- No browser execution, live site login, or network capture was performed. Timing, fullscreen, and FingerprintJS effects are inferred from standards-compliant browser behavior.
- `@require` dependencies were not downloaded or hashed. Their versions are assessed from the metadata at lines 22–23.
- The userscript is generic (`@match *://*/*`); “site compatibility” therefore means *effects on any site*, with `ictfromabc.com` called out where the surrounding repository provides architecture facts.
- Line numbers are for this exact revision. Any edit shifts them.

---

## 2. Executive summary

**Verdict:** This is not an `ictfromabc` tool. It is a generic, highly invasive page instrumentation kit with a media-sniffer UI bolted on. It contains no reference to `ictfromabc`, its API, its Bearer token, its FingerprintJS visitor ID, or its video endpoint. At the same time, it modifies signals that FingerprintJS and the site's device-lock flow depend on, suppresses the very errors needed to diagnose failures, and exposes captured credentials through a global object and a “copy as cURL” feature.

The script is best treated as **untrusted third-party code** and as a **prototype to cannibalize**, not as a component to ship.

### 2.1 Highest-severity findings

| # | Severity | Finding | Lines |
|---|---|---|---|
| 1 | **Critical** | Global `window.onerror` / `unhandledrejection` suppression hides site and script failures, including SvelteKit bundle/JSON/iframe errors. | 29–98 |
| 2 | **Critical** | `Element.prototype.requestFullscreen` is replaced with a no-op returning `Promise.resolve()`, while the script's own double-click handler calls it. Fullscreen is broken for the injected player and potentially for the host page. | 911–940, 4256–4261 |
| 3 | **Critical** | `UADBP` exposes `headerManager`, `cookieManager`, `drmInterceptor`, `STATE`, and `CONFIG` to any page script; captured `Cookie` and arbitrary request headers can be exported as cURL. | 2171–2204, 5405–5422, 5243–5258 |
| 4 | **High** | `FrameMessenger` accepts any `UADBP_*` message from any origin and broadcasts with `'*'`; `updateMediaList`, `updateLogs`, `showError`, and `showQualityModal` interpolate attacker-influenced strings into `innerHTML`. | 3141–3157, 3484–3502, 4270–4278, 5148–5163, 5181, 5236–5238 |
| 5 | **High** | DRM interception records license request headers/bodies and response bodies in public arrays; `isLicenseRequest` also matches `/gettoken/i` and `/acquire/i`, so ordinary auth/token calls can be captured. | 1041–1042, 1171–1206, 1510–1518 |
| 6 | **High** | Timer wrapper drops legitimate callbacks whose source contains `debugger` **or** (`constructor` and `apply`), returning timer ID `0`; this can silently break site timers and the script's own polling. | 751–764 |
| 7 | **High** | Timing “bypass” compares the patched clock to itself, so it never detects a pause; if `offset` ever exceeds 1000 ms, it grows by roughly 100 ms every 500 ms. | 855–880 |
| 8 | **High** | Config is loaded at line 5377, after `ConnectionPool` (2709) and `HLSDownloader` (3123) have already captured defaults; saved download/proxy settings do not affect those instances. | 2709, 3123, 5334–5373, 5377 |
| 9 | **Medium** | The cookie UI is unreachable: no “Cookies” tab exists, yet a full cookie panel and its handlers are built. | 4567–4572, 4606–4615, 4825–4844 |
| 10 | **Medium** | HLS download is unsafe for real streams: extensionless segments after the first are skipped, `EXT-X-MAP` init segments are ignored, AES-128 keys are captured but never used, and output is always labeled `video/mp2t`. | 2791–2827, 2890–2892, 2939, 3084 |

### 2.2 What works

- Error suppression, native-function masking, timer wrapping, keyboard/context-menu interception, and `debugger` stripping are implemented and will run on every page.
- Generic media URL discovery from `performance` entries, DOM attributes, `fetch`/XHR responses, and iframes is implemented.
- HLS master-playlist parsing, variant selection, concurrent segment download, and blob saving exist and can work for simple `.ts`/`.m4s` playlists.
- A custom video player, screenshot, PiP, speed, volume, and recording controls are present.
- Cookie capture from `document.cookie`, header capture from observed requests, and DRM EME instrumentation are present in some form.

### 2.3 What does not work as advertised

- “Cookie Edition” cannot read `HttpOnly` cookies; `addFromHeader` has no caller and the code admits `Set-Cookie` is unreadable (1935–1941).
- “DRM” does not decrypt Widevine/FairPlay/PlayReady; it only logs EME access and extracts ClearKey (1424–1449).
- “Proxy failover” is dead because `useProxy` defaults to `false` and is never set to `true` (2499); `CONFIG.proxy.currentIndex` is ignored in favor of `ProxyManager.proxyIndex` (207 vs. 2463/2470).
- “Integrity check” always returns `false` because `Utils.fetchBinary` does not exist (5410 vs. 5420).
- 22 of 40 feature flags and 8 of 9 player settings are never read.
- Notifications are gated on the undefined `CONFIG.features.showNotifications` (1015), so DRM notifications never fire.
- The site-specific capabilities the repository needs — FingerprintJS pin, Bearer export/import, API-aware `getVideoLink`, iframe resolver, per-site settings — are absent.

---

## 3. Architecture map

The file is one IIFE (`(function () { 'use strict';` at 26) with class declarations, singletons, and a bootstrap. There is no module boundary, no export, and no test surface. All state is process-global within the page.

| Lines | Unit | Purpose | Runtime status |
|---:|---|---|---|
| 1–24 | Metadata | `@name`, `@match *://*/*`, `@run-at document-start`, `@grant`, `@connect *`, `@require` hls.js 1.6.13 and unpinned dashjs `latest` | Active |
| 26 | IIFE start | `'use strict'` wrapper | Active |
| 29–98 | Error suppression | Replaces `window.onerror`, listens for `unhandledrejection`, filters messages | Active, harmful |
| 100–107 | `deepMerge` | Recursive config merge helper | **Never called** |
| 109–222 | `CONFIG` | Version, UI, features, player, download, proxy, storage, hotkeys | Active, largely inert |
| 233–267 | `STATE` | Mutable runtime state, stats, queues, maps | Partially used |
| 278–435 | `Utils` | DOM, URL, format, blob, notification, clipboard, ID helpers | Active; duplicate `generateId` |
| 446–532 | `EventEmitter` | `on`/`off`/`emit`/`once` | Active |
| 535–543 | `Events` singleton | Shared bus | Active |
| 546–670 | `Logger` | Ring buffer, levels, stats, console mirror | Active; double-count bug |
| 672–681 | `logger` singleton | Shared logger | Active |
| 683–1025 | `AntiDebugBypass` | DevTools/debugger/timer/timing/source/fullscreen/keyboard/VM bypasses | Active, broad side effects |
| 1036–1681 | `DRMInterceptor` | EME hooks, license fetch capture, ClearKey extraction, KID heuristics | Active, limited value |
| 1683–1692 | `drmInterceptor` | Singleton | Active |
| 1694–2145 | `CookieManager` | `document.cookie` parse, header parse, export, monitor | Partially reachable |
| 2147–2156 | `cookieManager` | Singleton | Active |
| 2158–2261 | `HeaderManager` | Default/captured headers, cURL/ffmpeg generation | Active, credential risk |
| 2263–2272 | `headerManager` | Singleton | Active |
| 2274–2448 | `MediaAnalyzer` | URL classification, quality/type inference | Active |
| 2450–2459 | `mediaAnalyzer` | Singleton | Active |
| 2461–2628 | `ProxyManager` | CORS proxy rotation, retry, cache, GM/fetch transport | Active; proxy path dead |
| 2630–2639 | `proxyManager` | Singleton | Active |
| 2641–2696 | `ConnectionPool` | Concurrency-limited downloader | Active, constructed too early |
| 2707–3121 | `HLSDownloader` | Manifest parse, quality selection, segment download, recording | Active, partial |
| 3123–3132 | `hlsDownloader` | Singleton | Active |
| 3134–3169 | `FrameMessenger` | Cross-frame `postMessage` bus | Active, untrusted |
| 3171 | `messenger` | Singleton | Active |
| 3182–3672 | `MediaCapture` | Fetch/XHR/performance/DOM/iframe sniffing, storage | Active |
| 3674–3683 | `mediaCapture` | Singleton | Active |
| 3685–3880 | `StreamRecorder` | `captureStream` + `MediaRecorder` | Active |
| 3882–3891 | `streamRecorder` | Singleton | Active |
| 3893–4302 | `VideoPlayer` | Custom overlay player, controls, screenshot | Active |
| 4304–4313 | `videoPlayer` | Singleton | Active |
| 4315–5320 | `UIPanel` | Shadow DOM panel, tabs, lists, settings, modals | Active; cookie tab missing |
| 5322–5331 | `uiPanel` | Singleton | Active |
| 5334–5373 | `loadConfig` | Reads GM/localStorage, shallow-merges | Called too late for some singletons |
| 5375–5430 | `initialize` | Starts anti-debug, capture, cookies, DRM, UI; exposes `UADBP` | Active |
| 5432–5439 | Bootstrap | DOMContentLoaded or immediate | Active |

### 3.1 Initialization order problem

Top-level singleton construction happens before `initialize()`:

- `connectionPool` is created at **2709** with `CONFIG.download.maxConcurrent`.
- `hlsDownloader` is created at **3123**.
- `mediaCapture`, `streamRecorder`, `videoPlayer`, `uiPanel` follow.
- `loadConfig()` is only called at **5377**, inside `initialize()`.

Therefore any saved `maxConcurrent`, proxy index, feature flag, or player setting is applied to `CONFIG` **after** the objects that copied those values were constructed. `ConnectionPool` stores `this.maxConcurrent` at construction; `loadConfig` never updates it. The “load config before init” comment at 5377 is true only relative to `initialize`, not relative to singleton construction.

---

## 4. Feature inventory

### 4.1 Subsystem-by-subsystem status

| Subsystem | Claim | Reality | Evidence |
|---|---|---|---|
| Anti-debug | “Ultra” bypass suite | Partially works; broad prototype patches with self-inflicted breakage | 683–1025 |
| Error suppression | Hide anti-debug traps | Works, but hides legitimate site failures | 29–98 |
| Fullscreen bypass | “Prevent forced fullscreen” | Replaces the API with a resolved no-op; breaks the tool's own fullscreen | 911–940 |
| Timing bypass | Defeat pause detection | Mathematically inert; possible runaway offset | 855–880 |
| Source protection | Hide native code | `Function.prototype.toString` override only; does not affect `instanceof` or stack traces | 882–909 |
| DRM detection | Detect Widevine/FairPlay/PlayReady | Detects EME; does not decrypt | 1036–1681 |
| ClearKey | Extract keys | Works only when the site uses ClearKey and the script sees `update()` | 1424–1449 |
| Cookie capture | “Cookie Edition” | Readable cookies only; HttpOnly impossible; UI unreachable | 1694–2145, 1935–1941 |
| Header capture | Capture request headers | Captures defaults and optional extras; not wired to fetch/XHR by default | 2158–2261, 2175–2184 |
| Media sniffing | HLS/DASH/blob/WebSocket | Fetch/XHR/performance/DOM/iframe paths exist; WebSocket capture is not implemented | 3182–3672 |
| Proxy failover | Rotate CORS proxies | Code exists but `useProxy` is never true | 2461–2628, 2499 |
| HLS download | Parallel segment merge | Works for simple playlists; fails on init maps, extensionless URLs, AES-128 | 2707–3121 |
| Recording | Live HLS recording | Polls manifest but reuses 60 s cached text; duplicates segments | 3040–3072, 2520–2523 |
| Player | Advanced player | Controls work; double-click fullscreen broken; subtitle/audio/filter flags unused | 3893–4302 |
| UI | Tabs and settings | Works; cookie panel orphaned; XSS sinks | 4315–5320 |
| Integrity | Self-check | Always false | 5407–5420 |
| Site integration | Implied by repo use | None | Whole file |

### 4.2 Feature flags: 22 of 40 are never read

The flags are declared at 137–189. A reference count of `CONFIG.features.<name>` shows these are **never consulted anywhere**:

`headerCapture`, `hlsDownload`, `dashDownload`, `proxyDownload`, `downloadQueue`, `pauseResume`, `parallelDownload`, `autoMerge`, `advancedPlayer`, `pictureInPicture`, `playbackSpeed`, `videoFilters`, `subtitleSupport`, `audioBoost`, `subtitleCapture`, `audioTrackSelect`, `thumbnailPreview`, `networkMonitor`, `bandwidthTest`, `autoRetry`, `smartQuality`, `cookieExport`.

The 18 that are read are all read exactly once (except `crossFrameCapture`, twice): `debuggerBypass`, `devToolsProtection`, `consoleProtection`, `sourceProtection`, `timingProtection`, `fullscreenBypass`, `antiVM`, `networkIntercept`, `blobCapture`, `crossFrameCapture`, `autoScan`, `deepScan`, `autoClear`, `webSocketCapture`, `gestureControls`, `cookieCapture`, `cookieMonitor`, `cookieIntercept`.

Implication: the settings UI can present toggles that have no effect. This is worse than a missing feature because it gives false assurance that capture/download behavior has been disabled.

### 4.3 Player settings: 7 of 8 are never read

Declared at 212–221. Only `speeds` is read. Never read:

`defaultVolume`, `defaultSpeed`, `rememberPosition`, `autoplay`, `maxVolume`, `seekStep`, `volumeStep`.

The player instead hard-codes `volume = 1` and `playbackRate = 1` in its initialization paths, so saved/default values cannot apply.

### 4.4 Other config fields that are inert

| Field | Line | Status |
|---|---:|---|
| `CONFIG.storage.prefix` (`uadbp_v16_`) | 124 | Never used; storage keys are hard-coded strings |
| `CONFIG.storage.maxAge` | 125 | Never used; cache expiry is a literal 60 s at 2522 |
| `CONFIG.download.chunkSize` | 194 | Never used; downloads are whole segments |
| `CONFIG.download.minSpeed` | 196 | Never used |
| `CONFIG.download.bufferSize` | 197 | Never used |
| `CONFIG.proxy.currentIndex` | 207 | Written/read as config, but rotation uses `proxyManager.proxyIndex` (2463, 2470) |
| `CONFIG.proxy.autoRotate` | 208 | Never read |
| `CONFIG.proxy.healthCheck` | 209 | Never read; `STATE.proxyHealth` is never updated |
| `CONFIG.proxy.failoverDelay` | 210 | Never read |
| `CONFIG.player.*` (7 fields) | 213–220 | Never read |
| `CONFIG.hotkeys.toggleMinimize` | 120 | Never read (hard-coded `m` at 4910) |
| `CONFIG.hotkeys.focusSearch` | 121 | Never read (hard-coded `f` at 4911) |

### 4.5 Duplicate definitions (later definition wins)

| Symbol | First definition | Second definition | Effect |
|---|---:|---:|---|
| `Utils.generateId` | 279 | 363 | Later alias to `Utils.uuid()` wins. The first implementation is dead. Both are non-cryptographic (`Math.random`). |
| `ProxyManager.fetchText` | 2479 | 2613 | Second wins. First returns `res.text`, which is `undefined` for arraybuffer responses; it is dead only because the class is redefined later. |
| `ProxyManager.fetchArrayBuffer` | 2484 | 2623 | Second wins and delegates to `fetchBinary`. |
| `ProxyManager.fetchBinary` | 2489 | 2618 | Second wins; returns `response.data`. |
| `UIPanel.createTrustedHTML` | 4343 | 4528 | Second wins. Identical logic, two policy-creation paths. The first is dead. |

These are not harmless style issues: the first `fetchText`/`fetchBinary` pair has different return semantics. Any future edit that deletes the second block without understanding the override will silently change behavior.

### 4.6 Dead, unreachable, or orphaned code

| Item | Lines | Why it is dead |
|---|---:|---|
| `deepMerge` | 100–107 | No call sites. |
| `addFromHeader` | 1858–1876 | No call sites. It is the only path that could populate `httpOnlyCookies`. |
| `getHttpOnly` | ~2110 | Always empty because nothing calls `addFromHeader`; `document.cookie` cannot expose HttpOnly. |
| Cookie tab | 4606–4615 | A `data-panel="cookies"` exists, but the tab bar at 4567–4572 has no `data-tab="cookies"`. |
| Cookie handlers | 4825–4844 | Bound to controls inside the hidden panel; reachable only if the panel is made visible manually. |
| `CONFIG.features.showNotifications` (DRM path) | 1015 | Undefined; the real flag is `CONFIG.ui.showNotifications` (134). DRM notifications never run. |
| Proxy path | 2499, 2529–2545 | `useProxy` defaults to false and no caller sets it. All five proxy servers are unused. |
| `CONFIG.proxy.currentIndex` | 207, 4759, 5368 | Saved and loaded, but never used by `getProxyUrl` (2470). |
| `STATE.downloadQueue` | 238 | Never read or written after declaration. |
| `STATE.activeDownloads` | 239 | Never used; downloads are tracked in `HLSDownloader.downloads`. |
| `STATE.playerState` | 248–255 | Never used; `VideoPlayer` keeps its own fields. |
| `STATE.proxyHealth` | 256 | Never written. |
| `STATE.webSockets` | 257 | Never written; no WebSocket hook exists. |
| `STATE.sessionId` | 258 | Never used. |
| `Utils.nativeRequestFullscreen` fallback branch | 4002–4005 | `nativeRequestFullscreen` is always set by `bypassFullscreen` before the UI is built; the else branch is effectively unreachable. |
| `checkIntegrity` `Utils.fetchBinary` row | 5410 | `Utils.fetchBinary` is undefined, so the row is `'N/A'` and the `every` predicate at 5420 can never be true. |
| `origPerfNow` | 859 | Captured but never used. `performance.now` is never patched. |

### 4.7 Version and identity inconsistencies

| Location | Value |
|---|---|
| Metadata `@name` (line 2) | “v17.1” |
| Metadata `@version` (line 4) | `17.1` |
| `CONFIG.version` (line 110) | `17.1` |
| DRM init comment (line 5391) | “v18.0” |
| Console banner (line 5424) | “v16.0 Enhanced Edition” |
| Storage prefix (line 124) | `uadbp_v16_` |
| Panel title (around 4555) | “UADBP” with no version |

This is not cosmetic. Support reports cannot tell which build is loaded, and the version shown in the panel may disagree with the actual code.

<!-- APPEND -->
