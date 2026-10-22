-- Projets : sous-projets (projet parent), projets épinglés en haut, projets archivés (cachés sans être supprimés).
alter table public.projects add column if not exists parent_id uuid references public.projects(id) on delete set null;
alter table public.projects add column if not exists pinned boolean not null default false;
alter table public.projects add column if not exists archived_at timestamptz;
create index if not exists projects_parent on public.projects(parent_id);
