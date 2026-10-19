-- Second Cerveau : corbeille et règle des 2 minutes.
-- À coller dans Supabase > SQL Editor après 003, puis Run. Ne touche pas aux données existantes.

-- Corbeille : un élément ou une épingle supprimé y est copié tel quel, récupérable pendant 30 jours.
create table if not exists public.trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('items', 'pins')),
  row_data jsonb not null,
  deleted_at timestamptz not null default now()
);
create index if not exists trash_user_deleted on public.trash(user_id, deleted_at desc);
alter table public.trash enable row level security;
drop policy if exists "own rows" on public.trash;
create policy "own rows" on public.trash for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Règle des 2 minutes : l'IA signale ce qui se fait tout de suite.
alter table public.items add column if not exists quick boolean not null default false;
