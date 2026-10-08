'use client';
import { useStore } from '@/lib/store';
import { useUI } from '../ui-context';
import { CardList, GroupedByProject } from '../Card';
import { Head } from './Calendar';
import { contextsOf, isOpen, list, sortItems } from '@/lib/gtd';
import { longDate, todayIso } from '@/lib/dates';

export function InboxView() {
  const { data } = useStore();
  const { ui, aiSort } = useUI();
  const its = list(data.items)
    .filter((i) => i.status === 'inbox')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const runAll = async () => {
    for (const i of its) {
      if (!ui.pending[i.id]) await aiSort(i.id);
    }
  };
  return (
    <>
      <Head
        eyebrow="Capturer"
        title="Inbox"
        lede="Tout ce que tu notes passe par ici. L'IA le range en quelques secondes ; ce qui reste attend une décision de ta part."
        actions={
          its.length > 0 && !ui.aiOff ? (
            <button className="btn primary" onClick={runAll}>
              Tout ranger avec l&apos;IA
            </button>
          ) : undefined
        }
      />
      <CardList
        items={its}
        o={{ drag: false }}
        empty={
          <div className="empty">
            <b>Inbox vide.</b> Tape une idée, une tâche ou un rendez-vous dans la barre du haut (touche <span className="kbd">C</span>), ou avec le bouton + sur ton téléphone. L&apos;IA le range dans le bon projet, avec une date, un contexte et une priorité.
          </div>
        }
      />
      {its.length > 0 && <p className="hint" style={{ marginTop: 12 }}>Clique un élément pour le ranger toi-même.</p>}
    </>
  );
}

export function NextView() {
  const { data } = useStore();
  const { ui, set } = useUI();
  const t = todayIso();
  const ctxs = contextsOf(data.settings);
  const byProject = !data.settings.showContexts || ui.ctx === 'project';
  const its = list(data.items).filter((i) => isOpen(i) && (!i.date || i.date <= t));
  const groups = (ui.ctx === 'all' ? [...ctxs, ['', 'Sans contexte'] as [string, string]] : ctxs.filter(([k]) => k === ui.ctx))
    .map(([k, l]) => [l, its.filter((i) => (i.context || '') === k).sort(sortItems)] as const)
    .filter(([, g]) => g.length);
  return (
    <>
      <Head
        eyebrow="Organiser"
        title="Prochaines actions"
        lede={byProject ? "Tout ce que tu peux faire maintenant, rangé par projet." : "Tout ce que tu peux faire maintenant, rangé par contexte : regarde la colonne qui correspond à l'endroit où tu es."}
      />
      {data.settings.showContexts && (
        <div className="filters">
          <div className="pick">
            {([['all', 'Par contexte'], ['project', 'Par projet']] as [string, string][]).concat(ctxs).map(([k, l]) => (
              <button key={k} className={ui.ctx === k ? 'on' : ''} onClick={() => set({ ctx: k })}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      {!its.length ? (
        <div className="empty">Aucune prochaine action. Capture quelque chose ou ouvre un projet pour définir sa prochaine étape.</div>
      ) : byProject ? (
        <GroupedByProject items={[...its].sort(sortItems)} />
      ) : !groups.length ? (
        <div className="empty">Rien dans ce contexte pour l&apos;instant.</div>
      ) : (
        <div className="ctx-groups">
          {groups.map(([l, g]) => (
            <div className="sec" key={l}>
              <div className="sec-head">
                <h2>
                  {l} <span className="n">{g.length}</span>
                </h2>
              </div>
              <CardList items={g} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function StatusListView({ status }: { status: 'waiting' | 'someday' }) {
  const { data } = useStore();
  const its = list(data.items)
    .filter((i) => i.status === status)
    .sort(sortItems);
  const meta =
    status === 'waiting'
      ? { title: 'En attente', lede: "Ce que tu as délégué, à une personne ou à Hermes, et ce que tu attends de quelqu'un. Relance ce qui traîne." }
      : { title: 'Un jour / peut-être', lede: "Les idées, envies et outils repérés que tu ne t'engages pas encore à faire. Tu les passes en revue chaque semaine." };
  return (
    <>
      <Head eyebrow="Organiser" title={meta.title} lede={meta.lede} />
      <CardList items={its} o={{ drag: false }} empty={<div className="empty">Rien ici pour l&apos;instant.</div>} />
    </>
  );
}

export function JournalView() {
  const { data } = useStore();
  const its = list(data.items)
    .filter((i) => i.status === 'done')
    .sort((a, b) => ((b.doneAt || '') < (a.doneAt || '') ? -1 : 1));
  const by: Record<string, typeof its> = {};
  its.forEach((i) => {
    const k = i.doneAt || '—';
    (by[k] = by[k] || []).push(i);
  });
  return (
    <>
      <Head eyebrow="Prendre du recul" title="Journal" lede="Ce que tu as terminé, jour par jour." />
      {!its.length ? (
        <div className="empty">Rien de terminé pour l&apos;instant. Coche une action pour la voir apparaître ici.</div>
      ) : (
        <div className="stack">
          {Object.keys(by).map((k) => (
            <div className="sec" key={k}>
              <div className="sec-head">
                <h2 style={{ textTransform: 'capitalize' }}>
                  {k === '—' ? 'Sans date' : longDate(k)} <span className="n">{by[k].length}</span>
                </h2>
              </div>
              <CardList items={by[k]} o={{ drag: false }} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
