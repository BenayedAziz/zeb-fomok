'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useUI } from '../ui-context';
import { CardList } from '../Card';
import { Head } from './Calendar';
import { HORIZONS, REVIEW_CADENCES, colorOfProject, counts, entriesOn, goalsSorted, lastReviewDays, list, overdue, projectStats, projectsSorted, upcoming } from '@/lib/gtd';
import { addDays, diffDays, todayIso } from '@/lib/dates';
import type { Horizon } from '@/lib/types';

function AddGoal({ horizon }: { horizon: Horizon }) {
  const { addGoal } = useStore();
  const [v, setV] = useState('');
  return (
    <form
      className="addrow"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        addGoal({ title: v.trim(), horizon });
        setV('');
      }}
    >
      <label className="sr" htmlFor={`g-${horizon}`}>
        Nouvel objectif
      </label>
      <input className="inp" id={`g-${horizon}`} value={v} onChange={(e) => setV(e.target.value)} placeholder="Ajouter…" />
      <button className="btn" type="submit">
        Ajouter
      </button>
    </form>
  );
}

export function GoalsView() {
  const { data } = useStore();
  const { openDrawer } = useUI();
  return (
    <>
      <Head
        eyebrow="Prendre du recul"
        title="Objectifs"
        lede="Ta boussole. Les objectifs de l'année s'affichent en haut de ta journée ; relie tes projets à un objectif pour voir où tu avances."
      />
      <div className="goals">
        {HORIZONS.map(([hz, label, hint]) => {
          const gs = goalsSorted(data).filter((g) => g.horizon === hz);
          return (
            <div className="gcol" key={hz}>
              <div>
                <h2>
                  {label} <span className="n">{gs.length}</span>
                </h2>
                <p className="hint" style={{ margin: '2px 0 0' }}>
                  {hint}
                </p>
              </div>
              {gs.map((g) => {
                const ps = projectsSorted(data).filter((p) => p.goalId === g.id);
                let tot = 0;
                let dn = 0;
                ps.forEach((p) => {
                  const s = projectStats(data, p.id);
                  tot += s.total;
                  dn += s.done;
                });
                return (
                  <button className="gcard" key={g.id} onClick={() => openDrawer({ type: 'goal', id: g.id })}>
                    <div className="gt">{g.title}</div>
                    {ps.length ? (
                      <>
                        <div className="gp">
                          {ps.map((p) => (
                            <span className="chip" key={p.id}>
                              <i className="dot" style={{ background: colorOfProject(data, p) }} />
                              <span>{p.name}</span>
                            </span>
                          ))}
                        </div>
                        <div className="bar">
                          <i style={{ width: `${tot ? Math.round((dn / tot) * 100) : 0}%`, background: 'var(--accent)' }} />
                        </div>
                        <div className="gs mono">
                          {dn}/{tot} actions faites
                        </div>
                      </>
                    ) : (
                      <div className="gs">Aucun projet relié</div>
                    )}
                  </button>
                );
              })}
              <AddGoal horizon={hz} />
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Chaque projet actif, avec sa prochaine action et de quoi décider vite. */
function ProjectsPass() {
  const store = useStore();
  const { data } = store;
  const { go } = useUI();
  const [add, setAdd] = useState<Record<string, string>>({});
  const ps = projectsSorted(data).filter((p) => p.status === 'active');
  if (!ps.length) return <p className="hint">Aucun projet actif.</p>;
  return (
    <div className="ppass">
      {ps.map((p) => {
        const st = projectStats(data, p.id);
        return (
          <div className="ppass-row" key={p.id} style={{ '--pc': colorOfProject(data, p) } as React.CSSProperties}>
            <div className="ppass-head">
              <button className="ppass-name" onClick={() => go('project', { projectId: p.id })}>
                <i className="dot" /> {p.name}
              </button>
              <span className="mono hint">
                {st.done}/{st.total}
              </span>
              <div className="ppass-act">
                <button className="btn ghost sm" onClick={() => store.updateProject(p.id, { status: 'paused' })}>
                  Pause
                </button>
                <button className="btn ghost sm" onClick={() => store.updateProject(p.id, { status: 'done' })}>
                  Terminé
                </button>
              </div>
            </div>
            {st.next ? (
              <div className="ppass-next">
                <span className="k">Ensuite</span> {st.next.title}
                {st.open.length > 1 && <span className="hint"> · +{st.open.length - 1}</span>}
              </div>
            ) : (
              <form
                className="addrow"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = (add[p.id] || '').trim();
                  if (!v) return;
                  store.addItem({ title: v, status: 'todo', kind: 'task', projectId: p.id, domainId: p.domainId || null });
                  setAdd((a) => ({ ...a, [p.id]: '' }));
                }}
              >
                <input className="inp sm warn" value={add[p.id] || ''} onChange={(e) => setAdd((a) => ({ ...a, [p.id]: e.target.value }))} placeholder="Pas de prochaine action. Laquelle ?" aria-label={`Prochaine action pour ${p.name}`} />
                <button className="btn sm" type="submit">
                  Ajouter
                </button>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Bilan du mois : objectifs et domaines laissés de côté. */
function MonthRecap() {
  const { data } = useStore();
  const t = todayIso();
  const recent = list(data.items).filter((i) => i.status === 'done' && i.doneAt && diffDays(t, i.doneAt) <= 30);
  const byDom: Record<string, number> = {};
  recent.forEach((i) => {
    const d = i.domainId || (i.projectId ? data.projects[i.projectId]?.domainId : null);
    if (d) byDom[d] = (byDom[d] || 0) + 1;
  });
  const forgotten = Object.values(data.domains).filter((d) => !byDom[d.id]);
  const goals = goalsSorted(data).filter((g) => g.horizon === 'year');
  return (
    <div className="recap">
      {goals.length > 0 && (
        <div>
          <b>Objectifs de l&apos;année</b>
          <ul>
            {goals.map((g) => {
              const ps = projectsSorted(data).filter((p) => p.goalId === g.id);
              const n = recent.filter((i) => i.projectId && ps.some((p) => p.id === i.projectId)).length;
              return (
                <li key={g.id}>
                  {g.title} : <span className={n ? '' : 'warn'}>{n ? `${n} action${n > 1 ? 's' : ''} ce mois-ci` : ps.length ? 'rien ce mois-ci' : 'aucun projet relié'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {forgotten.length > 0 && (
        <p>
          <b>Domaines laissés de côté ce mois-ci :</b> {forgotten.map((d) => d.name).join(', ')}. Normal, ou à rééquilibrer ?
        </p>
      )}
    </div>
  );
}

export function ReviewView() {
  const store = useStore();
  const { data } = store;
  const { go, set, toast } = useUI();
  const r = data.review;
  const ck = r.checks || {};
  const every = data.settings.reviewEvery || 7;
  const short = every <= 3;
  const monthly = every >= 30;
  const lr = lastReviewDays(data);
  const c = counts(data);
  const t = todayIso();
  const tomorrow = addDays(t, 1);
  const period = Math.max(every, 1);
  const noNext = projectsSorted(data).filter((p) => p.status === 'active' && !projectStats(data, p.id).open.length);
  const aiList = list(data.items).filter((i) => i.aiSorted && i.status !== 'done');
  const donePeriod = list(data.items).filter((i) => i.status === 'done' && i.doneAt && diffDays(t, i.doneAt) < period).length;
  const od = overdue(data).length;
  const up = upcoming(data, short ? 3 : monthly ? 30 : 14).length;
  const tmr = entriesOn(data, tomorrow).length;
  const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;
  const sinceTxt = every === 1 ? "aujourd'hui" : `sur ${every} jours`;

  const validateAll = () => {
    aiList.forEach((i) => store.updateItem(i.id, { aiSorted: false }));
    projectsSorted(data)
      .filter((p) => p.aiSorted)
      .forEach((p) => store.updateProject(p.id, { aiSorted: false }));
    toast({ text: 'Tout est validé' });
  };
  const openCal = (date: string, cal: 'day' | 'week' | 'month') => {
    set({ cal, date });
    go('day');
  };

  type Step = { k: string; title: string; text: string; action?: React.ReactNode; inner?: React.ReactNode };
  const inbox: Step = { k: 'inbox', title: "Vider l'inbox", text: c.inbox ? `${pl(c.inbox, 'élément')} à ranger.` : 'Inbox vide.', action: c.inbox ? <button className="btn sm" onClick={() => go('inbox')}>Ouvrir</button> : null };
  const ai: Step = {
    k: 'ai',
    title: "Vérifier ce que l'IA a rangé",
    text: aiList.length ? `${pl(aiList.length, 'élément')} rangé${aiList.length > 1 ? 's' : ''} automatiquement. Ouvre ceux qui te semblent faux, valide le reste.` : 'Rien à vérifier.',
    action: aiList.length ? <button className="btn sm" onClick={validateAll}>Tout valider</button> : null,
    inner: aiList.length ? <CardList items={aiList.slice(0, 15)} o={{ drag: false }} /> : null,
  };
  const past: Step = {
    k: 'past',
    title: short ? 'Ce que tu as fait' : monthly ? 'Revoir le mois passé' : 'Revoir la période passée',
    text: `${pl(donePeriod, 'action')} terminée${donePeriod > 1 ? 's' : ''} ${sinceTxt}${od ? `, ${pl(od, 'action')} en retard à replanifier.` : '.'}`,
    action: <button className="btn sm" onClick={() => go('journal')}>Journal</button>,
    inner: od ? <CardList items={overdue(data).slice(0, 10)} /> : null,
  };
  const steps: Step[] = short
    ? [
        inbox,
        ai,
        past,
        {
          k: 'tomorrow',
          title: 'Préparer demain',
          text: tmr ? `${pl(tmr, 'élément')} prévu${tmr > 1 ? 's' : ''} demain. Ajoute ce qui manque depuis « À faire ».` : "Rien de prévu demain. Glisse 2 ou 3 actions sur l'agenda.",
          action: <button className="btn sm" onClick={() => openCal(tomorrow, 'day')}>Ouvrir demain</button>,
        },
      ]
    : [
        inbox,
        ai,
        past,
        { k: 'cal', title: `Regarder l'agenda ${monthly ? 'du mois à venir' : 'des 2 prochaines semaines'}`, text: `${pl(up, 'élément')} daté${up > 1 ? 's' : ''}.`, action: <button className="btn sm" onClick={() => openCal(t, monthly ? 'month' : 'week')}>Ouvrir</button> },
        ...(data.settings.showWaitingSomeday ? [{ k: 'waiting', title: 'Relancer ce qui est en attente', text: `${pl(c.waiting, 'élément')} en attente.`, action: <button className="btn sm" onClick={() => go('waiting')}>Ouvrir</button> }] : []),
        {
          k: 'proj',
          title: 'Passer chaque projet en revue',
          text: noNext.length ? `${pl(noNext.length, 'projet')} sans prochaine action. Donne-leur une étape, mets-les en pause ou termine-les.` : 'Tous les projets actifs ont une prochaine action. Vérifie qu’elles sont toujours justes.',
          inner: <ProjectsPass />,
        },
        ...(data.settings.showWaitingSomeday ? [{ k: 'someday', title: 'Passer en revue « Un jour / peut-être »', text: `${pl(c.someday, 'idée')} en réserve. Active ce qui est mûr, supprime ce qui ne te parle plus.`, action: <button className="btn sm" onClick={() => go('someday')}>Ouvrir</button> }] : []),
        { k: 'goals', title: monthly ? 'Bilan du mois' : 'Relire tes objectifs', text: monthly ? 'Où tu as avancé, ce que tu as laissé de côté.' : 'Est-ce que tes projets servent ton cap ?', action: <button className="btn sm" onClick={() => go('goals')}>Objectifs</button>, inner: monthly ? <MonthRecap /> : null },
      ];
  const n = steps.filter((s) => ck[s.k]).length;
  const name = short ? (every === 1 ? 'Revue du jour' : 'Revue express') : monthly ? 'Revue du mois' : every === 14 ? 'Revue de quinzaine' : 'Revue de la semaine';
  return (
    <>
      <Head
        eyebrow="Prendre du recul"
        title={name}
        lede={`${lr === null ? 'Première revue.' : `Dernière revue ${lr === 0 ? "aujourd'hui" : `il y a ${pl(lr, 'jour')}`}`} · ${n}/${steps.length} étapes · ${short ? '5 minutes' : monthly ? '45 minutes' : '20 minutes'} environ.`}
        actions={
          <button
            className="btn primary"
            onClick={() => {
              store.setReview({ last: t, checks: {} });
              toast({ text: short ? 'Revue faite. À demain.' : 'Revue terminée. Esprit clair pour la suite.' });
            }}
          >
            Terminer la revue
          </button>
        }
      />
      <div className="cadence">
        <span>Rythme</span>
        <div className="pick">
          {REVIEW_CADENCES.map(([k, l]) => (
            <button key={k} className={every === k ? 'on' : ''} onClick={() => store.setSettings({ reviewEvery: k })}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="bar progress" aria-hidden="true">
        <i style={{ width: `${steps.length ? (n / steps.length) * 100 : 0}%`, background: 'var(--accent)' }} />
      </div>
      <div className="steps">
        {steps.map((s, i) => (
          <div className={`step${ck[s.k] ? ' done' : ''}`} key={s.k}>
            <button className="num" onClick={() => store.setReview({ ...r, checks: { ...ck, [s.k]: !ck[s.k] } })} aria-label={ck[s.k] ? 'Décocher l’étape' : 'Cocher l’étape'}>
              {ck[s.k] ? '✓' : i + 1}
            </button>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              {s.inner && !ck[s.k] && <div className="inner">{s.inner}</div>}
            </div>
            <div className="vh-actions">{s.action}</div>
          </div>
        ))}
      </div>
    </>
  );
}
