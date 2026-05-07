-- Allow up to 2 GB per object in the creatives bucket so the app can take
-- 2 GB video uploads via direct-to-storage. Note: Supabase Free tier limits
-- individual files to 50 MB regardless of bucket setting; Pro+ honors this
-- value.

update storage.buckets
  set file_size_limit = 2147483648  -- 2 GB
  where id = 'creatives';
