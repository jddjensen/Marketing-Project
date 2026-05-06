-- Lock down the creatives bucket: no more public reads. All access goes through
-- signed URLs minted by the API for authenticated users.

update storage.buckets
  set public = false
  where id = 'creatives';

-- Drop the open public-read policy. The remaining authenticated-only policies
-- on storage.objects (insert/update/delete) stay; SELECT for authenticated is
-- needed so the API can mint signed URLs for files in the bucket.
drop policy if exists "public read creatives" on storage.objects;

create policy "auth read creatives" on storage.objects
  for select to authenticated
  using (bucket_id = 'creatives');
