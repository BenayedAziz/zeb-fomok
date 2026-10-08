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

export interface RecRule {
  freq: string;
  interval?: number | null;
  days?: number[] | null;
}

const monthsBetween = (a: Date, b: Date) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/** La date `d` (postérieure ou égale à `start`) tombe-t-elle sur la règle ? */
export function matchesRule(start: string, rule: RecRule, d: string): boolean {
  if (d < start) return false;
  const iv = Math.max(1, rule.interval || 1);
  const sd = parseIso(start);
  const dd = parseIso(d);
  switch (rule.freq) {
    case 'daily':
      return diffDays(d, start) % iv === 0;
    case 'weekdays':
      return dd.getDay() >= 1 && dd.getDay() <= 5;
    case 'weekly': {
      const days = rule.days && rule.days.length ? rule.days : [sd.getDay()];
      if (!days.includes(dd.getDay())) return false;
      const weeks = Math.round(diffDays(mondayOf(d), mondayOf(start)) / 7);
      return weeks % iv === 0;
    }
    case 'monthly': {
      const m = monthsBetween(sd, dd);
      if (m % iv !== 0) return false;
      const dim = new Date(dd.getFullYear(), dd.getMonth() + 1, 0).getDate();
      return dd.getDate() === Math.min(sd.getDate(), dim);
    }
    case 'yearly': {
      const y = dd.getFullYear() - sd.getFullYear();
      if (y % iv !== 0 || dd.getMonth() !== sd.getMonth()) return false;
      const dim = new Date(dd.getFullYear(), dd.getMonth() + 1, 0).getDate();
      return dd.getDate() === Math.min(sd.getDate(), dim);
    }
  }
  return false;
}

/** Prochaine date après `date` qui respecte la règle (l'ancre est `start`, par défaut `date`). */
export function nextOccurrence(date: string, rule: RecRule | string, start?: string): string {
  const r: RecRule = typeof rule === 'string' ? { freq: rule } : rule;
  const anchor = start || date;
  let d = addDays(date, 1);
  for (let i = 0; i < 1500; i++) {
    if (matchesRule(anchor, r, d)) return d;
    d = addDays(d, 1);
  }
  return addDays(date, 1);
}

/** Toutes les occurrences entre `from` et `to` inclus (pour afficher les répétitions à venir). */
export function occurrencesBetween(start: string, rule: RecRule, from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  let d = from < start ? start : from;
  while (d <= to && out.length < max) {
    if (matchesRule(start, rule, d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const timeOf = (min: number) => {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};
export const fmtDuration = (min?: number | null) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${pad(m)}` : ''}` : `${m} min`;
};
export const timeRange = (time?: string | null, duration?: number | null) =>
  time ? (duration ? `${time}–${timeOf(minutesOf(time) + duration)}` : time) : '';
