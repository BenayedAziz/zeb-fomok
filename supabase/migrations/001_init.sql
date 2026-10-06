-- Second Cerveau : schéma initial.
-- À coller dans Supabase > SQL Editor > New query, puis Run.
-- Chaque table est privée par utilisateur (Row Level Security) : personne ne voit les données d'un autre.

create extension if not exists "pgcrypto";

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'c1',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  horizon text not null default 'year' check (horizon in ('vision','year','behavior')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  domain_id uuid references public.domains(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused','done')),
  outcome text,
  description text,
  notes text,
  due_date date,
  links jsonb not null default '[]'::jsonb,
  ai_sorted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  raw text,
  status text not null default 'inbox' check (status in ('inbox','todo','doing','waiting','someday','done')),
  project_id uuid references public.projects(id) on delete set null,
  domain_id uuid references public.domains(id) on delete set null,
  context text,
  priority text check (priority in ('high','med','low')),
  date date,
  time text,
  recurrence text check (recurrence in ('daily','weekdays','weekly','monthly')),
  waiting_for text,
  waiting_since date,
  notes text,
  ai_sorted boolean not null default false,
  ai_reason text,
  done_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  last date,
  checks jsonb not null default '{}'::jsonb
);

-- Compteur d'utilisation de l'IA (écrit uniquement par le serveur)
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);

create index if not exists items_user_status on public.items(user_id, status);
create index if not exists items_user_date on public.items(user_id, date);
create index if not exists projects_user on public.projects(user_id);

alter table public.domains enable row level security;
alter table public.goals enable row level security;
alter table public.projects enable row level security;
alter table public.items enable row level security;
alter table public.reviews enable row level security;
alter table public.ai_usage enable row level security;

do $$
declare t text;
begin
  foreach t in array array['domains','goals','projects','items','reviews'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select using (user_id = auth.uid());

-- Incrément atomique du compteur IA, appelé par le serveur avec la clé service.
create or replace function public.bump_ai_usage(p_user uuid, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.ai_usage(user_id, day, count) values (p_user, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  if n > p_limit then
    update public.ai_usage set count = count - 1 where user_id = p_user and day = current_date;
    return -1;
  end if;
  return n;
end $$;
revoke all on function public.bump_ai_usage(uuid, int) from public, anon, authenticated;
