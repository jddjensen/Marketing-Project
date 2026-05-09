# Local Dev Notes

Things to remember for this machine.

## App

- App URL: http://localhost:3000
- Login URL: http://localhost:3000/login
- Dev login:
  - Email: `admin@example.com`
  - Password: `password123`

The app is currently configured in `.env.local` to use local Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

`.env.local` is ignored by git, so these local values are machine-specific.

## Supabase

Supabase CLI is installed as a project dev dependency.

```bash
npx supabase --version
npx supabase start
npx supabase status
npx supabase stop
```

Local Supabase URLs:

- Studio: http://127.0.0.1:54323
- Mailpit: http://127.0.0.1:54324
- API: http://127.0.0.1:54321
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

The first `npx supabase start` pulled Docker images and applied migrations through `0018_creative_versioning_race_fix.sql`.

## Docker

Docker Desktop is installed at:

```text
/Applications/Docker.app
```

Docker CLI checks:

```bash
docker version
docker compose version
docker ps
```

Docker is required before `npx supabase start` will work.

## Next Dev Server

Normal foreground start:

```bash
npm run dev
```

Current detached launchctl job:

```bash
launchctl list | rg com.codex.marketing-platform.next
launchctl remove com.codex.marketing-platform.next
```

Detached server log:

```bash
tail -f /tmp/marketing-platform-next.log
```

To start the same detached server again:

```bash
launchctl submit -l com.codex.marketing-platform.next -- /bin/zsh -lc 'cd /Users/jamesjensen/Documents/GitHub/Marketing-Project && PATH=/Users/jamesjensen/.local/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin npm run dev > /tmp/marketing-platform-next.log 2>&1'
```

## Clean Stop

To stop the app and local Supabase:

```bash
launchctl remove com.codex.marketing-platform.next
npx supabase stop
```

## Git Notes

The Supabase CLI install changed:

- `package.json`
- `package-lock.json`

The local `.env.local` change does not appear in git status because `.env*` is ignored except `.env.local.example`.
