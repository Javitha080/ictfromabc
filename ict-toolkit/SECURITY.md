# SECURITY.md — ict-toolkit

## Secrets inventory

| File | Contents | Protection |
|---|---|---|
| `config/session.local.json` | live Bearer token, role, user JSON, fingerprint | mode `0600`, gitignored |
| `config/profile.local.json` | visitorId + confidenceScore | not a token, still account-linked |
| `config/pullzones.local.json` | library id -> CDN host | non-secret cache |
| `ict-session.json` (export) | token + user + fingerprint | user-managed file; treat as a password |
| browser `localStorage.token` | same token | origin-scoped |

The suite also keeps a token backup in Tampermonkey storage
(`ict_token_backup`). Any script with access to the extension's storage can read
it; the token is already in `localStorage` on the same origin, so this does not
widen the exposure meaningfully.

## Network endpoints

The toolkit contacts only:

- `https://ictfromabc.com/api/*` — authenticated API
- `https://www.ictfromabc.com` — script match
- `https://iframe.mediadelivery.net` — signed embed page (pull-zone discovery)
- `https://vz-0d705596-3d4.b-cdn.net` and other `*.b-cdn.net` pull zones — media
- `https://img.youtube.com`, `https://www.youtube.com` — thumbnails/embeds only

No analytics, no third-party proxy, no remote script loading. The suite is a
single self-contained file; it does not `eval` remote code. `GM_xmlhttpRequest`
is used only as a CORS fallback for the same media hosts listed above.

## Data handling

- The API logger stores method, path, status, duration, and key names — never
  request or response bodies.
- Session export writes the token to a local file the user chooses.
- The CLI redacts tokens in terminal output (`109650…0032`) and in
  `session show`.
- No passwords are written to disk by the CLI. The `login` command keeps the
  password in memory only.
- The workspace's older evidence files (root `me.json`, `login_test.json`, Burp
  history) contain account PII and a captured password. They predate this
  toolkit; do not copy them into reports or commits. Delete or move them when
  they are no longer needed.

## Threat model

In scope: a shared or lost device, a copied session file, another browser
extension reading this origin's storage, a stale token after logout.

Out of scope: a compromised OS or browser, a malicious Tampermonkey build, and
server-side compromise. A Bearer token is bearer-only; anyone who holds it is
the account until it is revoked (`POST /api/logout` or server-side revoke).

## Account-safety rules

1. One login attempt per new device. Repeated failures are what the pause rule
   reacts to.
2. Prefer `session import` over a fresh login when the device only needs access.
3. Never run the generic 280 KB harvester on this origin; it perturbs the
   fingerprint surface.
4. If the account pauses, stop. Only staff can clear it (071 455 5513).

## Cleanup checklist

- [ ] `node ict-toolkit\cli\ict.mjs session clear`
- [ ] delete `ict-toolkit/config/session.local.json`
- [ ] delete exported `ict-session.json` files
- [ ] remove the userscript and clear its storage
- [ ] delete `ict-toolkit/downloads/`
- [ ] revoke the token via `POST /api/logout` if it may have leaked
