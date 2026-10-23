'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { AiAction, AiItem, Data, Item, Project } from '@/lib/types';
import { COLORS, PR, REC, ST, contextsOf, entriesOn, familyIds, isEvent, isOpen, list, projectPath, projectStats, sortItems, domainsSorted, freeColor, guessContext, mergeLinks, projectsSorted, recLabel } from '@/lib/gtd';
import { mascotFor } from '@/lib/mascots';
import { applyTheme } from '@/lib/theme';
import { DAYS, addDays, isDate, isTime, minutesOf, nextOccurrence, pad, parseIso, relDate, timeOf, todayIso } from '@/lib/dates';

export type View =
  | 'day' | 'inbox' | 'next' | 'waiting' | 'someday' | 'projects' | 'project' | 'pins'
  | 'goals' | 'review' | 'journal' | 'import' | 'settings' | 'help' | 'onboarding' | 'trash' | 'feedback';
export type CalMode = 'day' | 'week' | 'month';
export type DrawerState =
  | { type: 'item'; id: string }
  | { type: 'project'; id: string | null; draft?: Record<string, string> }
  | { type: 'goal'; id: string }
  | { type: 'pin'; id: string }
  | { type: 'domain'; id: string | null; draft?: Record<string, string> };

export interface ToastState {
  text: string;
  chips?: string[];
  actions?: { label: string; run: () => void }[];
  key: number;
}

interface UI {
  view: View;
  cal: CalMode;
  date: string;
  projectId: string | null;
  domainFilter: string | null;
  /** Filtre du calendrier sur un projet. */
  calProject: string | null;
  ctx: string;
  drawer: DrawerState | null;
  navOpen: boolean;
  captureOpen: boolean;
  /** Date et heure préremplies quand on capture depuis un créneau du calendrier. */
  capturePreset: Partial<Item> | null;
  plan: { id: string; x: number; y: number } | null;
  pending: Record<string, boolean>;
  /** Cochés à l'instant : déclenche l'animation, puis s'efface. */
  justDone: Record<string, boolean>;
  /** Le nuage qui danse quand on coche (big : tout un projet est fini). */
  dance: { key: number; src: string | null; text?: string; big: boolean } | null;
  /** L'IA cherche un lien pour passer à l'action. */
  linking: Record<string, boolean>;
  /** Jour en cours de planification par l'IA. */
  planning: string | null;
  aiOff: boolean;
  importSource: string | null;
}

interface UIApi {
  ui: UI;
  set: (p: Partial<UI>) => void;
  go: (view: View, extra?: { projectId?: string; domain?: string | null }) => void;
  openDrawer: (d: DrawerState) => void;
  closeDrawer: () => void;
  toast: (t: Omit<ToastState, 'key'>) => void;
  toastState: ToastState | null;
  dismissToast: () => void;
  capture: (text: string, extra?: Partial<Item>) => Promise<void>;
  aiSort: (id: string) => Promise<void>;
  /** Ajout direct dans l'agenda : l'IA choisit seulement le projet et le domaine, sans toucher au reste. */
  fileWithAi: (id: string) => Promise<void>;
  /** L'IA place les tâches à planifier dans les créneaux libres du jour. */
  planDay: (date: string, opts?: { auto?: boolean }) => Promise<void>;
  /** Cherche sur le web le lien qui permet d'agir (réserver, s'inscrire…) et l'ajoute à l'élément. */
  findLinks: (id: string, query?: string) => Promise<void>;
  toggleDone: (id: string) => void;
  schedule: (id: string, date: string | null, time?: string | null) => void;
  removeItem: (id: string) => void;
  /** Supprime un projet : ses actions restent, sans projet. Annulable. */
  deleteProject: (id: string) => void;
  /** Range un projet (et ses sous-projets) dans un autre domaine de vie. Annulable. */
  moveProject: (id: string, domainId: string | null) => void;
}

const Ctx = createContext<UIApi | null>(null);
export const useUI = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('UIProvider manquant');
  return v;
};

export function aiContext(d: Data) {
  const now = new Date();
  return {
    today: todayIso(),
    now: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    city: d.settings.city?.trim() || undefined,
    contexts: contextsOf(d.settings).map(([k]) => k),
    domains: domainsSorted(d).map((x) => ({ id: x.id, name: x.name })),
    projects: projectsSorted(d)
      .filter((p) => p.status !== 'done')
      .map((p) => ({
        id: p.id,
        name: projectPath(d, p),
        domain: p.domainId ? d.domains[p.domainId]?.name : undefined,
        outcome: p.outcome || undefined,
        description: p.description || undefined,
        // La mémoire du projet : ce qui est en cours dedans.
        doing: projectStats(d, p.id).open.slice(0, 3).map((i) => i.title),
      })),
    about: d.settings.about?.trim() || undefined,
    // Pour les demandes du genre « déplace la réunion à jeudi » : ce qui est en cours et les événements à venir.
    items: list(d.items)
      .filter((i) => i.status !== 'done' && (!isEvent(i) || !i.date || i.date >= addDays(todayIso(), -1) || i.recurrence))
      .sort(sortItems)
      .slice(0, 150)
      .map((i) => ({ id: i.id, title: i.title, kind: i.kind || 'task', date: i.date || null, time: i.time || null, project: i.projectId && d.projects[i.projectId] ? d.projects[i.projectId].name : null })),
  };
}

const AI_ERRORS: Record<string, string> = {
  ai_not_configured: "Ajouté à l'inbox. L'IA n'est pas encore branchée sur ce site.",
  daily_limit: "Limite IA du jour atteinte : c'est dans l'inbox, range-le à la main ou réessaie demain.",
  not_signed_in: 'Ta session a expiré, reconnecte-toi.',
};

/** Normalise un élément renvoyé par l'IA en champs d'élément valides. */
function itemFromAi(d: Data, r: AiItem): Partial<Item> {
  const ctxs = new Set(contextsOf(d.settings).map(([k]) => k));
  const p: Partial<Item> = { aiSorted: true, aiReason: typeof r.reason === 'string' ? r.reason.slice(0, 300) : '' };
  p.kind = r.kind === 'event' ? 'event' : 'task';
  if (typeof r.title === 'string' && r.title.trim()) p.title = r.title.trim().slice(0, 300);
  p.status = p.kind === 'event' ? 'todo' : ((['todo', 'waiting', 'someday', 'inbox'].includes(r.status || '') ? r.status : 'inbox') as Item['status']);
  if (r.projectId && d.projects[r.projectId]) p.projectId = r.projectId;
  if (r.domainId && d.domains[r.domainId]) p.domainId = r.domainId;
  if (p.projectId && !p.domainId) p.domainId = d.projects[p.projectId]?.domainId || null;
  if (p.kind === 'task' && r.context && ctxs.has(r.context)) p.context = r.context;
  // Pas de contexte renvoyé : on le devine d'après le verbe (« Appeler » → @téléphone).
  if (p.kind === 'task' && !p.context && d.settings.showContexts) p.context = guessContext(p.title || '', d.settings);
  const links = mergeLinks(
    Array.isArray(r.links) ? r.links.filter((l) => typeof l?.url === 'string' && /^https:\/\//.test(l.url)).map((l) => ({ label: String(l.label || ''), url: l.url! })) : [],
    [],
  );
  if (links.length) p.links = links.slice(0, 4);
  if (p.kind === 'task' && r.priority && PR[r.priority]) p.priority = r.priority as Item['priority'];
  if (isDate(r.date)) p.date = r.date;
  if (isTime(r.time) && p.date) p.time = r.time;
  const dur = Number(r.duration);
  if (dur > 0 && dur <= 1440) p.duration = Math.round(dur);
  else if (p.kind === 'event' && p.time) p.duration = 60;
  if (r.recurrence && REC[r.recurrence]) {
    p.recurrence = r.recurrence as Item['recurrence'];
    if (!p.date) p.date = todayIso();
    if (r.recurrence === 'weekly' && Array.isArray(r.recurrenceDays)) {
      const days = r.recurrenceDays.map(Number).filter((x) => x >= 0 && x <= 6);
      if (days.length) p.recurrenceDays = Array.from(new Set(days));
    }
    const iv = Number(r.recurrenceInterval);
    if (iv > 1 && iv < 100) p.recurrenceInterval = Math.round(iv);
    if (p.status === 'inbox') p.status = 'todo';
  }
  // Règle des 2 minutes : à faire tout de suite, donc aujourd'hui s'il n'y a pas d'autre date.
  if (p.kind === 'task' && r.quick === true && p.status !== 'waiting' && p.status !== 'someday') {
    p.quick = true;
    if (p.status === 'inbox') p.status = 'todo';
    if (!p.date) p.date = todayIso();
  }
  if (p.status === 'waiting') {
    if (typeof r.waitingFor === 'string') p.waitingFor = r.waitingFor.slice(0, 120);
    p.waitingSince = todayIso();
  }
  return p;
}

type StoreApi = ReturnType<typeof useStore>;
const norm = (x: string) => x.trim().toLowerCase();

/**
 * Exécute les demandes faites à l'appli et comprises par l'IA.
 * Chaque changement garde de quoi revenir en arrière (bouton Annuler de la notification).
 */
function runActions(s: StoreApi, acts: AiAction[]) {
  const undo: (() => void)[] = [];
  const chips: string[] = [];
  let planDate: string | null = null;
  const domainFor = (a: AiAction): string | null | undefined => {
    const d = s.get();
    if (a.domainId && d.domains[a.domainId]) return a.domainId;
    if (typeof a.domainName === 'string' && a.domainName.trim()) {
      const found = Object.values(d.domains).find((x) => norm(x.name) === norm(a.domainName!));
      if (found) return found.id;
      const n = Object.keys(d.domains).length;
      const dom = s.addDomain({ name: a.domainName.trim().slice(0, 60), color: COLORS[n % COLORS.length], position: n });
      undo.push(() => s.removeDomain(dom.id));
      return dom.id;
    }
    return undefined;
  };
  acts.forEach((a) => {
    const d = s.get();
    if (a.type === 'update_project' && a.projectId && d.projects[a.projectId]) {
      const p = d.projects[a.projectId];
      const patch: Partial<Project> = {};
      if (typeof a.name === 'string' && a.name.trim()) patch.name = a.name.trim().slice(0, 120);
      const dom = domainFor(a);
      if (dom !== undefined) patch.domainId = dom;
      if (a.parentId && d.projects[a.parentId] && !familyIds(d, p.id).includes(a.parentId)) patch.parentId = a.parentId;
      if (!Object.keys(patch).length) return;
      const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, p[k as keyof Project] ?? null])) as Partial<Project>;
      s.updateProject(p.id, patch);
      undo.push(() => s.updateProject(p.id, prev));
      const after = s.get().projects[p.id];
      chips.push(`${after.name}${patch.domainId ? ` → ${s.get().domains[patch.domainId]?.name}` : ''}${patch.parentId ? ` → dans ${d.projects[patch.parentId].name}` : ''}`);
      return;
    }
    if (a.type === 'update_item' && a.itemId && d.items[a.itemId]) {
      const it = d.items[a.itemId];
      const patch: Partial<Item> = {};
      if (typeof a.title === 'string' && a.title.trim()) patch.title = a.title.trim().slice(0, 300);
      if (a.date === null || isDate(a.date)) patch.date = a.date;
      if (a.time === null || isTime(a.time)) patch.time = a.time;
      const dur = Number(a.duration);
      if (dur > 0 && dur <= 1440) patch.duration = Math.round(dur);
      if (a.projectId && d.projects[a.projectId]) {
        patch.projectId = a.projectId;
        patch.domainId = d.projects[a.projectId].domainId || it.domainId || null;
      }
      const dom = domainFor(a);
      if (dom !== undefined) patch.domainId = dom;
      if (a.status && ['todo', 'waiting', 'someday', 'doing'].includes(a.status)) patch.status = a.status as Item['status'];
      if (a.kind === 'task' || a.kind === 'event') patch.kind = a.kind;
      if (patch.time && !patch.date && !it.date) patch.date = todayIso();
      if (!Object.keys(patch).length) return;
      const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, it[k as keyof Item] ?? null])) as Partial<Item>;
      s.updateItem(it.id, patch);
      undo.push(() => s.updateItem(it.id, prev));
      const after = s.get().items[it.id];
      chips.push(`${after.title.slice(0, 40)}${after.date ? ` · ${relDate(after.date)}${after.time ? ` ${after.time}` : ''}` : ''}`);
      return;
    }
    if (a.type === 'complete_item' && a.itemId && d.items[a.itemId] && d.items[a.itemId].status !== 'done') {
      const it = d.items[a.itemId];
      s.updateItem(it.id, { status: 'done', doneAt: todayIso() });
      undo.push(() => s.updateItem(it.id, { status: it.status, doneAt: null }));
      chips.push(`Fait : ${it.title.slice(0, 40)}`);
      return;
    }
    if (a.type === 'delete_item' && a.itemId && d.items[a.itemId]) {
      const prev = s.removeItem(a.itemId);
      if (prev) {
        undo.push(() => s.restore('items', prev));
        chips.push(`Corbeille : ${prev.title.slice(0, 40)}`);
      }
      return;
    }
    if (a.type === 'plan_day') {
      planDate = isDate(a.date) ? a.date : todayIso();
      return;
    }
    if (a.type === 'remember' && typeof a.fact === 'string' && a.fact.trim()) {
      const before = s.get().settings.about || '';
      const fact = a.fact.trim().slice(0, 300);
      if (before.toLowerCase().includes(fact.toLowerCase())) return;
      s.setSettings({ about: `${before.trim()}${before.trim() ? '\n' : ''}${fact}`.slice(-3000) });
      undo.push(() => s.setSettings({ about: before }));
      chips.push(`Retenu : ${fact.slice(0, 50)}`);
    }
  });
  return { undo, chips, planDate };
}

/* Éléments de l'inbox déjà proposés à l'IA au chargement, pour ne pas les renvoyer en boucle. */
const AUTO_KEY = 'sc_ai_auto_tried';
const readTried = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(AUTO_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const writeTried = (ids: string[]) => {
  try {
    localStorage.setItem(AUTO_KEY, JSON.stringify(ids.slice(-300)));
  } catch {}
};

export function UIProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
  /* Pour les boutons des notifications créées avant que ces actions soient définies. */
  const toggleDoneRef = useRef<(id: string) => void>(() => {});
  const [ui, setUi] = useState<UI>(() => ({
    view: 'day',
    cal: 'day',
    date: todayIso(),
    projectId: null,
    domainFilter: null,
    calProject: null,
    ctx: 'all',
    drawer: null,
    navOpen: false,
    captureOpen: false,
    capturePreset: null,
    plan: null,
    pending: {},
    justDone: {},
    linking: {},
    dance: null,
    planning: null,
    aiOff: false,
    importSource: null,
  }));
  const [toastState, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = useCallback((p: Partial<UI>) => setUi((u) => ({ ...u, ...p })), []);
  const toast = useCallback((t: Omit<ToastState, 'key'>) => {
    setToast({ ...t, key: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), t.actions?.length ? 6500 : 3000);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const findLinks = useCallback(
    async (id: string, query?: string) => {
      const s = storeRef.current;
      const it = s.get().items[id];
      if (!it) return;
      setUi((u) => ({ ...u, linking: { ...u.linking, [id]: true } }));
      try {
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: it.title, query: query || it.title, city: s.get().settings.city?.trim() || undefined }),
        });
        const body = await res.json().catch(() => ({}));
        const found = Array.isArray(body.links) ? body.links.filter((l: { url?: unknown }) => typeof l?.url === 'string') : [];
        const cur = s.get().items[id];
        if (!cur) return;
        if (!found.length) {
          if (!query) toast({ text: res.ok ? "Pas de lien fiable trouvé. Ajoute-le à la main dans les notes." : "La recherche de liens n'a pas marché. Réessaie plus tard." });
          return;
        }
        // Les liens trouvés sur le web passent avant le plan.
        s.updateItem(id, { links: mergeLinks(found, cur.links).slice(0, 5) });
        toast({ text: `Lien trouvé : ${found[0].label}`, actions: [{ label: 'Ouvrir', run: () => window.open(found[0].url, '_blank', 'noopener') }] });
      } catch {
        /* hors ligne : pas de lien, pas grave */
      } finally {
        setUi((u) => {
          const linking = { ...u.linking };
          delete linking[id];
          return { ...u, linking };
        });
      }
    },
    [toast],
  );
  const findLinksRef = useRef(findLinks);
  findLinksRef.current = findLinks;

  /**
   * Planifie un jour avec l'IA : les tâches à planifier, celles prévues ce jour sans heure et celles en retard
   * sont placées dans les créneaux libres (celles du travail dans la journée de travail), le reste part plus tard.
   */
  const planDay = useCallback(
    async (date: string, opts: { auto?: boolean } = {}) => {
      const s = storeRef.current;
      const d = s.get();
      const t = todayIso();
      const tasks = list(d.items)
        .filter((it) => isOpen(it) && !it.time && (!it.date || it.date === date || (it.date < t && date >= t)))
        .sort(sortItems)
        .slice(0, 40);
      if (!tasks.length) {
        if (!opts.auto) toast({ text: 'Rien à planifier : tout a déjà sa place.' });
        return;
      }
      const st = d.settings;
      const now = new Date();
      const nowMin = Math.ceil((now.getHours() * 60 + now.getMinutes() + 5) / 15) * 15;
      const from = date === t ? Math.max(st.dayStart * 60, nowMin) : st.dayStart * 60;
      if (from >= (st.dayEnd + 1) * 60) {
        if (!opts.auto) toast({ text: "La journée est finie : je planifie demain à la place.", actions: [{ label: 'Planifier demain', run: () => planDayRef.current(addDays(t, 1)) }] });
        return;
      }
      const projName = (id?: string | null) => (id && d.projects[id] ? projectPath(d, d.projects[id]) : null);
      const events = entriesOn(d, date)
        .filter((e) => e.it.time)
        .map((e) => ({ title: e.it.title, time: e.it.time!, duration: e.it.duration || (isEvent(e.it) ? 60 : 30), project: projName(e.it.projectId) }));
      setUi((u) => ({ ...u, planning: date }));
      try {
        const res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            weekday: DAYS[parseIso(date).getDay()],
            from: timeOf(from),
            dayStart: `${pad(st.dayStart)}:00`,
            dayEnd: `${pad(st.dayEnd + 1 > 23 ? 23 : st.dayEnd + 1)}:00`,
            about: st.about || '',
            events,
            tasks: tasks.map((it) => ({
              id: it.id,
              title: it.title,
              project: projName(it.projectId),
              domain: it.domainId ? d.domains[it.domainId]?.name : it.projectId ? d.domains[d.projects[it.projectId]?.domainId || '']?.name : null,
              priority: it.priority || null,
              quick: !!it.quick,
              duration: it.duration || null,
              context: it.context || null,
              overdue: !!(it.date && it.date < t),
              plannedToday: it.date === date,
            })),
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!opts.auto) toast({ text: AI_ERRORS[body.error] || "La planification n'a pas marché. Réessaie dans un moment." });
          return;
        }
        const r = body.result || {};
        const ids = new Set(tasks.map((x) => x.id));
        const prev: [string, Partial<Item>][] = [];
        const lo = st.dayStart * 60;
        const hi = (st.dayEnd + 1) * 60;
        let placed = 0;
        let later = 0;
        (Array.isArray(r.plan) ? r.plan : []).forEach((x: { id?: string; time?: string; duration?: number }) => {
          const it = x?.id && ids.has(x.id) ? s.get().items[x.id] : null;
          if (!it || !isTime(x.time) || minutesOf(x.time) < lo || minutesOf(x.time) >= hi) return;
          const dur = Math.min(600, Math.max(15, Math.round(Number(x.duration) / 15) * 15 || it.duration || 30));
          prev.push([it.id, { date: it.date ?? null, time: it.time ?? null, duration: it.duration ?? null, status: it.status }]);
          s.updateItem(it.id, { date, time: x.time, duration: dur, status: 'todo' });
          ids.delete(it.id);
          placed++;
        });
        (Array.isArray(r.later) ? r.later : []).forEach((x: { id?: string; date?: string }) => {
          const it = x?.id && ids.has(x.id) ? s.get().items[x.id] : null;
          if (!it || !isDate(x.date) || x.date < t) return;
          prev.push([it.id, { date: it.date ?? null, time: it.time ?? null }]);
          s.updateItem(it.id, { date: x.date, time: null });
          later++;
        });
        if (!placed && !later) {
          if (!opts.auto) toast({ text: "Je n'ai trouvé aucun créneau libre ce jour-là." });
          return;
        }
        const label = date === t ? 'ta journée' : date === addDays(t, 1) ? 'ta journée de demain' : `ta journée ${relDate(date).toLowerCase()}`;
        toast({
          text: typeof r.summary === 'string' && r.summary.trim() ? `${opts.auto ? `J'ai préparé ${label}. ` : ''}${r.summary.trim().slice(0, 220)}` : `${placed} tâche${placed > 1 ? 's' : ''} placée${placed > 1 ? 's' : ''} dans ${label}${later ? `, ${later} pour plus tard` : ''}.`,
          actions: [
            { label: 'Voir', run: () => setUi((u) => ({ ...u, view: 'day', cal: 'day', date, drawer: null })) },
            { label: 'Annuler', run: () => prev.forEach(([id, p]) => s.updateItem(id, p)) },
          ],
        });
      } catch {
        if (!opts.auto) toast({ text: 'Pas de connexion : réessaie quand tu es en ligne.' });
      } finally {
        setUi((u) => ({ ...u, planning: null }));
      }
    },
    [toast],
  );
  const planDayRef = useRef(planDay);
  planDayRef.current = planDay;

  const go = useCallback((view: View, extra?: { projectId?: string; domain?: string | null }) => {
    setUi((u) => ({
      ...u,
      view,
      navOpen: false,
      drawer: null,
      plan: null,
      projectId: extra?.projectId ?? u.projectId,
      domainFilter: view === 'projects' ? extra?.domain ?? null : u.domainFilter,
    }));
    try {
      if (!['project', 'onboarding', 'import', 'help'].includes(view)) localStorage.setItem('sc-view', view);
    } catch {
      /* ignore */
    }
    document.querySelector('.work')?.scrollTo({ top: 0 });
  }, []);

  /** Applique la réponse de l'IA : un ou plusieurs éléments, éventuellement des épingles et un nouveau projet. */
  const applyAI = useCallback(
    (placeholderId: string, raw: AiItem[], rawActions: AiAction[] = []) => {
      const s = storeRef.current;
      const d = s.get();
      const results = raw.filter((r) => r && typeof r === 'object').slice(0, 20);
      const acts = rawActions.filter((x) => x && typeof x === 'object').slice(0, 30);
      if (!results.length && !acts.length) {
        toast({ text: "L'IA n'a rien trouvé à ranger : c'est dans l'inbox." });
        return;
      }
      // Les demandes faites à l'appli (« range Vinci dans Travail »…) sont exécutées, avec de quoi annuler.
      const done = runActions(s, acts);
      const created: { coll: 'items' | 'pins' | 'projects'; id: string }[] = [];
      const newProjects: Record<string, string> = {};
      const chips: string[] = [];
      let placeholderUsed = false;
      const lookups: [string, string][] = [];

      results.forEach((r) => {
        if (r.kind === 'pin') {
          const url = typeof r.url === 'string' && r.url.trim() ? r.url.trim() : '';
          const pin = s.addPin({
            url,
            title: (r.title || url || 'Ressource').slice(0, 200),
            note: typeof r.note === 'string' ? r.note.slice(0, 400) : null,
            projectId: r.projectId && d.projects[r.projectId] ? r.projectId : null,
            aiSorted: true,
          });
          created.push({ coll: 'pins', id: pin.id });
          chips.push(`Épinglé : ${pin.title.slice(0, 40)}`);
          return;
        }
        const p = itemFromAi(s.get(), r);
        if (r.newProject && typeof r.newProject.name === 'string' && r.newProject.name.trim() && !p.projectId) {
          const key = r.newProject.name.trim().toLowerCase();
          // Un projet du même nom existe déjà : on s'y rattache au lieu d'en créer un doublon.
          const same = Object.values(s.get().projects).find((x) => x.status !== 'done' && x.name.trim().toLowerCase() === key);
          if (same) newProjects[key] = same.id;
          if (!newProjects[key]) {
            const dom = r.newProject.domainId && d.domains[r.newProject.domainId] ? r.newProject.domainId : p.domainId || null;
            const np = s.addProject({
              name: r.newProject.name.trim().slice(0, 120),
              outcome: r.newProject.outcome?.slice(0, 300) || null,
              domainId: dom,
              color: freeColor(s.get()),
              aiSorted: true,
            });
            newProjects[key] = np.id;
            created.push({ coll: 'projects', id: np.id });
            chips.push(`Nouveau projet : ${np.name}`);
          }
          p.projectId = newProjects[key];
          if (!p.domainId) p.domainId = s.get().projects[p.projectId]?.domainId || null;
          if (p.status === 'inbox') p.status = 'todo';
        }
        let id: string;
        if (!placeholderUsed) {
          placeholderUsed = true;
          const ph = s.get().items[placeholderId];
          // Capturé depuis un créneau de l'agenda : on garde ce créneau si l'IA n'en donne pas.
          if (ph?.date && !p.date) {
            if (p.status === 'inbox') p.status = 'todo';
            if (ph.time && !p.duration) p.duration = p.kind === 'event' ? 60 : 30;
          }
          s.updateItem(placeholderId, p);
          id = placeholderId;
        } else {
          const raw0 = s.get().items[placeholderId]?.raw || null;
          id = s.addItem({ ...p, raw: raw0, title: p.title || 'Sans titre' }).id;
          created.push({ coll: 'items', id });
        }
        if (typeof r.lookup === 'string' && r.lookup.trim() && lookups.length < 3) lookups.push([id, r.lookup.trim()]);
        const it = s.get().items[id];
        const proj = it?.projectId ? s.get().projects[it.projectId]?.name : null;
        const when = it?.date ? `${relDate(it.date)}${it.time ? ` ${it.time}` : ''}` : '';
        chips.push([it?.kind === 'event' ? 'Événement' : ST[it?.status || 'todo'], proj, when, it?.recurrence ? recLabel(it) : ''].filter(Boolean).join(' · '));
      });
      // Liens pour agir : cherchés sur le web en arrière-plan, ils s'ajoutent à la carte quand ils arrivent.
      lookups.forEach(([lid, q]) => void findLinksRef.current(lid, q));
      // Si l'IA n'a renvoyé que des épingles, l'élément de départ n'a plus de raison d'être.
      if (!placeholderUsed) s.removeItem(placeholderId, { forget: true });

      const n = results.length;
      chips.unshift(...done.chips);
      const quickId = [placeholderId, ...created.filter((c) => c.coll === 'items').map((c) => c.id)].find((x) => s.get().items[x]?.quick);
      toast({
        text: quickId
          ? `${n > 1 ? `${n} éléments rangés. ` : ''}Moins de 2 min : fais-le maintenant.`
          : !n
            ? done.chips.length
              ? "C'est fait"
              : done.planDate
                ? 'Je planifie ta journée…'
                : "Je n'ai pas trouvé quoi modifier : précise le nom du projet ou de l'élément."
            : n > 1
              ? `${n} éléments rangés`
              : 'Rangé',
        chips: chips.slice(0, 5),
        actions: [
          ...(quickId ? [{ label: "C'est fait", run: () => toggleDoneRef.current(quickId) }] : []),
          ...(placeholderUsed && !quickId ? [{ label: 'Voir', run: () => setUi((u) => ({ ...u, drawer: { type: 'item', id: placeholderId } })) }] : []),
          {
            label: 'Annuler',
            run: () => {
              done.undo.reverse().forEach((f) => f());
              created.forEach((c) => (c.coll === 'items' ? s.removeItem(c.id, { forget: true }) : c.coll === 'pins' ? s.removePin(c.id, { forget: true }) : s.removeProject(c.id)));
              if (placeholderUsed) {
                const raw0 = s.get().items[placeholderId]?.raw;
                s.updateItem(placeholderId, { status: 'inbox', kind: 'task', title: raw0 || s.get().items[placeholderId]?.title, projectId: null, domainId: null, context: null, links: null, quick: false, date: null, time: null, duration: null, recurrence: null, recurrenceDays: null, recurrenceInterval: null, aiSorted: false });
              }
            },
          },
        ],
      });
      if (done.planDate) void planDayRef.current(done.planDate);
    },
    [toast],
  );

  const aiSort = useCallback(
    async (id: string) => {
      const s = storeRef.current;
      const it = s.get().items[id];
      if (!it) return;
      setUi((u) => ({ ...u, pending: { ...u.pending, [id]: true } }));
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: it.raw || it.title, ctx: aiContext(s.get()) }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (body.error === 'ai_not_configured') setUi((u) => ({ ...u, aiOff: true }));
          // Le code entre parenthèses aide à comprendre ce qui coince (crédits, clé, réponse illisible…).
          const code = [body.error || res.status, typeof body.detail === 'string' ? body.detail.slice(0, 90) : ''].filter(Boolean).join(' : ');
          toast({
            text: AI_ERRORS[body.error] || `L'IA n'a pas pu ranger cet élément, il reste dans l'inbox (${code}).`,
            actions: [{ label: 'Réessayer', run: () => aiSortRef.current(id) }],
          });
          return;
        }
        setUi((u) => (u.aiOff ? { ...u, aiOff: false } : u));
        const result = body.result || {};
        const arr: AiItem[] = Array.isArray(result.items) ? result.items : Array.isArray(result) ? result : [result];
        if (storeRef.current.get().items[id]) applyAI(id, arr.filter((x) => x && (x.title || x.kind)), Array.isArray(result.actions) ? result.actions : []);
      } catch {
        toast({ text: "Pas de connexion : c'est dans l'inbox." });
      } finally {
        setUi((u) => {
          const pending = { ...u.pending };
          delete pending[id];
          return { ...u, pending };
        });
      }
    },
    [applyAI, toast],
  );

  const fileWithAi = useCallback(
    async (id: string) => {
      const s = storeRef.current;
      const it = s.get().items[id];
      if (!it) return;
      try {
        const res = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: it.title, ctx: aiContext(s.get()) }),
        });
        if (!res.ok) return; // l'élément est déjà créé : pas de projet, ce n'est pas grave
        const body = await res.json().catch(() => ({}));
        const result = body.result || {};
        const r: AiItem | undefined = (Array.isArray(result.items) ? result.items : [result])[0];
        const cur = s.get().items[id];
        if (!r || !cur) return;
        const p = itemFromAi(s.get(), r);
        // Créé à la main : on garde titre, date et heure, on complète le contexte @ et les liens.
        const extra: Partial<Item> = {};
        if ((cur.kind || 'task') === 'task' && !cur.context && p.context) extra.context = p.context;
        if (p.links?.length && !cur.links?.length) extra.links = p.links;
        if (Object.keys(extra).length) s.updateItem(id, extra);
        if (typeof r.lookup === 'string' && r.lookup.trim()) void findLinksRef.current(id, r.lookup.trim());
        if (cur.projectId) return;
        let projectId = p.projectId || null;
        let created = '';
        const np = r.newProject;
        if (!projectId && np && typeof np.name === 'string' && np.name.trim()) {
          const key = np.name.trim().toLowerCase();
          const same = Object.values(s.get().projects).find((x) => x.status !== 'done' && x.name.trim().toLowerCase() === key);
          if (same) projectId = same.id;
          else {
            const dom = np.domainId && s.get().domains[np.domainId] ? np.domainId : p.domainId || null;
            const pr = s.addProject({ name: np.name.trim().slice(0, 120), outcome: np.outcome?.slice(0, 300) || null, domainId: dom, color: freeColor(s.get()), aiSorted: true });
            projectId = pr.id;
            created = pr.name;
          }
        }
        const domainId = p.domainId || (projectId ? s.get().projects[projectId]?.domainId : null) || cur.domainId || null;
        if (!projectId && !domainId) return;
        s.updateItem(id, { projectId, domainId });
        const name = projectId ? s.get().projects[projectId]?.name : null;
        if (name) toast({ text: created ? `Nouveau projet : ${name}` : `Rangé dans ${name}` });
      } catch {
        /* hors ligne : l'élément reste tel quel */
      }
    },
    [toast],
  );

  // Le thème choisi (clair, sombre, comme l'appareil) suit le compte, une fois les réglages chargés.
  const theme = store.data.settings.theme;
  useEffect(() => {
    if (store.ready) applyTheme(theme);
  }, [store.ready, theme]);

  /**
   * À l'ouverture : ce qui attend dans l'inbox sans être passé par l'IA (capturé avant que l'IA soit branchée,
   * ou quand elle a échoué) est rangé automatiquement, une seule tentative par élément.
   */
  const autoRan = useRef(false);
  useEffect(() => {
    if (!store.ready || autoRan.current) return;
    autoRan.current = true;
    const tried = readTried();
    const waiting = Object.values(storeRef.current.get().items)
      .filter((i) => i.status === 'inbox' && !i.aiSorted && !tried.includes(i.id))
      .slice(0, 10);
    if (!waiting.length) return;
    fetch('/api/connect/status')
      .then((r) => (r.ok ? r.json() : {}))
      .then(async (s: { ai?: boolean }) => {
        if (!s.ai) return;
        for (const it of waiting) {
          tried.push(it.id);
          writeTried(tried);
          await aiSort(it.id);
        }
      })
      .catch(() => {});
  }, [store.ready, aiSort]);

  /*
   * Une fois par jour, l'appli prépare la journée : le soir (dès 17 h) celle du lendemain,
   * sinon celle du jour si elle n'a pas encore été préparée.
   */
  const prepRan = useRef(false);
  useEffect(() => {
    if (!store.ready || prepRan.current) return;
    prepRan.current = true;
    const st = storeRef.current.get().settings;
    if (st.autoPlan === false || storeRef.current.mode !== 'db') return;
    const target = new Date().getHours() >= 17 ? addDays(todayIso(), 1) : todayIso();
    if (st.lastPrepared && st.lastPrepared >= target) return;
    const timer = setTimeout(() => {
      fetch('/api/connect/status')
        .then((r) => (r.ok ? r.json() : {}))
        .then((x: { ai?: boolean }) => {
          if (!x.ai) return;
          storeRef.current.setSettings({ lastPrepared: target });
          void planDayRef.current(target, { auto: true });
        })
        .catch(() => {});
    }, 4000);
    return () => clearTimeout(timer);
  }, [store.ready]);

  const aiSortRef = useRef(aiSort);
  aiSortRef.current = aiSort;

  const capture = useCallback(
    async (text: string, extra?: Partial<Item>) => {
      const t = text.trim();
      if (!t) return;
      const it = storeRef.current.addItem({ title: t, raw: t, status: 'inbox', ...(extra || {}) });
      // On tente toujours l'IA : si la clé a été ajoutée depuis l'ouverture de l'onglet, ça repart tout seul.
      await aiSort(it.id);
    },
    [aiSort],
  );

  const deleteProject = useCallback(
    (id: string) => {
      const s = storeRef.current;
      const d = s.get();
      const p = d.projects[id];
      if (!p) return;
      const items = list(d.items).filter((i) => i.projectId === id).map((i) => i.id);
      const kids = list(d.projects).filter((x) => x.parentId === id).map((x) => x.id);
      const pins = list(d.pins).filter((x) => x.projectId === id).map((x) => x.id);
      s.removeProject(id);
      kids.forEach((k) => s.updateProject(k, { parentId: null }));
      pins.forEach((k) => s.updatePin(k, { projectId: null }));
      setUi((u) => ({ ...u, drawer: null, view: u.view === 'project' && u.projectId === id ? 'projects' : u.view }));
      toast({
        text: `Projet « ${p.name} » supprimé.${items.length ? ` Ses ${items.length} action${items.length > 1 ? 's restent' : ' reste'}, sans projet.` : ''}`,
        actions: [
          {
            label: 'Annuler',
            run: () => {
              s.restore('projects', p);
              items.forEach((i) => s.get().items[i] && s.updateItem(i, { projectId: id }));
              kids.forEach((k) => s.get().projects[k] && s.updateProject(k, { parentId: id }));
              pins.forEach((k) => s.get().pins[k] && s.updatePin(k, { projectId: id }));
            },
          },
        ],
      });
    },
    [toast],
  );

  const moveProject = useCallback(
    (id: string, domainId: string | null) => {
      const s = storeRef.current;
      const d = s.get();
      const p = d.projects[id];
      if (!p || (p.domainId || null) === domainId) return;
      const family = familyIds(d, id);
      const before = family.map((k) => [k, d.projects[k]?.domainId ?? null, d.projects[k]?.parentId ?? null] as const);
      const old = p.domainId || null;
      // Les actions qui suivaient le domaine de l'ancien projet suivent le nouveau.
      const items = list(d.items).filter((i) => i.projectId && family.includes(i.projectId) && (i.domainId || null) === old).map((i) => i.id);
      family.forEach((k) => s.updateProject(k, { domainId }));
      const parent = p.parentId ? d.projects[p.parentId] : null;
      if (parent && (parent.domainId || null) !== domainId) s.updateProject(id, { parentId: null });
      items.forEach((i) => s.updateItem(i, { domainId }));
      toast({
        text: `${p.name} → ${domainId ? d.domains[domainId]?.name : 'Sans domaine'}`,
        actions: [
          {
            label: 'Annuler',
            run: () => {
              before.forEach(([k, dom, par]) => s.updateProject(k, { domainId: dom, parentId: par }));
              items.forEach((i) => s.updateItem(i, { domainId: old }));
            },
          },
        ],
      });
    },
    [toast],
  );

  const removeItem = useCallback(
    (id: string) => {
      const prev = storeRef.current.removeItem(id);
      setUi((u) => ({ ...u, drawer: null }));
      if (prev) toast({ text: 'Mis à la corbeille', actions: [{ label: 'Annuler', run: () => storeRef.current.restore('items', prev) }] });
    },
    [toast],
  );

  const toggleDone = useCallback(
    (id: string) => {
      const s = storeRef.current;
      const it = s.get().items[id];
      if (!it) return;
      if (it.status === 'done') {
        s.updateItem(id, { status: 'todo', doneAt: null });
        return;
      }
      const prev = { ...it };
      s.updateItem(id, { status: 'done', doneAt: todayIso() });
      setUi((u) => ({ ...u, justDone: { ...u.justDone, [id]: true } }));
      setTimeout(() => setUi((u) => {
        const justDone = { ...u.justDone };
        delete justDone[id];
        return { ...u, justDone };
      }), 1200);
      try {
        navigator.vibrate?.(12); // petit retour sur téléphone
      } catch {}
      let nextId: string | null = null;
      let extra = '';
      if (it.recurrence) {
        const rule = { freq: it.recurrence, days: it.recurrenceDays, interval: it.recurrenceInterval };
        const base = it.date || todayIso();
        let nd = nextOccurrence(base, rule);
        while (nd < todayIso()) nd = nextOccurrence(nd, rule, base);
        const { id: _omit, createdAt: _c, ...rest } = it;
        void _omit;
        void _c;
        const clone = s.addItem({ ...rest, status: 'todo', date: nd, doneAt: null, aiSorted: false });
        nextId = clone.id;
        extra = ` · prochaine : ${relDate(nd)}`;
      }
      // Un nuage danse ; si c'était la dernière action du projet, c'est la fête.
      const d = s.get();
      const pr = it.projectId ? d.projects[it.projectId] : null;
      const showM = d.settings.showMascots !== false;
      const st = pr ? projectStats(d, pr.id) : null;
      const finished = !!(pr && st && st.total > 0 && !st.open.length && it.kind !== 'event');
      const domName = (pr?.domainId ? d.domains[pr.domainId]?.name : null) || (it.domainId ? d.domains[it.domainId]?.name : null);
      if (finished || showM) {
        const key = Date.now();
        setUi((u) => ({
          ...u,
          dance: finished
            ? { key, big: true, src: showM ? '/mascots/anniversaire.webp' : null, text: `${pr!.name} : tout est fait !` }
            : { key, big: false, src: mascotFor(it.title, domName)?.src || '/mascots/idee.webp' },
        }));
        setTimeout(() => setUi((u) => (u.dance?.key === key ? { ...u, dance: null } : u)), finished ? 2700 : 1400);
      }
      if (finished) {
        toast({
          text: `Toutes les actions de ${pr!.name} sont faites`,
          actions: [
            { label: 'Terminer le projet', run: () => s.updateProject(pr!.id, { status: 'done' }) },
            { label: 'Annuler', run: () => s.updateItem(id, { status: prev.status, doneAt: null }) },
          ],
        });
        return;
      }
      toast({
        text: `${it.kind === 'event' ? 'Terminé' : 'Fait'}${extra}`,
        actions: [
          {
            label: 'Annuler',
            run: () => {
              s.updateItem(id, { status: prev.status, doneAt: null });
              if (nextId) s.removeItem(nextId, { forget: true });
            },
          },
        ],
      });
    },
    [toast],
  );
  toggleDoneRef.current = toggleDone;

  const schedule = useCallback(
    (id: string, date: string | null, time?: string | null) => {
      const s = storeRef.current;
      const it = s.get().items[id];
      if (!it) return;
      const p: Partial<Item> = { date, time: date ? (time === undefined ? it.time ?? null : time) : null };
      if (date && (it.status === 'inbox' || it.status === 'someday')) p.status = 'todo';
      if (p.time && !it.duration) p.duration = it.kind === 'event' ? 60 : 30;
      s.updateItem(id, p);
      setUi((u) => ({ ...u, plan: null }));
      toast({ text: date ? `Planifié : ${relDate(date)}${p.time ? ` à ${p.time}` : ''}` : 'Retiré du calendrier' });
    },
    [toast],
  );

  const api = useMemo<UIApi>(
    () => ({
      ui,
      set,
      go,
      openDrawer: (d) => setUi((u) => ({ ...u, drawer: d, plan: null, navOpen: false })),
      closeDrawer: () => setUi((u) => ({ ...u, drawer: null })),
      toast,
      toastState,
      dismissToast,
      capture,
      aiSort,
      fileWithAi,
      planDay,
      findLinks,
      toggleDone,
      schedule,
      removeItem,
      deleteProject,
      moveProject,
    }),
    [ui, set, go, toast, toastState, dismissToast, capture, aiSort, fileWithAi, planDay, findLinks, toggleDone, schedule, removeItem, deleteProject, moveProject],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
