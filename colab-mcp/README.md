# colab-mcp (local sandbox harness)

Local test harness for `colab/ict_tui.py` — emulates the Google Colab runtime plus
every external service so the real engine can be exercised end-to-end with
**zero traffic to the real ictfromabc.com / Bunny CDN / Telegram / Google**.

> Note: the registered MCP server named `colab-mcp` in `opencode.jsonc` is the
> OFFICIAL `googlecolab/colab-mcp` bridge (uvx, live Colab session). This
> directory is a separate offline tool used via CLI:

```
python colab-mcp/server.py selftest                 # all 17 scenarios
python colab-mcp/server.py selftest --scenario NAME # one scenario, full JSON + trace
```

## What it emulates

| Piece | How |
|---|---|
| Colab runtime | per-scenario temp dir as `/content`, cwd switched into it, engine module reloaded against sandbox paths |
| `google.colab.drive` | fake package in a sandbox `site-packages`; `mount()` writes a marker + `MyDrive` into the sandbox FS |
| `pyrogram` (kurigram) | fake package recording every `send_document`/`send_video` into `RECORD`, exports a fake session string |
| `yt-dlp` | scenario-level monkeypatch of `T.ytdlp_download` producing a dummy mp4 (the PATH shim was dropped: cmd batch mangling ate the `-o` template) |
| ictfromabc API | mock HTTP server on `127.0.0.1:<random>`: login rules (ok / 422-password / 422-fingerprint / 302-pause / 302+token), token rotation (only newest token valid), grouped `/courses`, `/lessons/allowed`, list responses that HIDE `video_url` (detail endpoint only), `/generate-token`, `/notifications` (+ `/read-all`), `/telegram`, `/model-papers/availability`, `/practical-sessions/availability`, `/pdfs/{type}` listings + `/pdfs/{id}` binary delivery, `/purchases/tutes`, role-gated `/admin/*` → 403 `{"msg":"Unauthorized"}`, injectable 429s (with/without `Retry-After`) |
| Bunny CDN | same mock server serving embed pages as 403, master/media m3u8, real mpegts segments generated once with local ffmpeg, plus a real AES-128 encrypted playlist fixture (`gen_aes_playlist`) |
| network guard | patches `requests.adapters.HTTPAdapter.send`; ANY request to a non-localhost host raises `GuardViolation` — the sandbox physically cannot reach the real site |

Engine URLs pointing at `mediadelivery.net` / `b-cdn.net` are transparently
rewritten to the local mock inside `T.http_text` + `T.bunny_direct_candidates`,
so the engine still runs its real embed-403 → direct-candidate logic.

## Scenarios (17)

- `login_ok` — 200 STUDENT, bearer header, bound pin + confidenceScore in the body, JSON content-type, me/courses/lessons
- `login_422_password_no_retry` — wrong password → `LoginError kind=device-check`, exactly ONE POST (never auto-retry a 422)
- `login_422_fingerprint_no_retry` — wrong visitorId → same, one POST
- `login_302_pause_notoken` — pause 302 → `kind=paused`, no token accepted
- `login_302_pause_with_token` — pause 302 with token → converted to live session
- `auto_relogin_on_401` — server revokes token mid-session → `tui._maybe_401` re-logins once and retries
- `download_hls` — sign → resolve (2 variants) → `ffmpeg -c copy` → real media verified with ffprobe
- `download_hls_aes128` — AES-128 playlist decrypted by ffmpeg while copying
- `download_mp4` — `video/*` / `.mp4` URL classified as `kind="mp4"` and downloaded
- `download_youtube` — youtube classified offline; yt-dlp branch wired and returns a path
- `drive_mount_save` — fake `google.colab` mount + `save_file` lands under the sandbox `MyDrive` (drive_root pointed at the sandbox because a real `D:\content` exists on this host)
- `telegram_upload_dedupe` — userbot connect, group list, first upload sent, second deduped by manifest
- `menu_smoke` — full scripted TUI session (login, dashboard, browser, API console, settings, exit) with `builtins.input`/`getpass.getpass` patched
- `no_real_network_canary` — direct external request must raise `GuardViolation`
- `api_quick_calls` — menu 10 scripted: /user, /courses, /lessons/allowed, /notifications, read-all POST, /telegram, both availabilities, /purchases/tutes, RBAC check → `RBAC intact: STUDENT -> 403`
- `pdf_browser` — menu 11 scripted: /pdfs/tute listing, /pdfs/901 binary delivery saved under `DL_ROOT/pdfs/`, listing metadata JSON
- `rate_limit_429_backoff` — `Retry-After: 0` honored (no multi-second wait, 3 tries → 200); no-header 429 → exponential backoff, exactly 3 tries → `ApiError 429`

Current: **17/17 PASS, 88/88 checks.**

## Engine bugs this harness caught (both fixed)

1. `resolve_stream` never classified `video/*`, `octet-stream`, or `.mp4` URLs as `kind="mp4"` → plain-file videos were "unknown".
2. `scr_settings` crashed with `IndexError` on the 2-tuple rows (16–18) because the print loop read `r[2]`.

## Mock login rule

`goodpass` → ok; wrong password → 422-password; any `visitorId` ≠ the bound pin
`CWUriseStUq30ANV6hIt` → 422-fingerprint; only the newest issued token is valid.
No scenario ever talks to the real account.
