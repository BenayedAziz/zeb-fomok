'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Data, Domain, Goal, Item, Pin, Project, Review, Settings } from './types';
import { DEFAULT_SETTINGS } from './gtd';
import { getBrowserSupabase } from './supabase/client';

type Coll = 'items' | 'projects' | 'domains' | 'goals' | 'pins';
const TABLE: Record<Coll, string> = { items: 'items', projects: 'projects', domains: 'domains', goals: 'goals', pins: 'pins' };
const LS_KEY = 'second-cerveau-demo-v1';

const empty = (): Data => ({ items: {}, projects: {}, domains: {}, goals: {}, pins: {}, review: { last: null, checks: {} }, settings: { ...DEFAULT_SETTINGS } });

/* camelCase <-> snake_case pour les colonnes Postgres */
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
function toDb(o: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}
function fromDb<T>(o: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (k !== 'user_id') out[toCamel(k)] = v;
  return out as T;
}
const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
const nowIso = () => new Date().toISOString();

export interface Bulk {
  domains?: Partial<Domain>[];
  goals?: Partial<Goal>[];
  projects?: Partial<Project>[];
  items?: Partial<Item>[];
  pins?: Partial<Pin>[];
}

export interface Store {
  data: Data;
  ready: boolean;
  mode: 'db' | 'demo';
  email: string | null;
  error: string | null;
  /** Données à jour, y compris les écritures pas encore affichées. */
  get: () => Data;
  addItem: (p: Partial<Item>) => Item;
  updateItem: (id: string, p: Partial<Item>) => void;
  removeItem: (id: string) => Item | null;
  addProject: (p: Partial<Project>) => Project;
  updateProject: (id: string, p: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addDomain: (p: Partial<Domain>) => Domain;
  updateDomain: (id: string, p: Partial<Domain>) => void;
  removeDomain: (id: string) => void;
  addGoal: (p: Partial<Goal>) => Goal;
  updateGoal: (id: string, p: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addPin: (p: Partial<Pin>) => Pin;
  updatePin: (id: string, p: Partial<Pin>) => void;
  removePin: (id: string) => Pin | null;
  restore: (coll: Coll, row: Item | Project | Domain | Goal | Pin) => void;
  setReview: (r: Review) => void;
  setSettings: (p: Partial<Settings>) => void;
  bulk: (b: Bulk) => void;
  signOut: () => Promise<void>;
  onError: (fn: (msg: string) => void) => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider manquant');
  return s;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = getBrowserSupabase();
  const mode: 'db' | 'demo' = supabase ? 'db' : 'demo';
  const [data, setData] = useState<Data>(empty);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const errFn = useRef<(m: string) => void>(() => {});

  /* ---------- chargement ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const saved = JSON.parse(raw);
            setData({ ...empty(), ...saved, settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) } });
          }
        } catch {
          /* stockage indisponible : on part de zéro */
        }
        setReady(true);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? null);
      const [it, pr, dm, gl, rv, pn, st] = await Promise.all([
        supabase.from('items').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('domains').select('*'),
        supabase.from('goals').select('*'),
        supabase.from('reviews').select('*').maybeSingle(),
        supabase.from('pins').select('*'),
        supabase.from('settings').select('*').maybeSingle(),
      ]);
      if (cancelled) return;
      const firstErr = it.error || pr.error || dm.error || gl.error;
      if (firstErr) setError(firstErr.message);
      const map = <T extends { id: string }>(rows: Record<string, unknown>[] | null) =>
        Object.fromEntries((rows || []).map((r) => {
          const o = fromDb<T>(r);
          return [o.id, o];
        }));
      setData({
        items: map<Item>(it.data),
        projects: map<Project>(pr.data),
        domains: map<Domain>(dm.data),
        goals: map<Goal>(gl.data),
        pins: map<Pin>(pn.data),
        settings: { ...DEFAULT_SETTINGS, ...((st.data?.data as Partial<Settings>) || {}) },
        review: rv.data ? { last: rv.data.last, checks: rv.data.checks || {} } : { last: null, checks: {} },
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  /* ---------- sauvegarde mode démo ---------- */
  useEffect(() => {
    if (mode !== 'demo' || !ready) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data, mode, ready]);

  /* ---------- écriture distante : une seule file, dans l'ordre (les clés étrangères restent valides) ---------- */
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const remote = useCallback(
    (op: () => PromiseLike<{ error: { message: string } | null }>) => {
      if (!supabase) return;
      const run = async () => {
        try {
          const { error: e } = await op();
          if (e) errFn.current(e.message.includes('row-level security') ? 'Modification refusée.' : 'Modification non enregistrée. Vérifie ta connexion.');
        } catch {
          errFn.current('Modification non enregistrée. Vérifie ta connexion.');
        }
      };
      queue.current = queue.current.then(run, run);
    },
    [supabase],
  );

  const put = useCallback(
    <T extends { id: string }>(coll: Coll, row: T, isNew: boolean) => {
      setData((d) => ({ ...d, [coll]: { ...d[coll], [row.id]: row } }));
      remote(() =>
        isNew
          ? supabase!.from(TABLE[coll]).insert(toDb(row as unknown as Record<string, unknown>))
          : supabase!.from(TABLE[coll]).update(toDb(row as unknown as Record<string, unknown>)).eq('id', row.id),
      );
    },
    [remote, supabase],
  );

  const del = useCallback(
    (coll: Coll, id: string) => {
      setData((d) => {
        const next = { ...d[coll] };
        delete next[id];
        return { ...d, [coll]: next };
      });
      remote(() => supabase!.from(TABLE[coll]).delete().eq('id', id));
    },
    [remote, supabase],
  );

  const store = useMemo<Store>(() => {
    const patchRow = <T extends { id: string }>(coll: Coll, id: string, p: Partial<T>) => {
      const cur = (dataRef.current[coll] as unknown as Record<string, T>)[id];
      if (!cur) return;
      const row = { ...cur, ...p, updatedAt: nowIso() } as T;
      if (coll === 'domains' || coll === 'goals' || coll === 'pins') delete (row as Record<string, unknown>).updatedAt;
      dataRef.current = { ...dataRef.current, [coll]: { ...dataRef.current[coll], [id]: row } };
      put(coll, row, false);
    };
    const insertRow = <T extends { id: string }>(coll: Coll, row: T) => {
      dataRef.current = { ...dataRef.current, [coll]: { ...dataRef.current[coll], [row.id]: row } };
      put(coll, row, true);
      return row;
    };
    return {
      data,
      ready,
      mode,
      email,
      error,
      get: () => dataRef.current,
      addItem: (p) => insertRow<Item>('items', { status: 'inbox', title: '', ...p, id: p.id || uuid(), createdAt: nowIso() } as Item),
      updateItem: (id, p) => patchRow<Item>('items', id, p),
      removeItem: (id) => {
        const prev = dataRef.current.items[id] || null;
        del('items', id);
        return prev;
      },
      addProject: (p) => insertRow<Project>('projects', { status: 'active', links: [], name: '', ...p, id: p.id || uuid(), createdAt: nowIso() } as Project),
      updateProject: (id, p) => patchRow<Project>('projects', id, p),
      removeProject: (id) => {
        Object.values(dataRef.current.items)
          .filter((i) => i.projectId === id)
          .forEach((i) => setData((d) => ({ ...d, items: { ...d.items, [i.id]: { ...i, projectId: null } } })));
        del('projects', id); // la base remet project_id à null toute seule
      },
      addDomain: (p) =>
        insertRow<Domain>('domains', { color: 'c1', name: '', ...p, position: p.position ?? Object.keys(dataRef.current.domains).length, id: p.id || uuid() } as Domain),
      updateDomain: (id, p) => patchRow<Domain>('domains', id, p),
      removeDomain: (id) => {
        Object.values(dataRef.current.projects)
          .filter((x) => x.domainId === id)
          .forEach((x) => setData((d) => ({ ...d, projects: { ...d.projects, [x.id]: { ...x, domainId: null } } })));
        del('domains', id);
      },
      addGoal: (p) => insertRow<Goal>('goals', { horizon: 'year', title: '', ...p, id: p.id || uuid(), createdAt: nowIso() } as Goal),
      updateGoal: (id, p) => patchRow<Goal>('goals', id, p),
      removeGoal: (id) => del('goals', id),
      addPin: (p) => insertRow<Pin>('pins', { title: p.title || p.url || '', url: '', ...p, id: p.id || uuid(), createdAt: nowIso() } as Pin),
      updatePin: (id, p) => patchRow<Pin>('pins', id, p),
      removePin: (id) => {
        const prev = dataRef.current.pins[id] || null;
        del('pins', id);
        return prev;
      },
      restore: (coll, row) => put(coll, row as { id: string }, true),
      setSettings: (p) => {
        const next = { ...dataRef.current.settings, ...p };
        dataRef.current = { ...dataRef.current, settings: next };
        setData((d) => ({ ...d, settings: next }));
        remote(() => supabase!.from('settings').upsert({ data: next }, { onConflict: 'user_id' }));
      },
      setReview: (r) => {
        setData((d) => ({ ...d, review: r }));
        remote(() => supabase!.from('reviews').upsert({ last: r.last ?? null, checks: r.checks }, { onConflict: 'user_id' }));
      },
      bulk: (b) => {
        // Tout part en une fois, dans l'ordre des clés étrangères : domaines, objectifs, projets, éléments.
        const stamp = nowIso();
        const d0 = dataRef.current;
        const domains = (b.domains || []).map((x, i) => ({ color: 'c1', position: Object.keys(d0.domains).length + i, ...x, id: x.id || uuid() }) as Domain);
        const goals = (b.goals || []).map((x) => ({ horizon: 'year', ...x, id: x.id || uuid(), createdAt: stamp }) as Goal);
        const projects = (b.projects || []).map((x) => ({ status: 'active', links: [], ...x, id: x.id || uuid(), createdAt: stamp }) as Project);
        const items = (b.items || []).map((x) => ({ status: 'todo', ...x, id: x.id || uuid(), createdAt: stamp }) as Item);
        const pins = (b.pins || []).map((x) => ({ title: x.url || '', url: '', ...x, id: x.id || uuid(), createdAt: stamp }) as Pin);
        const add = <T extends { id: string }>(m: Record<string, T>, rows: T[]) => ({ ...m, ...Object.fromEntries(rows.map((r) => [r.id, r])) });
        dataRef.current = {
          ...d0,
          domains: add(d0.domains, domains),
          goals: add(d0.goals, goals),
          projects: add(d0.projects, projects),
          items: add(d0.items, items),
          pins: add(d0.pins, pins),
        };
        setData(dataRef.current);
        remote(async () => {
          const steps: [string, Record<string, unknown>[]][] = [
            ['domains', domains as unknown as Record<string, unknown>[]],
            ['goals', goals as unknown as Record<string, unknown>[]],
            ['projects', projects as unknown as Record<string, unknown>[]],
            ['items', items as unknown as Record<string, unknown>[]],
            ['pins', pins as unknown as Record<string, unknown>[]],
          ];
          for (const [t, rows] of steps) {
            if (!rows.length) continue;
            const r = await supabase!.from(t).insert(rows.map(toDb));
            if (r.error) return r;
          }
          return { error: null };
        });
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
        window.location.href = '/login';
      },
      onError: (fn) => {
        errFn.current = fn;
      },
    };
  }, [data, ready, mode, email, error, put, del, remote, supabase]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export { uuid };
