# Phone setup — ICTFromABC Suite v2.3.1 (multi-device, no "Account on Pause")

> **VERIFIED on a real phone, 2026-11-12:** full flow completed on Android
> (Tampermonkey -> suite -> Import -> Save login -> Auto-relogin) with login over
> cellular. Note: a bounce to `/auth/login` right after Import is EXPECTED when
> the exported token was already revoked (single-session) — arming auto-relogin
> takes the session back. Not a fault, not a pause.

Goal: the account works on the phone over cellular, without ever triggering the device lock,
using ONE canonical fingerprint (the one already enrolled: `CWUriseStUq30ANV6hIt` / `0.82`).

## 1. Install a userscript manager (Android)
- **Kiwi Browser + Tampermonkey** (recommended — Chrome extensions work on Kiwi), or
- **Firefox + Tampermonkey**.

## 2. Install the suite
Copy `userscript/ict-suite.user.js` to the phone (Drive / USB / any file sync), then in
Tampermonkey: Dashboard → **+** → paste the file contents → Save.
(You only need THIS script on the phone — `ictfromabc-bypass.user.js` is redundant on new devices.)

## 3. Import the session (pins the enrolled fingerprint)
- Copy `session-export-2026-11-12.json` to the phone.
- Open https://www.ictfromabc.com → ICT panel (Alt+I or the tab button) → **Session** tab →
  **Import session** → pick the JSON.
- The Fingerprint field must show `CWUriseStUq30ANV6hIt`. If it doesn't, re-import.

## 4. Arm auto-relogin
- Session tab → **Save login** → phone number + password (stored in the phone's script storage only).
- Tick **Auto-relogin on token death**.

## 5. Test on cellular (WiFi off)
- Open the site. If the imported token was already revoked, the first API call 401s →
  auto-relogin logs in with the pinned fingerprint → the session is taken back. No pause.
- Expected log: `Auto-relogin: taking the session back (401 …)` → `session restored (…)`.

## Rules that keep the account safe (verified 2026-11-12, 6 live logins, zero pauses)
1. **Only ONE device is active at a time** — the server keeps a single session per account;
   every new login revokes all older tokens. With auto-relogin armed, whichever device you
   actually use takes the session back within ~45 s of its next click. That takeover is normal.
2. **Never log in with a DIFFERENT fingerprint** — a fresh fingerprint at login re-enrolls the
   account to the new device and can trigger "Account on Pause". The suite's body-rewrite makes
   every login (including the login page form) carry the pinned pair.
3. **Do not use the native Median app** — it rebinds the account's fingerprint.
4. If a login ever returns **422** ("Check Your Browser"), the pin is missing/stale: re-import
   the session export (step 3), then retry once.
5. Treat the export file and the suite's export as a password — they contain a live token.
6. **Pausing a device for a clean test**: while two armed devices are both in use they trade
   the session on every click (by design). To let another device hold it, untick
   **Auto-relogin on token death** in that device's panel — or, on the test-bed browser
   (delta companion), run `localStorage.removeItem('ict_delta_creds_v31')` in the console on
   www to stand the browser delta down; re-set the creds value to re-arm it.

## Session health at last verification
- `/api/user` 200, `/api/lessons` 200 (101 lessons), `/api/lessons/allowed` 200,
  `/api/pdfs/tute` 200 (tute types: `tute`, `lesson-pp`, `paper-book`),
  `/api/videos/{id}` → URL, `/api/videos/{id}/generate-token` → {token, expires},
  `/api/admin/*` → 403 for STUDENT (RBAC intact).
- Burp sent the same authenticated requests with the same token: all HTTP 200 — no TLS/UA
  blocking anywhere; the only gates are the login-time fingerprint check and session validity.
