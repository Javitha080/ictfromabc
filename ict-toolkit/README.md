# ict-toolkit

Site-specific tooling for the ictfromabc.com student account in this workspace:
pin the account's fingerprint on every device, transplant the Bearer session,
map authenticated API calls, and download lesson videos (Bunny HLS).

The generic `userpannel/userscript.js` is **not** used here. It perturbs
`navigator`/`Date`/`Function` and can change the very fingerprint the lock
compares. See `analysis/USCRIPT_AUDIT.md`.

## Layout

```
ict-toolkit/
  userscript/ict-suite.user.js           Tampermonkey suite v2.3.1 (login pin, auto-relogin, session, API map, downloader)
  userscript/ict-suite-relogin-delta.js  headless auto-relogin companion for init-script-injected browsers (test bed)
  cli/ict.mjs                            Node CLI (session, API, resolve, HLS download)
  config/profile.local.json      visitorId + confidenceScore (no token)
  config/session.local.json      created by login/import; live Bearer token — keep private
  tests/harness.html             fake-fetch harness (15 assertions)
  tests/serve.mjs                local static server for the harness
  tests/real-login-rewrite.mjs   Playwright test against the real origin (dummy credentials)
  legacy/                        retired v1 suite
```

Outside the tree: `userpannel/ictfromabc-bypass.user.js` — **bypass v3**, the
standalone device-lock bypass + complete API explorer (`window.__ICT_API`:
`.list()` / `.call()` / `.quick()` / `.resolveVideo()` / `.lesson()` /
`.allowed()` / `.pdfs()` / `.pastPapers()` / `.watchdog()` / `.pin()` /
`.debug()` / `.log()` / `.help()`). Same pin/pause/relogin machinery as the
suite, plus the v3 hardening: apex→www canonicalization at document-start,
urlencoded-login rewrite (in place, kept urlencoded), fail-closed Request
handling (an unreadable login body is never sent raw), a synthetic-200 pause
response to the caller, exact-path `/blocked` matching, a default-ON 5-minute
token watchdog, and an 86-entry endpoint map folded in from the 2026-11-12
full-surface recon (`analysis/RECON_FULL.md`, 202 endpoint pairs). API base
is the APEX origin (`https://ictfromabc.com`) since v3.0.2 — live-verified
12 Nov: the apex API honors Bearer tokens and sends
`access-control-allow-origin: https://www.ictfromabc.com`, while
`www.ictfromabc.com/api/*` serves public routes but 401s every authed
token (the old v2 "same-origin only" `location.origin` base is falsified).
Console-
driven instead of the DOM pane, and it defers auto-relogin + watchdog to the
delta when both run in one browser (`__ICT_DELTA.v >= 3` → headless mode). It
is the file-backed injection source for the Playwright test bed — since
2026-11-12 it is wired at config level (`playwright-mcp.config.json` in the
repo root, passed to the Playwright MCP server via `--config` in
`opencode.jsonc`; delta v3.1.1 registered FIRST so the bypass boots headless
and delegates relogin + watchdog to it). The bypass self-guards to
ictfromabc hosts (v3.0.1) because init-script contexts have no @match
enforcement. A userscript-manager install gives the same tooling on any
device without the suite's UI. Offline regression suite: `tests/node/`
(40/40 pass against v3.0.2).

## Userscript

Requirements: Tampermonkey or Violentmonkey, desktop or mobile.

1. Add `userscript/ict-suite.user.js`.
2. Open `https://www.ictfromabc.com` — apex URLs redirect here (v2.3.1
   canonicalizes documents to www, because localStorage is per-origin while
   the session is account-global) — then press `Alt+I` (or click the **ICT**
   button).
3. **Access** tab:
   - **[Read this device]** — best effort; imports the site's fingerprint module.
   - **[Capture next login]** — log in once; the payload's `visitorId` and
     `confidenceScore` are enrolled and pinned.
   - **[Set FP]** — paste both values manually from F12 → Network.
4. **Session** section:
   - **[Export session]** writes `ict-session.json` (token + role + user + FP).
   - **[Import session]** on another device restores all of it.
   - **[Restore token]** after a 401 or a pause wipe.
   - **[Save login]** stores the phone + password in this browser and arms
     **Auto-relogin**; when the token is revoked (no fixed TTL — see Session
     model), the suite logs back in with the pinned fingerprint. Keep this
     off while the CLI owns the session — the browser would otherwise keep
     taking it back.
5. **Videos** tab: open a lesson page, **[Scan lesson]**, then **DL** / **DL 1080**
   / **HLS** / **ffmpeg** per item.
6. **API** tab: export every authenticated call as JSON or Markdown (method +
   path + status only; no bodies).

The panel also blocks client-side navigation to `/blocked`, converts a 302 pause
response that carries a token into a stored session, and keeps the last 1200 API
calls in memory.

## CLI

Node 18+, no dependencies.

```powershell
cd D:\Pentesting\ictfromabc

# Import the suite export (token + FP)
node ict-toolkit\cli\ict.mjs session import ict-session.json
node ict-toolkit\cli\ict.mjs session show
node ict-toolkit\cli\ict.mjs whoami

# Browse
node ict-toolkit\cli\ict.mjs lessons
node ict-toolkit\cli\ict.mjs lesson 151
node ict-toolkit\cli\ict.mjs api /notifications

# Videos
node ict-toolkit\cli\ict.mjs resolve 1131
node ict-toolkit\cli\ict.mjs download 1131 --quality 720 --ffmpeg
node ict-toolkit\cli\ict.mjs download-lesson 151 --quality 720 --ffmpeg
node ict-toolkit\cli\ict.mjs download-url "https://vz-0d705596-3d4.b-cdn.net/<guid>/playlist.m3u8" --quality 720
```

`login`:

```powershell
node ict-toolkit\cli\ict.mjs login --phone 07XXXXXXXX --password '...' --dry-run   # show payload
node ict-toolkit\cli\ict.mjs login --phone 07XXXXXXXX --password '...'
```

It reads `config/profile.local.json` for the pinned identity unless `--fp` /
`--conf` are given. A login with the wrong identity can pause the account; the
CLI prints the warning and never retries automatically.

### Commands

| Command | Purpose |
|---|---|
| `login` | POST `/api/login` with the pinned identity, store token |
| `session import <file>` | import a suite export |
| `session export [file]` | write a suite-compatible export (live token) |
| `session show` / `clear` | inspect (redacted) / delete the local token |
| `whoami` | GET `/api/user` |
| `lessons` | GET `/api/lessons/allowed` |
| `lesson <id>` | GET `/api/lessons/<id>` and list videos |
| `resolve <videoId>` | generate token, resolve embed, return HLS |
| `download <videoId>` | resolve + HLS download |
| `download-url <m3u8>` | direct HLS download (no token; Referer only) |
| `download-lesson <id>` | all videos in a lesson (`--skip-existing` to resume) |
| `api <path>` | authenticated GET |

Flags: `--out`, `--quality`, `--ffmpeg`, `--keep-ts`, `--limit`, `--json`,
`--dry-run`, `--base`, `--token`, `--verbose`. Env: `ICT_TOKEN`, `ICT_API_BASE`,
`ICT_PHONE`, `ICT_PASSWORD`.

If `ICT_PHONE`/`ICT_PASSWORD` are set (or `--phone`/`--password` are passed),
the CLI re-logs in once when a call returns `401` and retries it with the new
token. Credentials are read from the environment only; nothing is written to
disk. Without them, a `401` is reported and the call fails.

## Tests

```powershell
# Harness (15 assertions, fake transport)
node ict-toolkit/tests/serve.mjs . 8765
# open http://127.0.0.1:8765/tests/harness.html

# Real-origin rewrite (dummy phone/password, Playwright MCP)
node ict-toolkit/tests/build-real-test.mjs
# then run ict-toolkit/tests/real-login-rewrite.generated.mjs through
# browser_run_code_unsafe (filename argument)
```

Last run: harness 15/15, real-origin rewrite confirmed
`visitorId=CWUriseStUq30ANV6hIt`, `confidenceScore=0.97` in the outgoing body.

## How it works

- `analysis/DEVICE_LOCK_BYPASS.md` — mechanism, evidence, procedure, rollback.
- `analysis/VIDEO_PIPELINE.md` — API → embed → token → pull zone → segments.
- `analysis/API_MAP_CURRENT.md` — 70 student/public endpoints + auth semantics.
- `analysis/USCRIPT_AUDIT.md` — why the generic script is unsafe on this origin.

Short version: the server binds the account to the `visitorId` sent at login.
Rewrite that field and the login succeeds from any device. After login the API
is stateless Bearer auth, so the token can be moved between browsers. Bunny's
pull zone needs only `Referer: https://ictfromabc.com/`, so a resolved GUID can
be downloaded directly.

## Session model

Two rules, both measured:

1. **No fixed TTL.** Tokens live as long as no other login happens: observed
   alive at 4 min and 7-10+ min in active use, and real-world sessions run
   hours. The earlier "180 s absolute TTL" reading was an artifact of login
   churn from a second client — every observed fast death coincided exactly
   with a new `POST /api/login` (network-log correlation).
2. **One active token.** Every new `POST /api/login` immediately revokes all
   previously issued tokens (verified live from both directions: a fresh login
   kills an in-use token within seconds, and an in-use token is killed by a
   login on the other device).

Practical rules:

- Logging in on device B signs device A out. The fingerprint pin makes the login
  *allowed*; it does not create a second session.
- A competing client that re-logs in turns both rules into a ping-pong of `401`s.
  That looks like a random short TTL; close the other tab first.
- The CLI re-logs in automatically on `401` when `ICT_PHONE`/`ICT_PASSWORD` are
  set, so long jobs survive token revocations.
- A download needs the token only to resolve the embed. Once the HLS URL is
  known, segments are tokenless behind `Referer`, so an expiry mid-download is
  harmless. `download-lesson` resolves every video first for this reason.

## Troubleshooting

| Problem | Fix |
|---|---|
| login still pauses | verify the panel shows the same visitorId; use session import instead |
| `401` everywhere | a newer login revoked the token (single-session); log in again on the device you want to keep, or set `ICT_PHONE`/`ICT_PASSWORD` |
| panel missing | script disabled on the origin, or another extension blocked it |
| no HLS after resolve | open the player once; the frame sniffer learns the pull zone |
| `403` on CDN | the downloader must send `Referer: https://ictfromabc.com/` |
| `ffmpeg` not found | install ffmpeg, or drop `--ffmpeg` and keep the `.ts` |

## Uninstall

1. Remove the userscript; `Alt+I` → **[Clear]** first if you want the pinned FP gone.
2. `node ict-toolkit\cli\ict.mjs session clear`.
3. Delete `ict-toolkit/config/session.local.json`, `downloads/`, and any
   `ict-session.json` exports.
