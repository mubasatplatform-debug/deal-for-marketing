-- Atomic throttle reservation + deterministic expiry for rate_hits.
--
-- The app used to count, then insert, in two statements: parallel requests all
-- saw the same count and all got through. `rate_take` serializes callers of one
-- key on a transaction-scoped advisory lock, so the count it reads (a fresh
-- snapshot per statement under READ COMMITTED) always includes every hit
-- committed before it. It also drops every hit older than the longest window
-- (one day) on each call, so nothing outlives 24 hours.
create index if not exists rate_hits_at_idx on rate_hits (at);

create or replace function rate_take(p_key text, p_limit bigint, p_window_seconds int)
returns boolean
language plpgsql
volatile
as $$
declare
  n bigint;
begin
  perform pg_advisory_xact_lock(hashtext('rate_hits'), hashtext(p_key));
  delete from rate_hits where at < now() - interval '1 day';
  select count(*) into n
    from rate_hits
    where key = p_key and at > now() - p_window_seconds * interval '1 second';
  if n >= p_limit then
    return false;
  end if;
  insert into rate_hits (key) values (p_key);
  return true;
end;
$$;

-- Visitor keys are now an HMAC of the IP, never the raw address: drop the old
-- raw-IP rows (at most a fresh throttle window for everyone).
delete from rate_hits where (key like 'lead:%' or key like 'line:%') and key <> 'line:model';
