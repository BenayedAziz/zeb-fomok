-- Remarques des testeurs : tout le monde (connecté) peut en envoyer, seul l'admin les lit et les traite.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text default (auth.jwt() ->> 'email'),
  message text not null check (char_length(message) between 1 and 4000),
  page text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created on public.feedback(created_at desc);
create index if not exists feedback_user on public.feedback(user_id);
alter table public.feedback enable row level security;

create policy "feedback: send your own" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "feedback: admin reads" on public.feedback for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'azizbenayed15@gmail.com');
create policy "feedback: admin updates" on public.feedback for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'azizbenayed15@gmail.com')
  with check ((select auth.jwt() ->> 'email') = 'azizbenayed15@gmail.com');
create policy "feedback: admin deletes" on public.feedback for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'azizbenayed15@gmail.com');
