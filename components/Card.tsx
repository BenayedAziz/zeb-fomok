'use client';
import type { Item } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useUI } from './ui-context';
import { CTX, PR, REC, colorOfProject } from '@/lib/gtd';
import { diffDays, relDate, todayIso } from '@/lib/dates';
import { Icon } from './icons';

export function Prio({ p }: { p?: string | null }) {
  if (!p || !PR[p]) return null;
  return (
    <span className={`prio ${p}`} title={`Priorité ${PR[p].toLowerCase()}`}>
      <i />
      <i />
      <i />
    </span>
  );
}

export interface CardOpts {
  noProject?: boolean;
  noDate?: boolean;
  showTime?: boolean;
  compact?: boolean;
  drag?: boolean;
}

export function Card({ it, o = {} }: { it: Item; o?: CardOpts }) {
  const { data } = useStore();
  const { ui, openDrawer, toggleDone, set } = useUI();
  const pr = it.projectId ? data.projects[it.projectId] : null;
  const dom = !pr && it.domainId ? data.domains[it.domainId] : null;
  const done = it.status === 'done';
  const pending = ui.pending[it.id];
  const tick = it.status !== 'someday' && it.status !== 'inbox';
  const n = it.date ? diffDays(it.date, todayIso()) : 0;

  const open = () => openDrawer({ type: 'item', id: it.id });
  const plan = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    set({ plan: { id: it.id, x: Math.min(r.left, window.innerWidth - 240), y: Math.min(r.bottom + 4, window.innerHeight - 320) } });
  };

  return (
    <div
      className={`card${done ? ' done' : ''}${pending ? ' pending' : ''}`}
      draggable={o.drag !== false}
      data-drag={it.id}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          open();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={it.title}
    >
      {tick && (
        <button
          className="ck"
          onClick={(e) => {
            e.stopPropagation();
            toggleDone(it.id);
          }}
          aria-label={done ? 'Marquer à faire' : 'Marquer fait'}
        >
          <Icon name="check" />
        </button>
      )}
      {o.showTime && it.time && !o.compact && <span className="time">{it.time}</span>}
      <div className="card-body">
        <div className="card-title">
          <Prio p={it.priority} />
          <span>{it.title}</span>
        </div>
        <div className="card-meta">
          {o.compact && it.time && <span className="chip date">{it.time}</span>}
          {pr && !o.noProject && (
            <span className="chip">
              <i className="dot" style={{ background: colorOfProject(data, pr) }} />
              <span>{pr.name}</span>
            </span>
          )}
          {dom && !o.noProject && !o.compact && (
            <span className="chip">
              <i className="dot" style={{ background: `var(--${dom.color})` }} />
              <span>{dom.name}</span>
            </span>
          )}
          {it.context && !o.compact && <span className="chip">{CTX[it.context] || it.context}</span>}
          {it.status === 'doing' && <span className="chip doing">En cours</span>}
          {it.status === 'waiting' && <span className="chip waiting">Attend{it.waitingFor ? ` ${it.waitingFor}` : ''}</span>}
          {it.date && !o.noDate && (
            <span className={`chip date${!done && n < 0 ? ' over' : n === 0 ? ' today' : ''}`}>
              {relDate(it.date)}
              {it.time && !o.showTime ? ` ${it.time}` : ''}
            </span>
          )}
          {it.recurrence && (
            <span className="chip" title={REC[it.recurrence]}>
              ↻ {o.compact ? '' : REC[it.recurrence]}
            </span>
          )}
          {it.aiSorted && !done && (
            <span className="chip ai" title={it.aiReason || "Rangé par l'IA"}>
              IA
            </span>
          )}
          {pending && (
            <span className="chip ai">
              <i className="spin" /> L&apos;IA range…
            </span>
          )}
        </div>
      </div>
      {!o.compact && it.status !== 'done' && (
        <div className="card-actions">
          <button className="icon-btn sm" onClick={plan} aria-label="Planifier" title="Planifier">
            <Icon name="cal" />
          </button>
        </div>
      )}
    </div>
  );
}

export function CardList({ items, o, empty }: { items: Item[]; o?: CardOpts; empty?: React.ReactNode }) {
  if (!items.length) return <>{empty || null}</>;
  return (
    <div className="list">
      {items.map((i) => (
        <Card key={i.id} it={i} o={o} />
      ))}
    </div>
  );
}
