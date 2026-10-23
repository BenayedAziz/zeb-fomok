'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Item } from '@/lib/types';
import { useUI, type CalMode } from '../ui-context';
import { Card, GroupedByProject } from '../Card';
import { Icon } from '../icons';
import { mascotFor } from '@/lib/mascots';
import {
  backlog, domainsSorted, guessContext, isOpen, colorOfItem, colorOfProject, contextsOf, counts, goalsSorted, isEvent, list, overdue, projectsSorted, reviewDue, lastReviewDays, entriesOn, type Entry,
} from '@/lib/gtd';
import { DAYS, DSHORT, MONTHS, MSHORT, addDays, isoOf, isoWeek, minutesOf, mondayOf, pad, parseIso, relDate, timeOf, timeRange, todayIso } from '@/lib/dates';

export const HOUR_PX = 72;
const SNAP = 15;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;

/* Au doigt, l'agenda doit d'abord défiler : une action ne part qu'après un appui maintenu, sans bouger. */
const HOLD_MS = 450;
const SLOP = 10;
function useHold() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };
  const arm = (x: number, y: number, fire: () => void) => {
    cancel();
    from.current = { x, y };
    timer.current = setTimeout(() => {
      timer.current = null;
      try {
        navigator.vibrate?.(15); // petit retour : « c'est attrapé »
      } catch {}
      fire();
    }, HOLD_MS);
  };
  /** Le doigt bouge avant la fin de l'appui : c'est un défilement, on laisse faire. */
  const check = (x: number, y: number) => {
    if (timer.current && from.current && Math.hypot(x - from.current.x, y - from.current.y) > SLOP) cancel();
  };
  useEffect(() => cancel, []);
  return { arm, check, cancel };
}

/** Bloque le défilement de la page tant qu'on déplace quelque chose au doigt. */
function useNoScroll(ref: React.RefObject<HTMLElement | null>, active: boolean) {
  const on = useRef(active);
  on.current = active;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: TouchEvent) => on.current && e.cancelable && e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, [ref]);
}

export function Head({ eyebrow, title, lede, actions }: { eyebrow: string; title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="vh">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {actions && <div className="vh-actions">{actions}</div>}
    </header>
  );
}

export function useNarrow(px = 860) {
  const [n, setN] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${px}px)`);
    const on = () => setN(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [px]);
  return n;
}

function CalNav() {
  const { ui, set } = useUI();
  const shift = (dir: number) => {
    if (ui.cal === 'day') set({ date: addDays(ui.date, dir) });
    else if (ui.cal === 'week') set({ date: addDays(ui.date, 7 * dir) });
    else {
      const d = parseIso(ui.date);
      set({ date: isoOf(new Date(d.getFullYear(), d.getMonth() + dir, 1)) });
    }
  };
  return (
    <>
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Précédent">
          <Icon name="left" />
        </button>
        <button className="btn sm" onClick={() => set({ date: todayIso() })}>
          Aujourd&apos;hui
        </button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Suivant">
          <Icon name="right" />
        </button>
      </div>
      <div className="seg" role="group" aria-label="Affichage">
        {(
          [
            ['day', 'Jour'],
            ['week', 'Semaine'],
            ['month', 'Mois'],
          ] as [CalMode, string][]
        ).map(([k, l]) => (
          <button key={k} className={ui.cal === k ? 'on' : ''} onClick={() => set({ cal: k })}>
            {l}
          </button>
        ))}
      </div>
    </>
  );
}

export function Compass() {
  const { data } = useStore();
  const { openDrawer } = useUI();
  const g = goalsSorted(data).filter((x) => x.horizon === 'year');
  if (!g.length) return null;
  return (
    <div className="compass">
      <span className="lbl">Cap</span>
      {g.map((x) => (
        <button key={x.id} className="g" onClick={() => openDrawer({ type: 'goal', id: x.id })}>
          {x.title}
        </button>
      ))}
    </div>
  );
}

/** Légende des projets : leur couleur, et un clic pour ne voir qu'eux. */
function ProjectLegend() {
  const { data } = useStore();
  const { ui, set } = useUI();
  const ps = projectsSorted(data).filter((p) => p.status === 'active');
  if (!ps.length) return null;
  // Rangée par domaine : la couleur du domaine, puis ses projets dans leurs nuances.
  const groups = [
    ...domainsSorted(data).map((d) => ({ id: d.id, name: d.name, color: `var(--${d.color})`, ps: ps.filter((p) => p.domainId === d.id) })),
    { id: 'none', name: 'Sans domaine', color: 'var(--line-2)', ps: ps.filter((p) => !p.domainId || !data.domains[p.domainId]) },
  ].filter((g) => g.ps.length);
  const chip = (p: (typeof ps)[number]) => (
    <button
      key={p.id}
      className={`legend-item${ui.calProject === p.id ? ' on' : ''}${p.parentId ? ' sub' : ''}`}
      style={{ '--pc': colorOfProject(data, p) } as React.CSSProperties}
      onClick={() => set({ calProject: ui.calProject === p.id ? null : p.id })}
      title={p.parentId && data.projects[p.parentId] ? `Dans ${data.projects[p.parentId].name}` : undefined}
    >
      <i className="dot" />
      {p.name}
    </button>
  );
  return (
    <div className="legend" aria-label="Filtrer le calendrier par projet">
      {ui.calProject && (
        <button className="legend-item on" onClick={() => set({ calProject: null })}>
          Tous les projets ✕
        </button>
      )}
      {groups.map((g) => (
        <span key={g.id} className="legend-dom" style={{ '--dc': g.color } as React.CSSProperties}>
          <span className="ld-name">{g.name}</span>
          {g.ps.map(chip)}
        </span>
      ))}
    </div>
  );
}

export function PlanPanel({ projectId, flat }: { projectId?: string | null; flat?: boolean }) {
  const { data } = useStore();
  const { ui, set, schedule } = useUI();
  const s = data.settings;
  let bl = backlog(data, projectId || ui.calProject);
  if (s.showContexts && ui.ctx !== 'all') bl = bl.filter((i) => i.context === ui.ctx);
  const od = projectId ? [] : overdue(data).filter((i) => !ui.calProject || i.projectId === ui.calProject);
  return (
    <aside className={`panel${flat ? ' flat' : ''}`} data-drop="backlog" aria-label="À planifier">
      {od.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <h2 style={{ color: 'var(--crit)' }}>
              En retard <span className="n">{od.length}</span>
            </h2>
            <button className="btn sm" onClick={() => od.forEach((i) => schedule(i.id, todayIso()))}>
              Tout mettre aujourd&apos;hui
            </button>
          </div>
          <div className="cards">
            {od.map((i) => (
              <Card key={i.id} it={i} />
            ))}
          </div>
        </div>
      )}
      <div className="sec">
        <div className="sec-head">
          <h2>
            À planifier <span className="n">{bl.length}</span>
          </h2>
        </div>
        {s.showContexts && (
          <div className="pick">
            {[['all', 'Tout'] as [string, string]].concat(contextsOf(s)).map(([k, l]) => (
              <button key={k} className={ui.ctx === k ? 'on' : ''} onClick={() => set({ ctx: k })}>
                {l}
              </button>
            ))}
          </div>
        )}
        {bl.length ? (
          <div className="cards">
            {bl.map((i) => (
              <Card key={i.id} it={i} />
            ))}
          </div>
        ) : (
          <div className="empty">Rien à planifier. Les actions sans date arrivent ici : glisse-les dans l&apos;agenda, ou utilise le bouton calendrier d&apos;une carte.</div>
        )}
      </div>
    </aside>
  );
}

function Alerts() {
  const { data } = useStore();
  const { go } = useUI();
  const c = counts(data);
  const lr = lastReviewDays(data);
  return (
    <>
      {c.inbox > 0 && (
        <div className="alert info">
          <span>
            <b>{c.inbox}</b> élément{c.inbox > 1 ? 's' : ''} dans l&apos;inbox à ranger.
          </span>
          <button className="btn sm" onClick={() => go('inbox')}>
            Ouvrir l&apos;inbox
          </button>
        </div>
      )}
      {reviewDue(data) && list(data.items).length > 0 && (
        <div className="alert">
          <span>{lr === null ? 'Pas encore de revue.' : `Dernière revue il y a ${lr} jour${lr > 1 ? 's' : ''}.`} Quelques minutes pour tout remettre à plat.</span>
          <button className="btn sm" onClick={() => go('review')}>
            Lancer la revue
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Agenda à l'heure : blocs dimensionnés par la durée, redimensionnables */
/* ------------------------------------------------------------------ */
interface Placed {
  e: Entry;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  /** Bloc de présence (journée de travail, journée sur site) : en fond, pleine largeur. */
  bg?: boolean;
  /** Posé sur un bloc de présence : un peu décalé pour laisser voir le fond. */
  inset?: boolean;
}
/** Un événement de 3 h ou plus est un lieu où l'on est, pas une indisponibilité : les tâches s'y posent. */
const BG_MIN = 180;
function layout(entries: Entry[], minPx = 26): Placed[] {
  const all: Placed[] = entries
    .map((e) => {
      const start = minutesOf(e.it.time!);
      const dur = e.it.duration || (isEvent(e.it) ? 60 : 30);
      return { e, start, end: start + Math.max(dur, 15), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const bgs = all.filter((p) => isEvent(p.e.it) && p.end - p.start >= BG_MIN).map((p) => ({ ...p, bg: true }));
  const items = all.filter((p) => !(isEvent(p.e.it) && p.end - p.start >= BG_MIN));
  // Un bloc court s'affiche avec une hauteur minimale lisible : on en tient compte pour ne pas les superposer.
  const MIN_VIS = Math.ceil((minPx / HOUR_PX) * 60);
  const vend = (p: Placed) => Math.max(p.end, p.start + MIN_VIS);
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const lanesEnd: number[] = [];
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = n));
    cluster = [];
    lanesEnd.length = 0;
  };
  for (const p of items) {
    if (p.start >= clusterEnd && cluster.length) flush();
    let lane = lanesEnd.findIndex((end) => end <= p.start);
    if (lane === -1) lane = lanesEnd.length;
    lanesEnd[lane] = vend(p);
    p.lane = lane;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, vend(p));
  }
  if (cluster.length) flush();
  items.forEach((p) => (p.inset = bgs.some((b) => p.start < b.end && p.end > b.start)));
  return [...bgs, ...items];
}

/** Largeur sous laquelle une colonne partagée devient illisible : on superpose en cascade plutôt que de couper en lamelles. */
const LANE_MIN = 104;

/**
 * Position horizontale d'un bloc dans une colonne de largeur `w` (px).
 * Assez de place : côte à côte. Sinon, en cascade comme un paquet de cartes : chaque bloc garde presque
 * toute la largeur et son titre ; le plus tardif passe devant (ordre du DOM), décalé pour laisser voir celui de dessous.
 */
function geometry(p: Placed, w: number): { left: number | string; width: number | string; stacked?: boolean } {
  if (p.bg) return { left: 2, width: 'calc(100% - 4px)' };
  const x0 = p.inset ? 28 : 2;
  if (!w) return { left: `calc(${(p.lane / p.lanes) * 100}% + ${x0}px)`, width: `calc(${100 / p.lanes}% - ${x0 + 2}px)` };
  const avail = Math.max(40, w - x0 - 2);
  if (p.lanes === 1) return { left: x0, width: avail };
  const per = avail / p.lanes;
  if (per >= LANE_MIN) return { left: x0 + p.lane * per, width: per - 3 };
  const step = Math.max(6, Math.min(24, (avail - 96) / (p.lanes - 1)));
  return { left: x0 + p.lane * step, width: avail - p.lane * step, stacked: true };
}

function TimeBlock({ p, dayStart, colW }: { p: Placed; dayStart: number; colW: number }) {
  const store = useStore();
  const { ui, openDrawer, toggleDone, toast } = useUI();
  const it = p.e.it;
  const ghost = p.e.ghost;
  const ev = isEvent(it);
  const [drag, setDrag] = useState<{ mode: 'move' | 'resize'; x0: number; y0: number; dx: number; dy: number } | null>(null);
  const moved = useRef(false);
  /** Attrapé au doigt par un appui long : le relâcher sans bouger n'ouvre pas la fiche. */
  const held = useRef(false);
  const el = useRef<HTMLDivElement>(null);
  const hold = useHold();
  useNoScroll(el, !!drag);

  const dyMin = drag ? (drag.dy / HOUR_PX) * 60 : 0;
  const start = drag?.mode === 'move' ? snap(p.start + dyMin) : p.start;
  const dur = drag?.mode === 'resize' ? Math.max(SNAP, snap(p.end - p.start + dyMin)) : p.end - p.start;
  const top = ((start - dayStart * 60) / 60) * HOUR_PX;
  const height = Math.max((dur / 60) * HOUR_PX - 2, 24);
  const geo = geometry(p, colW);
  // Une tâche dont le créneau est passé sans être cochée : elle reste à faire, on la signale.
  const today = todayIso();
  const late = !ev && !ghost && it.status !== 'done' && (p.e.date < today || (p.e.date === today && p.end <= nowMinutes()));

  const begin = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (ghost || e.button !== 0) return;
    e.stopPropagation();
    moved.current = false;
    held.current = false;
    const { clientX: x0, clientY: y0 } = e;
    if (e.pointerType === 'touch') {
      hold.arm(x0, y0, () => {
        held.current = true;
        setDrag({ mode, x0, y0, dx: 0, dy: 0 });
      });
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ mode, x0, y0, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => {
    hold.check(e.clientX, e.clientY);
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    const dx = drag.mode === 'move' ? e.clientX - drag.x0 : 0;
    if (Math.abs(dy) > 4 || Math.abs(dx) > 8) moved.current = true;
    setDrag({ ...drag, dx, dy });
  };
  const end = (e: React.PointerEvent) => {
    hold.cancel();
    if (!drag) return;
    if (moved.current) {
      if (drag.mode === 'move') {
        // En semaine, on peut aussi changer de jour : on regarde la colonne sous le pointeur.
        const col = document
          .elementsFromPoint(e.clientX, e.clientY)
          .filter((el) => !(e.currentTarget as HTMLElement).contains(el))
          .map((el) => (el as HTMLElement).closest?.('[data-drop="timeline"]') as HTMLElement | null)
          .find((el) => el && el.dataset.date);
        const date = col?.dataset.date && col.dataset.date !== p.e.date ? col.dataset.date : null;
        store.updateItem(it.id, { time: timeOf(start), duration: p.end - p.start, ...(date ? { date } : {}) });
        toast({ text: date ? `Déplacé ${relDate(date).toLowerCase()} à ${timeOf(start)}` : `Déplacé à ${timeOf(start)}` });
      } else {
        store.updateItem(it.id, { duration: dur });
        toast({ text: `Durée : ${timeRange(it.time, dur)}` });
      }
    }
    setDrag(null);
  };

  return (
    <div
      ref={el}
      className={`tblock${ev ? ' event' : ''}${p.bg ? ' bg' : ''}${geo.stacked ? ' stacked' : ''}${late ? ' late' : ''}${ghost ? ' ghost' : ''}${it.status === 'done' ? ' done' : ''}${drag ? ' dragging' : ''}${drag && held.current ? ' held' : ''}${ui.justDone[it.id] ? ' just-done' : ''}`}
      style={{
        top,
        height,
        left: geo.left,
        width: geo.width,
        transform: drag?.dx ? `translateX(${drag.dx}px)` : undefined,
        '--pc': colorOfItem(store.data, it),
      } as React.CSSProperties}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => {
        hold.cancel();
        setDrag(null);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (!moved.current && !held.current) openDrawer({ type: 'item', id: it.id });
        held.current = false;
      }}
      role="button"
      tabIndex={0}
      aria-label={`${it.title}, ${timeRange(it.time, it.duration)}`}
      onKeyDown={(e) => e.key === 'Enter' && openDrawer({ type: 'item', id: it.id })}
      title={ghost ? 'Répétition à venir' : undefined}
    >
      {p.bg ? (
        // Bloc de présence : son nom court le long du bord gauche, les tâches de ce travail se posent à côté.
        <span className="bg-label" title={`${it.title}, ${timeOf(start)}–${timeOf(start + dur)}`}>
          <b>{it.title}</b>
          <span>
            {timeOf(start)}–{timeOf(start + dur)}
          </span>
        </span>
      ) : (
        <>
          <div className="tb-row">
            {!ghost && (
              <button
                className={`ck sm${ev ? ' ev' : ''}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDone(it.id);
                }}
                aria-label={it.status === 'done' ? 'Décocher' : ev ? 'Marquer terminé' : 'Marquer fait'}
              >
                <Icon name="check" />
              </button>
            )}
            <b>{it.title}</b>
          </div>
          {height > 30 && (
            <span className="tb-time">
              {timeOf(start)}–{timeOf(start + dur)}
              {it.projectId && store.data.projects[it.projectId] ? ` · ${store.data.projects[it.projectId].name}` : ''}
              {it.recurrence ? ' · ↻' : ''}
            </span>
          )}
          {height > 70 && !ghost && it.status !== 'done' && store.data.settings.showMascots !== false && (() => {
            const pj = it.projectId ? store.data.projects[it.projectId] : null;
            const dn = (pj?.domainId ? store.data.domains[pj.domainId]?.name : null) || (it.domainId ? store.data.domains[it.domainId]?.name : null);
            const m = mascotFor(it.title, dn);
            return m ? <img className="mascot" src={m.src} alt="" title={m.name} width={34} height={34} draggable={false} /> : null;
          })()}
        </>
      )}
      {!ghost && <span className="tb-handle" onPointerDown={begin('resize')} aria-label="Changer la durée" title="Glisser pour changer la durée" />}
    </div>
  );
}

/** Une colonne d'agenda pour un jour. */
/* ---------- créer en glissant sur l'agenda ---------- */
type Draft = { a: number; b: number; drawing: boolean };

/** Fenêtre flottante qui apparaît à côté du créneau dessiné : titre, tâche ou événement, Ajouter. */
function QuickAdd({ date, start, end, anchor, onClose }: { date: string; start: number; end: number; anchor: DOMRect; onClose: () => void }) {
  const store = useStore();
  const { fileWithAi, toast } = useUI();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'event' | 'task'>('event');
  const ref = useRef<HTMLFormElement>(null);
  const W = 300;
  const right = anchor.right + 10 + W < window.innerWidth;
  const left = right ? anchor.right + 10 : Math.max(10, anchor.left - W - 10);
  const top = Math.min(Math.max(10, anchor.top - 8), window.innerHeight - 220);

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('pointerdown', away), 0);
    document.addEventListener('keydown', esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    const it = store.addItem({ title: t, raw: t, kind, status: 'todo', date, time: timeOf(start), duration: end - start, context: kind === 'task' && store.data.settings.showContexts ? guessContext(t, store.data.settings) : null });
    onClose();
    toast({ text: `${kind === 'event' ? 'Événement' : 'Tâche'} ajouté ${relDate(date).toLowerCase()} à ${timeOf(start)}` });
    void fileWithAi(it.id); // l'IA le range dans le bon projet, en arrière-plan
  };

  return (
    <form
      ref={ref}
      className="quick-add"
      style={{ left, top, width: W }}
      onSubmit={(e) => {
        e.preventDefault();
        add();
      }}
      role="dialog"
      aria-label="Ajouter sur l'agenda"
    >
      <div className="qa-when">
        <i />
        {timeOf(start)} – {timeOf(end)} · {relDate(date)}
      </div>
      <input className="qa-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'event' ? 'Nom de l’événement' : 'Ce que tu vas faire'} aria-label="Titre" />
      <div className="qa-foot">
        <div className="seg" role="tablist" aria-label="Type">
          <button type="button" className={kind === 'event' ? 'on' : ''} onClick={() => setKind('event')}>
            Événement
          </button>
          <button type="button" className={kind === 'task' ? 'on' : ''} onClick={() => setKind('task')}>
            Tâche
          </button>
        </div>
        <button className="btn primary sm" type="submit" disabled={!title.trim()}>
          Ajouter
        </button>
      </div>
    </form>
  );
}

/** Largeur d'un élément, suivie quand la fenêtre ou le panneau change de taille. */
function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Timeline({ date, entries, showHours, nowLine, dense }: { date: string; entries: Entry[]; showHours: boolean; nowLine: boolean; dense?: boolean }) {
  const { data } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftEl = useRef<HTMLDivElement>(null);
  const tlEl = useRef<HTMLDivElement>(null);
  const hold = useHold();
  useNoScroll(tlEl, !!draft?.drawing);
  const colW = useWidth(tlEl);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const { dayStart, dayEnd } = data.settings;
  const hours = Array.from({ length: dayEnd - dayStart + 1 }, (_, i) => dayStart + i);
  // Colonne étroite (semaine) : les blocs courts gardent toute la largeur plutôt que de se partager une colonne illisible.
  const placed = layout(entries.filter((e) => e.it.time), dense ? 0 : 26);
  const nowMin = useMinute();
  const showNow = nowLine && date === todayIso() && nowMin >= dayStart * 60 && nowMin <= (dayEnd + 1) * 60;
  return (
    <div className={`tl-wrap${showHours ? '' : ' no-hours'}`}>
      {showHours && (
        <div className="tl-hours" aria-hidden="true">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }}>
              {pad(h)}:00
            </div>
          ))}
        </div>
      )}
      <div
        ref={tlEl}
        className="tl"
        style={{ height: hours.length * HOUR_PX }}
        data-drop="timeline"
        data-date={date}
        data-start={dayStart}
        data-hourpx={HOUR_PX}
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget || e.button !== 0) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const min = Math.floor((dayStart * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60) / SNAP) * SNAP;
          if (e.pointerType === 'touch') {
            // Au doigt : glisser fait défiler. Un appui long ouvre un créneau d'une heure, qu'on peut étirer avant de lâcher.
            hold.arm(e.clientX, e.clientY, () => {
              setAnchor(null);
              setDraft({ a: min, b: min + 60, drawing: true });
            });
            return;
          }
          setAnchor(null);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDraft({ a: min, b: min + SNAP, drawing: true });
        }}
        onPointerMove={(e) => {
          hold.check(e.clientX, e.clientY);
          if (!draft?.drawing) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const min = Math.max(dayStart * 60, Math.min((dayEnd + 1) * 60, snap(dayStart * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60)));
          setDraft({ ...draft, b: min });
        }}
        onPointerCancel={() => hold.cancel()}
        onContextMenu={(e) => e.preventDefault()}
        onPointerUp={() => {
          hold.cancel();
          if (!draft?.drawing) return;
          let a = Math.min(draft.a, draft.b);
          let b = Math.max(draft.a, draft.b);
          if (b - a < 30) b = a + 60; // simple clic : une heure par défaut
          a = Math.max(dayStart * 60, a);
          setDraft({ a, b, drawing: false });
          requestAnimationFrame(() => draftEl.current && setAnchor(draftEl.current.getBoundingClientRect()));
        }}
        title="Glisse sur l'agenda pour ajouter quelque chose (appui long au doigt)"
      >
        {hours.map((h) => (
          <div key={h} className="tl-line" style={{ top: (h - dayStart) * HOUR_PX }} />
        ))}
        {showNow && <div className="tl-now" style={{ top: ((nowMin - dayStart * 60) / 60) * HOUR_PX }} />}
        {placed.map((p) => (
          <TimeBlock key={`${p.e.it.id}-${p.e.date}`} p={p} dayStart={dayStart} colW={colW} />
        ))}
        {draft && (
          <div
            ref={draftEl}
            className="tdraft"
            style={{ top: ((Math.min(draft.a, draft.b) - dayStart * 60) / 60) * HOUR_PX, height: Math.max((Math.abs(draft.b - draft.a) / 60) * HOUR_PX - 2, 12) }}
          >
            <span>
              {timeOf(Math.min(draft.a, draft.b))} – {timeOf(Math.max(draft.a, draft.b))}
            </span>
          </div>
        )}
      </div>
      {draft && !draft.drawing && anchor && (
        <QuickAdd
          date={date}
          start={draft.a}
          end={draft.b}
          anchor={anchor}
          onClose={() => {
            setDraft(null);
            setAnchor(null);
          }}
        />
      )}
    </div>
  );
}

/** Ce qui n'a pas d'heure ce jour-là : les événements de la journée et, sur téléphone, les tâches à caser. */
function AllDay({ entries, withTasks }: { entries: Entry[]; withTasks?: boolean }) {
  const { data } = useStore();
  const { openDrawer, toggleDone } = useUI();
  const evs = entries.filter((e) => isEvent(e.it) && !e.it.time);
  const tasks = withTasks ? entries.filter((e) => !isEvent(e.it) && !e.it.time && !e.ghost).sort((a, b) => Number(a.it.status === 'done') - Number(b.it.status === 'done')) : [];
  if (!evs.length && !tasks.length) return null;
  return (
    <div className="allday">
      {evs.map((e) => (
        <button key={`${e.it.id}-${e.date}`} className={`ad-chip${e.ghost ? ' ghost' : ''}${e.it.status === 'done' ? ' done' : ''}`} style={{ '--pc': colorOfItem(data, e.it) } as React.CSSProperties} onClick={() => openDrawer({ type: 'item', id: e.it.id })}>
          {e.it.title}
          {e.it.recurrence ? ' ↻' : ''}
        </button>
      ))}
      {tasks.length > 0 && (
        <div className="ad-tasks">
          <span className="ad-label">Sans heure</span>
          {tasks.map((e) => (
            <div key={e.it.id} className={`ad-task${e.it.status === 'done' ? ' done' : ''}`} style={{ '--pc': colorOfItem(data, e.it) } as React.CSSProperties}>
              <button className="ck sm" onClick={() => toggleDone(e.it.id)} aria-label={e.it.status === 'done' ? 'Décocher' : 'Marquer fait'}>
                <Icon name="check" />
              </button>
              <button className="ad-title" onClick={() => openDrawer({ type: 'item', id: e.it.id })}>
                {e.it.title}
              </button>
              {e.it.quick && <span className="chip quick">2 min</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Minutes écoulées depuis minuit. */
const nowMinutes = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

/** L'heure qui avance : rafraîchit l'affichage chaque minute. */
function useMinute() {
  const [m, setM] = useState(nowMinutes);
  useEffect(() => {
    const t = window.setInterval(() => setM(nowMinutes()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return m;
}

const inMin = (m: number) => (m < 60 ? `dans ${m} min` : `dans ${Math.floor(m / 60)} h${m % 60 ? ` ${pad(m % 60)}` : ''}`);

/** En haut de l'agenda du jour : ce que je fais maintenant, ce qui vient ensuite, et ce qui reste. */
function NowNext({ entries }: { entries: Entry[] }) {
  const { data } = useStore();
  const { openDrawer, toggleDone } = useUI();
  const now = useMinute();
  const timed = entries
    .filter((e) => e.it.time && !e.ghost && e.it.status !== 'done')
    .map((e) => {
      const start = minutesOf(e.it.time!);
      const dur = e.it.duration || (isEvent(e.it) ? 60 : 30);
      return { it: e.it, start, end: start + dur };
    })
    // Une journée de travail est un lieu, pas une activité : on montre ce qu'on y fait.
    .filter((x) => !(isEvent(x.it) && x.end - x.start >= BG_MIN));
  const cur = timed.filter((x) => x.start <= now && now < x.end);
  const next = timed.filter((x) => x.start > now).sort((a, b) => a.start - b.start)[0];
  const late = timed.filter((x) => !isEvent(x.it) && x.end <= now).length;
  const left = entries.filter((e) => !e.ghost && !isEvent(e.it) && e.it.status !== 'done').length;
  if (!cur.length && !next && !left) return null;
  const row = (x: { it: Item; start: number; end: number }, tag: string, when: string) => (
    <div key={x.it.id} className="nn-row" style={{ '--pc': colorOfItem(data, x.it) } as React.CSSProperties}>
      <span className="nn-tag">{tag}</span>
      {!isEvent(x.it) && (
        <button className="ck sm" onClick={() => toggleDone(x.it.id)} aria-label="Marquer fait">
          <Icon name="check" />
        </button>
      )}
      <button className="nn-title" onClick={() => openDrawer({ type: 'item', id: x.it.id })}>
        <b>{x.it.title}</b>
        <span>{when}</span>
      </button>
    </div>
  );
  return (
    <div className="nownext" aria-label="Maintenant et ensuite">
      {cur.slice(0, 2).map((x) => row(x, 'Maintenant', `jusqu'à ${timeOf(x.end)}`))}
      {next && row(next, 'Ensuite', `${timeOf(next.start)} · ${inMin(next.start - now)}`)}
      {!cur.length && !next && <div className="nn-free">Plus rien à l&apos;agenda aujourd&apos;hui.</div>}
      <div className="nn-foot">
        {left > 0 ? `${left} tâche${left > 1 ? 's' : ''} à faire aujourd'hui` : 'Toutes les tâches du jour sont faites'}
        {late > 0 && <span className="nn-late"> · {late} en retard</span>}
      </div>
    </div>
  );
}

const projFilter = (pid: string | null) => (pid ? (it: Item) => it.projectId === pid : undefined);

/** Bouton « Planifier ma journée » : l'IA place les tâches à planifier dans les créneaux libres. */
function PlanButton({ date, n, sm }: { date: string; n: number; sm?: boolean }) {
  const { ui, planDay } = useUI();
  const busy = ui.planning === date;
  if (!n && !busy) return null;
  return (
    <button className={`btn primary plan-btn${sm ? ' sm' : ''}`} onClick={() => planDay(date)} disabled={!!ui.planning || ui.aiOff}>
      {busy ? <i className="spin" /> : <Icon name="sparkle" />}
      {busy ? 'Je planifie…' : `Planifier ${date === todayIso() ? 'ma journée' : 'ce jour'}`}
    </button>
  );
}

/** Ce qui reste à placer pour un jour donné : sans date, prévu ce jour sans heure, en retard. */
function toPlanCount(data: ReturnType<typeof useStore>['data'], date: string) {
  const t = todayIso();
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const missed = (it: Item) => date === t && it.date === t && !!it.time && minutesOf(it.time) + (it.duration || 30) <= nowM;
  return list(data.items).filter((it) => isOpen(it) && ((!it.time && (!it.date || it.date === date || (it.date < t && date >= t))) || missed(it))).length;
}

type DayTab = 'day' | 'agenda' | 'plan';

/** Téléphone : barre collante avec les jours de la semaine et le choix Jour / Semaine / Mois. */
function MobileCalBar({ tabs }: { tabs?: { tab: DayTab; setTab: (t: DayTab) => void; nDay: number; nPlan: number } }) {
  const { data } = useStore();
  const { ui, set } = useUI();
  const t = todayIso();
  const m = mondayOf(ui.date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(m, i));
  const dd = parseIso(ui.date);
  const shift = (dir: number) => {
    if (ui.cal === 'day') set({ date: addDays(ui.date, 7 * dir) });
    else if (ui.cal === 'week') set({ date: addDays(ui.date, 7 * dir) });
    else set({ date: isoOf(new Date(dd.getFullYear(), dd.getMonth() + dir, 1)) });
  };
  const label =
    ui.cal === 'month'
      ? `${MONTHS[dd.getMonth()]} ${dd.getFullYear()}`
      : ui.cal === 'week'
        ? `Semaine ${isoWeek(ui.date)}`
        : ui.date === t
          ? "Aujourd'hui"
          : `${DAYS[dd.getDay()]} ${dd.getDate()} ${MSHORT[dd.getMonth()]}`;
  return (
    <div className="mcal-bar">
      <div className="mcal-row">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label={ui.cal === 'month' ? 'Mois précédent' : 'Semaine précédente'}>
          <Icon name="left" />
        </button>
        <button className="mcal-label" onClick={() => set({ date: t })} title="Revenir à aujourd'hui">
          {label}
          {ui.date !== t && <span className="mcal-today">Aujourd&apos;hui</span>}
        </button>
        <button className="icon-btn" onClick={() => shift(1)} aria-label={ui.cal === 'month' ? 'Mois suivant' : 'Semaine suivante'}>
          <Icon name="right" />
        </button>
        <div className="seg mcal-seg" role="group" aria-label="Affichage">
          {(
            [
              ['day', 'J', 'Jour'],
              ['week', 'S', 'Semaine'],
              ['month', 'M', 'Mois'],
            ] as [CalMode, string, string][]
          ).map(([k, s, l]) => (
            <button key={k} className={ui.cal === k ? 'on' : ''} onClick={() => set({ cal: k })} aria-label={l} title={l}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {ui.cal !== 'month' && (
        <div className="mcal-week" role="group" aria-label="Jours de la semaine">
          {days.map((d) => {
            const x = parseIso(d);
            const n = entriesOn(data, d).filter((e) => e.it.status !== 'done').length;
            return (
              <button key={d} className={`${d === ui.date && ui.cal === 'day' ? 'on' : ''}${d === t ? ' today' : ''}`} onClick={() => set({ date: d, cal: 'day' })} aria-label={`${DAYS[x.getDay()]} ${x.getDate()}`}>
                <small>{DSHORT[x.getDay()].slice(0, 3)}</small>
                <b>{x.getDate()}</b>
                <i className={n ? 'dot' : 'dot none'} />
              </button>
            );
          })}
        </div>
      )}
      {tabs && ui.cal === 'day' && (
        <div className="mcal-tabs" role="tablist">
          {(
            [
              ['day', 'Journée', tabs.nDay],
              ['agenda', 'Agenda', 0],
              ['plan', 'À planifier', tabs.nPlan],
            ] as [DayTab, string, number][]
          ).map(([k, l, n]) => (
            <button key={k} role="tab" aria-selected={tabs.tab === k} className={tabs.tab === k ? 'on' : ''} onClick={() => tabs.setTab(k)}>
              {l}
              {n ? <span className="n">{n}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function useDayTab(): [DayTab, (t: DayTab) => void] {
  const [tab, setTab] = useState<DayTab>('day');
  useEffect(() => {
    try {
      const v = localStorage.getItem('sc-day-tab');
      if (v === 'day' || v === 'agenda' || v === 'plan') setTab(v);
    } catch {}
  }, []);
  return [
    tab,
    (t) => {
      setTab(t);
      try {
        localStorage.setItem('sc-day-tab', t);
      } catch {}
      document.querySelector('.work')?.scrollTo({ top: 0 });
    },
  ];
}

function DayView() {
  const { data } = useStore();
  const { ui } = useUI();
  const narrow = useNarrow(1100);
  const phone = useNarrow(860);
  const [tab, setTab] = useDayTab();
  const d = ui.date;
  const isToday = d === todayIso();
  const entries = entriesOn(data, d, projFilter(ui.calProject));
  // Au centre : les tâches du jour sans heure, les plus rapides d'abord, les faites en bas. Le reste vit dans l'agenda.
  const tasks = entries
    .filter((e) => !e.it.time && !isEvent(e.it) && !e.ghost)
    .map((e) => e.it)
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || Number(!!b.quick) - Number(!!a.quick));
  const doneN = entries.filter((e) => !e.ghost && e.it.status === 'done').length;
  const totalN = entries.filter((e) => !e.ghost).length;
  const nPlan = toPlanCount(data, d);
  const dd = parseIso(d);
  const dateLabel = `${DAYS[dd.getDay()]} ${dd.getDate()} ${MONTHS[dd.getMonth()]}`;
  const agenda = (
    <aside className="agenda-panel" aria-label="Agenda">
      <div className="ap-head">
        <h2>Agenda</h2>
        <span className="hint">
          <span className="on-mouse">Glisse pour ajouter</span>
          <span className="on-touch">Appui long pour ajouter</span>
        </span>
      </div>
      {isToday && !phone && <NowNext entries={entries} />}
      <AllDay entries={entries} withTasks={phone} />
      <AgendaScroll>
        <Timeline date={d} entries={entries} showHours nowLine />
      </AgendaScroll>
    </aside>
  );
  const progress = totalN > 0 && (
    <div className="day-progress" aria-label={`${doneN} sur ${totalN} terminés`}>
      <div className="dp-bar">
        <i style={{ width: `${Math.round((doneN / totalN) * 100)}%` }} />
      </div>
      <span>{doneN === totalN ? 'Tout est fait, bravo !' : `${doneN} sur ${totalN} terminé${doneN > 1 ? 's' : ''}`}</span>
    </div>
  );

  if (phone) {
    // Téléphone : la journée dans l'ordre (horaires puis le reste), l'agenda et « À planifier » à un geste.
    const timed = entries.filter((e) => e.it.time).sort((a, b) => minutesOf(a.it.time!) - minutesOf(b.it.time!));
    const allDay = entries.filter((e) => isEvent(e.it) && !e.it.time);
    return (
      <>
        <MobileCalBar tabs={{ tab, setTab, nDay: entries.filter((e) => e.it.status !== 'done').length, nPlan: backlog(data).length + (isToday ? overdue(data).length : 0) }} />
        {tab === 'day' && (
          <div className="stack mday">
            {isToday && <NowNext entries={entries} />}
            {isToday && <Alerts />}
            {nPlan > 0 && (
              <div className="plan-hint">
                <span>
                  <b>{nPlan}</b> tâche{nPlan > 1 ? 's' : ''} à placer.
                </span>
                <PlanButton date={d} n={nPlan} sm />
              </div>
            )}
            {progress}
            {allDay.length > 0 && <AllDay entries={entries} />}
            {timed.length > 0 && (
              <div className="cards">
                {timed.map((e) => (
                  <Card key={`${e.it.id}-${e.date}`} it={e.it} o={{ noDate: true, ghost: e.ghost }} />
                ))}
              </div>
            )}
            <div className="sec" data-drop="date" data-date={d}>
              {tasks.length ? (
                <>
                  {timed.length > 0 && (
                    <div className="sec-head">
                      <h2>
                        Sans horaire <span className="n">{tasks.length}</span>
                      </h2>
                    </div>
                  )}
                  <div className="cards">
                    {tasks.map((i) => (
                      <Card key={i.id} it={i} o={{ noDate: true }} />
                    ))}
                  </div>
                </>
              ) : !timed.length ? (
                <div className="drop-hint">Rien de prévu {isToday ? "aujourd'hui" : 'ce jour-là'}. Note ce que tu as en tête avec le bouton nuage, ou planifie tes tâches.</div>
              ) : null}
            </div>
          </div>
        )}
        {tab === 'agenda' && <div className="mday">{agenda}</div>}
        {tab === 'plan' && (
          <div className="stack mday">
            {nPlan > 0 && (
              <div className="plan-hint">
                <span>L&apos;IA place ces tâches dans {isToday ? 'ta journée' : 'ce jour'} et estime leur durée.</span>
                <PlanButton date={d} n={nPlan} sm />
              </div>
            )}
            <PlanPanel flat />
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <header className="vh day-head">
        <div>
          <div className="day-date">
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · semaine {isoWeek(d)}
          </div>
          <h1>{isToday ? 'Ma journée' : d < todayIso() ? 'Journée passée' : 'Journée à venir'}</h1>
        </div>
        <div className="vh-actions">
          <PlanButton date={d} n={nPlan} />
          <CalNav />
        </div>
      </header>
      <Compass />
      <ProjectLegend />
      <div className="today-grid">
        <div className="stack today-main">
          {isToday && <Alerts />}
          {progress}
          <div className="sec" data-drop="date" data-date={d}>
            {tasks.length ? (
              <div className="cards">
                {tasks.map((i) => (
                  <Card key={i.id} it={i} o={{ noDate: true }} />
                ))}
              </div>
            ) : (
              <div className="drop-hint">
                Rien de prévu sans horaire {isToday ? "aujourd'hui" : 'ce jour-là'}. Glisse ici une action depuis « À planifier », ou capture-la en haut.
              </div>
            )}
          </div>
          {narrow && agenda}
          <PlanPanel flat />
        </div>
        {!narrow && agenda}
      </div>
    </>
  );
}

/** Zone de l'agenda qui défile, placée d'emblée sur l'heure actuelle. */
function AgendaScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useStore();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = new Date().getHours();
    el.scrollTop = Math.max(0, (h - data.settings.dayStart - 1) * HOUR_PX);
  }, [data.settings.dayStart]);
  return (
    <div className="ap-scroll" ref={ref}>
      {children}
    </div>
  );
}

/** Libellé d'une plage de 7 jours : « 19 – 25 octobre » ou « 28 oct. – 3 nov. ». */
function rangeLabel(from: string) {
  const md = parseIso(from);
  const ed = parseIso(addDays(from, 6));
  return md.getMonth() === ed.getMonth() ? `${md.getDate()} – ${ed.getDate()} ${MONTHS[ed.getMonth()]}` : `${md.getDate()} ${MSHORT[md.getMonth()]} – ${ed.getDate()} ${MSHORT[ed.getMonth()]}`;
}

/*
 * Semaine sur ordinateur : un ruban de 3 semaines (la précédente, celle choisie, la suivante) qu'on fait défiler
 * jour par jour. On voit toujours 7 jours, par exemple du mardi dernier au mardi prochain.
 */
const SPAN_BEFORE = 7;
const SPAN = 21;
const GUTTER = 56;
function WeekScroller({ onRange }: { onRange: (first: string) => void }) {
  const { data } = useStore();
  const { ui, set } = useUI();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const m = mondayOf(ui.date);
  const days = Array.from({ length: SPAN }, (_, i) => addDays(m, i - SPAN_BEFORE));
  const dayW = Math.max(140, Math.floor((w - GUTTER) / 7));
  const t = todayIso();
  const { dayStart, dayEnd } = data.settings;
  const hours = Array.from({ length: dayEnd - dayStart + 1 }, (_, i) => dayStart + i);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // La semaine choisie s'affiche en entier ; à l'ouverture, on se place aussi sur l'heure actuelle.
  useEffect(() => {
    const el = ref.current;
    if (!el || !w) return;
    el.scrollLeft = SPAN_BEFORE * dayW;
    onRange(days[SPAN_BEFORE]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, dayW]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (new Date().getHours() - dayStart - 1) * HOUR_PX);
  }, [dayStart]);
  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(SPAN - 7, Math.max(0, Math.round(el.scrollLeft / dayW)));
      onRange(days[i]);
    });
  };
  const byDay = days.map((d) => entriesOn(data, d, projFilter(ui.calProject)));
  return (
    <div className="wscroll" ref={ref} onScroll={onScroll}>
      <div className="wsgrid" style={{ gridTemplateColumns: `${GUTTER}px repeat(${SPAN}, ${dayW}px)` }}>
        <div className="ws-corner" />
        {days.map((d) => {
          const dd = parseIso(d);
          return (
            <button key={`h-${d}`} className={`ws-day${d === t ? ' today' : ''}${parseIso(d).getDay() === 1 ? ' monday' : ''}`} onClick={() => set({ date: d, cal: 'day' })} title="Voir cette journée">
              <b>{DSHORT[dd.getDay()]}</b> <span>{dd.getDate()}</span>
              {dd.getDate() === 1 || d === days[0] ? <em>{MSHORT[dd.getMonth()]}</em> : null}
            </button>
          );
        })}
        <div className="ws-label">Journée</div>
        {days.map((d, i) => (
          <div key={`a-${d}`} className={`ws-cell${parseIso(d).getDay() === 1 ? ' monday' : ''}`} data-drop="date" data-date={d}>
            {byDay[i]
              .filter((e) => !e.it.time)
              .map((e) => (
                <Card key={`${e.it.id}-${d}`} it={e.it} o={{ compact: true, noDate: true, ghost: e.ghost }} />
              ))}
          </div>
        ))}
        <div className="ws-hours" aria-hidden="true">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }}>
              {pad(h)}:00
            </div>
          ))}
        </div>
        {days.map((d, i) => (
          <div key={`t-${d}`} className={`ws-col${d === t ? ' today' : ''}${parseIso(d).getDay() === 1 ? ' monday' : ''}${[0, 6].includes(parseIso(d).getDay()) ? ' weekend' : ''}`}>
            <Timeline date={d} entries={byDay[i]} showHours={false} nowLine dense />
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView() {
  const { data } = useStore();
  const { ui, set } = useUI();
  const narrow = useNarrow();
  const m = mondayOf(ui.date);
  const [first, setFirst] = useState(m);
  const t = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(m, i));
  const byDay = days.map((d) => entriesOn(data, d, projFilter(ui.calProject)));
  return (
    <>
      {narrow ? (
        <MobileCalBar />
      ) : (
        <Head eyebrow={`Semaine ${isoWeek(first)}${first !== mondayOf(first) ? ` – ${isoWeek(addDays(first, 6))}` : ''}`} title={rangeLabel(first)} lede="Fais défiler de côté pour voir les jours d'avant ou d'après." actions={<CalNav />} />
      )}
      <Compass />
      <ProjectLegend />
      <div className="stack">
        {narrow ? (
          <div className="week">
            {days.map((d, i) => {
              const dd = parseIso(d);
              return (
                <div key={d} className={`wcol${d === t ? ' today' : ''}`}>
                  <button className="wh" onClick={() => set({ date: d, cal: 'day' })}>
                    <b>{DSHORT[dd.getDay()]}</b>
                    <span>{dd.getDate()}</span>
                  </button>
                  <div className="wb" data-drop="date" data-date={d} data-keeptime="1">
                    {byDay[i].map((e) => (
                      <Card key={`${e.it.id}-${d}`} it={e.it} o={{ compact: true, noDate: true, ghost: e.ghost }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <WeekScroller onRange={setFirst} />
        )}
        <PlanPanel flat />
      </div>
    </>
  );
}

export function MonthGrid({ ym, projectId, compact }: { ym: string; projectId?: string | null; compact?: boolean }) {
  const { data } = useStore();
  const { ui, set, openDrawer, go } = useUI();
  const [y, mo] = ym.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const startDow = (first.getDay() + 6) % 7;
  const dim = new Date(y, mo, 0).getDate();
  const rows = Math.ceil((startDow + dim) / 7);
  const start = isoOf(new Date(y, mo - 1, 1 - startDow));
  const t = todayIso();
  const pid = projectId || ui.calProject;
  const max = compact ? 2 : 3;
  return (
    <div className="month">
      <div className="mhead">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((x) => (
          <div key={x}>{x}</div>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div className="mrow" key={r}>
          {Array.from({ length: 7 }, (_, c) => {
            const day = addDays(start, r * 7 + c);
            const es = entriesOn(data, day, projFilter(pid || null));
            const dues = list(data.projects).filter((p) => p.dueDate === day && p.status !== 'done' && (!pid || p.id === pid));
            const out = day.slice(0, 7) !== ym;
            return (
              <div
                key={day}
                className={`mcell${out ? ' out' : ''}${day === t ? ' today' : ''}`}
                data-drop="date"
                data-date={day}
                data-keeptime="1"
                onClick={() => {
                  set({ date: day, cal: 'day' });
                  if (projectId) go('day');
                }}
                role="button"
                tabIndex={-1}
                aria-label={day}
              >
                <span className="d">{parseIso(day).getDate()}</span>
                {dues.map((p) => (
                  <button
                    key={p.id}
                    className="mchip due"
                    style={{ '--pc': colorOfProject(data, p) } as React.CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation();
                      go('project', { projectId: p.id });
                    }}
                    title={`Échéance : ${p.name}`}
                  >
                    <span>⚑ {p.name}</span>
                  </button>
                ))}
                {es.slice(0, max).map((e) => (
                  <button
                    key={`${e.it.id}-${day}`}
                    className={`mchip${e.it.status === 'done' ? ' done' : ''}${isEvent(e.it) ? ' event' : ''}${e.ghost ? ' ghost' : ''}`}
                    style={{ '--pc': colorOfItem(data, e.it) } as React.CSSProperties}
                    draggable={!e.ghost}
                    data-drag={e.ghost ? undefined : e.it.id}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      openDrawer({ type: 'item', id: e.it.id });
                    }}
                    title={e.it.title}
                  >
                    <span>
                      {e.it.time ? <span className="mono">{e.it.time} </span> : null}
                      {e.it.title}
                    </span>
                  </button>
                ))}
                {es.length > max && <div className="more">+{es.length - max}</div>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function MonthView() {
  const { ui } = useUI();
  const phone = useNarrow(860);
  const ym = ui.date.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  return (
    <>
      {phone ? <MobileCalBar /> : <Head eyebrow="Mois" title={`${MONTHS[m - 1]} ${y}`} actions={<CalNav />} />}
      <Compass />
      <ProjectLegend />
      <div className="day-grid">
        <div>
          <MonthGrid ym={ym} />
        </div>
        <PlanPanel />
      </div>
    </>
  );
}

export function CalendarView() {
  const { ui } = useUI();
  if (ui.cal === 'week') return <WeekView />;
  if (ui.cal === 'month') return <MonthView />;
  return <DayView />;
}
