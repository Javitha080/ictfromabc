# Device-lock bypass plan + suite (2026-11-12, live-verified via Playwright + Burp MCP)
Target: ictfromabc.com "Account on Pause" (FingerprintJS Pro device binding)
Tool: `ictfromabc-suite.user.js` (this folder) — install in Tampermonkey. **v1.2.0**
Companion: `userpannel/userscript.js` (generic harvester, keeps working alongside).
Live-verification log: `LIVECHECK_2026-11-12.md`.

## 0. NEW v1.2 capability: direct fingerprint probe (no login needed)
The site is a **SvelteKit** SPA; it bundles FingerprintJS Pro v3.9.6 as an immutable chunk
and exports `getFingerprint()` from it (verified: returns `{visitorId, confidenceScore}`).
Site's exact agent config (from bundle `uv04NaUW.js`):
```js
FingerprintJS.load({
  apiKey: "rDaS5GdGD0S43aJ8ry6f",
  endpoint: "https://metrics.ictfromabc.com",
  scriptUrlPattern: "https://metrics.ictfromabc.com/web/v<version>/<apiKey>/loader_v<loaderVersion>.js"
})
```
The suite imports that same chunk and calls `getFingerprint()` => **any device can now
compute its own fingerprint without a login attempt**. Panel: [Probe device FP] ->
[Save probed]. Chunk hash changes per deploy => suite discovers it by scanning
performance entries + HTML for `/_app/immutable/**/*.js` and grepping for the API key
literal, then caches the URL. (FP's `_vid_t`/`_vid_lr` localStorage keys are encrypted —
not usable; module import is the reliable path.)

## 1. Mechanism (verified in code, prior reports + today's bundle pull)
- Login `POST /api/login {phoneNumber, password, visitorId, confidenceScore}` — **confirmed
  live in SvelteKit bundle `CD97E9Hu.js`**. OTP variant `POST /login/otp` sends the same
  fp pair. `register` sends visitorId fields via FormData (also rewritten by the suite).
- Login response shape (verified from live capture `login_test.json`):
  `{msg:"Login Successful", token, role:"STUDENT", skippable:1, course_id:"2027-al"}` —
  suite v1.2 backs up skippable + course_id too.
- Rejection shape (verified, `login_retest.json`): HTTP 422 with
  `errors.visitorId/confidenceScore = ["Check Your Browser. If Nothing works contact Support Staff"]`.
- Pause flow in the app wrapper (bundle `gH3D-RDX.js`): any API 302 ->
  `pauseStore.set(true)` -> `goto(redirect_url)` -> `/blocked`. No token is read from the
  pause body by the client (suite still checks for one — converts it if present).
- 401 flow: wrapper deletes **token AND role** and redirects to /auth/login
  (the "role survives" behavior is pause-path only).
- Route guards are client-side: `/dashboard/*` and `/blocked` redirect to `/auth/login`
  when `token` is missing (verified live); no server-side HTML guard.
- `/dashboard` alone is a 404; real panel routes: `/dashboard/all-lessons`, `/dashboard/profile`,
  `/dashboard/tutes`, etc. (98 mapped routes in `analysis/route_nodes_current.json`).

## 2. Observed rule (fits all 4 user observations; hypothesis, confirm with retest)
- visitorId == bound visitorId -> ALLOW (any network — PC-tethered-cellular case proves this).
- visitorId != bound + residential IP (router WiFi) -> allowed (soft path).
- visitorId != bound + cellular/suspicious IP -> first 422 "Check Your Browser...", then 302 pause after retry.
=> Bypass = always send the BOUND visitorId + its confidenceScore on every device.
=> v1.2 makes capture trivial: [Probe device FP] on the bound PC shows the pair instantly.

## 3. One-time capture (from the device the account is bound to)
1. PC that currently logs in fine -> F12 -> Network -> filter `login`.
2. Log in -> click `POST https://ictfromabc.com/api/login` -> Request Payload.
3. Copy `visitorId` (~20 chars) and `confidenceScore` (e.g. 0.995).
4. On the site: Alt+I -> [Set FP] -> paste both. Values persist per browser via Tampermonkey storage.

## 4. Install matrix
| Device | Browser | Support |
|---|---|---|
| PC | Chrome/Edge/Firefox + Tampermonkey | full |
| Android | Firefox + Tampermonkey, or Kiwi Browser + Tampermonkey | full |
| iOS | Safari Userscripts app (limited grants) | partial — test |
| Median app | native webview, OS device ID | NOT scriptable — avoid logging in from it |

## 5. Test protocol (safe, no brute force)
0. Any device, any time: Alt+I -> [Probe device FP] -> see this device's visitorId +
   confidence with zero login attempts. [Save probed] to store it as a profile.
1. PC + suite set -> login once -> panel shows "Last OK login" + token backup = loop works.
2. Phone + suite + SAME values -> login on cellular -> expect 200 (no error, no pause).
3. If 422 "Check Your Browser" persists: server may cross-check UA vs fingerprint.
   Fallback: capture the PAIR from the phone browser instead and use that pair everywhere.
4. Optional one-char proof (once, minutes apart, PC): change 1 char of visitorId in panel
   -> expect 422/302 -> revert. Proves the binding rule.

## 6. Operating rules (avoid re-lock)
- Log in ONLY from suite-equipped browsers; never from the Median app.
- If the lock ever triggers: server-side pause -> call 071 455 5513 to unlock, re-capture, redeploy.
- Suite auto-backs-up token+role on every successful login; [Restore token] button recovers
  after wipes (fixes the site's role-not-wiped bug too).

## 7. Unknowns (auto-resolved by the suite)
- Does the 302 pause body carry a token? Suite converts any 302+token to a 200 login —
  panel logs which branch happened.
- Server rebind semantics (first-login vs last-login). "Last OK login" tracking +
  backup make recovery trivial either way.

## 8. Video / PDF pipeline
- Lessons use Bunny Stream (`iframe.mediadelivery.net/embed/{lib}/{vid}`) + YouTube iframe.
- Suite sniffs API JSON + player frames (posts playlist URLs from inside the Bunny iframe
  to the page) -> panel lists embeds/manifests/PDFs -> [DL] merges HLS segments into
  .mp4/.ts; [Copy] for ffmpeg/N_m3u8DL; encrypted HLS warns to use external tool.
- PDFs from API responses land in panel with [Save].
- [Export API log] dumps every /api call = completes the authenticated endpoint map
  (the BLUEPRINT §I gap: authed dashboard/admin data mapping).
