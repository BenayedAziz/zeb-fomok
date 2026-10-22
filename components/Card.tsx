'use client';
import type { Item } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useUI } from './ui-context';
import { PR, colorOfItem, colorOfProject, ctxLabel, isEvent, recLabel } from '@/lib/gtd';
import { diffDays, fmtDuration, relDate, timeRange, todayIso } from '@/lib/dates';
import { Icon } from './icons';
import { mascotFor, typeMascot } from '@/lib/mascots';

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
  // Une tâche se coche quand elle est faite, un événement quand il est passé.
  const tick = !o.ghost && (ev || (it.status !== 'someday' && it.status !== 'inbox'));
  const n = it.date ? diffDays(it.date, todayIso()) : 0;
  const color = colorOfItem(data, it);
  const domainName = (pr?.domainId ? data.domains[pr.domainId]?.name : null) || (it.domainId ? data.domains[it.domainId]?.name : null);
  const mascot = s.showMascots !== false && !done && !o.ghost && !o.compact ? mascotFor(it.title, domainName) : null;

  const open = () => openDrawer({ type: 'item', id: it.id });
  const plan = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    set({ plan: { id: it.id, x: Math.min(r.left, window.innerWidth - 250), y: Math.min(r.bottom + 4, window.innerHeight - 340) } });
  };

  return (
    <div
      className={`card${done ? ' done' : ''}${pending ? ' pending' : ''}${ev ? ' event' : ''}${o.ghost ? ' ghost' : ''}${ui.justDone[it.id] ? ' just-done' : ''}${mascot ? ' has-mascot' : ''}`}
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
          className={`ck${ev ? ' ev' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleDone(it.id);
          }}
          aria-label={done ? (ev ? 'Marquer à venir' : 'Marquer à faire') : ev ? 'Marquer terminé' : 'Marquer fait'}
        >
          {done && (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path className="ck-draw" d="M2.5 6.2l2.3 2.3 4.7-5" />
            </svg>
          )}
        </button>
      ) : ev ? (
        <span className="evdot" aria-hidden="true">
          <Icon name="cal" />
        </span>
      ) : null}
      {pr && !done && !ev && <span className="pbar" style={{ background: colorOfProject(data, pr) }} aria-hidden="true" />}
      {o.showTime && it.time && !o.compact && <span className="time">{it.time}</span>}
      <div className="card-body">
        <div className="card-title">
          {s.showPriorities && !ev && <Prio p={it.priority} />}
          <span>{it.title}</span>
        </div>
        <div className="card-meta">
          {(o.compact || o.noDate) && it.time && <span className="chip date">{timeRange(it.time, it.duration)}</span>}
          {pr && !o.noProject && (
            <span className="chip proj" style={{ '--pc': colorOfProject(data, pr) } as React.CSSProperties}>
              {s.showMascots !== false && typeMascot(domainName) ? <img src={typeMascot(domainName)!} alt="" width={20} height={20} /> : <i className="dot" style={{ background: colorOfProject(data, pr) }} />}
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
          {it.quick && !done && !o.ghost && (
            <span className="chip quick" title="Se fait en moins de 2 minutes : fais-le maintenant">
              <Icon name="clock" />2 min
            </span>
          )}
          {it.aiSorted && !done && !o.ghost && (
            <span className="chip ai" title={it.aiReason || "Rangé par l'IA"}>
              <Icon name="sparkle" />IA
            </span>
          )}
          {pending && (
            <span className="chip ai">
              <i className="spin" /> L&apos;IA range…
            </span>
          )}
        </div>
        {!done && !o.ghost && !o.compact && (it.links?.length || ui.linking[it.id]) ? (
          <div className="card-links">
            {(it.links || []).slice(0, 3).map((l) => (
              <a key={l.url} className="chip link" href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} title={l.url} draggable={false}>
                <Icon name="link" />
                <span>{l.label}</span>
              </a>
            ))}
            {ui.linking[it.id] && (
              <span className="chip link wait">
                <i className="spin" /> Cherche un lien…
              </span>
            )}
          </div>
        ) : null}
      </div>
      {mascot && <img className="mascot" src={mascot.src} alt="" title={mascot.name} width={64} height={64} loading="lazy" draggable={false} />}
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
