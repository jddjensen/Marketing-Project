-- Track an optional poster image for videos. The browser extracts a frame at
-- upload time, the server stores it alongside the video, and reader routes
-- return a signed URL the <video poster=...> attribute can use.

alter table public.media
  add column poster_storage_path text;
