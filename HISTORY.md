# Project History

A running log of work completed on this repo, kept so agents (and humans) don't
re-tread ground. **Read this before starting work. Append a session entry at the
end of every session, before pushing/syncing** — see [Maintenance protocol](#maintenance-protocol)
at the bottom.

The project is a multi-channel marketing campaign workspace on Next.js 16,
React 19, Supabase (Postgres + Auth + Storage), and Tailwind CSS v4. See
[README.md](README.md) and [docs/architecture.md](docs/architecture.md) for the
current-state picture; this file is the *how we got here*.

---

## Phase 1 — Scaffold and core workspace (Apr 17–18, 2026)

- Bootstrapped from Create Next App (`0eb963e`).
- First real version: Supabase storage, logins, and the new-project screen
  (`9ebf548`, `aa3eb34`, `3b8c5a1`).
- **UTM tracking link builder** with platform-specific configuration (`7c80316`).

## Phase 2 — Tracking, channels, and dashboards (Apr 20, 2026)

- **QR tracking links + scan analytics** (`6bafa46`).
- Aquarium channel support, signage blueprints, GA4 link dashboards (`61fba8f`).
- **Campaign brief module** on the project dashboard (`62ae18e`, `fecd263`).
- **Unified performance dashboard** with tracked click attribution (`a9d4608`).

## Phase 3 — Uploads, media, and GA4 integration (May 6–9, 2026)

- **Direct uploads and creative versioning**; later refined with upload cleanup
  (`17a8be4`, `55042ff`).
- **Campaign media tracking and GA4 OAuth** (`8faf90b`).
- Test asset fixtures and an upload runner (`4241403`).
- Bug-fixing pass; HoverScrubVideo activation/focus-ring polish (`2d5ce98`, `7630e3f`).
- **API input validation hardened**, 500s cleaned up (`fdee9d4`).
- Platform copy limits/hints updated to 2026 platform reality (`aa598ad`).
- Local Supabase setup notes added (`3d8c75b`, see [LOCAL_DEV_NOTES.md](LOCAL_DEV_NOTES.md)).

## Phase 4 — Security hardening (May 22, 2026)

- Privacy policy added; **security headers hardened; open-redirect and IDOR
  gaps plugged** (`a0e8072`). Don't re-audit these without checking what this
  commit already covered.

## Phase 5 — Engineering hygiene, testing, CI, docs (May 23, 2026)

Large quality sweep, all on one day:

- **Formatting**: Prettier config + whole-codebase format, with
  `.git-blame-ignore-revs` so blame skips the bulk commit (`be4cd9f`, `02e4f77`, `f22e760`).
- **Pre-commit**: Husky + lint-staged (`8501e3f`).
- **Unit tests**: Vitest with example tests for `utm` and `isUuid` (`8e28f45`).
- **E2E tests**: Playwright infra + smoke tests for public pages (`78d4610`).
- **CI**: format + tests enforced on every PR; gated E2E job (`399f91f`).
- **App-shell**: loading/error/not-found boundaries; web app manifest +
  apple-icon route (`934ede3`, `31ab3f0`).
- **Docs**: README expanded, CONTRIBUTING added, architecture doc,
  language-choices policy (`fd7ecf8`, `7117d91`).
- **Shared workspace polish** (Agent 2's `feat/polish` branch merged) — empty/
  loading/error state polish across the shared workspace (`477c56f`, `b106fcb`, `a72e57c`).

## Known deferred / future work

- **Video service migration** (Mux or Cloudflare Stream) is intentionally NOT
  done — [docs/video-service-migration.md](docs/video-service-migration.md) is
  a runbook for *when* trigger conditions are met (egress, customer-facing
  video, >1 GB uploads). Don't migrate preemptively.

---

## Session log

Newest entries at the top. One entry per working session.

### 2026-06-11 — Establish HISTORY.md

- Created this file, backfilled from the full git history (40 commits,
  2026-04-17 → 2026-05-23).
- Added the maintenance rule to [AGENTS.md](AGENTS.md) so every future agent
  reads this file at session start and updates it before pushing.

---

## Maintenance protocol

**For every agent working in this repo:**

1. **At session start:** read this file (at minimum the Session log and Known
   deferred work) before exploring or planning, so you don't redo or undo
   prior work.
2. **At session end, before `git push` / sync:** append a new entry at the top
   of the Session log:

   ```markdown
   ### YYYY-MM-DD — <one-line summary>

   - What was done (features, fixes, refactors) with key file paths or commit hashes.
   - Decisions made and why, especially anything that constrains future work.
   - Anything deliberately left undone or deferred (move durable items into
     "Known deferred / future work").
   ```

3. Keep entries factual and brief — this is a map, not a diary. If a phase-level
   summary above becomes stale, update it rather than only appending.
4. Commit the HISTORY.md update together with (or immediately after) the
   session's final commit, so the push includes it.
