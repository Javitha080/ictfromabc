# Admin RBAC census — live, 2026-11-12

Full read-only verification of every admin-namespace GET row from the recon map
(`analysis/api_endpoints_full.json`), executed from the STUDENT side with a
live pinned-fingerprint token (`1141238|…`, minted minutes before the run via
the pinned form login — zero pauses).

## Method

- Spec: `analysis/_admin_census_specs.json` — 56 concrete GET rows from the
  recon map + 4 parameterized rows probed with dummy values
  (`users/search/a`, `purchases/1`, `tags/student/1`, `reviews` no-query).
  POST/PATCH/DELETE rows were never sent.
- Transport: `window.__ICT_API.call('GET <path>')` — the suite's own fetch
  hook against the apex API base, i.e. the exact client path.
- 60 sequential probes, chunked 10-per-evaluate.

## Verdict

**RBAC holds across the entire admin GET surface — zero data exposure.**

| Result | Count | Meaning |
|---|---|---|
| `403` | 37 | Route registered, role gate rejects STUDENT (token preserved) |
| `404` | 20 | No GET route registered — recon over-mapped these as GET |
| `405` | 2 | Route exists, GET not allowed (`/admin/past-papers/1`, `/admin/videos` — POST-class operations) |
| `200` | 1 | `/admins` — **not admin surface**: public-by-design staff directory (see below) |

No `200` on any `/admin/*` path. No `422`/`400`/`500` (those would have meant
the role gate passed and the request reached the controller).

## The one 200 — reclassified

`GET /admins` (top-level, outside `/admin/*`) returns the public staff
directory — first/last name, bio, profile image path, role label — **with no
Authorization header at all** (verified: same 200 unauthenticated). This is
the content the public site renders on its staff/about pages. The recon had
grouped it into the admin namespace; it belongs to the public surface. No
sensitive data (no emails, phones, or internal identifiers beyond the role
label/id the public pages already show).

## Map corrections (404/405 rows)

These recon rows have no GET route (registration is POST/PATCH-only or the
row was a grouping artifact): `/admin/check/{id}`, `/admin/courses/{id}`,
`/admin/courses/{id}/students`, `/admin/events/{id}`,
`/admin/events/{id}/purchases`, `/admin/lessons/{id}`,
`/admin/lessons/{id}/students`, `/admin/model-papers/marked`,
`/admin/model-papers/user/{id}`, `/admin/papers/{id}/marked-submissions`,
`/admin/papers/{id}/unmarked-submissions`, `/admin/practical-sessions/{id}`,
`/admin/tags/{id}`, `/admin/tickets/{id}`, `/admin/tutes/{id}`,
`/admin/tutes/{id}/students`, `/admin/tutes/inventory/{id}`,
`/admin/users/{id}`, `/admin/purchases/{studentId}`,
`/admin/tags/student/{userId}` — and GET is not allowed on
`/admin/past-papers/{id}` and `/admin/videos`.

## Run context

- Token: `1141238|…` (STUDENT), pinned fingerprint
  `CWUriseStUq30ANV6hIt`/0.82, apex API base (v3.0.2).
- The previous PC token (`1141177|…`) had been revoked by a phone login
  minutes earlier (single-session semantics) — the first census attempt ran
  as an unauthenticated baseline (all `401`) and was discarded; this run is
  the live-token census.
- Post-run token state: preserved (403s do not revoke).
