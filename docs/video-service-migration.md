# Video service migration runbook

How to move video off Supabase Storage onto a dedicated video service (Mux or
Cloudflare Stream) when the time comes. Images stay on Supabase regardless.

## When to migrate

Pull the trigger when **any** of these is true:

- Supabase egress is regularly exceeding the included tier (250 GB/month on Pro)
  AND >70% of that egress is video traffic. Check at
  https://supabase.com/dashboard/project/_/settings/billing.
- Videos are being shown to **customers**, not just the internal team.
- You start hitting playback complaints on slower networks (a 4K source over
  hotel wifi will stutter — Supabase serves whatever bitrate you uploaded).
- You're routinely uploading videos > 1 GB.
- You need analytics on view-through rate, drop-off, etc.

Stay on Supabase if:

- All video viewing is internal team review.
- You're on Supabase Pro and egress is comfortably under 250 GB/month.
- File sizes are < 100 MB and short clips.

## Mux vs Cloudflare Stream — quick pick

|                         | Mux                                              | Cloudflare Stream                                    |
| ----------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Pricing model           | Storage $0.003/min, streaming $0.0008–$0.005/min | Storage $5/1000 min, streaming $1/1000 min delivered |
| Adaptive bitrate (HLS)  | Auto                                             | Auto                                                 |
| Analytics               | First-class, very deep                           | Basic                                                |
| Live streaming          | Yes (extra)                                      | Yes (extra)                                          |
| Per-asset playback URLs | Signed JWTs, fine-grained                        | Signed tokens, simpler                               |
| Player                  | `mux-player` web component, polished             | HLS.js or `<stream>` web component                   |
| Complexity              | Higher (more knobs)                              | Lower (more turnkey)                                 |

**For a marketing platform without live or per-second analytics needs, Cloudflare
Stream is usually the right pick** — pricing is simpler, the player is
plug-and-play, and you're not paying for analytics features you won't use.

## Implementation outline (Cloudflare Stream)

The change is contained: video uploads + video reads switch backends; images
keep using Supabase Storage. Estimated effort: half a day.

### 1. Provision

- Enable Cloudflare Stream in your Cloudflare account dashboard.
- Generate an API token with `Stream:Edit` permission.
- Set env vars in `.env.local` and your deploy:
  ```
  CLOUDFLARE_ACCOUNT_ID=...
  CLOUDFLARE_STREAM_TOKEN=...
  CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN=customer-xxxxx.cloudflarestream.com
  ```

### 2. Schema

Add a migration:

```sql
alter table public.media
  add column cf_stream_uid text,
  add column cf_stream_status text;
```

Keep `storage_path` populated for backward compat; new video rows have
`cf_stream_uid` set instead and `kind = 'video'`. The reader routes branch on
which is non-null.

### 3. Upload flow

Replace the video branch in [src/app/api/upload/route.ts](../src/app/api/upload/route.ts):

- Image branch: unchanged (Supabase Storage).
- Video branch: instead of uploading bytes to Supabase, request a one-time
  Cloudflare Stream **direct upload URL** via the Stream API
  (`POST /accounts/:id/stream/direct_upload`). Return that URL to the browser.
- Browser: `PUT` the video directly to Cloudflare. This bypasses your function
  entirely — no Node memory pressure, no 500 MB cap from your side.
- Browser: after upload completes, POST `/api/upload/finalize` with the Stream
  UID. Server inserts the `media` row with `cf_stream_uid`.

### 4. Playback

In components that render video, branch on `cf_stream_uid`:

```tsx
{item.cfStreamUid ? (
  <iframe
    src={`https://${CF_SUBDOMAIN}/${item.cfStreamUid}/iframe`}
    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
    allowFullScreen
  />
) : (
  // existing <video> for legacy Supabase-stored items
)}
```

For thumbnails (the dashboard preview tiles), Cloudflare auto-generates them at
`https://{customer-domain}/{uid}/thumbnails/thumbnail.jpg`. No need for the
browser-side poster extraction we built — Cloudflare handles it.

### 5. Migrating existing videos (optional)

If you have existing Supabase-stored videos and want to move them:

1. Script that lists `media` rows where `kind='video' AND storage_path IS NOT NULL`.
2. For each: download from Supabase via service role, POST to Stream's
   `from_url` endpoint, wait for processing, store the resulting UID, null out
   `storage_path`, then `supabase.storage.remove([path])`.
3. Run during low-traffic hours; budget ~30 sec per video for Cloudflare ingest.

If you'd rather just leave old videos on Supabase and only put new ones on
Stream, the branching reader handles that natively — no migration needed.

## What stays on Supabase

- All images (your `sharp`/EXIF-strip pipeline keeps working).
- All non-creative storage (project metadata, tracking links, etc.).
- Auth, DB, RLS — never moves.

## When you decide to do this

Tell me which provider you picked and paste the env values into `.env.local`.
The integration is ~150 lines of code split across the upload route, two
reader routes, and the video-rendering components. I'll wire it up cleanly and
keep the existing Supabase video path working for any legacy assets.
