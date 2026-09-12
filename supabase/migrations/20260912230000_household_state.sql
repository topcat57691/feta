create table if not exists public.household_state (
  household_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.household_state enable row level security;

grant select, insert, update on table public.household_state to anon;

create or replace function public.set_household_state_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists household_state_updated_at on public.household_state;
create trigger household_state_updated_at
before update on public.household_state
for each row execute function public.set_household_state_updated_at();

drop policy if exists "household token can read state" on public.household_state;
create policy "household token can read state"
on public.household_state
for select
to anon
using (
  household_id = coalesce(
    current_setting('request.headers', true)::jsonb ->> 'x-household-token',
    ''
  )
);

drop policy if exists "household token can create state" on public.household_state;
create policy "household token can create state"
on public.household_state
for insert
to anon
with check (
  household_id = coalesce(
    current_setting('request.headers', true)::jsonb ->> 'x-household-token',
    ''
  )
);

drop policy if exists "household token can update state" on public.household_state;
create policy "household token can update state"
on public.household_state
for update
to anon
using (
  household_id = coalesce(
    current_setting('request.headers', true)::jsonb ->> 'x-household-token',
    ''
  )
)
with check (
  household_id = coalesce(
    current_setting('request.headers', true)::jsonb ->> 'x-household-token',
    ''
  )
);
