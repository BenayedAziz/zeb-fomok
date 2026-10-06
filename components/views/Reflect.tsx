'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { useUI } from '../ui-context';
import { CardList } from '../Card';
import { Head } from './Calendar';
import { HORIZONS, colorOfProject, counts, goalsSorted, lastReviewDays, list, overdue, projectStats, projectsSorted, upcoming } from '@/lib/gtd';
import { diffDays, todayIso } from '@/lib/dates';
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

export function ReviewView() {
  const store = useStore();
  const { data } = store;
  const { go, set, toast } = useUI();
  const r = data.review;
  const ck = r.checks || {};
  const lr = lastReviewDays(data);
  const c = counts(data);
  const t = todayIso();
  const noNext = projectsSorted(data).filter((p) => p.status === 'active' && !projectStats(data, p.id).open.length);
  const aiList = list(data.items).filter((i) => i.aiSorted && i.status !== 'done');
  const doneWeek = list(data.items).filter((i) => i.status === 'done' && i.doneAt && diffDays(t, i.doneAt) <= 7).length;
  const od = overdue(data).length;
  const up = upcoming(data).length;
  const pl = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;

  const validateAll = () => {
    aiList.forEach((i) => store.updateItem(i.id, { aiSorted: false }));
    projectsSorted(data)
      .filter((p) => p.aiSorted)
      .forEach((p) => store.updateProject(p.id, { aiSorted: false }));
    toast({ text: 'Tout est validé' });
  };

  const steps: { k: string; title: string; text: string; action?: React.ReactNode; inner?: React.ReactNode }[] = [
    { k: 'inbox', title: "Vider l'inbox", text: c.inbox ? `${pl(c.inbox, 'élément')} à ranger.` : 'Inbox vide.', action: c.inbox ? <button className="btn sm" onClick={() => go('inbox')}>Ouvrir</button> : null },
    {
      k: 'ai',
      title: "Vérifier ce que l'IA a rangé",
      text: aiList.length ? `${pl(aiList.length, 'élément')} rangé${aiList.length > 1 ? 's' : ''} automatiquement. Ouvre ceux qui te semblent faux, valide le reste.` : 'Rien à vérifier.',
      action: aiList.length ? <button className="btn sm" onClick={validateAll}>Tout valider</button> : null,
      inner: aiList.length ? <CardList items={aiList.slice(0, 15)} o={{ drag: false }} /> : null,
    },
    { k: 'past', title: 'Revoir la semaine passée', text: `${pl(doneWeek, 'action')} terminée${doneWeek > 1 ? 's' : ''} sur 7 jours${od ? `, ${pl(od, 'action')} en retard à replanifier.` : '.'}`, action: <button className="btn sm" onClick={() => go('journal')}>Journal</button> },
    { k: 'cal', title: "Regarder l'agenda des 2 prochaines semaines", text: `${pl(up, 'élément')} daté${up > 1 ? 's' : ''}.`, action: <button className="btn sm" onClick={() => { set({ cal: 'week', date: t }); go('day'); }}>Ouvrir</button> },
    { k: 'waiting', title: 'Relancer ce qui est en attente', text: `${pl(c.waiting, 'élément')} en attente.`, action: <button className="btn sm" onClick={() => go('waiting')}>Ouvrir</button> },
    { k: 'proj', title: 'Chaque projet actif a une prochaine action', text: noNext.length ? `${pl(noNext.length, 'projet')} sans prochaine action : ${noNext.map((p) => p.name).join(', ')}.` : 'Tous les projets actifs ont une prochaine action.', action: <button className="btn sm" onClick={() => go('projects')}>Projets</button> },
    { k: 'someday', title: 'Passer en revue « Un jour / peut-être »', text: `${pl(c.someday, 'idée')} en réserve. Active ce qui est mûr, supprime ce qui ne te parle plus.`, action: <button className="btn sm" onClick={() => go('someday')}>Ouvrir</button> },
    { k: 'goals', title: 'Relire tes objectifs', text: 'Est-ce que tes projets de la semaine servent ton cap ?', action: <button className="btn sm" onClick={() => go('goals')}>Objectifs</button> },
  ];
  const n = steps.filter((s) => ck[s.k]).length;
  return (
    <>
      <Head
        eyebrow="Prendre du recul"
        title="Revue hebdo"
        lede={`${lr === null ? 'Première revue.' : `Dernière revue ${lr === 0 ? "aujourd'hui" : `il y a ${pl(lr, 'jour')}`}`} · ${n}/${steps.length} étapes cochées.`}
        actions={
          <button
            className="btn primary"
            onClick={() => {
              store.setReview({ last: t, checks: {} });
              toast({ text: 'Revue terminée. Esprit clair pour la semaine.' });
            }}
          >
            Terminer la revue
          </button>
        }
      />
      <div className="steps">
        {steps.map((s, i) => (
          <div className={`step${ck[s.k] ? ' done' : ''}`} key={s.k}>
            <button className="num" onClick={() => store.setReview({ ...r, checks: { ...ck, [s.k]: !ck[s.k] } })} aria-label="Cocher l'étape">
              {ck[s.k] ? '✓' : i + 1}
            </button>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              {s.inner && <div className="inner">{s.inner}</div>}
            </div>
            <div className="vh-actions">{s.action}</div>
          </div>
        ))}
      </div>
    </>
  );
}
