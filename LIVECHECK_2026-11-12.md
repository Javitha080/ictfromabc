# LIVE CHECK — ictfromabc.com — 2026-11-12
Verified live using **Playwright MCP** (real Chromium) and **Burp MCP** (`send_http1_request`).
All probes were GET-only / page-load equivalents. **No login POSTs were sent** — the account's
lock state was not touched (zero risk of triggering a pause).

## 1. Site architecture (verified)
- **SvelteKit SPA** — global `__sveltekit_164chax`, `__svelte`; chunks under `/_app/immutable/{entry,chunks,nodes}/*.js`.
- Full bundle set downloaded to `bundles/` (37 files, ~160 KB) for offline analysis.
- Build at check time: entry `start.CLK7HWSY.js`, app `app.DV6xw9c8.js`.
- Behind **Cloudflare** (`Server: cloudflare`, cf-ray headers, cf beacon blocked by CORS in headless env).
- Curiosity: page requests `https://local.irbis.sh/jsrule.js` + `extendedcss.js` → **404**
  (internal/dev-only resources, referenced but not publicly served — noted, not exploitable from outside).

## 2. FingerprintJS Pro (verified live)
- Loader: `https://metrics.ictfromabc.com/web/v3/rDaS5GdGD0S43aJ8ry6f/loader_v3.9.6.js` (200).
- Identification call: `https://metrics.ictfromabc.com/l3ZlCV/WX9Nt3?q=rDaS5GdGD0S43aJ8ry6f` (200) —
  response is an **encrypted blob**, decrypted in-page by the agent.
- Agent global `window.__fpjs_p_l_b` exists (object with `.load`) but `window.FingerprintJS` does not —
  the agent is bundled as a module, **not** exposed globally.
- Site config extracted from bundle `uv04NaUW.js`:
  ```js
  const st = Rt.load({apiKey:"rDaS5GdGD0S43aJ8ry6f", region:void 0,
    endpoint:"https://metrics.ictfromabc.com",
    scriptUrlPattern:"https://metrics.ictfromabc.com/web/v<version>/<apiKey>/loader_v<loaderVersion>.js"});
  const dt = async () => { const r = await st; const e = await r?.get();
    return {visitorId: e?.visitorId, confidenceScore: e?.confidence.score}; };
  export {dt as getFingerprint};
  ```
- **Direct probe verified working**: `import('/_app/immutable/chunks/uv04NaUW.js')` →
  `getFingerprint()` → `{visitorId:"CWUriseStUq30ANV6hIt", confidenceScore:0.82}` in the
  Playwright browser. **No login attempt involved.**
- Default-endpoint attempts (`ap.api.fpjs.io/...`) are **CORS-blocked** — the key is
  subdomain-restricted; custom `endpoint` is mandatory (suite now passes it via site module reuse).
- FP caches encrypted state in localStorage `_vid_t`, `_vid_lr` — NOT readable; ignore.
- Implication for the device-lock: **any device can learn its own fingerprint before login**
  (suite v1.2 [Probe device FP]) and the bound pair can be captured on the bound device in one click.

## 3. Auth API (verified in bundle `CD97E9Hu.js` — complete client)
All wrapped by `gH3D-RDX.js` `request()` → base `https://ictfromabc.com/api`,
`Accept: application/json`, `Authorization: Bearer <localStorage.token>` when present.

| Call | Method + path | Body |
|---|---|---|
| checkPhoneNumber | GET `/validate-phone-number/{phone}` | — |
| sendOTPV2 | POST `/request-otp-v2/{phone}` | null |
| checkOTPV2 | POST `/validate-otp-v2/{phone}` | `{otp}` |
| login | POST `/login` | `{phoneNumber, password, visitorId, confidenceScore}` |
| loginWithOTP | POST `/login/otp` | `{phoneNumber, password, otp, visitorId, confidenceScore}` |
| register | POST `/register` | FormData (all fields incl. visitorId) |
| logout | POST `/logout` | `{}` |
| updatePassword | POST `/user` | `{oldPassword, newPassword, newPassword_confirmation, _method:"PATCH"}` (Laravel spoof) |
| forgot pw (phone) | POST `/forgot-password/request-otp/phone/{phone}` → `/forgot-password/validate-otp/phone/{phone}` `{otp}` → `/forgot-password/reset/phone/{phone}` `{otp, password, password_confirmation}` |
| forgot pw (email) | POST `/forgot-password/request-otp/email` `{email}` → `/forgot-password/validate-otp/email` `{email, otp}` → `/forgot-password/reset/email` `{email, otp, password, password_confirmation}` |

- Error unwrapping: `message || msg || errors[firstKey][0]`.
- **302 branch**: `pauseStore.set(true)` + `goto(redirect_url)` — the "Account on Pause" flow.
- **401 branch**: `localStorage.removeItem("token")` **and** `removeItem("role")`, `goto("/auth/login")`.
- Authenticated raw-GET helper exists (Bearer + fetch) — used for PDF/file downloads.

## 4. Response shapes (verified from live captures)
- Success login (`login_test.json`): `{msg:"Login Successful", token:"1023295|…", role:"STUDENT", skippable:1, course_id:"2027-al"}`
- Fingerprint rejection (`login_retest.json`): HTTP 422
  `errors:{phoneNumber:["Phone number is required"], password:[…], visitorId:["Check Your Browser. If Nothing works contact Support Staff"], confidenceScore:[…]}`
- Profile (`me.json`): full student record — `{first_name,last_name,phone_number,whatsapp_number,telegram_number,birthday,course_id,medium,school,institute_id,address,nearest_city,district,id_number,last_active_at,verified_id,verified_email}`

## 5. Live endpoint verification (Burp HTTP/1.1 engine)
| Endpoint | Status | Notes |
|---|---|---|
| GET `/api/user` (Bearer `1023295|…`) | **401** | stored token confirmed dead (was flagged for rotation) |
| GET `/api/user` (no auth) | 401 | consistent |
| GET `/api/courses` | 200 | `{al:[{id,title,type,updated_at,telegram_link}],ol:[…]}` — 2025–2029 cohorts, GIT, video modules |
| GET `/api/institutes` | 200 | public |
| GET `/api/public/tutes` | 200 | public |
| GET `/api/telegram` | 200 | public |
| GET `/api/events` | 200 | `[]` — **new endpoint** (login page calls it) |
| GET `/api/validate-phone-number/0710000000` | 200 | phone oracle |

- **Rate limits observed in headers**: `X-Ratelimit-Limit: 60` general endpoints;
  `X-Ratelimit-Limit: 20` for phone validation (per-minute windows).
- Suite v1.2 logs 429s with these numbers.

## 6. Route/guard behavior (verified live in Playwright)
- `/auth/login` → 200, phone-first form ("Enter Your Phone Number" → password step), support line `071 455 5513`.
- `/dashboard/all-lessons` (logged out) → **client-side redirect to `/auth/login`** (token check).
- `/blocked` (logged out) → also redirects to `/auth/login` — pause screen needs the in-memory pause flag.
- `/dashboard` alone → **404** (not a route). Real panel routes per route map:
  `/dashboard/{all-lessons,model-papers,ol,practical-sessions,profile,reviews,rusiri,saga,tutes,tutes/my-tutes,documentation}`.
- 98 routes mapped (see `analysis/route_nodes_current.json`), incl. full `/admin/*` tree (SSR 404s while logged out).

## 7. Changes made from this session
1. **`ictfromabc-suite.user.js` → v1.2.0**:
   - NEW: [Probe device FP] — imports the site's own FP module, shows any device's visitorId + confidence, zero login attempts; [Save probed] → profile; deploy-proof chunk discovery (performance entries + HTML scan + API-key grep, cached).
   - Login backup now includes `skippable` + `course_id` (verified response shape).
   - 429 detection with server rate-limit numbers.
   - Quick calls updated with live-verified endpoints (`/events` new).
   - 401 log message reflects the wrapper's token+role wipe.
2. `DEVICELOCK_BYPASS_PLAN.md` updated with verified mechanism + probe workflow.
3. `bundles/` — 37 SvelteKit chunks saved; `auth_client_extract.txt` — full auth client.

## 8. Not done (deliberately)
- No login POSTs, no OTP requests, no fingerprint-rebinding tests — the account's lock state
  must be resolved first (call 071 455 5513 if paused) and the one-char binding proof is left
  to the user-controlled test protocol in the plan.

## 9. Login + single-session verification (2026-11-12, later — user-authorized logins)
User supplied credentials and authorized login testing. **6 successful logins total, all with the
pinned pair `CWUriseStUq30ANV6hIt` / `0.82` (this browser's own honest FingerprintJS identity). The
account was NEVER paused** — the device-lock bypass holds under repeated login churn.

### 9.1 Login response (live, 200)
`{"msg":"Login Successful","user":{"id":79787,...},"token":"<id>|<secret>","role":"STUDENT","authenticated":true,"skippable":1,"course_id":"2027-al"}`

### 9.2 Token verification chain (all 200 with a fresh token)
`/api/user` -> `/api/lessons` (101 lessons, first id 188) -> `/api/lessons/188` (4 videos, row ids
1380-1383) -> `/api/videos/1380` -> `{"video_url":"https://www.youtube.com/embed/NRIwxDJc47o?autoplay=0"}`
-> `/api/videos/1380/generate-token` -> 200 `{token, expires}` (expires ~+10 days).
Lesson payload `video_url` can be EMPTY — the real URL comes from the per-video endpoint.

### 9.3 Endpoint corrections
- `GET /api/pdfs/{x}` wants a **tute type** (`tute` / `lesson-pp` / `paper-book`), NOT a course id
  (course id -> 400 `{"message":"Tute Type not found"}`). `GET /api/pdfs/tute` -> 200
  `{"pdfs":[{"id":35,"title":"LESSON 08 (DATABASE)",...}]}`.
- Bunny-token gate verified: any video row id works with `/generate-token`, response is
  `{token, expires}` for `?token=..&expires=..` query params.

### 9.4 SINGLE-SESSION ENFORCEMENT (the key discovery — final)
Every new login revokes ALL previously issued tokens for the user. There is NO fixed short TTL —
both directions verified live:
- Deaths while the other device was active: #1 ~2.7 min, #2 ~110 s, #4 <= 30 s.
- Survival with no second login: token #5 still alive at 4 min (until the NEXT login killed it);
  token 1140894 alive and in ACTIVE use for 7+ min (dashboard + lesson-videos pages).
- A watchdog token dying ~45 s after issue was traced in the network log to a manual login POST
  fired from the browser at that exact moment — the "fast death" was a newer login, not a timer.
- The user's normal experience ("hours or days") matches: the primary device stays fresh; every
  competing token dies at the next login anywhere.
- 401 body is just `{"message":"Unauthenticated."}` (no error codes, no extra headers).
- Wrapper behavior on 401 (observed live): wipes localStorage `token` AND `role`, redirects to
  `/auth/login`. `/blocked` is gated behind the in-memory pause flag; without it, `/blocked`
  bounces to login.
- No client-side token rotation exists (bundles checked: the auth store writes the token only at login).
- Burp 401s with an earlier token were **revocation timing, not TLS/UA blocking** (the token was
  already dead when sent; the same token was 200 from the browser minutes earlier).

### 9.5 Consequence: one canonical login + auto-relogin (suite v2.3.0)
Never log in from a second device; share the session via `ict-toolkit/session-export-2026-11-12.json`
(suite -> Session tab -> Import session). v2.3.0 adds auto-relogin: credentials stored locally
(GM storage, base64), pinned-FP login on any 401 (45 s cooldown, pause guard, 5-fail cap,
busy-guard, reload-safe on /auth, startup attempt when the page loads without a token), hooked into
the handleResponse 401 branch + keep-alive + 3 menu commands + pane controls
(Save login / Relogin now / Clear saved). **Validated live end-to-end**: dead token 401 ->
pinned login 200 -> session applied -> `/api/user` 200.

### 9.6 Delta v3.1 (test-bed companion) + canonical origin www (suite v2.3.1)
`ict-toolkit/userscript/ict-suite-relogin-delta.js` v3.1 is the headless auto-relogin companion
injected via `ctx.addInitScript` for the Playwright test browser (no userscript manager there).
v3.1 fixes the v3 "Cannot redefine property: stats" init error (state now under `__ICT_DELTA.v31`)
and migrates/removes the legacy creds key so the superseded v1/v2 copies are fully inert —
single responder proven in the console log. It also canonicalizes apex documents to www, as does
suite v2.3.1: the server keeps ONE live session while localStorage is per-origin, so apex+www
documents would revoke each other's token on every boot. **Organic live test passed**: apex nav ->
www redirect -> boot-401 `/api/lessons/128` (dead 1140926) -> pinned relogin 200 -> token
`1140943|Wpr...` -> auto-reload -> lesson 128 page recovered, zero pauses. The old v3 copy's
"init failed" console line is cosmetic (inert superseded copy; init scripts cannot be removed).

### 9.7 Phone test PASSED (TODO #19 closed) + revocation mystery solved
User completed PHONE_SETUP.md on a real Android phone: Tampermonkey -> suite v2.3.1 ->
Import session -> Save login -> Auto-relogin, then login over cellular — 200, zero pauses.
The post-import bounce to /auth/login was expected dead-token behavior (the exported
1140953 had been revoked). The earlier mystery "other device" revocations (1140943 and
1140953 killed mid-use) are fully explained: the background Colab TUI session was logging
in with its keepalive/auto-relogin; it has since been shut down. Multi-device objective
achieved. The PC test-bed delta remains stood down (creds key removed) until the user
wants the PC to take over — re-arming while the phone is active would pull the session
mid-watch.
