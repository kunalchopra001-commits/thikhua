create table public.schools (
  id uuid primary key default gen_random_uuid(),
  udise_code text not null unique,
  name_en text not null,
  name_kn text not null,
  block_id text not null,
  block_name text not null,
  district text not null,
  state text not null,
  is_urban boolean not null,
  management_type text not null,
  lat double precision not null,
  lng double precision not null,
  enrolment integer not null
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  school_id uuid not null references public.schools (id),
  category text not null,
  severity text not null check (severity in ('S1', 'S2', 'S3', 'S4')),
  severity_reasoning text not null,
  rte_entitlement_violated boolean not null,
  estimated_scale text not null check (estimated_scale in ('minor', 'major')),
  location_within_premises text,
  grievance_authority text not null,
  execution_authority text not null,
  funding_pathway text not null,
  statutory_limit_days integer not null default 90,
  status text not null check (
    status in ('submitted', 'in_progress', 'overdue', 'unfunded', 'resolved')
  ),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_photo_url text
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id),
  text_original text not null,
  text_hindi text not null,
  text_english_official text not null,
  detected_language text not null,
  photo_url text not null,
  reporter_mode text not null check (
    reporter_mode in ('anonymous', 'named_private', 'named_public')
  ),
  reporter_name text,
  reporter_contact text,
  capture_provenance text not null check (capture_provenance in ('live', 'upload')),
  created_at timestamptz not null default now()
);

create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id),
  event_type text not null check (
    event_type in (
      'SUBMITTED',
      'CORROBORATED',
      'ACKNOWLEDGED',
      'INSPECTION_ORDERED',
      'MARKED_UNFUNDED',
      'RESOLVED',
      'REOPENED'
    )
  ),
  actor_office text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create index schools_block_id_idx on public.schools (block_id);
create index issues_school_id_idx on public.issues (school_id);
create index issues_status_idx on public.issues (status);
create index status_events_issue_id_idx on public.status_events (issue_id);

alter table public.schools enable row level security;
alter table public.issues enable row level security;
alter table public.reports enable row level security;
alter table public.status_events enable row level security;

create policy "Anonymous users can read schools"
  on public.schools
  for select
  to anon
  using (true);

create policy "Anonymous users can read issues"
  on public.issues
  for select
  to anon
  using (true);

create policy "Anonymous users can create issues"
  on public.issues
  for insert
  to anon
  with check (true);

create policy "Anonymous users can read reports"
  on public.reports
  for select
  to anon
  using (true);

create policy "Anonymous users can create reports"
  on public.reports
  for insert
  to anon
  with check (true);

create policy "Anonymous users can read status events"
  on public.status_events
  for select
  to anon
  using (true);

create policy "Anonymous users can create status events"
  on public.status_events
  for insert
  to anon
  with check (true);

create function public.prevent_status_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'status_events is append-only; UPDATE and DELETE are not allowed';
  return null;
end;
$$;

create trigger status_events_append_only
before update or delete on public.status_events
for each row
execute function public.prevent_status_event_mutation();

create trigger status_events_append_only_statement
before update or delete or truncate on public.status_events
for each statement
execute function public.prevent_status_event_mutation();

create function public.reset_seed_data(
  seed_school_ids uuid[],
  seed_issue_ids uuid[],
  seed_report_ids uuid[],
  seed_status_event_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  alter table public.status_events disable trigger status_events_append_only;
  alter table public.status_events disable trigger status_events_append_only_statement;

  begin
    delete from public.status_events where id = any(seed_status_event_ids);
    delete from public.reports where id = any(seed_report_ids);
    delete from public.issues where id = any(seed_issue_ids);
    delete from public.schools where id = any(seed_school_ids);
  exception
    when others then
      alter table public.status_events enable trigger status_events_append_only;
      alter table public.status_events enable trigger status_events_append_only_statement;
      raise;
  end;

  alter table public.status_events enable trigger status_events_append_only;
  alter table public.status_events enable trigger status_events_append_only_statement;
end;
$$;

revoke all on function public.reset_seed_data(uuid[], uuid[], uuid[], uuid[]) from public;
grant execute on function public.reset_seed_data(uuid[], uuid[], uuid[], uuid[]) to service_role;
