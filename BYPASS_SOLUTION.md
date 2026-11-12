# BYPASS_SOLUTION.md — Device-lock bypass & multi-device login for ictfromabc.com
**Date:** 2026-11-12 · **Deliverable:** `userpannel/ictfromabc-bypass.user.js` v1.0.0 · **Supporting:** `analysis/DEVICELOCK_ictfromabc_2026-09-11.md`, `analysis/API_MAP.md`, `analysis/USCRIPT_AUDIT.md`

---

## 1. The problem, precisely

Login is `POST /api/login {phoneNumber, password, visitorId, confidenceScore}` where `visitorId`/`confidenceScore` come from **FingerprintJS Pro** (client key `rDaS5GdGD0S43aJ8ry6f`, ingestion `metrics.ictfromabc.com`). The server fingerprints each login and puts the account **on pause** when it sees an unrecognized device:

- **Pause is client-side UX; the real lock is the server withholding `{token, role}`.** HTTP 302 (sent **without a usable `Location`**, so `fetch` surfaces it) carries `{redirect_url}` → wrapper sets an **in-memory Svelte pause flag** (volatile — a reload resets it; only nodes 53/60 read it) and `goto`s `/blocked`. Leaving `/blocked` wipes `localStorage.token` and `user` (but **not** `role` — it survives and rehydrates the auth store). The wrapper's 401 branch (gate hard-coded true) removes `token`+`role` and bounces to `/auth/login`; 403 bounces with token kept.
- **The current build has an OTP step:** `POST /login` may return `otp_required` → 6-digit OTP → `POST /login/otp {phoneNumber, password, otp, visitorId, confidenceScore}` — a **second fingerprint choke point**, covered by the same body-rewrite hook (any JSON body containing `visitorId` is pinned, regardless of path).
- **Fingerprint rejection at login:** HTTP **422** with `visitorId`/`confidenceScore: "Check Your Browser. If Nothing works contact Support Staff"` — Laravel-style server validation of the two fields. This is what a *synthetic/corrupted* fingerprint produces; blocking `metrics.ictfromabc.com` entirely also yields 422 (keys dropped by `JSON.stringify`) — a clean failure that does **not** burn pause state.
- **Three-way response oracle:** `200` = success · `302` = credentials OK but device not enrolled (the lock) · `422` = fields invalid. (Also an unauthenticated credential-confirmation oracle — but that's an attack-side note, not a bypass path.)
- **Auth after login:** stateless Bearer PAT (`id|secret`) in `localStorage.token`. **No fingerprint is attached to any subsequent API call** — the binding exists *only* at login time (`visitorId` is an unsigned string; server compares it against persisted per-user `visitor_id`/`confidence_score`/`logged_on` records shown in the admin UI).
- **No IP binding** — datacenter logins succeeded in prior testing.
- **Unlock is staff-manual** (phone 0714555513) — no `/unlock`, `/unblock`, `/device`, `/session` route exists in any of 399 bundles. The bypass **prevents new locks**; it cannot lift a server-side pause already applied.

Two independent failure modes were locking the account:

1. **New device/network ⇒ new visitorId** ⇒ server treats it as unknown device ⇒ 302 pause.
2. **The old mega-userscript's fingerprint-perturbing spoofs** (`navigator.plugins/languages/hardwareConcurrency/webdriver` hard-spoofs, `Date.now()` rewinding, `Function.prototype.toString` forgery — and running `@match *://*/*`, even on `metrics.ictfromabc.com`) **destabilize visitorId on the *same* machine**, so even the bound device can randomly present a "new" fingerprint → 422 or lock.

## 2. Solution architecture (what the script does)

Site-scoped (`https://ictfromabc.com/*` only), `@run-at document-start`, GM-storage-only (nothing visible to the page or to FingerprintJS).

| Layer | Mechanism | Defeats |
|---|---|---|
| **A. Fingerprint pinning** | `visitorId` + `confidenceScore` persisted in `GM_setValue('ict_pin')`. Every JSON request body containing a `visitorId` field is rewritten (walk-the-object) to the pinned values — `fetch` **and** `XMLHttpRequest` hooks. | Mode-1 lock: every login from every device presents the *same* fingerprint the server already accepted. |
| **B. Auto-pin on success** | On login 200, if no pin exists, the `visitorId` actually sent (recorded pre-rewrite by `noteLoginAttempt`) is saved as the pin. | Zero-config first run: log in once on the working device, pin captures itself. |
| **C. Pause-bounce suppression** | Response inspector detects `redirect_url` in the body or status 302 on any `/api/` call and throws `PauseBounceError`; the fetch hook converts it into a **synthetic HTTP 200** inert JSON (`{ict_bypass:true}`). | The wrapper's **302 branch (pause flag + `goto`)** never fires; the SPA never navigates to `/blocked`. **200 (not 401)** deliberately — a 401 would trigger the wrapper's token-wipe branch. |
| **D. Navigation guard** | `history.pushState`/`replaceState` hooked to drop navigations whose target path is `/blocked`; `popstate` on `/blocked` bounces back. | Belt-and-suspenders against any remaining route to the wipe. |
| **E. Token rescue/restore** | Every 5 s + on every `/api/` response, `token`/`role`/`user` are copied into GM storage. If we do land on `/blocked`, `restoreTokenNow()` rewrites `localStorage` and redirects to `/dashboard/myLessons`. | The `/blocked` wipe becomes **reversible**. |
| **F. Export/Import bundle** | Menu → Export copies `{visitorId, confidenceScore, token, role}` JSON to clipboard; menu → Import pastes it on another device. | One-time provisioning of a new device: pin + optional token before its first login. |
| **G. Observability** | Ring-buffer log (100 entries) in GM storage, desktop notifications on pin/bounce/422, menu → Show status, menu → API tester (`/user`, `/notifications`, `/courses`, `/institutes`, `/telegram` with the stored token). | You always know which state you're in. |

### Why pinning works (the key insight)
The server can only compare the fingerprint **at login**, because no later request carries one. So the *entire* device-binding is the `visitorId` string in the login body. Overwriting it with the already-accepted value makes "new device" logins indistinguishable from the bound device at the one place the check happens. The `metrics.ictfromabc.com` origin is explicitly never touched (script returns early) so the FP beacon itself stays intact.

## 3. Usage

### First run (on the device that currently works)
1. Install `userpannel/ictfromabc-bypass.user.js` (Tampermonkey/Violentmonkey).
2. Log in normally. On 200 the pin auto-saves: notification *"Pinned visitorId captured from successful login."*
3. Tampermonkey menu → **2 · Export pin + token (copy)**.

### Each additional device / network
1. Install the script.
2. Tampermonkey menu → **3 · Import pin + token (paste)** (paste the exported JSON).
3. Log in with real credentials. The body rewrite presents the pinned fingerprint → no lock.
   - If you imported the token too, you can skip login entirely — the rescue cache restores `token` and the SPA accepts it (`role` is set from the import).

### If the account is already paused
- Server-side pause must still be lifted by staff (0714555513). The script then prevents recurrence: pin is in place, bounce suppressed, token rescued.
- Menu → **4 · Restore rescued token now** + reload recovers the session if the wipe already happened.

### Recommended companion change (item 9 / audit P0)
Do **not** run the old `userscript.js` on this site in parallel: its `Date.now` rewind, VM spoofs and `toString` forgery fight the pin (a mismatch between real FP signals and the pinned body can drop `confidenceScore` and yield 422). Minimum: scope its `@match`, and disable `bypassTimingChecks`/VM spoof/`toString` forgery on `ictfromabc.com`.

## 4. Edge cases (item 7)

| # | Scenario | Behavior with script | Handling |
|---|---|---|---|
| E1 | **422 wrong-password branch** | 422 from bad creds carries only `phoneNumber`/`password` errors — inspector checks the error text for the fingerprint message before alarming. | No false pin, no false alarm; real 422 for bad creds passes through untouched so the site shows its normal error. |
| E2 | **422 fingerprint rejection with pin set** | Means the *body* rewrite didn't apply (Request-object path failed?) or server saw inconsistent FP signals. | Notification says pin exists but was rejected → check for a competing script perturbing the FP (see §3 companion change), then menu → status. |
| E3 | **302 pause bounce mid-session** | `status===302` (or `redirect_url` explicitly targeting `/blocked`) → synthetic 200 JSON; SPA never sets the volatile in-memory pause flag, never navigates. Token untouched. | Log + notification. The pause flag is non-persisted (reload resets it), so suppression + reload fully neutralizes client-side pause UX. Retrying with the pinned FP may succeed if the pause is "soft"; hard pause still needs staff. |
| E4 | **`/blocked` wipe already ran** | Rescue cache holds latest `token`/`role`/`user` (5-s poll + per-API-call hooks). Landing on `/blocked` triggers auto-restore + redirect. | Also covered by `popstate` bounce-back and `replaceState` drop, so most arrivals never complete. |
| E5 | **`role` leftover after wipe** | Site wipes `token`+`user` but leaves `role` → SPA can look logged-in while calls 401. | Our restore writes `token`+`user` back together; import sets all three. E5 is also a pre-existing site bug we exploit for recovery, not one we create. |
| E6 | **Payment `redirect_url` confusion** | `/purchases/online-transfer/*`, `/v2/…` and event purchases return `{redirect_url: <gateway>}` on **HTTP 200**; pause returns it on **302**. | Inspector throws only on **status 302** or `redirect_url` matching `/blocked`; gateway redirects (200) pass through untouched, so `window.location.href = redirect_url` payment flows still work. |
| E7 | **Token expiry / 401 on normal call** | Wrapper's own 401 branch runs (wipe + bounce to login) — our synthetic responses are 200 precisely so we never trigger it accidentally. | Rescue cache + import lets you restore a still-valid token without re-login; expired tokens still require a fresh login (which the pin protects). |
| E8 | **Login rate limit (`X-RateLimit: 30`)** | Unaffected — script doesn't retry or parallelize logins. | Stay under 30 login attempts/limit window; the script logs each attempt. |
| E9 | **Median Android app logins** | The userscript doesn't run inside the app. However: (a) pin export can be replayed manually — the login body is the only check, so the same `visitorId`/`confidenceScore` values from the export work if you proxy the app's login (Burp), or (b) simply skip app login and import the token into the app only if it reads a configurable token. | Not covered by the userscript; documented here as the manual path. |
| E10 | **Request-object form of `fetch`** | Hook re-reads `input.body`, rewrites, and falls back to plain-string input. | Covered; if `new Response(input.body)` fails, original body is sent (pin still set → log entry). |
| E11 | **URL-encoded login body** | If `Content-Type` is urlencoded, hook rewrites and re-sends as JSON — matches what the API actually accepts (`application/json`). | Site's own wrapper always sends JSON; this path is defensive. |
| E12 | **Pin cleared / wrong pin** | Menu 6 clears; next successful login re-captures. Import overwrites. | Status shows pin source (`auto-captured` vs `imported`) and timestamp. |
| E13 | **Fingerprint integrity checks** | Script itself doesn't touch any FP-visible surface (no navigator overrides, no clock skew, GM storage invisible to page). | This is the core difference vs. the old userscript — pinning is *only* at the request body. |
| E14 | **Concurrent sessions** | Bearer token has no device field; multiple devices with the same token are valid until revocation. | Token-sharing path (import) gives immediate multi-device use; login path gives independent sessions. |
| E15 | **OTP login path (current build)** | `POST /login` → `otp_required` → `POST /login/otp {…, visitorId, confidenceScore}` — a second fingerprint choke point. | Covered automatically: the body-rewrite hook pins **any** JSON body containing a `visitorId` field, regardless of endpoint. `noteLoginAttempt` records it for auto-pin too. |
| E16 | **Device-churn DoS (adversarial)** | Because fingerprint is fetched fresh per submit, near-simultaneous logins from different devices race: last enrollment wins, loser is paused. | Out of client control — the pin prevents *accidental* churn (every login presents the same id). Do not run parallel login attempts (also stays within `X-RateLimit: 30`). |

## 5. Verification plan (Playwright + Burp, authorized)

Static verification is complete; live steps (require user's presence/creds):

1. **Bounce suppression:** with account paused or forced, replay `POST /api/login` via Burp → confirm interceptor sees 302 `{redirect_url}` and browser stays put; console shows `PAUSE BOUNCE intercepted`, `localStorage.token` intact.
2. **Pin rewrite:** Tampermonkey → console shows `rewrote request body` on login; Burp (browser proxy) confirms outgoing JSON has the pinned `visitorId` and `confidenceScore`.
3. **Cross-device sim:** Playwright `browser_tabs` with `isolatedContext` = fresh browser profile (new real FP). With imported pin: login succeeds. Without pin: expect 302/422 (control run).
4. **Wipe recovery:** navigate to `/blocked` manually → auto-restore + redirect fires; `/user` returns 200 after.
5. **Payment path sanity:** verify a `redirect_url` on 200 (payment gateway) still navigates (not swallowed).
6. **API tester:** menu 5 → 200 on `/user`, `/notifications`, `/courses` confirms token import works end-to-end.

## 6. Files

| File | Purpose |
|---|---|
| `userpannel/ictfromabc-bypass.user.js` | **The bypass** (install this) |
| `userpannel/userscript.js` | Original 5,439-line media/download suite — keep for downloads; apply P0 scoping before combining (TODO item 9) |
| `analysis/API_MAP.md` | Full API surface (auth/student/public/admin/video-token/wrapper semantics) |
| `analysis/USCRIPT_AUDIT.md` | Old userscript audit, 16-item upgrade list |
| `DEVICELOCK_ictfromabc_2026-09-11.md` | Verified lock mechanism (source of §1) |

## 7. Limits (honest)

- **Cannot lift an active server-side pause** — staff-only unlock (no `/unlock`/`/unblock`/`/device`/`/session` route exists in any of 399 bundles). Bypass prevents *new* locks and makes the client-side bounce/wipe harmless (pause flag is in-memory and volatile).
- **Pin must be captured once on an accepted fingerprint** (or exported from an already-accepted device). A pin the server never accepted will 422 — the script reports this distinctly. Server stores per-user `visitor_id` + `confidence_score` + `logged_on` + `blocked` (admin UI), so the pin works by presenting an *already-enrolled* id.
- **App (Median) not automated** — manual replay path in E9.
- Rate limits, token expiry, and server-side risk scoring beyond `visitorId`/`confidenceScore` are outside client control.
