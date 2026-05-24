# Contributing

Thanks for working on Marketing Platform. This guide covers what you need to know to land a change cleanly.

## Before you start

Read these in order — they take ten minutes total:

1. [README.md](README.md) — environment setup, scripts, project layout.
2. [docs/architecture.md](docs/architecture.md) — how the subsystems fit together.
3. [docs/language-choices.md](docs/language-choices.md) — when to introduce a new language vs. keeping work in TypeScript.
4. [AGENTS.md](AGENTS.md) — Next.js 16 caveat: consult the bundled docs in `node_modules/next/dist/docs/` before writing anything Next-specific, since several APIs differ from older releases.

## Branch workflow

- Branch from `main`. Name: `feat/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`, or `docs/<short-slug>`.
- Keep branches focused. One reviewable concern per PR. If the diff spans multiple unrelated areas, split it.
- Rebase onto `main` before opening or updating a PR — no merge commits in branch history.

## Commit messages

The history aims to read like a changelog. Style guide:

- Subject line ≤ 72 chars, present tense, no trailing period. Start with a type prefix:
  - `feat:` — new user-visible capability
  - `fix:` — bug fix
  - `chore:` — tooling, deps, formatting
  - `docs:` — documentation only
  - `test:` — test-only changes
  - `refactor:` — internal restructuring with no behavior change
  - `ci:` — CI/workflow changes
- Body explains the **why** — the diff already shows the what. Reference incidents, constraints, or decisions that future-you would otherwise forget.
- Wrap body lines at ~72 chars.

Example:

```
fix: stop leaking column types in 500 responses

Routes were echoing the raw Postgres error message verbatim when a
non-UUID hit a UUID column, exposing implementation details to
clients. Move the validation up front with isUuid() and return a
generic 400 instead.
```

## Before you push

Local checks should all pass:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
```

CI runs the same set on every PR plus `npm run build`. The pre-commit hook (Husky + lint-staged) catches formatting/lint errors before they reach a commit, so most of this is automatic.

Pushing to `main` is allowed for `chore:` and `docs:` commits made by maintainers; everything else goes through a PR.

## Pull request checklist

Open the PR with a one-paragraph summary that answers:

- **What changes** — one sentence.
- **Why** — the user problem or constraint driving it.
- **How verified** — what you ran locally (tests added, E2E run, manual click-through).

Then verify:

- [ ] Tests cover the new behavior (unit for pure functions, E2E for user-facing flows).
- [ ] No new lint warnings (`npm run lint` reports 0 warnings).
- [ ] No new TypeScript errors (`npm run typecheck` clean).
- [ ] No new untracked files left behind (`git status` clean before push).
- [ ] If a Supabase migration was added: it's numbered sequentially, doesn't rewrite an existing one, and works on a fresh database.
- [ ] If API behavior changed: the request/response shape is reflected in the calling client code.
- [ ] If user-visible: screenshots or a short clip in the PR body.

## Tests

- **Unit tests** ([Vitest](https://vitest.dev/)) live next to the code under test as `*.test.ts(x)`. Use them for pure functions and small components.
- **E2E tests** ([Playwright](https://playwright.dev/)) live in [`tests/e2e/`](tests/e2e/). Use them for flows that span multiple pages or rely on the auth proxy.
- First-time setup for E2E:
  ```bash
  npm run test:e2e:install   # downloads Chromium
  npm run test:e2e           # runs against `npm run dev`
  ```
- Tests must not depend on remote state. Use Supabase local (`supabase start`) or stubs for anything that hits the database.

## Database migrations

- Go in [`supabase/migrations/`](supabase/migrations/) with sequential numbering — pick the next free number.
- Never rename or renumber existing migrations. Drift between local and prod migration history is a hard-to-recover bug.
- Migrations should be idempotent where it's cheap (`create table if not exists`, `drop policy if exists`).
- If the migration changes RLS, write the policy explanation in the migration body — the reasoning rots fast once the SQL lands.

## Adding a dependency

Before `npm install <pkg>`:

- Is there a lighter alternative already in the tree?
- Will it work with Next 16 + React 19? Many packages still ship `react@18` peer-deps.
- Is the package maintained? Check last publish date and open-issues ratio.
- Does it pull in a new build step (native code, postinstall scripts)? If yes, mention it in the PR.

## Reporting bugs

For now, open a GitHub issue with:

- What you did (clicked, navigated, called).
- What you expected.
- What happened instead (screenshot, network response, console error).
- Browser + OS, if it's a UI bug.

## Code of conduct

Be specific, be kind, be patient with reviews. Critique the code, not the person. Disagreements are normal — surface them early so they don't become merge-conflicts later.
