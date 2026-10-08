import type { Data, Item, Project, Status, Priority, Recurrence, Horizon, ProjectStatus, Settings } from './types';
import { diffDays, todayIso, addDays, matchesRule, DAYS } from './dates';

export const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12'];

export const DEFAULT_CONTEXTS = ['@ordi', '@telephone', '@dehors', '@maison', '@bureau'];
const CTX_LABEL: Record<string, string> = { '@telephone': '@téléphone' };
export const ctxLabel = (k: string) => CTX_LABEL[k] || k;
export const contextsOf = (s: Settings): [string, string][] => (s.contexts?.length ? s.contexts : DEFAULT_CONTEXTS).map((k) => [k, ctxLabel(k)]);

export const DEFAULT_SETTINGS: Settings = {
  showContexts: true,
  showPriorities: true,
  showWaitingSomeday: true,
  contexts: DEFAULT_CONTEXTS,
  dayStart: 7,
  dayEnd: 22,
  defaultCal: 'day',
  reviewEvery: 7,
};

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
  ['weekdays', 'Du lundi au vendredi'],
  ['weekly', 'Chaque semaine'],
  ['monthly', 'Chaque mois'],
  ['yearly', 'Chaque année'],
];
export const REC: Record<string, string> = Object.fromEntries(RECURRENCES);
export const WEEKDAYS_PICK: [number, string][] = [
  [1, 'L'],
  [2, 'M'],
  [3, 'M'],
  [4, 'J'],
  [5, 'V'],
  [6, 'S'],
  [0, 'D'],
];

/** « Tous les mardis et jeudis », « Toutes les 2 semaines », « Chaque année »… */
export function recLabel(it: Pick<Item, 'recurrence' | 'recurrenceDays' | 'recurrenceInterval' | 'date'>) {
  if (!it.recurrence) return '';
  const iv = it.recurrenceInterval && it.recurrenceInterval > 1 ? it.recurrenceInterval : 1;
  if (it.recurrence === 'weekly') {
    const days = it.recurrenceDays?.length ? it.recurrenceDays : it.date ? [new Date(it.date + 'T12:00').getDay()] : [];
    const names = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => `${DAYS[d]}s`);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}` : names[0] || '';
    return iv > 1 ? `Toutes les ${iv} semaines (${list})` : `Tous les ${list}`;
  }
  if (iv > 1) return { daily: `Tous les ${iv} jours`, monthly: `Tous les ${iv} mois`, yearly: `Tous les ${iv} ans` }[it.recurrence as 'daily'] || REC[it.recurrence];
  return REC[it.recurrence] || '';
}

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

export const REVIEW_CADENCES: [number, string][] = [
  [1, 'Chaque jour'],
  [3, 'Tous les 3 jours'],
  [7, 'Chaque semaine'],
  [14, 'Toutes les 2 semaines'],
  [30, 'Chaque mois'],
];
export const cadenceLabel = (n: number) => REVIEW_CADENCES.find(([k]) => k === n)?.[1] || `Tous les ${n} jours`;

export const DURATIONS: [number, string][] = [
  [15, '15 min'],
  [30, '30 min'],
  [45, '45 min'],
  [60, '1 h'],
  [90, '1 h 30'],
  [120, '2 h'],
  [180, '3 h'],
  [240, '4 h'],
];

export const DOMAIN_SUGGESTIONS = ['Travail', 'Freelance', 'Business', 'Sport', 'Santé', 'Famille', 'Musique', 'Apprendre', 'Perso'];

/* ---------- sélecteurs ---------- */
export const list = <T,>(m: Record<string, T>) => Object.values(m);
export const isEvent = (it: Item) => it.kind === 'event';
/** Une action à faire (les événements n'en sont pas). */
export const isOpen = (it: Item) => !isEvent(it) && (it.status === 'todo' || it.status === 'doing');

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

/** Une entrée de calendrier : l'élément lui-même, ou une répétition à venir (`ghost`). */
export interface Entry {
  it: Item;
  date: string;
  ghost: boolean;
}

/** Ce qui tombe un jour donné, répétitions comprises. */
export function entriesOn(d: Data, date: string, filter?: (it: Item) => boolean): Entry[] {
  const out: Entry[] = [];
  for (const it of list(d.items)) {
    if (!it.date || it.status === 'someday' || it.status === 'inbox') continue;
    if (filter && !filter(it)) continue;
    if (it.date === date) out.push({ it, date, ghost: false });
    else if (it.recurrence && it.status !== 'done' && date > it.date && matchesRule(it.date, { freq: it.recurrence, days: it.recurrenceDays, interval: it.recurrenceInterval }, date)) {
      out.push({ it, date, ghost: true });
    }
  }
  return out.sort((a, b) => byTime(a.it, b.it));
}
export const onDate = (d: Data, date: string, filter?: (it: Item) => boolean) => entriesOn(d, date, filter).filter((e) => !e.ghost).map((e) => e.it);

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
  const its = list(d.items).filter((i) => i.projectId === projectId && i.status !== 'someday' && !isEvent(i));
  const done = its.filter((i) => i.status === 'done').length;
  const open = its.filter(isOpen).sort(sortItems);
  return { total: its.length, done, open, next: open[0] || null };
}
export function counts(d: Data) {
  const c = { inbox: 0, next: 0, waiting: 0, someday: 0, ai: 0, overdue: 0, pins: 0 };
  const t = todayIso();
  for (const it of list(d.items)) {
    if (it.status === 'inbox') c.inbox++;
    if (isOpen(it) && (!it.date || it.date <= t)) c.next++;
    if (it.status === 'waiting') c.waiting++;
    if (it.status === 'someday') c.someday++;
    if (it.aiSorted && it.status !== 'done') c.ai++;
    if (isOpen(it) && it.date && it.date < t) c.overdue++;
  }
  c.pins = list(d.pins).length;
  return c;
}
export const lastReviewDays = (d: Data) => (d.review.last ? diffDays(todayIso(), d.review.last) : null);
export const reviewDue = (d: Data) => {
  const lr = lastReviewDays(d);
  return lr === null || lr >= (d.settings.reviewEvery || 7);
};
export const domainOfProject = (d: Data, p?: Project | null) => (p && p.domainId ? d.domains[p.domainId] || null : null);
export function colorKeyOfProject(d: Data, p?: Project | null) {
  return p?.color || domainOfProject(d, p)?.color || 'c8';
}
export const colorOfProject = (d: Data, p?: Project | null) => `var(--${colorKeyOfProject(d, p)})`;
export function colorOfItem(d: Data, it: Item) {
  const p = it.projectId ? d.projects[it.projectId] : null;
  if (p) return colorOfProject(d, p);
  const dom = it.domainId ? d.domains[it.domainId] : null;
  return `var(--${dom?.color || 'c8'})`;
}
/** Couleur libre pour un nouveau projet : la moins utilisée. */
export function freeColor(d: Data) {
  const used: Record<string, number> = {};
  list(d.projects).forEach((p) => {
    const k = colorKeyOfProject(d, p);
    used[k] = (used[k] || 0) + 1;
  });
  return [...COLORS].sort((a, b) => (used[a] || 0) - (used[b] || 0))[0];
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
export const hostOf = (url: string) => {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
