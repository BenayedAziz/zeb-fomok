'use client';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { AiItem, Data, Item } from '@/lib/types';
import { PR, REC, ST, contextsOf, domainsSorted, freeColor, projectsSorted, recLabel } from '@/lib/gtd';
import { isDate, isTime, nextOccurrence, relDate, todayIso } from '@/lib/dates';

export type View =
  | 'day' | 'inbox' | 'next' | 'waiting' | 'someday' | 'projects' | 'project' | 'pins'
  | 'goals' | 'review' | 'journal' | 'import' | 'settings' | 'help' | 'onboarding';
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
  toggleDone: (id: string) => void;
  schedule: (id: string, date: string | null, time?: string | null) => void;
  removeItem: (id: string) => void;
}

const Ctx = createContext<UIApi | null>(null);
export const useUI = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('UIProvider manquant');
  return v;
};

export function aiContext(d: Data) {
  return {
    today: todayIso(),
    contexts: contextsOf(d.settings).map(([k]) => k),
    domains: domainsSorted(d).map((x) => ({ id: x.id, name: x.name })),
    projects: projectsSorted(d)
      .filter((p) => p.status !== 'done')
      .map((p) => ({ id: p.id, name: p.name, domain: p.domainId ? d.domains[p.domainId]?.name : undefined, outcome: p.outcome || undefined })),
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
  if (p.status === 'waiting') {
    if (typeof r.waitingFor === 'string') p.waitingFor = r.waitingFor.slice(0, 120);
    p.waitingSince = todayIso();
  }
  return p;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;
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
    (placeholderId: string, raw: AiItem[]) => {
      const s = storeRef.current;
      const d = s.get();
      const results = raw.filter((r) => r && typeof r === 'object').slice(0, 20);
      if (!results.length) {
        toast({ text: "L'IA n'a rien trouvé à ranger : c'est dans l'inbox." });
        return;
      }
      const created: { coll: 'items' | 'pins' | 'projects'; id: string }[] = [];
      const newProjects: Record<string, string> = {};
      const chips: string[] = [];
      let placeholderUsed = false;

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
        const it = s.get().items[id];
        const proj = it?.projectId ? s.get().projects[it.projectId]?.name : null;
        const when = it?.date ? `${relDate(it.date)}${it.time ? ` ${it.time}` : ''}` : '';
        chips.push([it?.kind === 'event' ? 'Événement' : ST[it?.status || 'todo'], proj, when, it?.recurrence ? recLabel(it) : ''].filter(Boolean).join(' · '));
      });
      // Si l'IA n'a renvoyé que des épingles, l'élément de départ n'a plus de raison d'être.
      if (!placeholderUsed) s.removeItem(placeholderId);

      const n = results.length;
      toast({
        text: n > 1 ? `${n} éléments rangés` : 'Rangé',
        chips: chips.slice(0, 5),
        actions: [
          ...(placeholderUsed ? [{ label: 'Voir', run: () => setUi((u) => ({ ...u, drawer: { type: 'item', id: placeholderId } })) }] : []),
          {
            label: 'Annuler',
            run: () => {
              created.forEach((c) => (c.coll === 'items' ? s.removeItem(c.id) : c.coll === 'pins' ? s.removePin(c.id) : s.removeProject(c.id)));
              if (placeholderUsed) {
                const raw0 = s.get().items[placeholderId]?.raw;
                s.updateItem(placeholderId, { status: 'inbox', kind: 'task', title: raw0 || s.get().items[placeholderId]?.title, projectId: null, date: null, time: null, duration: null, recurrence: null, recurrenceDays: null, recurrenceInterval: null, aiSorted: false });
              }
            },
          },
        ],
      });
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
          toast({ text: AI_ERRORS[body.error] || "L'IA n'a pas pu ranger cet élément : il reste dans l'inbox." });
          return;
        }
        const result = body.result || {};
        const arr: AiItem[] = Array.isArray(result.items) ? result.items : Array.isArray(result) ? result : [result];
        if (storeRef.current.get().items[id]) applyAI(id, arr);
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

  const capture = useCallback(
    async (text: string, extra?: Partial<Item>) => {
      const t = text.trim();
      if (!t) return;
      const it = storeRef.current.addItem({ title: t, raw: t, status: 'inbox', ...(extra || {}) });
      if (ui.aiOff) {
        toast({ text: "Ajouté à l'inbox", actions: [{ label: 'Voir', run: () => setUi((u) => ({ ...u, drawer: { type: 'item', id: it.id } })) }] });
        return;
      }
      await aiSort(it.id);
    },
    [aiSort, toast, ui.aiOff],
  );

  const removeItem = useCallback(
    (id: string) => {
      const prev = storeRef.current.removeItem(id);
      setUi((u) => ({ ...u, drawer: null }));
      if (prev) toast({ text: 'Élément supprimé', actions: [{ label: 'Annuler', run: () => storeRef.current.restore('items', prev) }] });
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
      toast({
        text: `Fait${extra}`,
        actions: [
          {
            label: 'Annuler',
            run: () => {
              s.updateItem(id, { status: prev.status, doneAt: null });
              if (nextId) s.removeItem(nextId);
            },
          },
        ],
      });
    },
    [toast],
  );

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
      toggleDone,
      schedule,
      removeItem,
    }),
    [ui, set, go, toast, toastState, dismissToast, capture, aiSort, toggleDone, schedule, removeItem],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
