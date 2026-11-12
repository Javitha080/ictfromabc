# ICTfromABC — Colab TUI

Drive `ictfromabc.com` entirely from a Google Colab notebook: **login → dashboard → lessons → fast video download → Google Drive → Telegram group backup**.

## Files

| File | What it is |
|---|---|
| `ICT_TUI_Colab.ipynb` | the notebook — upload to Colab, run cell 2 → 3 → 4 → 5 |
| `ict_tui.py` | the engine (same code as notebook cell 4; edit here, rebuild with `build_notebook.py`) |
| `build_notebook.py` | regenerates the notebook from `ict_tui.py` |

## The login bypass (why this works from Colab)

The server binds **one FingerprintJS `visitorId` per account**, sent in every
`POST /api/login {phoneNumber, password, visitorId, confidenceScore}`. Observed rule:

| visitorId | network | result |
|---|---|---|
| bound fingerprint | any (router, cellular, datacenter) | ✅ 200 |
| different + residential IP | | ✅ soft pass |
| different + cellular/suspicious IP | | ❌ 422 → retry → 302 "Account on Pause" |

Colab is a datacenter IP — irrelevant as long as every login sends the **bound**
`visitorId` + `confidenceScore`. The TUI does exactly that on every login
(and converts a 302-with-token pause body into a live session, like the browser suite does).

**One-time capture:** on the device that currently logs in fine — `F12 → Network → log in
→ click POST .../api/login → Request Payload` → copy `visitorId` + `confidenceScore` into Cell 3.
Phone + password are already filled in Cell 3 — the fingerprint pair is the only missing piece.
⚠ The notebook now contains real credentials — don't share the .ipynb or `/content/ict_tui_config.json`.

**Operating rules (avoid a server-side pause, staff unlock only):**
- a **422** means the fingerprint was rejected — *never retry blindly*; the TUI refuses to auto-retry.
- log in only from suite-equipped browsers; the **Median app rebinds the fingerprint**.
- if you ever see 302-pause: call staff (071 455 5513), unlock, re-capture, continue.

## Telegram backup storage

- **Userbot (primary):** `kurigram` (Pyrogram fork) with your own account — uploads **up to 2 GB/file**
  into the group, parallel chunks, saturates Colab bandwidth. One-time: get `api_id`/`api_hash`
  at https://my.telegram.org → *API development tools* → Cell 3. First connect (menu 6 → 1) asks
  phone + code in the output; after that the session string is saved into the config.
- **Pick the backup group:** menu 6 → 3 lists your groups; select one, it's saved as `tg_group`.
- **Manifest dedupe:** `telegram_manifest.json` (mirrored to Drive) remembers every uploaded file
  (path+size → message), so re-running "upload folder" only sends new files.
- **Bot fallback:** `tg_bot_token` works for files < 50 MB only (Bot API limit).
- **`tg_as_document`:** `True` (default) sends the raw file — exact backup; `False` sends a
  streamable video (needs ffprobe metadata, fine in Colab).

## Auto pipeline (menu 7)

`pick course → download every lesson video (ffmpeg -c copy, no re-encode) → save to Drive →
upload to Telegram group → optional delete local`. Toggle each stage in Settings (menu 9).

## Colab notes

- Downloads land in `/content/ict_downloads/<course>/<lesson>/`; Drive copies to
  `MyDrive/ICT/<course>/<lesson>/` (menu 5 → 1 mounts Drive).
- Keep-alive is **optional and off by default** (menu 1 → 6 asks Y/N; interval in
  Settings → 19). It pings `/api/user` through the engine's request helper so long
  batches don't drop the session silently; a dead token triggers one automatic
  re-login (safe — bound fingerprint).
- 429s are handled in the request helper itself: `Retry-After` honored when the
  server sends it, otherwise exponential backoff (2 s, 4 s), max 3 tries.
- The API console (menu 8) maps the whole site from inside the TUI: 217 endpoints known,
  `map` prints the student-relevant ones, any `METHOD /path {json}` runs live.
- Menu 10 = one-key API calls (`/user`, `/lessons/allowed`, `/notifications`,
  `/telegram`, `/model-papers/availability`, `/practical-sessions/availability`,
  `/pdfs/tute|lesson-pp|paper-book`, `/purchases/tutes`) + the **RBAC check**
  (`GET /admin/courses` must answer 403 `{"msg":"Unauthorized"}` — verification, not an attack).
- Menu 11 = PDF browser: `/pdfs/{type}` listings (titles/ids), `/pdfs/{id}` delivery
  download via the Bearer request helper (follows a JSON file link or `/files/secure/...`
  when the server returns one), and "save metadata" for the raw listing.
- The config holds your password and Telegram session string — **don't share the notebook
  or `/content/ict_tui_config.json`**. Settings → 16 exports a password-redacted copy.

## Verified behavior

**Live against the real site (2026-11-12, bound pair from the PC):** login 200 (role STUDENT),
`/user`, `/courses` (16), `/lessons/allowed` (11), lesson videos listed, video signing
(`/videos/{id}` + `generate-token`), Bunny HLS resolved end-to-end (lesson 151 / video 1131:
4 variants 240p–720p, master + media playlists 200, 1569 segments — ffmpeg-ready),
YouTube-backed videos classified for yt-dlp. Tokens rotate fast (~10 min or per login):
the TUI's keepalive + one safe auto-relogin (bound fingerprint) handles it.

**Local mock suites (before any real login):**

- login body always carries the forced `visitorId`/`confidenceScore` ✓
- 200 → token stored, Bearer header set ✓ · 302+token → converted ✓ · 302 no-token → paused error ✓
- 422 → classified device-check, no auto-retry ✓
- 429 → Retry-After honored / exponential backoff, max 3 tries ✓
- HLS master/variant parsing, quality pick, embed→direct playlist candidates ✓
- menu flow (login/dashboard/browse/console/quick calls/pdfs/settings) end-to-end ✓
- RBAC: student token gets 403 on `/admin/*` ✓
