-- Liens pour passer à l'action (réserver, prendre rendez-vous, démarche en ligne) sur une tâche ou un événement.
alter table public.items add column if not exists links jsonb not null default '[]'::jsonb;
