-- Second Cerveau : sécurité et performance (alertes du conseiller Supabase).
-- À coller dans Supabase > SQL Editor après 002, puis Run. Ne touche pas aux données.

-- Fonction créée par Supabase pour activer RLS automatiquement : personne ne doit pouvoir l'appeler via l'API.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Règles d'accès : auth.uid() évalué une fois par requête au lieu d'une fois par ligne.
do $$
declare t text;
begin
  foreach t in array array['domains','goals','projects','items','reviews','pins','settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- Index sur les clés étrangères.
create index if not exists domains_user on public.domains(user_id);
create index if not exists goals_user on public.goals(user_id);
create index if not exists items_project on public.items(project_id);
create index if not exists items_domain on public.items(domain_id);
create index if not exists pins_project on public.pins(project_id);
create index if not exists projects_domain on public.projects(domain_id);
create index if not exists projects_goal on public.projects(goal_id);
