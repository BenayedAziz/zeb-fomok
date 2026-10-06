'use client';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { AiResult, Data, Item } from '@/lib/types';
import { CTX, PR, REC, ST, projectsSorted, domainsSorted } from '@/lib/gtd';
import { isDate, isTime, nextOccurrence, relDate, todayIso } from '@/lib/dates';

export type View =
  | 'day' | 'inbox' | 'next' | 'waiting' | 'someday' | 'projects' | 'project'
  | 'goals' | 'review' | 'journal' | 'import' | 'onboarding';
export type CalMode = 'day' | 'week' | 'month';
export type DrawerState =
  | { type: 'item'; id: string }
  | { type: 'project'; id: string | null; draft?: Record<string, string> }
  | { type: 'goal'; id: string }
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
  ctx: string;
  drawer: DrawerState | null;
  navOpen: boolean;
  captureOpen: boolean;
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
  capture: (text: string) => Promise<void>;
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
    ctx: 'all',
    drawer: null,
    navOpen: false,
    captureOpen: false,
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
    timer.current = setTimeout(() => setToast(null), t.actions?.length ? 6000 : 3000);
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
      if (!['project', 'onboarding', 'import'].includes(view)) localStorage.setItem('sc-view', view);
    } catch {
      /* ignore */
    }
    document.querySelector('.work')?.scrollTo({ top: 0 });
  }, []);

  const applyAI = useCallback(
    (id: string, r: AiResult) => {
      const s = storeRef.current;
      const d = s.get();
      const p: Partial<Item> = { aiSorted: true, aiReason: typeof r.reason === 'string' ? r.reason.slice(0, 300) : '' };
      if (typeof r.title === 'string' && r.title.trim()) p.title = r.title.trim().slice(0, 300);
      p.status = (['todo', 'waiting', 'someday', 'inbox'].includes(r.status || '') ? r.status : 'inbox') as Item['status'];
      if (r.projectId && d.projects[r.projectId]) p.projectId = r.projectId;
      if (r.domainId && d.domains[r.domainId]) p.domainId = r.domainId;
      if (r.context && CTX[r.context]) p.context = r.context;
      if (r.priority && PR[r.priority]) p.priority = r.priority as Item['priority'];
      if (isDate(r.date)) p.date = r.date;
      if (isTime(r.time) && p.date) p.time = r.time;
      if (r.recurrence && REC[r.recurrence]) {
        p.recurrence = r.recurrence as Item['recurrence'];
        if (!p.date) p.date = todayIso();
      }
      if (p.status === 'waiting') {
        if (typeof r.waitingFor === 'string') p.waitingFor = r.waitingFor.slice(0, 120);
        p.waitingSince = todayIso();
      }
      let newProject: string | null = null;
      if (r.newProject && typeof r.newProject.name === 'string' && r.newProject.name.trim() && !p.projectId) {
        const dom = r.newProject.domainId && d.domains[r.newProject.domainId] ? r.newProject.domainId : p.domainId || null;
        const np = s.addProject({ name: r.newProject.name.trim().slice(0, 120), outcome: r.newProject.outcome?.slice(0, 300) || null, domainId: dom, aiSorted: true });
        p.projectId = np.id;
        newProject = np.name;
        if (p.status === 'inbox') p.status = 'todo';
      }
      s.updateItem(id, p);
      const chips = [ST[p.status!] || 'Inbox'];
      const proj = p.projectId ? newProject || d.projects[p.projectId]?.name : null;
      if (proj) chips.push(newProject ? `Nouveau projet : ${proj}` : proj);
      if (p.date) chips.push(relDate(p.date) + (p.time ? ` ${p.time}` : ''));
      if (p.recurrence) chips.push(REC[p.recurrence]);
      toast({
        text: 'Rangé',
        chips,
        actions: [
          { label: 'Voir', run: () => setUi((u) => ({ ...u, drawer: { type: 'item', id } })) },
          { label: 'Annuler', run: () => s.updateItem(id, { status: 'inbox', projectId: null, date: null, time: null, recurrence: null, aiSorted: false }) },
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
        if (storeRef.current.get().items[id]) applyAI(id, body.result || {});
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
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      const it = storeRef.current.addItem({ title: t, raw: t, status: 'inbox' });
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
        const base = it.date || todayIso();
        let nd = nextOccurrence(base, it.recurrence);
        while (nd < todayIso()) nd = nextOccurrence(nd, it.recurrence);
        const clone = s.addItem({ ...it, id: undefined as unknown as string, status: 'todo', date: nd, doneAt: null, aiSorted: false });
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
