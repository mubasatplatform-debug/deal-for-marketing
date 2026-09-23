-- Optional expiry for API keys. Null means the key lives until it is revoked;
-- otherwise authentication refuses it from `expires_at` on.
alter table api_keys add column if not exists expires_at timestamptz;
