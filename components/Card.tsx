'use client';
import type { Item } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useUI } from './ui-context';
import { PR, colorOfItem, colorOfProject, ctxLabel, isEvent, recLabel } from '@/lib/gtd';
import { diffDays, fmtDuration, relDate, timeRange, todayIso } from '@/lib/dates';
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
  /** Répétition à venir d'un élément récurrent (affichage seulement). */
  ghost?: boolean;
}

export function Card({ it, o = {} }: { it: Item; o?: CardOpts }) {
  const { data } = useStore();
  const s = data.settings;
  const { ui, openDrawer, toggleDone, set } = useUI();
  const pr = it.projectId ? data.projects[it.projectId] : null;
  const dom = !pr && it.domainId ? data.domains[it.domainId] : null;
  const done = it.status === 'done';
  const ev = isEvent(it);
  const pending = ui.pending[it.id];
  const tick = !ev && !o.ghost && it.status !== 'someday' && it.status !== 'inbox';
  const n = it.date ? diffDays(it.date, todayIso()) : 0;
  const color = colorOfItem(data, it);

  const open = () => openDrawer({ type: 'item', id: it.id });
  const plan = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    set({ plan: { id: it.id, x: Math.min(r.left, window.innerWidth - 250), y: Math.min(r.bottom + 4, window.innerHeight - 340) } });
  };

  return (
    <div
      className={`card${done ? ' done' : ''}${pending ? ' pending' : ''}${ev ? ' event' : ''}${o.ghost ? ' ghost' : ''}`}
      style={{ '--pc': color } as React.CSSProperties}
      draggable={o.drag !== false && !o.ghost}
      data-drag={o.ghost ? undefined : it.id}
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
      {tick ? (
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
      ) : ev ? (
        <span className="evdot" aria-hidden="true">
          <Icon name="cal" />
        </span>
      ) : null}
      {o.showTime && it.time && !o.compact && <span className="time">{it.time}</span>}
      <div className="card-body">
        <div className="card-title">
          {s.showPriorities && !ev && <Prio p={it.priority} />}
          <span>{it.title}</span>
        </div>
        <div className="card-meta">
          {(o.compact || o.noDate) && it.time && <span className="chip date">{timeRange(it.time, it.duration)}</span>}
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
          {ev && !it.time && <span className="chip">Toute la journée</span>}
          {s.showContexts && it.context && !o.compact && !ev && <span className="chip">{ctxLabel(it.context)}</span>}
          {it.status === 'doing' && <span className="chip doing">En cours</span>}
          {it.status === 'waiting' && <span className="chip waiting">Attend{it.waitingFor ? ` ${it.waitingFor}` : ''}</span>}
          {it.date && !o.noDate && !o.compact && (
            <span className={`chip date${!done && !ev && n < 0 ? ' over' : n === 0 ? ' today' : ''}`}>
              {relDate(it.date)}
              {it.time ? ` ${timeRange(it.time, it.duration)}` : ''}
            </span>
          )}
          {!it.time && it.duration && !o.compact ? <span className="chip">{fmtDuration(it.duration)}</span> : null}
          {it.recurrence && (
            <span className="chip" title={recLabel(it)}>
              ↻{o.compact ? '' : ` ${recLabel(it)}`}
            </span>
          )}
          {it.aiSorted && !done && !o.ghost && (
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
      {!o.compact && !o.ghost && it.status !== 'done' && (
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

/** Liste groupée par projet : un en-tête coloré par projet, les cartes en dessous. */
export function GroupedByProject({ items, o, empty }: { items: Item[]; o?: CardOpts; empty?: React.ReactNode }) {
  const { data } = useStore();
  if (!items.length) return <>{empty || null}</>;
  const groups = new Map<string, Item[]>();
  items.forEach((i) => {
    const k = i.projectId && data.projects[i.projectId] ? i.projectId : '';
    groups.set(k, [...(groups.get(k) || []), i]);
  });
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (data.projects[a]?.name || '').localeCompare(data.projects[b]?.name || '')));
  return (
    <div className="groups">
      {keys.map((k) => {
        const p = k ? data.projects[k] : null;
        return (
          <div className="group" key={k || 'none'} style={{ '--pc': p ? colorOfProject(data, p) : 'var(--line-2)' } as React.CSSProperties}>
            <div className="group-head">
              <i className="dot" />
              <span>{p ? p.name : 'Sans projet'}</span>
              <span className="n">{groups.get(k)!.length}</span>
            </div>
            <div className="cards">
              {groups.get(k)!.map((i) => (
                <Card key={i.id} it={i} o={{ ...o, noProject: true }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
