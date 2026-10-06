import type { Data, Item, Project, Status, Priority, Recurrence, Horizon, ProjectStatus } from './types';
import { diffDays, todayIso, addDays } from './dates';

export const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];

export const CONTEXTS: [string, string][] = [
  ['@ordi', '@ordi'],
  ['@telephone', '@téléphone'],
  ['@dehors', '@dehors'],
  ['@maison', '@maison'],
  ['@bureau', '@bureau'],
];
export const CTX: Record<string, string> = Object.fromEntries(CONTEXTS);

export const STATUSES: [Status, string][] = [
  ['inbox', 'Inbox'],
  ['todo', 'À faire'],
  ['doing', 'En cours'],
  ['waiting', 'En attente'],
  ['someday', 'Un jour'],
  ['done', 'Terminé'],
];
export const ST: Record<string, string> = Object.fromEntries(STATUSES);

export const PRIORITIES: [Priority, string][] = [
  ['high', 'Haute'],
  ['med', 'Moyenne'],
  ['low', 'Basse'],
];
export const PR: Record<string, string> = Object.fromEntries(PRIORITIES);
const PRANK: Record<string, number> = { high: 0, med: 1, low: 2 };

export const RECURRENCES: [Recurrence, string][] = [
  ['daily', 'Chaque jour'],
  ['weekdays', 'Jours ouvrés'],
  ['weekly', 'Chaque semaine'],
  ['monthly', 'Chaque mois'],
];
export const REC: Record<string, string> = Object.fromEntries(RECURRENCES);

export const HORIZONS: [Horizon, string, string][] = [
  ['vision', 'Vision à 5 ans', 'La vie que tu construis.'],
  ['year', "Objectifs de l'année", 'Ce qui doit être vrai dans 12 mois.'],
  ['behavior', 'Comportemental', 'La personne que tu es au quotidien.'],
];

export const PSTATUSES: [ProjectStatus, string][] = [
  ['active', 'Actif'],
  ['paused', 'En pause'],
  ['done', 'Terminé'],
];

export const DOMAIN_SUGGESTIONS = ['Travail', 'Freelance', 'Business', 'Sport', 'Santé', 'Famille', 'Musique', 'Apprendre', 'Perso'];

export const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07:00 → 22:00

/* ---------- sélecteurs ---------- */
export const list = <T,>(m: Record<string, T>) => Object.values(m);
export const isOpen = (it: Item) => it.status === 'todo' || it.status === 'doing';

export function sortItems(a: Item, b: Item) {
  const pa = a.priority ? PRANK[a.priority] : 3;
  const pb = b.priority ? PRANK[b.priority] : 3;
  if (pa !== pb) return pa - pb;
  const da = a.date || '9';
  const db = b.date || '9';
  if (da !== db) return da < db ? -1 : 1;
  return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
}
export function byTime(a: Item, b: Item) {
  const ta = a.time || '99';
  const tb = b.time || '99';
  if (ta !== tb) return ta < tb ? -1 : 1;
  return sortItems(a, b);
}

export const domainsSorted = (d: Data) => list(d.domains).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
export const projectsSorted = (d: Data) => list(d.projects).sort((a, b) => a.name.localeCompare(b.name));
export const goalsSorted = (d: Data) => list(d.goals).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

export function onDate(d: Data, date: string, filter?: (it: Item) => boolean) {
  return list(d.items)
    .filter((it) => it.date === date && it.status !== 'someday' && it.status !== 'inbox' && (!filter || filter(it)))
    .sort(byTime);
}
export function overdue(d: Data) {
  const t = todayIso();
  return list(d.items).filter((it) => isOpen(it) && it.date && it.date < t).sort(sortItems);
}
export function backlog(d: Data, projectId?: string | null) {
  return list(d.items)
    .filter((it) => isOpen(it) && !it.date && (!projectId || it.projectId === projectId))
    .sort(sortItems);
}
export function projectStats(d: Data, projectId: string) {
  const its = list(d.items).filter((i) => i.projectId === projectId && i.status !== 'someday');
  const done = its.filter((i) => i.status === 'done').length;
  const open = its.filter(isOpen).sort(sortItems);
  return { total: its.length, done, open, next: open[0] || null };
}
export function counts(d: Data) {
  const c = { inbox: 0, next: 0, waiting: 0, someday: 0, ai: 0, overdue: 0 };
  const t = todayIso();
  for (const it of list(d.items)) {
    if (it.status === 'inbox') c.inbox++;
    if (isOpen(it) && (!it.date || it.date <= t)) c.next++;
    if (it.status === 'waiting') c.waiting++;
    if (it.status === 'someday') c.someday++;
    if (it.aiSorted && it.status !== 'done') c.ai++;
    if (isOpen(it) && it.date && it.date < t) c.overdue++;
  }
  return c;
}
export const lastReviewDays = (d: Data) => (d.review.last ? diffDays(todayIso(), d.review.last) : null);
export const domainOfProject = (d: Data, p?: Project | null) => (p && p.domainId ? d.domains[p.domainId] || null : null);
export function colorOfProject(d: Data, p?: Project | null) {
  const dom = domainOfProject(d, p);
  return `var(--${dom?.color || 'c8'})`;
}
export function colorOfItem(d: Data, it: Item) {
  const p = it.projectId ? d.projects[it.projectId] : null;
  if (p) return colorOfProject(d, p);
  const dom = it.domainId ? d.domains[it.domainId] : null;
  return `var(--${dom?.color || 'c8'})`;
}
export const upcoming = (d: Data, days = 14) => {
  const t = todayIso();
  const end = addDays(t, days);
  return list(d.items).filter((i) => i.date && i.date >= t && i.date <= end && i.status !== 'done');
};

/** Transforme un texte de notes en liste de liens cliquables. */
export function linksIn(text?: string | null): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(/https?:\/\/[^\s<>"')]+/g) || []));
}
