'use client';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Item } from '@/lib/types';
import { useUI, type CalMode } from '../ui-context';
import { Card, GroupedByProject } from '../Card';
import { Icon } from '../icons';
import {
  backlog, colorOfItem, colorOfProject, contextsOf, counts, goalsSorted, isEvent, list, overdue, projectsSorted, reviewDue, lastReviewDays, entriesOn, type Entry,
} from '@/lib/gtd';
import { DAYS, DSHORT, MONTHS, MSHORT, addDays, isoOf, isoWeek, minutesOf, mondayOf, pad, parseIso, relDate, timeOf, timeRange, todayIso } from '@/lib/dates';

export const HOUR_PX = 52;
const SNAP = 15;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;

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
  return (
    <div className="legend" aria-label="Filtrer le calendrier par projet">
      {ui.calProject && (
        <button className="legend-item on" onClick={() => set({ calProject: null })}>
          Tous les projets ✕
        </button>
      )}
      {ps.map((p) => (
        <button
          key={p.id}
          className={`legend-item${ui.calProject === p.id ? ' on' : ''}`}
          style={{ '--pc': colorOfProject(data, p) } as React.CSSProperties}
          onClick={() => set({ calProject: ui.calProject === p.id ? null : p.id })}
        >
          <i className="dot" />
          {p.name}
        </button>
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
}
function layout(entries: Entry[]): Placed[] {
  const items = entries
    .map((e) => {
      const start = minutesOf(e.it.time!);
      const dur = e.it.duration || (isEvent(e.it) ? 60 : 30);
      return { e, start, end: start + Math.max(dur, 15), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
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
    lanesEnd[lane] = p.end;
    p.lane = lane;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.end);
  }
  if (cluster.length) flush();
  return items;
}

function TimeBlock({ p, dayStart }: { p: Placed; dayStart: number }) {
  const store = useStore();
  const { openDrawer, toggleDone, toast } = useUI();
  const it = p.e.it;
  const ghost = p.e.ghost;
  const ev = isEvent(it);
  const [drag, setDrag] = useState<{ mode: 'move' | 'resize'; x0: number; y0: number; dx: number; dy: number } | null>(null);
  const moved = useRef(false);

  const dyMin = drag ? (drag.dy / HOUR_PX) * 60 : 0;
  const start = drag?.mode === 'move' ? snap(p.start + dyMin) : p.start;
  const dur = drag?.mode === 'resize' ? Math.max(SNAP, snap(p.end - p.start + dyMin)) : p.end - p.start;
  const top = ((start - dayStart * 60) / 60) * HOUR_PX;
  const height = Math.max((dur / 60) * HOUR_PX - 2, 18);

  const begin = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (ghost || e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moved.current = false;
    setDrag({ mode, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    const dx = drag.mode === 'move' ? e.clientX - drag.x0 : 0;
    if (Math.abs(dy) > 4 || Math.abs(dx) > 8) moved.current = true;
    setDrag({ ...drag, dx, dy });
  };
  const end = (e: React.PointerEvent) => {
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
      className={`tblock${ev ? ' event' : ''}${ghost ? ' ghost' : ''}${it.status === 'done' ? ' done' : ''}${drag ? ' dragging' : ''}`}
      style={{ top, height, left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`, width: `calc(${100 / p.lanes}% - 4px)`, transform: drag?.dx ? `translateX(${drag.dx}px)` : undefined, '--pc': colorOfItem(store.data, it) } as React.CSSProperties}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={() => setDrag(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (!moved.current) openDrawer({ type: 'item', id: it.id });
      }}
      role="button"
      tabIndex={0}
      aria-label={`${it.title}, ${timeRange(it.time, it.duration)}`}
      onKeyDown={(e) => e.key === 'Enter' && openDrawer({ type: 'item', id: it.id })}
      title={ghost ? 'Répétition à venir' : undefined}
    >
      <div className="tb-row">
        {!ev && !ghost && (
          <button
            className="ck sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleDone(it.id);
            }}
            aria-label="Marquer fait"
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
      {!ghost && <span className="tb-handle" onPointerDown={begin('resize')} aria-label="Changer la durée" title="Glisser pour changer la durée" />}
    </div>
  );
}

/** Une colonne d'agenda pour un jour. */
function Timeline({ date, entries, showHours, nowLine }: { date: string; entries: Entry[]; showHours: boolean; nowLine: boolean }) {
  const { data } = useStore();
  const { set } = useUI();
  const { dayStart, dayEnd } = data.settings;
  const hours = Array.from({ length: dayEnd - dayStart + 1 }, (_, i) => dayStart + i);
  const placed = layout(entries.filter((e) => e.it.time));
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
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
        className="tl"
        style={{ height: hours.length * HOUR_PX }}
        data-drop="timeline"
        data-date={date}
        data-start={dayStart}
        data-hourpx={HOUR_PX}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const min = Math.floor((dayStart * 60 + ((e.clientY - rect.top) / HOUR_PX) * 60) / 30) * 30;
          set({ captureOpen: true, capturePreset: { date, time: timeOf(min) } });
        }}
        title="Clique sur un créneau pour y ajouter quelque chose"
      >
        {hours.map((h) => (
          <div key={h} className="tl-line" style={{ top: (h - dayStart) * HOUR_PX }} />
        ))}
        {showNow && <div className="tl-now" style={{ top: ((nowMin - dayStart * 60) / 60) * HOUR_PX }} />}
        {placed.map((p) => (
          <TimeBlock key={`${p.e.it.id}-${p.e.date}`} p={p} dayStart={dayStart} />
        ))}
      </div>
    </div>
  );
}

function AllDay({ entries }: { entries: Entry[] }) {
  const { data } = useStore();
  const { openDrawer } = useUI();
  const evs = entries.filter((e) => isEvent(e.it) && !e.it.time);
  if (!evs.length) return null;
  return (
    <div className="allday">
      {evs.map((e) => (
        <button key={`${e.it.id}-${e.date}`} className={`ad-chip${e.ghost ? ' ghost' : ''}`} style={{ '--pc': colorOfItem(data, e.it) } as React.CSSProperties} onClick={() => openDrawer({ type: 'item', id: e.it.id })}>
          {e.it.title}
          {e.it.recurrence ? ' ↻' : ''}
        </button>
      ))}
    </div>
  );
}

const projFilter = (pid: string | null) => (pid ? (it: Item) => it.projectId === pid : undefined);

function DayView() {
  const { data } = useStore();
  const { ui } = useUI();
  const d = ui.date;
  const isToday = d === todayIso();
  const entries = entriesOn(data, d, projFilter(ui.calProject));
  const untimed = entries.filter((e) => !e.it.time && !isEvent(e.it) && !e.ghost).map((e) => e.it);
  const dd = parseIso(d);
  return (
    <>
      <Head
        eyebrow={`${isToday ? 'Ma journée' : 'Journée'} · semaine ${isoWeek(d)}`}
        title={
          isToday ? (
            <>
              <em>{DAYS[dd.getDay()]}</em> {dd.getDate()} {MONTHS[dd.getMonth()]}
            </>
          ) : (
            `${DAYS[dd.getDay()]} ${dd.getDate()} ${MONTHS[dd.getMonth()]}`
          )
        }
        actions={<CalNav />}
      />
      <Compass />
      <ProjectLegend />
      <div className="day-grid">
        <div className="stack">
          {isToday && (
            <div className="sec">
              <Alerts />
            </div>
          )}
          <AllDay entries={entries} />
          <div className="sec" data-drop="date" data-date={d}>
            <div className="sec-head">
              <h2>
                {isToday ? "À faire aujourd'hui" : 'À faire ce jour-là'} <span className="n">{untimed.length}</span>
              </h2>
              <span className="hint">Rangé par projet</span>
            </div>
            <GroupedByProject items={untimed} o={{ noDate: true }} empty={<div className="drop-hint">Glisse ici une action pour la faire {isToday ? "aujourd'hui" : 'ce jour-là'}, sans horaire précis.</div>} />
          </div>
          <div className="sec">
            <div className="sec-head">
              <h2>Agenda</h2>
              <span className="hint">Glisse une carte sur l&apos;agenda, étire un bloc pour changer sa durée, clique un créneau pour ajouter</span>
            </div>
            <div className="timeline-card">
              <Timeline date={d} entries={entries} showHours nowLine />
            </div>
          </div>
        </div>
        <PlanPanel />
      </div>
    </>
  );
}

function WeekView() {
  const { data } = useStore();
  const { ui, set } = useUI();
  const narrow = useNarrow();
  const m = mondayOf(ui.date);
  const end = addDays(m, 6);
  const md = parseIso(m);
  const ed = parseIso(end);
  const label = md.getMonth() === ed.getMonth() ? `${md.getDate()} – ${ed.getDate()} ${MONTHS[ed.getMonth()]}` : `${md.getDate()} ${MSHORT[md.getMonth()]} – ${ed.getDate()} ${MSHORT[ed.getMonth()]}`;
  const t = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(m, i));
  const byDay = days.map((d) => entriesOn(data, d, projFilter(ui.calProject)));
  return (
    <>
      <Head eyebrow={`Semaine ${isoWeek(m)}`} title={label} actions={<CalNav />} />
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
          <div className="wgrid">
            <div className="wg-head">
              <div />
              {days.map((d) => {
                const dd = parseIso(d);
                return (
                  <button key={d} className={`wg-day${d === t ? ' today' : ''}`} onClick={() => set({ date: d, cal: 'day' })}>
                    <b>{DSHORT[dd.getDay()]}</b> <span>{dd.getDate()}</span>
                  </button>
                );
              })}
            </div>
            <div className="wg-allday">
              <div className="hint">Journée</div>
              {days.map((d, i) => {
                const untimed = byDay[i].filter((e) => !e.it.time);
                return (
                  <div key={d} className="wg-cell" data-drop="date" data-date={d}>
                    {untimed.map((e) => (
                      <Card key={`${e.it.id}-${d}`} it={e.it} o={{ compact: true, noDate: true, ghost: e.ghost }} />
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="wg-body">
              <Timeline date={days[0]} entries={byDay[0]} showHours nowLine />
              {days.slice(1).map((d, i) => (
                <Timeline key={d} date={d} entries={byDay[i + 1]} showHours={false} nowLine />
              ))}
            </div>
          </div>
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
  const ym = ui.date.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  return (
    <>
      <Head eyebrow="Mois" title={`${MONTHS[m - 1]} ${y}`} actions={<CalNav />} />
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
