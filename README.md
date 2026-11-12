# ictfromabc — self-pentest workspace

[![tests](https://github.com/Javitha080/ictfromabc/actions/workflows/tests.yml/badge.svg)](https://github.com/Javitha080/ictfromabc/actions/workflows/tests.yml)

Authorized security testing of **my own** ictfromabc.com student account
(STUDENT role, user id 79787). Work ran 2026-09-11 → 2026-11-12 against my
own account only — no third-party account, data, or privilege was touched,
and no actual privilege escalation was attempted (admin surface was probed
from the STUDENT side and confirmed closed: 403 namespace-wide).

**Status: complete.** Full evidence trail in [`TODO.md`](TODO.md) —
items 1–35 closed.

## Repo layout

| Path | What it is |
|---|---|
| `userpannel/ictfromabc-bypass.user.js` | **Bypass v3.0.2** — device-lock bypass + API explorer (`window.__ICT_API`): 86-entry endpoint map, login pin, pause handling, watchdog, video resolver. Console-driven, 12 menu commands. |
| `ict-toolkit/` | Toolkit proper: `userscript/` (bypass, unlock overlay, relogin-delta), `cli/` (Node CLI), `config/`, `tests/node/` (40/40 green), `legacy/`. See [`ict-toolkit/README.md`](ict-toolkit/README.md). |
| `ict-toolkit/userscript/ict-suite-relogin-delta.js` | **Delta v3.1.1** — session watchdog; relogs-in with the pinned fingerprint on any real 401. Reads `ict_delta_creds_v31` (b64 `phone\npassword`) from www localStorage. |
| `colab/` | **TUI v1.1.0** for Google Colab (`ict_tui.py`) + builder (`build_notebook.py`) + generated notebook. Creds empty by design — getpass prompts at runtime. See [`colab/README.md`](colab/README.md). |
| `colab-mcp/` | Local MCP server wrapping the Colab bridge flow (sandbox mock server for offline testing). |
| `analysis/` | Core analysis: `RECON_FULL.md` (202-endpoint API surface), `api_endpoints_full.json`, `API_MAP*.md`, `DEVICE_LOCK_BYPASS.md`, `devicelock_deepdive.md`, `VIDEO_PIPELINE.md`, TTL/RBAC/IDOR probe scripts (`_*.mjs`, results recorded in `TODO.md`). |
| `TREASURES/` | Curated recon capture set (`INDEX.md`): api/, recon/, reports/, scans/. |
| `dashboard/` | `unlocked.html` — offline dashboard snapshot + template + generator (`analysis/_build_unlock_assets.mjs`). |
| `js/`, `bundles/` | Site bundle snapshots (SvelteKit SPA) used for source-mapping. |
| `tools/`, `tools_out/`, `CloudRecon/` | Recon tooling + raw scan outputs. (`tools/LinkFinder`, `tools/SecretFinder` and `CloudRecon` are third-party clones — gitignored; their outputs live in `tools_out/`.) |
| `*.txt`, `*.json` (root) | Raw recon outputs: dns/nmap/naabu/nuclei/ffuf/wayback/crt/endpoint lists. |
| `playwright-mcp.config.json` | Config-level init-script injection for the Playwright test bed (strict JSON; delta registered FIRST, bypass second). |
| `TODO.md` | The log — every work item with live evidence. |

## Key facts (live-verified 2026-11-12)

- **API base is the APEX origin** `https://ictfromabc.com` — the only host
  that validates Bearer tokens. `www.ictfromabc.com/api/*` serves public
  routes but 401s authed tokens. Apex sends
  `access-control-allow-origin: https://www.ictfromabc.com`.
- **Single-session semantics**: every successful login revokes ALL prior
  tokens; tokens have no fixed TTL (measured ~10 min idle death, revived by
  activity patterns — see `_ttl_probe*.mjs` + `TODO.md` item 24).
- **Device pin**: FingerprintJS pair `CWUriseStUq30ANV6hIt` / 0.82 — every
  login uses it; raw/unpinned logins trigger the device lock.
- **RBAC**: STUDENT → 403 across the whole admin namespace (canary battery
  9×200 + `/admin/courses 403`, plus 5 admin group spot-checks, all 403,
  token preserved). Full live census 2026-11-12: **60 admin GET probes →
  37× 403, zero 200s inside `/admin/*`** — see
  [`analysis/RBAC_CENSUS.md`](analysis/RBAC_CENSUS.md).

## Quickstart

1. **Bypass on any device**: install `userpannel/ictfromabc-bypass.user.js`
   in Tampermonkey/Violentmonkey, or run it headless via the Playwright test
   bed. Never log in raw; never use the native Median app.
2. **Arm the delta (auto-relogin)**: on `https://www.ictfromabc.com`, set
   `ict_delta_creds_v31` in localStorage = base64 of `phone\npassword`.
   Only one device holds the session at a time — arming a device means it
   will take the session back from every other one.
3. **Playwright test bed**: `playwright-mcp.config.json` is passed to the
   Playwright MCP via `--config` (see `opencode.jsonc` playwright entry).
   Init-scripts are file-backed and re-read on every context creation.
4. **Tests**: `node --test "ict-toolkit\tests\node\*.test.mjs"` → 40/40
   (or `npm --prefix ict-toolkit test`).
5. **Colab flow**: open `colab/ICT_TUI_Colab.ipynb`; the CONFIG cell ships
   empty and the TUI prompts with getpass at runtime.

## Repo ops

- **Branches**: `main` = stable (releases are tagged here), `develop` =
  integration (feature branches land here via PR first). Force-pushes and
  branch deletion are blocked on `main` where the plan allows protection.
  See [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **CI** (`.github/workflows/tests.yml`): every push runs the Node suite
  (40/40), the offline Python engine/bridge selftest (17 scenarios via
  `colab-mcp/server.py selftest`), and a notebook-sync check —
  `colab/build_notebook.py` must reproduce `ICT_TUI_Colab.ipynb`
  byte-for-byte.
- **Dependabot**: weekly GitHub-Actions + npm (`ict-toolkit`) and monthly
  pip (`colab`) version updates.
- **Releases**: annotated `vX.Y.Z` tags on `main`; release assets are
  extracted from the committed tree, never a dirty worktree. See
  [Releases](../../releases).
- **License**: none — all rights reserved, private research. See
  [`LICENSE`](LICENSE).

## Secrets policy

No credentials or PII are committed:

- All 7 login-bearing probe scripts read `ICT_PHONE` / `ICT_PASS` from the
  environment instead of embedding them.
- The Colab notebook + builder ship empty CONFIG (runtime getpass).
- Account captures use `REDACTED_PHONE` / `REDACTED_PASSWORD` /
  `REDACTED_EMAIL` / `REDACTED_ID` / `REDACTED_BIRTHDAY` /
  `REDACTED_ADDRESS` / `REDACTED_SCHOOL` / `REDACTED_NAME` placeholders.
- Gitignored (local-only): `.playwright-mcp/` (session logs incl. typed
  creds), `downloads/` (516 MB video archive), `me.json`,
  `*_live_token.json`, `session-export-*.json`, `*.local.json`
  (session/profile state with live tokens).
- Dead artifacts kept deliberately: expired video tokens in the unlocked
  dashboard snapshot, revoked bearer tokens in login-response captures.
- The device pin `CWUriseStUq30ANV6hIt` is part of the shipped tooling by
  design (it is the account-bound fingerprint pair the API expects).

**This repo must stay private.** It documents a bypass for a specific
production site plus redacted-but-real evidence.
