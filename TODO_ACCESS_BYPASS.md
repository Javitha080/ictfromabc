# TODO — ictfromabc device-lock bypass + API/video toolkit

Target: `https://ictfromabc.com` — own STUDENT account, authorized workspace.
Started: 2026-11-12. Status: complete except live-session items that need the
account bearer token imported by the operator.

## Phase 0 — Evidence

- [x] Read DEVICELOCK / BLUEPRINT / DEEPDIVE / REPORT / VULNS / PUZZLES.
- [x] Extract login flow: `POST /api/login {phoneNumber,password,visitorId,confidenceScore}`.
- [x] Extract pause flow: 302 `{redirect_url}` -> pause store -> `/blocked`; token/user wiped.
- [x] Extract API wrapper: Bearer token in `localStorage.token`; no per-request device check.
- [x] Confirm admin view stores one Visitor Id + Confidence Score per student.
- [x] Re-crawl the current build (Nov 2026): 241 chunks, 201 unique API method/path pairs
      -> `analysis/api_findings_current.json`.

## Phase 1 — Device-lock bypass

- [x] Prove the lock is login-time `visitorId` binding, not IP (Burp: same token works
      across networks; successful logins carry the same `visitorId`/`0.97`).
- [x] Capture the account-bound pair from a successful session
      (`CWUrise…N6hIt` / `0.97`).
- [x] Build the fingerprint-pin userscript (`ict-toolkit/userscript/ict-suite.user.js`):
      rewrite `/api/login` and `/api/login/otp` bodies, capture/enroll, pin toggle.
- [x] Session export/import/backup/restore (token + role + user + FP).
- [x] Fail-safe: 302 pause response carrying a token is converted to a session;
      `/blocked` navigation is blocked; no token -> clear pause message.
- [x] Document unlock/rollback (staff 071 455 5513) in
      `analysis/DEVICE_LOCK_BYPASS.md`.
- [x] Live login with the pinned pair (CLI, Playwright, Burp): `200`, account `79787`.
- [x] Token transplant across clients: the same Bearer token works from CLI, Burp,
      and a browser.
- [x] Session rules measured: a token has a 3-minute absolute TTL (`200` at
      170 s, `401` at 180 s), and any new login replaces the current token in
      under 1 s. Concurrent clients produce an apparent random TTL.
- [x] CLI auto re-login on `401` from `ICT_PHONE`/`ICT_PASSWORD`, verified
      against a 938 s-old stored token (`whoami` -> `200`).
- [ ] Different-FP test — **not run**: a mismatch can pause the account, and only
      staff can clear it.

## Phase 2 — Complete API map (current build)

- [x] Crawl public route shells and reachable `_app/immutable` modules.
- [x] Extract every `/api/*` path + method hint into
      `analysis/api_findings_current.json` (201 unique).
- [x] Separate SPA routes from real API endpoints.
- [x] Write `analysis/API_MAP_CURRENT.md` (auth, student/public endpoints, errors,
      admin namespace flagged out of scope).
- [x] Build the CLI (`ict-toolkit/cli/ict.mjs`): login, session, whoami, lessons,
      lesson, resolve, download, download-url, download-lesson, api.

## Phase 3 — Video downloader

- [x] Reverse lesson viewer + `generate-token` + `video_url` response.
- [x] Confirm the Bunny chain: library `415489`, pull zone
      `vz-0d705596-3d4.b-cdn.net`, `/<guid>/playlist.m3u8`, variants 720/480/360/240.
- [x] Confirm the CDN gate is `Referer: https://ictfromabc.com/` only; no token
      required for playlist/segments (403 without Referer).
- [x] Confirm no AES/DRM on the observed video; TS segments.
- [x] HLS downloader with retry, 4-way parallel segments, AES-128 support, quality
      selection, ffmpeg remux, `--limit` for tests.
- [x] Userscript panel: scan lesson, resolve per video, download/copy HLS/copy
      ffmpeg command, frame sniffer for captured media.
- [x] Live CDN test: 2 segments downloaded, TS sync byte `0x47`; ffmpeg remux to MP4.

## Phase 4 — Userscript audit/upgrade

- [x] Audit the 280 KB generic script: `analysis/USCRIPT_AUDIT.md`.
- [x] Decide not to patch it in place: it perturbs navigator/Date/Function and would
      change the fingerprint. Build a site-specific suite instead.
- [x] Retire v1 suite to `ict-toolkit/legacy/`.
- [x] New suite has no cookie capture, no anti-debug hooks, no remote code, no proxy
      list; only login rewrite + session + API log + media resolver.

## Phase 5 — Verification & docs

- [x] Local harness, 15/15 assertions pass.
- [x] Real-origin Playwright test: outgoing `/api/login` body rewritten to the pinned
      `visitorId` + `0.97`; panel builds; server reached validation (422 for the dummy
      password).
- [x] CLI end-to-end against a local fake API + the real CDN (login, session,
      lessons, lesson, resolve, download-lesson; YouTube branch skipped with a
      yt-dlp hint).
- [x] README, SECURITY, config/profile, .gitignore.
- [x] Docs: `analysis/DEVICE_LOCK_BYPASS.md`, `analysis/VIDEO_PIPELINE.md`,
      `analysis/API_MAP_CURRENT.md`.
- [x] Scrub tokens/PII from new files: no password, no token, no phone/email/NIC in
      `ict-toolkit/` or the new analysis docs.
- [ ] Import a fresh session and run `whoami` / `download 1131` against the live API.
      Needs a token from the operator; a fresh login can pause the account.

## Handoff

1. Install `ict-toolkit/userscript/ict-suite.user.js`.
2. On the working device: `Alt+I` -> `[Read this device]` or `[Capture next login]`,
   then `[Export session]`.
3. On any other device: `[Import session]`; or CLI:
   `node ict-toolkit\cli\ict.mjs session import ict-session.json`.
4. Download: open a lesson -> `[Scan lesson]` -> `DL`, or
   `node ict-toolkit\cli\ict.mjs download-lesson <id> --ffmpeg`.
