-- Review hardening: indexes for foreign keys and hot lookups, and a fixed
-- search_path on every function this app owns.

-- Case deletes set these to null / check them; webhook lookups by reference.
create index if not exists law_appointments_case_idx on law_appointments (workspace_id, case_id);
create index if not exists law_invoices_case_idx on law_invoices (workspace_id, case_id);
create index if not exists workspace_invoices_provider_ref_idx on workspace_invoices (provider, provider_ref)
  where provider_ref is not null;
create index if not exists law_calls_conversation_idx on law_calls (workspace_id, conversation_id);
-- Removing a member also touches done tasks (the existing index is open-only).
create index if not exists law_tasks_assignee_all_idx on law_tasks (workspace_id, assignee_id);
-- New case numbers never reuse a deleted case's number (practice-core).
create index if not exists workspace_events_case_created_idx on workspace_events (workspace_id)
  where kind = 'case_created';

-- Functions resolve names through a fixed path (current schema, then
-- pg_temp last), so a role that can create objects elsewhere can't shadow
-- the tables they use.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = current_schema()
      and p.prokind = 'f'
      and (p.proname like 'law\_%' or p.proname = 'rate_take')
  loop
    execute format('alter function %s set search_path = %I, pg_temp', f.sig, current_schema());
  end loop;
end
$$;
