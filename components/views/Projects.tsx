'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Project } from '@/lib/types';
import { useUI } from '../ui-context';
import { CardList } from '../Card';
import { Icon } from '../icons';
import { Head, MonthGrid } from './Calendar';
import { CONTEXTS, PSTATUSES, backlog, colorOfProject, domainOfProject, domainsSorted, list, projectStats, projectsSorted } from '@/lib/gtd';
import { MONTHS, isoOf, longDate, relDate, todayIso } from '@/lib/dates';

function PCard({ p }: { p: Project }) {
  const { data } = useStore();
  const { go } = useUI();
  const st = projectStats(data, p.id);
  const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
  const g = p.goalId ? data.goals[p.goalId] : null;
  const color = colorOfProject(data, p);
  return (
    <button className="pcard" onClick={() => go('project', { projectId: p.id })}>
      <div className="pn">
        <i className="dot" style={{ background: color }} />
        <span>{p.name}</span>
        {p.aiSorted && <span className="chip ai">IA</span>}
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
    </button>
  );
}

export function ProjectsView() {
  const { data } = useStore();
  const { ui, openDrawer } = useUI();
  const [tab, setTab] = useState<Project['status']>('active');
  const df = ui.domainFilter;
  const doms = domainsSorted(data).filter((d) => !df || d.id === df);
  const all = projectsSorted(data).filter((p) => p.status === tab);
  const blocks = doms
    .map((d) => [d, all.filter((p) => p.domainId === d.id)] as const)
    .filter(([, ps]) => ps.length);
  const orphans = df ? [] : all.filter((p) => !p.domainId || !data.domains[p.domainId]);
  const title = df && data.domains[df] ? data.domains[df].name : 'Projets';
  return (
    <>
      <Head
        eyebrow="Organiser"
        title={title}
        lede={df ? 'Les projets de ce domaine.' : 'Tous tes projets, rangés par domaine de vie.'}
        actions={
          <>
            <div className="seg">
              {PSTATUSES.map(([k, l]) => (
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
          Aucun projet {tab === 'active' ? 'actif' : tab === 'paused' ? 'en pause' : 'terminé'} ici. En GTD, un projet c&apos;est tout résultat qui demande plus d&apos;une action.
        </div>
      ) : (
        <div className="stack">
          {blocks.map(([d, ps]) => (
            <div className="dom-block" key={d.id}>
              <div className="dom-title">
                <i className="sw" style={{ background: `var(--${d.color})` }} />
                {d.name}
              </div>
              <div className="pgrid">
                {ps.map((p) => (
                  <PCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          ))}
          {orphans.length > 0 && (
            <div className="dom-block">
              <div className="dom-title">Sans domaine</div>
              <div className="pgrid">
                {orphans.map((p) => (
                  <PCard key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ProjectView() {
  const store = useStore();
  const { data } = store;
  const { ui, go, openDrawer, toast } = useUI();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [ctx, setCtx] = useState('');
  const [link, setLink] = useState('');
  const [showDone, setShowDone] = useState(false);
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
  const g = p.goalId ? data.goals[p.goalId] : null;
  const st = projectStats(data, id);
  const nodate = backlog(data, id);
  const others = list(data.items).filter((i) => i.projectId === id && ['waiting', 'someday', 'inbox'].includes(i.status));
  const done = list(data.items).filter((i) => i.projectId === id && i.status === 'done');
  const [y, m] = month.split('-').map(Number);
  const shiftMonth = (dir: number) => setMonth(isoOf(new Date(y, m - 1 + dir, 1)).slice(0, 7));

  const addCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    store.addItem({ title: title.trim(), status: 'todo', projectId: id, domainId: p.domainId || null, date: date || null, context: ctx || null });
    setTitle('');
    setDate('');
    toast({ text: 'Carte ajoutée' });
  };
  const addLink = (e: React.FormEvent) => {
    e.preventDefault();
    const u = link.trim();
    if (!u) return;
    store.updateProject(id, { links: [...(p.links || []), { url: u, label: u.replace(/^https?:\/\/(www\.)?/i, '').slice(0, 80) }] });
    setLink('');
  };

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <button className="btn ghost sm" onClick={() => go('projects')}>
          <Icon name="left" />
          Projets
        </button>
      </div>
      <Head
        eyebrow={d ? d.name : 'Projet'}
        title={p.name}
        actions={
          <>
            {p.aiSorted && <span className="chip ai">Créé par l&apos;IA</span>}
            <div className="seg">
              {PSTATUSES.map(([k, l]) => (
                <button key={k} className={p.status === k ? 'on' : ''} onClick={() => store.updateProject(id, { status: k })}>
                  {l}
                </button>
              ))}
            </div>
            <button className="btn" onClick={() => openDrawer({ type: 'project', id })}>
              Modifier
            </button>
          </>
        }
      />
      <div className="proj-grid">
        <div className="stack">
          <form className="sec" onSubmit={addCard}>
            <div className="sec-head">
              <h2>Ajouter une carte</h2>
            </div>
            <div className="addrow">
              <label className="sr" htmlFor="padd-title">
                Titre de la carte
              </label>
              <input className="inp" id="padd-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Prochaine action pour ce projet…" />
              <label className="sr" htmlFor="padd-date">
                Date
              </label>
              <input className="inp" style={{ flex: '0 1 160px' }} type="date" id="padd-date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn primary" type="submit">
                Ajouter
              </button>
            </div>
            <div className="pick">
              {CONTEXTS.map(([k, l]) => (
                <button type="button" key={k} className={ctx === k ? 'on' : ''} onClick={() => setCtx(ctx === k ? '' : k)}>
                  {l}
                </button>
              ))}
            </div>
          </form>
          <div className="sec">
            <div className="sec-head">
              <h2>Calendrier du projet</h2>
              <div className="cal-nav">
                <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
                  <Icon name="left" />
                </button>
                <span className="cal-title">
                  {MONTHS[m - 1]} {y}
                </span>
                <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Mois suivant">
                  <Icon name="right" />
                </button>
              </div>
            </div>
            <MonthGrid ym={month} projectId={id} compact />
          </div>
          <div className="sec" data-drop="backlog">
            <div className="sec-head">
              <h2>
                Cartes sans date <span className="n">{nodate.length}</span>
              </h2>
              <span className="hint">Glisse-les sur le calendrier</span>
            </div>
            <CardList
              items={nodate}
              o={{ noProject: true }}
              empty={
                <div className="empty">
                  {st.open.length ? (
                    'Toutes les cartes ouvertes ont une date.'
                  ) : (
                    <>
                      <b>Aucune prochaine action.</b> En GTD, un projet actif a toujours au moins une action concrète à faire. Ajoute-la au-dessus.
                    </>
                  )}
                </div>
              }
            />
          </div>
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
        </div>
        <div className="stack">
          <div className="info">
            <h2>Infos générales</h2>
            <dl className="kv">
              <dt>Résultat attendu</dt>
              <dd>{p.outcome || <span style={{ color: 'var(--warn)' }}>À définir : à quoi ressemble « terminé » ?</span>}</dd>
              <dt>Domaine</dt>
              <dd>
                {d ? (
                  <span className="chip">
                    <i className="dot" style={{ background: `var(--${d.color})` }} />
                    <span>{d.name}</span>
                  </span>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Objectif</dt>
              <dd>
                {g ? (
                  <button className="btn ghost sm" style={{ height: 'auto', padding: '2px 6px', whiteSpace: 'normal', textAlign: 'left' }} onClick={() => openDrawer({ type: 'goal', id: g.id })}>
                    ◎ {g.title}
                  </button>
                ) : (
                  '—'
                )}
              </dd>
              <dt>Échéance</dt>
              <dd>{p.dueDate ? longDate(p.dueDate) : '—'}</dd>
              <dt>Avancement</dt>
              <dd className="mono">
                {st.done}/{st.total}
              </dd>
            </dl>
            {p.description && <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13, whiteSpace: 'pre-wrap' }}>{p.description}</p>}
          </div>
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
              Liens <span className="n">{(p.links || []).length}</span>
            </h2>
            <div className="links">
              {(p.links || []).map((l, i) => (
                <div className="link-row" key={`${l.url}-${i}`}>
                  <a href={/^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}`} target="_blank" rel="noopener noreferrer">
                    {l.label || l.url}
                  </a>
                  <button
                    className="icon-btn sm"
                    onClick={() => store.updateProject(id, { links: p.links.filter((_, j) => j !== i) })}
                    aria-label="Retirer le lien"
                  >
                    <Icon name="x" />
                  </button>
                </div>
              ))}
            </div>
            <form className="addrow" onSubmit={addLink}>
              <label className="sr" htmlFor="plink">
                Lien
              </label>
              <input className="inp" id="plink" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Coller un lien (doc, outil, Insta…)" />
              <button className="btn" type="submit">
                Ajouter
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
