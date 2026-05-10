# Marketing Platform

A multi-channel marketing campaign workspace built on **Next.js 16**, **React 19**, **Supabase** (Postgres + Auth + Storage), and **Tailwind CSS v4**.

Each project bundles its creative assets, channel-specific media slots, UTM-tagged tracking links, QR codes, signage formats, a campaign brief, and a unified performance dashboard backed by Google Analytics 4.

## Prerequisites

- **Node.js 20+** (required by Next 16 and `file-type@22`)
- **npm** (`package-lock.json` is committed)
- A **Supabase project** — either hosted ([supabase.com](https://supabase.com/)) or local via the Supabase CLI

## First-time setup

```bash
git clone <repo-url>
cd Marketing-Project
npm install
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Where to find Supabase credentials

In the Supabase dashboard: **Project Settings → API**. Copy the **Project URL** and the **anon public** key (not the `service_role` key — that one stays server-side and isn't used here).

If you'd rather run everything locally:

```bash
brew install supabase/tap/supabase
supabase start
```

The CLI prints a local URL and anon key on boot — drop those into `.env.local`.

### Applying database migrations

Migrations live under [`supabase/migrations/`](supabase/migrations) and are numbered sequentially.

```bash
supabase link --project-ref <your-project-ref>   # one-time, for hosted projects
supabase db push                                  # applies pending migrations
```

For local dev with `supabase start`, migrations are applied automatically when the stack boots.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with fast refresh |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint over the project |
| `npm run typecheck` | `tsc --noEmit`, no build artifacts |

## Project layout

```
src/
├── app/
│   ├── _components/        # React components (client + server)
│   ├── api/                # Route handlers (REST-style endpoints)
│   ├── projects/[id]/      # Per-project dashboards & per-channel boards
│   ├── calendar/           # Cross-project marketing calendar
│   ├── login/, register/   # Auth flows
│   ├── go/[linkId]/        # Tracked shortlink redirect (records a click)
│   ├── qr/[linkId]/        # QR-code redirect (records a scan)
│   ├── c/[id]/             # Legacy click redirect
│   ├── layout.tsx, page.tsx, globals.css
│   └── (proxy.ts at src/)  # Auth + redirect "middleware" (Next 16 rename)
├── lib/
│   ├── supabase/           # Browser, server, middleware clients + env helper
│   ├── storage.ts          # Signed-URL helpers for the creatives bucket
│   ├── uploadWithProgress.ts
│   ├── channels.ts, channelAssets.ts, signage.ts
│   ├── campaignBrief.ts, projects.ts, utm.ts
│   └── googleAnalytics.ts  # GA4 service-account auth + queries
└── proxy.ts                # Auth gate (Next 16 middleware replacement)
supabase/
├── config.toml
└── migrations/             # 14 SQL migrations, applied in order
```

## Auth and routing

Every route except `/login`, `/register`, `/auth/callback`, and the public click-redirect paths (`/c/`, `/go/`, `/qr/`) is gated by [`src/proxy.ts`](src/proxy.ts) — the Next.js 16 replacement for `middleware.ts`. Unauthenticated users are bounced to `/login?next=<path>`. API routes return `401 unauthorized`.

## Storage and security

- **Bucket:** `creatives` in Supabase Storage. Files at `{projectId}/{platform}/{ratio}/{name}` (or `{projectId}/signage/{formatId}/{name}`).
- **Access:** the bucket is **private**. The API mints short-lived signed URLs (default 1 hour, configurable in [`src/lib/storage.ts`](src/lib/storage.ts)).
- **Upload pipeline** ([`src/app/api/upload/route.ts`](src/app/api/upload/route.ts)):
  - Strict MIME allowlist (JPEG, PNG, WebP, GIF, MP4, MOV, WebM — no SVG)
  - Magic-byte sniff via [`file-type`](https://github.com/sindresorhus/file-type) to reject mismatched/renamed binaries
  - Images re-encoded through [`sharp`](https://sharp.pixelplumbing.com/) to strip EXIF and apply orientation
  - 500 MB per-file cap; project must exist and not be archived
- **Headers:** [`next.config.ts`](next.config.ts) sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, and a restrictive `Permissions-Policy` on every route.

## Data model

The shared workspace is intentional — see the comment at the top of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Any authenticated user can read and write to any project; per-user isolation only applies to `signage_blueprints`. If you need a multi-tenant model, every RLS policy needs to be rewritten to scope by `auth.uid()`.

Core tables:

- `projects` — campaigns; holds the brief, GA4 property ID, archived state
- `project_platforms` — which channels are enabled per project
- `media` — uploaded creative assets (with `signage_format_id` for signage)
- `signage_formats` (per project) and `signage_blueprints` (per user)
- `project_tracking_links`, `_scans`, `_clicks` — UTM-tagged URLs + analytics
- `tracking`, `search_terms` — legacy / Google-Ads search-term aggregation

## Deployment notes

- The `creatives` bucket must be private in production. Migration `0014_secure_creatives_bucket.sql` enforces this.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required at runtime. They're optional at build time — pages that fetch from Supabase are marked `dynamic`.
- For Google Analytics account login: set `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`, and add `/api/google-analytics/oauth/callback` as an authorized redirect URI in Google Cloud. Service-account GA4 access remains available as a fallback. See [`.env.local.example`](.env.local.example).

## Conventions

- **Imports:** use `@/...` for files outside the current directory; relative for same-folder.
- **Server vs client components:** prefer server components by default. Add `"use client"` only when the file actually needs hooks, browser APIs, or event handlers.
- **API responses:** validate at boundaries; never return raw Supabase `error.message` to clients.
- **Migrations:** sequentially numbered (`0001_*.sql` … `0014_*.sql`). Don't rename or renumber. New migrations go at the end.
