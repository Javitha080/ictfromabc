# DEVICE_LOCK_BYPASS.md — one account, many devices

Authorized work on the account in this workspace. The account is a single
STUDENT account; no other account is touched.

## 1. What the lock actually is

The site uses FingerprintJS Pro in the login page. The login request carries two
device fields:

```json
{"phoneNumber":"...","password":"...","visitorId":"<visitorId>","confidenceScore":0.97}
```

The server stores the `visitorId` seen on the first successful login and treats
it as the account's device. Evidence:

- Successful logins on 18 Oct 2026 (Burp history) carried the same
  `visitorId` (`CWUrise…N6hIt`) and `confidenceScore: 0.97` on both attempts.
- The admin student view exposes a "Visitor Id" and "Confidence Score" per
  student, so the pair is stored account-side, not derived per request.
- After login, every `/api/*` request is a plain Bearer call. There is no
  fingerprint header, no device cookie check, and no IP pinning: the same token
  was replayed from a different network and kept working until a newer login
  replaced it.
- A login whose `visitorId` differs from the bound one is answered with
  `302 {"redirect_url":"/blocked"}` and the client wipes `token`/`role`,
  navigates to `/blocked`, and shows "Account on Pause". That state is
  server-side; only staff can clear it.

Conclusion: the lock is **login-time fingerprint binding**, not IP binding and
not per-request device validation.

## 2. Bypass strategy

There are two independent paths. Use both: pinning makes future logins work;
session transplant covers devices where you do not want to log in at all.

### A. Pin the account's visitorId on every device (primary)

The userscript (`ict-toolkit/userscript/ict-suite.user.js`) wraps `fetch` and
`XMLHttpRequest` at `document-start` and rewrites any JSON body containing
`visitorId` — `/api/login` and `/api/login/otp` — to the pinned pair before the
request leaves the browser. The server therefore sees the same fingerprint from
every device and every network.

Pinning does not spoof the rest of the browser fingerprint and does not patch
`navigator`, `Date`, or `Function`. Only the two fields the server checks are
replaced.

### B. Transplant the Bearer session (fallback / no-login devices)

`localStorage.token` is a Sanctum token. Because the API never sees device data,
copying `token`, `role`, and `user` into another browser authenticates it
immediately. The suite stores a backup of these values on every successful
login and can restore them after a 401 or a pause wipe.

### C. Salvage a pause response that still carries a token

Some 302 pause responses include a `token`. The suite converts that response to
a synthetic `200`, stores the session, and blocks navigation to `/blocked`, so a
pause redirect does not destroy a valid session. If the 302 has no token, the
account is genuinely paused and no client-side trick will clear it.

### D. Session rules: 3-minute TTL + one active session (measured)

Two independent rules apply to the Bearer token.

**Absolute TTL of 180 seconds.** With no competing client, a clean token was
probed every 10 s: `200` through 170 s, `401` at 180 s. The clock starts at
login; requests do not extend it.

| age | result |
|---|---|
| 170s | `200` |
| 180s | `401` |

**One active token.** The server keeps one token per account. A new
`/api/login` does not add a session; it replaces the previous token immediately:

| t | action | result |
|---|---|---|
| 1s | login A | `200` |
| 1s | `GET /api/user` with A | `200` |
| 3s | login B | `200` |
| 3s | `GET /api/user` with A | **`401`** |
| 3s | `GET /api/user` with B | `200` |

The two rules together explain the earlier "random expiry": a browser tab that
re-authenticated after its token was replaced killed the CLI token, which looked
like a variable TTL (20 s, 33 s, 90 s, 130 s). With the tab closed the death
lands on 180 s every time. Long jobs therefore need a re-login on expiry, not a
longer timeout.

Consequences:

- Logging in on device B signs device A out. The fingerprint pin makes the login
  *allowed*; it does not make two sessions coexist.
- Do not leave a tab that re-submits the login form while the CLI is working.
- A download needs the Bearer token only to resolve the signed embed. Once the
  HLS URL is known, segments come from Bunny with `Referer` only, so a takeover
  mid-download does not break the transfer.

## 3. Procedure

### Device A (the device that currently logs in)

1. Install Tampermonkey (or Violentmonkey) and add
   `ict-toolkit/userscript/ict-suite.user.js`.
2. Open `https://ictfromabc.com`, press `Alt+I`.
3. Click **[Read this device]**. If the module import is blocked, click
   **[Capture next login]** and log in once; the next login payload is enrolled
   and pinned automatically.
4. Confirm the panel shows the visitorId and `0.97`.
5. Click **[Export session]** and store `ict-session.json` somewhere private.
   It contains a live Bearer token.

### Device B (any other browser, phone, or network)

1. Install the same userscript.
2. Open the site, `Alt+I` → **[Import session]** and pick `ict-session.json`.
   This restores the token, role, user, and the pinned fingerprint.
3. Either keep using the imported session, or log in normally — the login body
   is rewritten to the pinned visitorId.

### Command line (no browser)

```powershell
cd D:\Pentesting\ictfromabc
node ict-toolkit\cli\ict.mjs session import ict-session.json
node ict-toolkit\cli\ict.mjs whoami
node ict-toolkit\cli\ict.mjs lessons
```

The CLI reads `config/profile.local.json` (visitorId + confidence) for `login`
and stores the token in `config/session.local.json`.

## 4. Verification performed

| Test | Result |
|---|---|
| Local harness, 15 assertions (login rewrite, token store, pause 302, pause-with-token, `/blocked` guard, lesson listing, panel) | 15/15 pass |
| Real origin `POST /api/login` from a Playwright browser with the suite installed and dummy credentials | outgoing body rewritten to pinned `visitorId` + `0.97`; server answered `422 Password is too long` |
| Live login, real account, pinned pair (CLI) | `200`, role `STUDENT`, user `79787` |
| Burp replay of the same `POST /api/login` | `200`, token + role returned |
| Two logins with the same pinned pair | second login makes the first token `401` within 1s - one active session |
| Token probed every 10s with no competing client, twice | `200` at 170s, `401` at 180s - 3-minute absolute TTL |
| CLI `whoami` with a 938s-old stored token and `ICT_PHONE`/`ICT_PASSWORD` | auto re-login, retry, `200` |
| Burp authenticated GETs: `/user`, `/lessons/allowed`, `/lessons/151`, `/videos/1131`, `/videos/1155/generate-token` | all `200` |
| Pull zone 619330 (`vz-842e9805-ddc`): playlist + 2 segments | `200`, TS sync `0x47` |
| Video 1155 full pipeline, 720p, 2 segments, ffmpeg remux | 1.3 MB MP4 |
| Old token after a newer login | `401` - replaced, not expired |
| Bunny CDN without `Referer` | `403` |

Live logins used the real account on the bound device and did not trigger a
pause. The remaining risk is a login whose `visitorId` genuinely differs from
the stored pair; the CLI and suite always send the pinned pair.

## 5. Failure handling

| Symptom | Meaning | Action |
|---|---|---|
| `302` + `/blocked`, no token | account paused server-side | call staff (071 455 5513), do not retry logins |
| `401` on every call | a newer login replaced this token (one active session) | log in again on the device you want to keep; do not run concurrent logins |
| panel shows a different visitorId | pin not set on this device | set it manually or import the session |
| login `422` | validation, not the lock | fix the field named in `errors` |

Do not hammer `/api/login`. Each failed attempt is another data point for the
server-side rule; one attempt per device is enough.

## 6. Rollback

1. Disable or uninstall the userscript.
2. `Alt+I` → **[Clear]** removes the pinned fingerprint from script storage.
3. Log in normally. The account will bind to whatever device you use next (staff
   intervention may be required if the old binding is still enforced).
4. `ict session clear` deletes the local token file.

## 7. Why not the generic harvester

`userpannel/userscript.js` is a 280 KB general-purpose harvester. It hooks
`navigator`, `Date`, `Function`, and error handlers, installs anti-debug traps,
and captures cookies. Running it on this origin changes the very fingerprint the
server compares, so it can cause the pause it is supposed to prevent. Keep it
disabled for `ictfromabc.com`; the site-specific suite does not touch those
surfaces.
