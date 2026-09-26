-- Sample data for new offices («جرّب ببيانات تجريبية»).
--
-- Rows inserted by the demo seeder (src/lib/law/demo-core.ts) carry
-- is_demo = true so they can be removed later without touching anything the
-- office entered itself. Automatic timeline events on a demo case (a stage
-- change, a payment) inherit the flag from their case.

alter table law_clients add column if not exists is_demo boolean not null default false;
alter table law_cases add column if not exists is_demo boolean not null default false;
alter table law_hearings add column if not exists is_demo boolean not null default false;
alter table law_tasks add column if not exists is_demo boolean not null default false;
alter table law_appointments add column if not exists is_demo boolean not null default false;
alter table law_notes add column if not exists is_demo boolean not null default false;

create index if not exists law_clients_demo_idx on law_clients (workspace_id) where is_demo;
create index if not exists law_cases_demo_idx on law_cases (workspace_id) where is_demo;
