'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/store';
import type { Project } from '@/lib/types';
import { useUI } from '../ui-context';
import { Card, CardList } from '../Card';
import { ProjMenu } from '../ProjectTree';
import { Icon } from '../icons';
import { Head, MonthGrid } from './Calendar';
import { PinList, AddPin } from './Pins';
import { PSTATUSES, childrenOf, isOpen, parentOf, contextsOf, sortItems, backlog, colorOfProject, domainOfProject, domainsSorted, list, projectStats, projectsSorted } from '@/lib/gtd';
import { MONTHS, isoOf, longDate, relDate, todayIso } from '@/lib/dates';

function PCard({ p, all }: { p: Project; all: Project[] }) {
  const store = useStore();
  const { data } = store;
  const { go, toast } = useUI();
  const [open, setOpen] = useState(false);
  const st = projectStats(data, p.id);
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  const g = p.goalId ? data.goals[p.goalId] : null;
  const color = colorOfProject(data, p);
  const kids = childrenOf(data, p.id, all);
  const openIt = () => go('project', { projectId: p.id });
  return (
    <div className={`pcard${p.pinned ? ' pinned' : ''}${open ? ' open' : ''}`} onClick={openIt} role="button" tabIndex={0} onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && openIt()}>
      <div className="pn">
        <i className="dot" style={{ background: color }} />
        <span>{p.name}</span>
        {p.aiSorted && <span className="chip ai">IA</span>}
        <button
          className={`pin-btn${p.pinned ? ' on' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            store.updateProject(p.id, { pinned: !p.pinned });
            toast({ text: p.pinned ? 'Retiré des épinglés' : 'Épinglé en haut du menu' });
          }}
          aria-label={p.pinned ? 'Désépingler' : 'Épingler'}
          title={p.pinned ? 'Désépingler' : 'Épingler en haut'}
        >
          <Icon name="pin" />
        </button>
      </div>
      <div className={`po${p.outcome ? '' : ' missing'}`}>{p.outcome || 'Résultat attendu à définir'}</div>
      <div className="bar">
        <i style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="pmeta">
        <span className="mono">
          {st.done}/{st.total} actions
        </span>
        {p.dueDate && <span className={`chip date${p.dueDate < todayIso() ? ' over' : ''}`}>⚑ {relDate(p.dueDate)}</span>}
      </div>
      {p.status === 'active' &&
        !p.archivedAt &&
        (st.next ? (
          <div className="pnext">
            <span className="k">Ensuite</span>
            <span>{st.next.title}</span>
          </div>
        ) : (
          <div className="pnext warn">
            <span>Aucune prochaine action</span>
          </div>
        ))}
      {g && (
        <div className="card-meta">
          <span className="chip">
            <span>◎ {g.title}</span>
          </span>
        </div>
      )}
      {kids.length > 0 && (
        <>
          <button
            className="sub-toggle"
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            <Icon name="right" />
            {kids.length} sous-projet{kids.length > 1 ? 's' : ''}
          </button>
          {open && (
            <div className="sub-list" onClick={(e) => e.stopPropagation()}>
              {kids.map((k) => (
                <SubRow key={k.id} p={k} all={all} depth={0} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Un sous-projet dans la carte de son parent (et ses propres sous-projets, repliables). */
function SubRow({ p, all, depth }: { p: Project; all: Project[]; depth: number }) {
  const { data } = useStore();
  const { go } = useUI();
  const [open, setOpen] = useState(false);
  const kids = depth < 5 ? childrenOf(data, p.id, all) : [];
  const st = projectStats(data, p.id);
  return (
    <>
      <div className="sub-row" style={{ paddingLeft: depth * 14 }}>
        {kids.length > 0 ? (
          <button className={`nav-caret${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`${open ? 'Replier' : 'Déplier'} ${p.name}`}>
            <Icon name="right" />
          </button>
        ) : (
          <i className="dot" style={{ background: colorOfProject(data, p) }} />
        )}
        <button className="sub-name" onClick={() => go('project', { projectId: p.id })}>
          {p.name}
        </button>
        <span className="mono">
          {st.done}/{st.total}
        </span>
      </div>
      {open && kids.map((k) => <SubRow key={k.id} p={k} all={all} depth={depth + 1} />)}
    </>
  );
}

type Tab = Project['status'] | 'archived';

export function ProjectsView() {
  const { data } = useStore();
  const { ui, openDrawer } = useUI();
  const [tab, setTab] = useState<Tab>('active');
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const df = ui.domainFilter;
  const doms = domainsSorted(data).filter((d) => !df || d.id === df);
  const all = tab === 'archived' ? projectsSorted(data, { archived: true }) : projectsSorted(data).filter((p) => p.status === tab);
  // Un sous-projet s'affiche dans la carte de son parent ; seul s'il n'a pas de parent dans cette liste.
  const top = all.filter((p) => {
    const par = parentOf(data, p);
    return !par || !all.includes(par);
  });
  const blocks = doms
    .map((d) => [d, top.filter((p) => p.domainId === d.id)] as const)
    .filter(([, ps]) => ps.length);
  const orphans = df ? [] : top.filter((p) => !p.domainId || !data.domains[p.domainId]);
  const title = df && data.domains[df] ? data.domains[df].name : 'Projets';
  const flip = (id: string) =>
    setClosed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const tabs: [Tab, string][] = [...PSTATUSES, ['archived', 'Archivés']];
  return (
    <>
      <Head
        eyebrow="Organiser"
        title={title}
        lede={df ? 'Les projets de ce domaine.' : 'Tous tes projets, rangés par domaine de vie. Épingle ceux du moment, archive ceux qui dorment.'}
        actions={
          <>
            <div className="seg">
              {tabs.map(([k, l]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                  {l}
                </button>
              ))}
            </div>
            {df && (
              <button className="btn" onClick={() => openDrawer({ type: 'domain', id: df })}>
                Modifier le domaine
              </button>
            )}
            <button className="btn primary" onClick={() => openDrawer({ type: 'project', id: null, draft: { domainId: df || '' } })}>
              <Icon name="plus" />
              Nouveau projet
            </button>
          </>
        }
      />
      {!blocks.length && !orphans.length ? (
        <div className="empty">
          {tab === 'archived' ? (
            'Aucun projet archivé. Archive un projet qui dort : il disparaît du menu sans être supprimé.'
          ) : (
            <>
              Aucun projet {tab === 'active' ? 'actif' : tab === 'paused' ? 'en pause' : 'terminé'} ici. En GTD, un projet c&apos;est tout résultat qui demande plus d&apos;une action.
            </>
          )}
        </div>
      ) : (
        <div className="stack">
          {[...blocks.map(([d, ps]) => ({ key: d.id, name: d.name, color: `var(--${d.color})`, ps })), ...(orphans.length ? [{ key: 'none', name: 'Sans domaine', color: 'var(--line-2)', ps: orphans }] : [])].map((b) => {
            const isOpen = !closed.has(b.key);
            return (
              <div className="dom-block" key={b.key}>
                <button className="dom-title" onClick={() => flip(b.key)} aria-expanded={isOpen}>
                  <span className={`nav-caret${isOpen ? ' open' : ''}`} aria-hidden="true">
                    <Icon name="right" />
                  </span>
                  <i className="sw" style={{ background: b.color }} />
                  {b.name}
                  <span className="n">{b.ps.length}</span>
                </button>
                {isOpen && (
                  <div className="pgrid">
                    {b.ps.map((p) => (
                      <PCard key={p.id} p={p} all={all} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export function ProjectView() {
  const store = useStore();
  const { data } = store;
  const { ui, go, openDrawer, toast, deleteProject } = useUI();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [ctx, setCtx] = useState('');
  const [kind, setKind] = useState<'task' | 'event'>('task');
  const [showDone, setShowDone] = useState(false);
  const [showCal, setShowCal] = useState<boolean | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const id = ui.projectId;
  const p = id ? data.projects[id] : null;
  if (!p || !id) {
    return (
      <div className="empty">
        Ce projet n&apos;existe plus.{' '}
        <button className="btn sm" onClick={() => go('projects')}>
          Voir les projets
        </button>
      </div>
    );
  }
  const d = domainOfProject(data, p);
  const parent = parentOf(data, p);
  const kids = childrenOf(data, id);
  const g = p.goalId ? data.goals[p.goalId] : null;
  const st = projectStats(data, id);
  const nodate = backlog(data, id);
  const others = list(data.items).filter((i) => i.projectId === id && ['waiting', 'someday', 'inbox'].includes(i.status));
  const done = list(data.items).filter((i) => i.projectId === id && i.status === 'done' && i.kind !== 'event');
  const t0 = todayIso();
  const events = list(data.items)
    .filter((i) => i.projectId === id && i.kind === 'event' && (!i.date || i.date >= t0 || i.recurrence))
    .sort(sortItems);
  const pins = list(data.pins)
    .filter((x) => x.projectId === id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const [y, m] = month.split('-').map(Number);
  const shiftMonth = (dir: number) => setMonth(isoOf(new Date(y, m - 1 + dir, 1)).slice(0, 7));

  const addCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (kind === 'event' && !date) return toast({ text: 'Choisis la date de l’événement.' });
    store.addItem({ title: title.trim(), kind, status: 'todo', projectId: id, domainId: p.domainId || null, date: date || null, context: kind === 'task' ? ctx || null : null });
    setTitle('');
    setDate('');
    toast({ text: kind === 'event' ? 'Événement ajouté' : 'Carte ajoutée' });
  };

  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  const dated = list(data.items)
    .filter((i) => i.projectId === id && isOpen(i) && i.date)
    .sort(sortItems);
  const color = colorOfProject(data, p);
  const calOpen = showCal ?? dated.length + events.length > 0;

  return (
    <>
      <nav className="crumbs" aria-label="Fil d'Ariane">
        <button onClick={() => go('projects')}>Projets</button>
        {d && (
          <>
            <span aria-hidden="true">›</span>
            <button onClick={() => go('projects', { domain: d.id })}>{d.name}</button>
          </>
        )}
        {parent && (
          <>
            <span aria-hidden="true">›</span>
            <button onClick={() => go('project', { projectId: parent.id })}>{parent.name}</button>
          </>
        )}
      </nav>

      <section className="phero" style={{ '--pc': color } as React.CSSProperties}>
        <div className="phero-top">
          <h1>{p.name}</h1>
          <div className="phero-actions">
            <div className="seg sm" role="group" aria-label="Statut">
              {PSTATUSES.map(([k, l]) => (
                <button key={k} className={p.status === k ? 'on' : ''} onClick={() => store.updateProject(id, { status: k })}>
                  {l}
                </button>
              ))}
            </div>
            <button className="btn sm" onClick={() => openDrawer({ type: 'project', id })}>
              <Icon name="edit" />
              <span className="lbl">Modifier</span>
            </button>
            <button
              className="icon-btn"
              aria-label="Plus d'actions"
              title="Épingler, archiver, en faire un domaine, supprimer"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenuAt(menuAt ? null : { x: r.right - 200, y: r.bottom });
              }}
            >
              <Icon name="more" />
            </button>
          </div>
        </div>
        <button className={`phero-outcome${p.outcome ? '' : ' missing'}`} onClick={() => openDrawer({ type: 'project', id })} title="Modifier le résultat attendu">
          {p.outcome || 'Ajoute le résultat attendu : à quoi ressemble « terminé » ?'}
        </button>
        {p.description && <p className="phero-desc">{p.description}</p>}
        <div className="phero-stats">
          <div className="phero-bar" aria-label={`${pct} % des actions faites`}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <span>
            <b>{st.done}</b> sur {st.total} action{st.total > 1 ? 's' : ''} faite{st.total > 1 ? 's' : ''}
          </span>
          {kids.length > 0 && (
            <span>
              {kids.length} sous-projet{kids.length > 1 ? 's' : ''}
            </span>
          )}
          {p.dueDate && <span className={`chip date${p.dueDate < t0 ? ' over' : ''}`}>⚑ {relDate(p.dueDate)}</span>}
          {g && (
            <button className="chip" onClick={() => openDrawer({ type: 'goal', id: g.id })}>
              ◎ {g.title}
            </button>
          )}
          {p.pinned && <span className="chip">Épinglé</span>}
          {p.archivedAt && <span className="chip">Archivé</span>}
          {p.aiSorted && <span className="chip ai">IA</span>}
        </div>
      </section>

      <div className="proj-grid">
        <div className="stack">
          <form className="padd" onSubmit={addCard}>
            <label className="sr" htmlFor="padd-title">
              {kind === 'event' ? 'Nom de l’événement' : 'Prochaine action'}
            </label>
            <input id="padd-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'event' ? 'Réunion, rendez-vous, échéance…' : 'Ajoute la prochaine action de ce projet…'} autoComplete="off" />
            <div className="seg sm" role="group" aria-label="Type">
              <button type="button" className={kind === 'task' ? 'on' : ''} onClick={() => setKind('task')}>
                Tâche
              </button>
              <button type="button" className={kind === 'event' ? 'on' : ''} onClick={() => setKind('event')}>
                Événement
              </button>
            </div>
            <label className="sr" htmlFor="padd-date">
              Date
            </label>
            <input className="padd-date" type="date" id="padd-date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button className="btn primary sm" type="submit" disabled={!title.trim()}>
              Ajouter
            </button>
          </form>
          {kind === 'task' && data.settings.showContexts && title.trim() && (
            <div className="pick">
              {contextsOf(data.settings).map(([k, l]) => (
                <button type="button" key={k} className={ctx === k ? 'on' : ''} onClick={() => setCtx(ctx === k ? '' : k)}>
                  {l}
                </button>
              ))}
            </div>
          )}

          <div className="sec" data-drop="backlog">
            <div className="sec-head">
              <h2>
                Prochaines actions <span className="n">{dated.length + nodate.length}</span>
              </h2>
            </div>
            {dated.length + nodate.length ? (
              <div className="cards">
                {[...dated, ...nodate].map((i) => (
                  <Card key={i.id} it={i} o={{ noProject: true }} />
                ))}
              </div>
            ) : (
              <div className="empty">
                <b>Aucune prochaine action.</b> En GTD, un projet actif a toujours au moins une action concrète à faire. Ajoute-la juste au-dessus.
              </div>
            )}
          </div>

          <div className="sec">
            <div className="sec-head">
              <h2>
                Sous-projets <span className="n">{kids.length}</span>
              </h2>
              <button className="btn ghost sm" onClick={() => openDrawer({ type: 'project', id: null, draft: { parentId: id, domainId: p.domainId || '' } })}>
                <Icon name="plus" />
                Ajouter un sous-projet
              </button>
            </div>
            {kids.length > 0 && (
              <div className="kid-grid">
                {kids.map((k) => {
                  const ks = projectStats(data, k.id);
                  const kp = ks.total ? Math.round((ks.done / ks.total) * 100) : 0;
                  return (
                    <button key={k.id} className="kid" style={{ '--pc': colorOfProject(data, k) } as React.CSSProperties} onClick={() => go('project', { projectId: k.id })}>
                      <span className="kid-name">
                        <i className="dot" />
                        {k.name}
                      </span>
                      <span className="kid-next">{ks.next ? ks.next.title : 'Aucune prochaine action'}</span>
                      <span className="kid-bar">
                        <i style={{ width: `${kp}%` }} />
                      </span>
                      <span className="kid-n">
                        {ks.done}/{ks.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {events.length > 0 && (
            <div className="sec">
              <div className="sec-head">
                <h2>
                  Événements <span className="n">{events.length}</span>
                </h2>
              </div>
              <CardList items={events} o={{ noProject: true, drag: false }} />
            </div>
          )}
          {others.length > 0 && (
            <div className="sec">
              <div className="sec-head">
                <h2>
                  En attente et plus tard <span className="n">{others.length}</span>
                </h2>
              </div>
              <CardList items={others} o={{ noProject: true, drag: false }} />
            </div>
          )}
          {done.length > 0 && (
            <div className="sec">
              <div className="sec-head">
                <h2>
                  Terminées <span className="n">{done.length}</span>
                </h2>
                <button className="btn ghost sm" onClick={() => setShowDone(!showDone)}>
                  {showDone ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {showDone && <CardList items={done} o={{ noProject: true, drag: false }} />}
            </div>
          )}

          <div className="sec">
            <div className="sec-head">
              <h2>Calendrier du projet</h2>
              <div className="cal-nav">
                {calOpen && (
                  <>
                    <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
                      <Icon name="left" />
                    </button>
                    <span className="cal-title">
                      {MONTHS[m - 1]} {y}
                    </span>
                    <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
                      <Icon name="right" />
                    </button>
                  </>
                )}
                <button className="btn ghost sm" onClick={() => setShowCal(!calOpen)}>
                  {calOpen ? 'Masquer' : 'Afficher'}
                </button>
              </div>
            </div>
            {calOpen && <MonthGrid ym={month} projectId={id} compact />}
          </div>
        </div>
        <div className="stack">
          <div className="info">
            <label className="fld">
              <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 13 }}>Notes</span>
              <textarea
                className="inp"
                key={id}
                defaultValue={p.notes || ''}
                rows={7}
                placeholder="Idées, contexte, décisions…"
                onBlur={(e) => e.target.value !== (p.notes || '') && store.updateProject(id, { notes: e.target.value })}
              />
            </label>
          </div>
          <div className="info">
            <h2>
              <Icon name="pin" /> Ressources épinglées <span className="n">{pins.length + (p.links || []).length}</span>
            </h2>
            <PinList pins={pins} noProject />
            {(p.links || []).length > 0 && (
              <div className="links">
                {(p.links || []).map((l, i) => (
                  <div className="link-row" key={`${l.url}-${i}`}>
                    <a href={/^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`} target="_blank" rel="noopener noreferrer">
                      {l.label || l.url}
                    </a>
                    <button className="icon-btn sm" onClick={() => store.updateProject(id, { links: p.links.filter((_, j) => j !== i) })} aria-label="Retirer le lien">
                      <Icon name="x" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <AddPin projectId={id} compact />
          </div>
        </div>
      </div>
      {menuAt && createPortal(<ProjMenu p={p} at={menuAt} onClose={() => setMenuAt(null)} />, document.body)}
    </>
  );
}
