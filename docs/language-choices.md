# Language Choices

Use the right language for the job. This project is polyglot by design — pick the language that best fits the work, not the one that's already there.

## JavaScript / TypeScript

**Use for:** the web app itself.

- Next.js app: pages, server components, client components, route handlers tightly coupled to the UI.
- Supabase client interactions from the browser/edge.
- UI tooling, build pipelines, anything that lives in `src/`.
- Lightweight Node scripts that only the web app needs.

**Avoid for:** heavy data crunching, long-running background workers, CPU-bound jobs, or standalone services that don't need to share code with the frontend.

## Go

**Use for:** standalone backend services and infra tooling.

- High-throughput HTTP services: tracking-link redirector, event ingestion endpoints, webhook receivers.
- Concurrent workers: queue consumers, fan-out jobs, scheduled tasks.
- CLI tools for ops/deploy (static binary, cross-compiles, fast startup).
- Network programming: proxies, custom protocol handlers.
- Anything where deployment simplicity (single binary) and predictable performance matter.

**Avoid for:** data science, anything needing a rich type system or generics-heavy code, UI work.

## Python

**Use for:** data, analytics, and ML.

- GA4 / analytics processing and reporting.
- ETL pipelines, batch jobs, data cleaning.
- ML/AI: personalization, segmentation, content scoring, embeddings.
- Notebooks for ad-hoc analysis.
- Scripts where library ecosystem matters more than raw speed (pandas, numpy, scikit-learn, requests).

**Avoid for:** user-facing services that need low latency under load, or anything that ships as a binary to end users.

## C#

**Use for:** Microsoft-ecosystem integrations and enterprise tooling.

- Microsoft Graph integrations (Outlook, Teams, SharePoint, OneDrive).
- Dynamics 365 / Power Platform connectors.
- Office add-ins.
- Windows desktop utilities if we ever need them.
- .NET-based enterprise integrations a partner requires.

**Avoid for:** web services where Go or Node already fit, or anything we'd otherwise host on Linux without a .NET reason.

## SQL / PL-pgSQL

**Use for:** anything that lives close to the data. Supabase is Postgres — treat it as a programming environment, not just storage.

- RLS policies — all authorization rules belong here, not in app code.
- Database functions / RPC — multi-step reads/writes called via `supabase.rpc()` to collapse round-trips.
- Triggers — audit logs, derived columns, denormalized counters, `NOTIFY` events.
- Materialized views — GA4 rollups and other heavy aggregations.
- Postgres features — JSONB for flexible metadata, full-text search, `pg_cron` for scheduled jobs, partial/expression indexes.

**Rule of thumb:** if the operation is "read rows → transform → write rows" with no external I/O, it belongs in a Postgres function, not a Next.js route handler.

**Avoid for:** business logic that needs external API calls, complex branching, or anything a future engineer would struggle to debug in `psql`.

## Rust

**Use for:** performance-critical or safety-critical pieces where Go isn't enough.

- Extreme-throughput edge services (millions of events/sec, sub-millisecond latency).
- WASM modules running in the browser or on Cloudflare Workers / Supabase Edge.
- Native extensions (NAPI for Node, PyO3 for Python) when a hot loop dominates.
- Long-lived daemons where memory safety + zero-cost abstractions actually pay back the complexity.

**Avoid for:** anything Go could do. Rust costs more in development time — only reach for it when you've measured a real ceiling.

## Elixir

**Use for:** real-time and massively concurrent systems.

- Live dashboards (Phoenix LiveView) — campaign performance, GA4 streams, tracking-link click feeds.
- WebSocket fan-out at scale (presence, collaborative editing of creatives).
- Soft-realtime pipelines: A/B test allocation, event broadcasting, rate-limited webhook fan-out.
- Long-running stateful processes (GenServers) where Go's goroutines would need an external store.

**Avoid for:** CPU-bound work (BEAM is not fast per-core), one-off scripts, or anything the team won't realistically learn OTP for.

## Decision rule

When starting new work, ask in this order:

1. Does this operation live entirely in the database (read/transform/write rows, auth rules, aggregations)? → **SQL / PL-pgSQL**.
2. Is this part of the Next.js web app (UI, server components, route handlers tied to the frontend)? → **TypeScript**.
3. Is this data/analytics/ML? → **Python**.
4. Is this real-time, high-concurrency, or live-dashboard work? → **Elixir**.
5. Is this a standalone backend service, worker, or CLI? → **Go**.
6. Have you measured a real perf/safety ceiling Go can't clear, or do you need WASM? → **Rust**.
7. Does this integrate with the Microsoft ecosystem? → **C#**.

If two fit, prefer the one already used for similar work in this repo. If retrofitting an existing piece, flag it explicitly before rewriting — don't silently port code across languages.
