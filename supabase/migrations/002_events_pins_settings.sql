-- Second Cerveau : événements, durées, récurrences avancées, couleurs de projet, épingles et réglages.
-- À coller dans Supabase > SQL Editor après 001_init.sql, puis Run.

alter table public.items add column if not exists kind text not null default 'task';
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check check (kind in ('task','event'));
alter table public.items add column if not exists duration int check (duration is null or (duration > 0 and duration <= 1440));
alter table public.items add column if not exists recurrence_days int[];
alter table public.items add column if not exists recurrence_interval int check (recurrence_interval is null or recurrence_interval between 1 and 99);
alter table public.items drop constraint if exists items_recurrence_check;
alter table public.items add constraint items_recurrence_check check (recurrence in ('daily','weekdays','weekly','monthly','yearly'));

alter table public.projects add column if not exists color text;

create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text not null,
  title text not null,
  note text,
  project_id uuid references public.projects(id) on delete set null,
  ai_sorted boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pins_user on public.pins(user_id);

create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb
);

alter table public.pins enable row level security;
alter table public.settings enable row level security;
drop policy if exists "own rows" on public.pins;
create policy "own rows" on public.pins for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own rows" on public.settings;
create policy "own rows" on public.settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
