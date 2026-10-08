-- New web tables only. Existing mobile-app tables and records are preserved.
begin;

create table public.garasadae_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  concern text not null check (char_length(concern) between 3 and 2000),
  verse_id text not null,
  verse_snapshot jsonb not null,
  thought text not null default '' check (char_length(thought) <= 2000),
  afterword text not null default '' check (char_length(afterword) <= 3000),
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  share_token text unique,
  selection_version text not null
);
create index garasadae_records_owner_date on public.garasadae_records (user_id, created_at desc);
alter table public.garasadae_records enable row level security;
create policy garasadae_records_owner_select on public.garasadae_records for select to authenticated using ((select auth.uid()) = user_id);
create policy garasadae_records_owner_insert on public.garasadae_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy garasadae_records_owner_update on public.garasadae_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy garasadae_records_owner_delete on public.garasadae_records for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.garasadae_records to authenticated;
revoke all on public.garasadae_records from anon;

create table public.garasadae_feedback (
  draw_id uuid primary key,
  concern text not null check (char_length(concern) between 3 and 2000),
  verse_id text not null,
  verse_snapshot jsonb not null,
  analysis jsonb not null,
  selection_metadata jsonb not null,
  experience text not null check (experience in ('enough', 'uncertain', 'miss')),
  note text not null default '' check (char_length(note) <= 1500),
  drawn_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  source text not null default 'live_service' check (source = 'live_service')
);
alter table public.garasadae_feedback enable row level security;
revoke all on public.garasadae_feedback from anon, authenticated;

create table public.garasadae_history (
  draw_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verse_id text not null,
  displayed_at timestamptz not null default now()
);
create index garasadae_history_owner_date on public.garasadae_history (user_id, displayed_at desc);
alter table public.garasadae_history enable row level security;
revoke all on public.garasadae_history from anon, authenticated;

create table public.garasadae_usage (
  bucket text primary key,
  amount integer not null check (amount >= 0),
  updated_at timestamptz not null default now()
);
alter table public.garasadae_usage enable row level security;
revoke all on public.garasadae_usage from anon, authenticated;

create function public.garasadae_take_quota(p_bucket text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare used integer;
begin
  if p_limit < 1 or char_length(p_bucket) > 200 then return false; end if;
  insert into public.garasadae_usage (bucket, amount) values (p_bucket, 1)
  on conflict (bucket) do update set amount = garasadae_usage.amount + 1, updated_at = now()
  returning amount into used;
  delete from public.garasadae_usage where updated_at < now() - interval '2 days';
  return used <= p_limit;
end;
$$;
revoke all on function public.garasadae_take_quota(text, integer) from public, anon, authenticated;
grant execute on function public.garasadae_take_quota(text, integer) to service_role;
grant all on public.garasadae_records, public.garasadae_feedback, public.garasadae_history, public.garasadae_usage to service_role;

commit;
