# Architecture

A high-level map of how Marketing Platform fits together. Skim this once on day one, then come back when adding a new subsystem.

For tactical details — file paths, env vars, deploy notes — see [`README.md`](../README.md).

## Big picture

```
┌──────────────┐    ┌──────────────────────────────────┐    ┌──────────────┐
│   Browser    │───►│   Next.js 16 app (App Router)    │◄──►│   Supabase   │
│  (React 19)  │◄───│   src/app/, src/lib/, proxy.ts   │    │  Postgres +  │
└──────────────┘    └──────────────────────────────────┘    │  Auth + S3   │
                                  ▲                          └──────────────┘
                                  │
                            ┌─────┴─────┐
                            │  GA4 API  │   (server-to-server,
                            └───────────┘    OAuth or service account)
```

Everything user-facing is one Next.js app. The same process serves:

- React UI (server + client components)
- REST-style route handlers under `src/app/api/`
- Tracking redirects (`/c/`, `/go/`, `/qr/`)
- Auth proxy (`src/proxy.ts`)

Persistent state lives in Supabase: Postgres for application data, Supabase Auth for sessions, Supabase Storage for creative uploads.

## Layers

### Auth gate — [`src/proxy.ts`](../src/proxy.ts)

The Next.js 16 replacement for `middleware.ts`. Runs on every request, decides whether to pass it through, redirect to `/login`, or 401 the API. Maintains the public-path allowlist (`/login`, `/register`, `/privacy`, `/c/`, `/go/`, `/qr/`, `/auth/callback`). Refreshes the Supabase session cookie via [`updateSession`](../src/lib/supabase/middleware.ts).

### Supabase clients — [`src/lib/supabase/`](../src/lib/supabase/)

Three clients for three contexts, all sharing one env reader:

- `browser.ts` — for client components, anon key only.
- `server.ts` — for server components and route handlers; reads the user's session cookie.
- `middleware.ts` — for `src/proxy.ts`; can rewrite cookies as it goes.

Touching this layer is rare. When you do, mirror the pattern across all three.

### Routes — [`src/app/`](../src/app/)

App Router. Top-level segments:

| Segment               | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `page.tsx`            | Dashboard (project grid + communication platforms)                      |
| `projects/`           | Project list                                                            |
| `projects/[id]/`      | Per-project workspace; 13 platform sub-pages (meta, tiktok, signage, …) |
| `calendar/`           | Cross-project marketing calendar                                        |
| `settings/`           | Account + GA4 connection                                                |
| `login/`, `register/` | Auth UI                                                                 |
| `privacy/`            | Public privacy policy                                                   |
| `c/[id]/`             | Legacy short-link redirect (records a click)                            |
| `go/[linkId]/`        | UTM-tagged tracking-link redirect (records a click)                     |
| `qr/[linkId]/`        | QR-code redirect (records a scan)                                       |

Auth-required routes are gated by the proxy. The three redirect routes are public and intentionally lightweight — they return a 302 in a single round-trip, without rendering UI.

### API surface — [`src/app/api/`](../src/app/api/)

28 route handlers, all expecting an authenticated session. Conventions:

- Validate body and route params at the boundary (`isUuid`, schema check).
- Never echo raw Supabase errors. Map to a generic `{ error: string }` with the right HTTP code.
- For multi-step writes, prefer one Supabase call over a transaction emulated in JS.

Notable groups:

- `api/projects/[id]/creatives/` — uploads, versioning, restoration.
- `api/projects/[id]/tracking-links/` — UTM links + analytics + scans.
- `api/projects/[id]/signage-formats/` — physical signage spec sheets.
- `api/upload/` — three-step direct upload (sign → finalize → cleanup), supports orientation/EXIF stripping via `sharp`.
- `api/google-analytics/` — OAuth start/callback + GA4 properties listing + disconnect.

### Storage — Supabase Storage `creatives` bucket

Private bucket. The API mints short-lived signed URLs (1h default) via [`src/lib/storage.ts`](../src/lib/storage.ts).

Upload pipeline ([`api/upload/route.ts`](../src/app/api/upload/route.ts)):

1. Strict MIME allowlist (no SVG).
2. Magic-byte sniff via `file-type` (rejects renamed binaries).
3. Images re-encoded through `sharp` to strip EXIF and apply orientation.
4. 500 MB per-file cap, project must exist and not be archived.

### Performance & GA4 — [`src/lib/googleAnalytics.ts`](../src/lib/googleAnalytics.ts)

Two auth paths, in priority order:

1. **OAuth** — per-user, set up in `settings/`. Stored in `google_analytics_oauth`.
2. **Service account** — fallback, configured via env vars.

Per-project queries are aggregated into the unified performance dashboard (`projects/[id]/`'s performance widget).

## Data model

See the comment at the top of [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) for the rationale.

**Important:** this is a **shared workspace**, not multi-tenant. RLS policies let any authenticated user read and write every row in every table. The single exception is `signage_blueprints`, which is scoped to the creator. If you ever need to multi-tenant this, every RLS policy needs to be rewritten to filter by `auth.uid()`, and the API needs to start checking ownership before mutating.

Core tables (≈20 migrations applied in order; see [`supabase/migrations/`](../supabase/migrations/)):

| Table                    | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `projects`               | Campaigns: name, description, GA4 property, brief, archived state |
| `project_platforms`      | Which channels are enabled per project                            |
| `media`                  | Uploaded creatives (with version history, soft-delete, restore)   |
| `signage_formats`        | Per-project signage specs                                         |
| `signage_blueprints`     | Per-user reusable signage templates                               |
| `project_tracking_links` | UTM-tagged URLs                                                   |
| `project_link_clicks`    | Per-click analytics rows                                          |
| `project_link_scans`     | QR-scan analytics rows                                            |
| `tracking`               | Legacy click stream                                               |
| `search_terms`           | Google-Ads search-term aggregation                                |
| `google_analytics_oauth` | Per-user GA4 OAuth tokens                                         |

## Cross-cutting concerns

### Error handling

- React rendering errors are caught by `error.tsx` boundaries at the appropriate segment. Root-layout failures are caught by `global-error.tsx`.
- API errors return a consistent shape. Server-side errors are logged via Sentry (`@sentry/nextjs`).
- `proxy.ts` returns `{ error: "unauthorized" }` for unauthenticated API calls and redirects for unauthenticated pages.

### Observability

- **Sentry** is wired via `@sentry/nextjs`. Edge + node + browser SDKs are bundled. Configure DSN via env (`SENTRY_DSN` family).
- E2E test reports upload to GitHub Actions artifacts on every CI run with secrets configured.

### Theming

- `src/app/_components/AppearanceProvider.tsx` reads `localStorage` for theme + color mode and writes attributes on `<html>` before paint.
- The inline boot script in [`src/app/layout.tsx`](../src/app/layout.tsx) prevents the flash of default theme on reload.
- Tokens live in [`src/app/globals.css`](../src/app/globals.css) (Tailwind v4 `@theme` blocks).

## Extending the system

When the next bit of work doesn't obviously fit in TypeScript, see [`docs/language-choices.md`](language-choices.md) for the rule of thumb on when to reach for Go, Python, SQL/PL-pgSQL, Elixir, Rust, or C#.

A few seams that already exist:

- **Background work** — there's no queue yet. Anything async happens inline in route handlers. When that hurts, the right move is probably a Go worker, not a Node one.
- **Analytics rollups** — GA4 queries are made on demand. As data grows, push the aggregation into Postgres materialized views (`pg_cron` + materialized view refresh).
- **Real-time** — none today. If campaign-level collaboration becomes a thing, Elixir/Phoenix LiveView would be the lower-risk path than rebuilding WebSocket fan-out in Node.
