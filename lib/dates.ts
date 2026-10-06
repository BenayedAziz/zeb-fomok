// Toutes les dates sont des chaînes AAAA-MM-JJ en heure locale.
export const pad = (n: number) => String(n).padStart(2, '0');
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
export const parseIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
export const addMonths = (s: string, n: number) => {
  const d = parseIso(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, dim));
  return isoOf(d);
};
export const diffDays = (a: string, b: string) => Math.round((parseIso(a).getTime() - parseIso(b).getTime()) / 864e5);
export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isTime = (s: unknown): s is string => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const MSHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const DSHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export const mondayOf = (s: string) => {
  const d = parseIso(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoOf(d);
};

export function isoWeek(s: string) {
  const d = parseIso(s);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 864e5 + 1) / 7);
}

/** « Aujourd'hui », « Demain », « jeu. », « 12 oct. » */
export function relDate(s: string) {
  const n = diffDays(s, todayIso());
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n === -1) return 'Hier';
  const d = parseIso(s);
  if (n > 1 && n < 7) return DSHORT[d.getDay()];
  const y = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MSHORT[d.getMonth()]}${y}`;
}

export const longDate = (s: string) => {
  const d = parseIso(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Prochain lundi strictement après aujourd'hui. */
export const nextMonday = (from = todayIso()) => {
  const d = parseIso(from);
  const add = ((8 - d.getDay()) % 7) || 7;
  return addDays(from, add);
};

/** Date suivante pour une tâche récurrente. */
export function nextOccurrence(date: string, rec: string): string {
  if (rec === 'daily') return addDays(date, 1);
  if (rec === 'weekly') return addDays(date, 7);
  if (rec === 'monthly') return addMonths(date, 1);
  if (rec === 'weekdays') {
    let n = addDays(date, 1);
    while ([0, 6].includes(parseIso(n).getDay())) n = addDays(n, 1);
    return n;
  }
  return addDays(date, 1);
}
