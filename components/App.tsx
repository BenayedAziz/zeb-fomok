'use client';
import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import { UIProvider, useUI, type View } from './ui-context';
import { Icon, type IconName } from './icons';
import { Drawer } from './Drawer';
import { Onboarding, ONB_KEY } from './Onboarding';
import { ImportPanel } from './Import';
import { CalendarView, Head } from './views/Calendar';
import { InboxView, JournalView, NextView, StatusListView } from './views/Lists';
import { ProjectView, ProjectsView } from './views/Projects';
import { GoalsView, ReviewView } from './views/Reflect';
import { counts, domainsSorted, lastReviewDays, list, projectStats, projectsSorted } from '@/lib/gtd';
import { addDays, nextMonday, todayIso } from '@/lib/dates';

const IMPORT_ERRORS: Record<string, string> = {
  not_configured: "Cette connexion n'est pas encore activée sur le site.",
  denied: 'Connexion annulée.',
  token: "La connexion n'a pas abouti. Réessaie.",
  unknown: 'Outil inconnu.',
};

function NavBtn({ view, label, icon, n, hot, warn }: { view: View; label: string; icon: IconName; n?: number | string; hot?: boolean; warn?: boolean }) {
  const { ui, go } = useUI();
  const on = ui.view === view;
  return (
    <button className={`nav${on ? ' on' : ''}`} onClick={() => go(view)} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {n ? <span className={`n${hot ? ' hot' : ''}${warn ? ' warn' : ''}`}>{n}</span> : null}
    </button>
  );
}

function Sidebar() {
  const store = useStore();
  const { data } = store;
  const { ui, go, openDrawer, set } = useUI();
  const c = counts(data);
  const lr = lastReviewDays(data);
  const doms = domainsSorted(data);
  const projects = projectsSorted(data).filter((p) => p.status === 'active');
  const orphans = projects.filter((p) => !p.domainId || !data.domains[p.domainId]);
  return (
    <>
      <aside className="side" aria-label="Navigation">
        <div className="brand">
          <span className="logo">SC</span>
          <div>
            <b>Second Cerveau</b>
            <small>Méthode GTD</small>
          </div>
        </div>
        <div className="nav-group">
          <div className="nav-label">Agir</div>
          <NavBtn view="day" label="Ma journée" icon="day" n={c.overdue || undefined} warn />
        </div>
        <div className="nav-group">
          <div className="nav-label">Capturer</div>
          <NavBtn view="inbox" label="Inbox" icon="inbox" n={c.inbox || undefined} hot />
        </div>
        <div className="nav-group">
          <div className="nav-label">Organiser</div>
          <NavBtn view="next" label="Prochaines actions" icon="next" n={c.next || undefined} />
          <NavBtn view="waiting" label="En attente" icon="wait" n={c.waiting || undefined} />
          <NavBtn view="someday" label="Un jour / peut-être" icon="someday" n={c.someday || undefined} />
          <NavBtn view="projects" label="Projets" icon="proj" />
        </div>
        <div className="nav-group">
          <div className="nav-label">Prendre du recul</div>
          <NavBtn view="goals" label="Objectifs" icon="goal" />
          <NavBtn view="review" label="Revue hebdo" icon="review" n={lr === null || lr >= 7 ? (lr === null ? '!' : `${lr} j`) : undefined} warn />
          <NavBtn view="journal" label="Journal" icon="done" />
        </div>
        <div className="nav-group">
          <div className="nav-label">
            Domaines
            <button onClick={() => openDrawer({ type: 'domain', id: null })} aria-label="Ajouter un domaine" title="Ajouter un domaine">
              +
            </button>
          </div>
          {!doms.length && <div className="hint" style={{ padding: '2px 8px' }}>Aucun domaine pour l&apos;instant.</div>}
          {doms.map((d) => (
            <div key={d.id}>
              <button className={`nav${ui.view === 'projects' && ui.domainFilter === d.id ? ' on' : ''}`} onClick={() => go('projects', { domain: d.id })}>
                <i className="sw" style={{ background: `var(--${d.color})` }} />
                <span>{d.name}</span>
              </button>
              {projects
                .filter((p) => p.domainId === d.id)
                .map((p) => {
                  const st = projectStats(data, p.id);
                  return (
                    <button key={p.id} className={`nav sub${ui.view === 'project' && ui.projectId === p.id ? ' on' : ''}`} onClick={() => go('project', { projectId: p.id })}>
                      <span>{p.name}</span>
                      {st.open.length ? <span className="n">{st.open.length}</span> : null}
                    </button>
                  );
                })}
            </div>
          ))}
          {orphans.length > 0 && (
            <>
              <div className="nav-label" style={{ paddingTop: 8 }}>
                Sans domaine
              </div>
              {orphans.map((p) => (
                <button key={p.id} className={`nav sub${ui.view === 'project' && ui.projectId === p.id ? ' on' : ''}`} onClick={() => go('project', { projectId: p.id })}>
                  <span>{p.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="side-foot">
          <NavBtn view="import" label="Importer depuis mes outils" icon="import" />
          <button className="nav" onClick={() => go('onboarding')}>
            <Icon name="chat" />
            <span>Refaire l&apos;entretien</span>
          </button>
          {store.mode === 'db' && (
            <button className="nav" onClick={() => store.signOut()}>
              <Icon name="out" />
              <span>Se déconnecter</span>
            </button>
          )}
          {store.email && <div className="who">{store.email}</div>}
        </div>
      </aside>
      <div className="side-scrim" onClick={() => set({ navOpen: false })} />
    </>
  );
}

function TopBar() {
  const store = useStore();
  const { ui, set, capture } = useUI();
  const [v, setV] = useState('');
  const titles: Partial<Record<View, string>> = { day: 'Ma journée', inbox: 'Inbox', next: 'Prochaines actions', waiting: 'En attente', someday: 'Un jour / peut-être', projects: 'Projets', project: 'Projet', goals: 'Objectifs', review: 'Revue hebdo', journal: 'Journal', import: 'Importer' };
  return (
    <header className="top">
      <button className="icon-btn menu-btn" onClick={() => set({ navOpen: true })} aria-label="Ouvrir le menu">
        <Icon name="menu" />
      </button>
      <span className="title-sm">{titles[ui.view] || ''}</span>
      <form
        className="capture"
        onSubmit={(e) => {
          e.preventDefault();
          const t = v;
          setV('');
          capture(t);
        }}
      >
        <Icon name="plus" />
        <label htmlFor="captureInput" className="sr">
          Capturer une idée ou une tâche
        </label>
        <input id="captureInput" value={v} onChange={(e) => setV(e.target.value)} placeholder="Note n'importe quoi, l'IA le range… (ex. « Appeler Karim jeudi 14h »)" autoComplete="off" enterKeyHint="send" />
        <span className="kbd">C</span>
        <button className="btn primary sm" type="submit" disabled={!v.trim()}>
          Capturer
        </button>
      </form>
      <div className={`sync ${store.mode === 'db' ? 'ok' : 'demo'}`}>
        <i />
        <span>{store.mode === 'db' ? 'Synchronisé' : 'Mode démo : données dans ce navigateur'}</span>
      </div>
    </header>
  );
}

function CaptureSheet() {
  const { ui, set, capture } = useUI();
  const [v, setV] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ui.captureOpen) setTimeout(() => ref.current?.focus(), 30);
  }, [ui.captureOpen]);
  if (!ui.captureOpen) return null;
  const submit = () => {
    const t = v;
    setV('');
    set({ captureOpen: false });
    capture(t);
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Capturer">
      <div className="scrim" onClick={() => set({ captureOpen: false })} />
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="eyebrow" style={{ margin: 0 }}>
          Capturer
        </div>
        <textarea
          ref={ref}
          className="big"
          rows={3}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Une idée, une tâche, un rendez-vous… L'IA s'occupe de ranger."
          aria-label="Ce que tu as en tête"
        />
        <div className="vh-actions" style={{ justifyContent: 'space-between' }}>
          <span className="hint">Ex. « Séance de MMA tous les mardis 19h », « Relancer François pour le devis »</span>
          <button className="btn primary" type="submit" disabled={!v.trim()}>
            Capturer
          </button>
        </div>
      </form>
    </div>
  );
}

function PlanPopover() {
  const { ui, set, schedule } = useUI();
  const { data } = useStore();
  const [custom, setCustom] = useState('');
  if (!ui.plan) return null;
  const it = data.items[ui.plan.id];
  if (!it) return null;
  const t = todayIso();
  const opts: [string, string | null, string][] = [
    ["Aujourd'hui", t, ''],
    ['Demain', addDays(t, 1), ''],
    ['Lundi prochain', nextMonday(), ''],
    ['Dans une semaine', addDays(t, 7), ''],
  ];
  return (
    <div className="overlay" onClick={() => set({ plan: null })}>
      <div className="pop" style={{ left: Math.max(8, ui.plan.x), top: Math.max(8, ui.plan.y) }} onClick={(e) => e.stopPropagation()} role="menu" aria-label="Planifier">
        {opts.map(([l, d]) => (
          <button key={l} className="opt" role="menuitem" onClick={() => schedule(it.id, d)}>
            <span>{l}</span>
            <span>{d ? d.slice(5).split('-').reverse().join('/') : ''}</span>
          </button>
        ))}
        {it.date && (
          <button className="opt" role="menuitem" onClick={() => schedule(it.id, null)}>
            <span>Retirer la date</span>
            <span />
          </button>
        )}
        <div className="sep" />
        <input className="inp" type="date" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Choisir une date" />
        <button className="btn sm primary" style={{ margin: 4 }} disabled={!custom} onClick={() => schedule(it.id, custom)}>
          Planifier à cette date
        </button>
      </div>
    </div>
  );
}

function Toast() {
  const { toastState, dismissToast } = useUI();
  if (!toastState) return null;
  return (
    <div className="toast" role="status" aria-live="polite" key={toastState.key}>
      <span>{toastState.text}</span>
      {toastState.chips && (
        <span className="tchips">
          {toastState.chips.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </span>
      )}
      {toastState.actions?.map((a) => (
        <button
          key={a.label}
          onClick={() => {
            a.run();
            dismissToast();
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function TabBar() {
  const { ui, go } = useUI();
  const { data } = useStore();
  const c = counts(data);
  const tabs: [View, string, IconName, number?][] = [
    ['day', 'Journée', 'day'],
    ['inbox', 'Inbox', 'inbox', c.inbox],
    ['next', 'Actions', 'next'],
    ['projects', 'Projets', 'proj'],
    ['review', 'Revue', 'review'],
  ];
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {tabs.map(([v, l, i, n]) => (
        <button key={v} className={ui.view === v || (v === 'projects' && ui.view === 'project') ? 'on' : ''} onClick={() => go(v)}>
          <Icon name={i} />
          {l}
          {n ? <span className="badge">{n}</span> : null}
        </button>
      ))}
    </nav>
  );
}

function ImportView() {
  const { ui } = useUI();
  return (
    <>
      <Head eyebrow="Capturer" title="Importer depuis mes outils" lede="L'IA lit tes outils et te propose des projets et des actions. Tu coches ce que tu gardes, rien n'est ajouté sans ton accord." />
      <ImportPanel autoSource={ui.importSource} />
    </>
  );
}

function Main() {
  const { ui } = useUI();
  switch (ui.view) {
    case 'inbox':
      return <InboxView />;
    case 'next':
      return <NextView />;
    case 'waiting':
      return <StatusListView status="waiting" />;
    case 'someday':
      return <StatusListView status="someday" />;
    case 'projects':
      return <ProjectsView />;
    case 'project':
      return <ProjectView />;
    case 'goals':
      return <GoalsView />;
    case 'review':
      return <ReviewView />;
    case 'journal':
      return <JournalView />;
    case 'import':
      return <ImportView />;
    default:
      return <CalendarView />;
  }
}

function Shell() {
  const store = useStore();
  const ui = useUI();
  const { set, go, toast } = ui;
  const booted = useRef(false);

  useEffect(() => {
    store.onError((m) => toast({ text: m }));
  }, [store, toast]);

  /* première ouverture : vue mémorisée, retour d'une connexion d'outil, accueil */
  useEffect(() => {
    if (!store.ready || booted.current) return;
    booted.current = true;
    const params = new URLSearchParams(window.location.search);
    const imp = params.get('import');
    const err = params.get('import_error');
    if (imp || err) {
      window.history.replaceState(null, '', window.location.pathname);
      if (err) toast({ text: IMPORT_ERRORS[err] || "L'import n'a pas abouti." });
      set({ view: 'import', importSource: imp });
      return;
    }
    let done = false;
    try {
      done = localStorage.getItem(ONB_KEY) === '1';
    } catch {
      /* ignore */
    }
    const empty = !list(store.data.domains).length && !list(store.data.items).length && !list(store.data.projects).length;
    if (empty && !done) {
      set({ view: 'onboarding' });
      return;
    }
    try {
      const v = localStorage.getItem('sc-view') as View | null;
      if (v && ['day', 'inbox', 'next', 'waiting', 'someday', 'projects', 'goals', 'review', 'journal'].includes(v)) set({ view: v });
    } catch {
      /* ignore */
    }
  }, [store.ready, store.data, set, toast]);

  /* raccourcis clavier */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable;
      if (e.key === 'Escape') {
        if (ui.ui.plan) return set({ plan: null });
        if (ui.ui.drawer) {
          (document.activeElement as HTMLElement | null)?.blur();
          return set({ drawer: null });
        }
        if (ui.ui.captureOpen) return set({ captureOpen: false });
        if (ui.ui.navOpen) return set({ navOpen: false });
        if (el.id === 'captureInput') el.blur();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCapture();
        return;
      }
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === 'c' || e.key === 'C' || e.key === '/')) {
        e.preventDefault();
        openCapture();
      }
    };
    const openCapture = () => {
      const input = document.getElementById('captureInput') as HTMLInputElement | null;
      if (input && input.offsetParent !== null) input.focus();
      else set({ captureOpen: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.ui.plan, ui.ui.drawer, ui.ui.captureOpen, ui.ui.navOpen, set]);

  /* glisser-déposer vers le calendrier */
  useEffect(() => {
    let dragId: string | null = null;
    const clear = () => document.querySelectorAll('.dragging,.drop-on').forEach((x) => x.classList.remove('dragging', 'drop-on'));
    const start = (e: DragEvent) => {
      const c = (e.target as HTMLElement).closest?.('[data-drag]') as HTMLElement | null;
      if (!c || c.getAttribute('draggable') !== 'true') return;
      dragId = c.dataset.drag || null;
      c.classList.add('dragging');
      try {
        e.dataTransfer?.setData('text/plain', dragId || '');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      } catch {
        /* ignore */
      }
    };
    const over = (e: DragEvent) => {
      if (!dragId) return;
      const z = (e.target as HTMLElement).closest?.('[data-drop]') as HTMLElement | null;
      if (!z) return;
      e.preventDefault();
      document.querySelectorAll('.drop-on').forEach((x) => x !== z && x.classList.remove('drop-on'));
      z.classList.add('drop-on');
    };
    const drop = (e: DragEvent) => {
      const z = (e.target as HTMLElement).closest?.('[data-drop]') as HTMLElement | null;
      const id = dragId;
      dragId = null;
      clear();
      if (!z || !id) return;
      e.preventDefault();
      if (z.dataset.drop === 'backlog') return ui.schedule(id, null);
      const date = z.dataset.date;
      if (!date) return;
      const time = z.dataset.time ? z.dataset.time : z.dataset.keeptime ? undefined : null;
      ui.schedule(id, date, time);
    };
    const end = () => {
      dragId = null;
      clear();
    };
    document.addEventListener('dragstart', start);
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    document.addEventListener('dragend', end);
    return () => {
      document.removeEventListener('dragstart', start);
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
      document.removeEventListener('dragend', end);
    };
  }, [ui]);

  if (!store.ready) {
    return (
      <div className="login">
        <span className="hint">Chargement de tes listes…</span>
      </div>
    );
  }

  if (ui.ui.view === 'onboarding') {
    return (
      <div className="work" style={{ height: '100%' }}>
        <main className="main" style={{ maxWidth: 860, margin: '0 auto' }}>
          <Onboarding onFinish={() => go('day')} />
        </main>
        <Toast />
      </div>
    );
  }

  return (
    <div className={`app${ui.ui.navOpen ? ' nav-open' : ''}`}>
      <Sidebar />
      <div className="work">
        <TopBar />
        <main className="main" id="main">
          {store.error && <div className="alert crit" style={{ marginBottom: 16 }}>Impossible de charger tes données : {store.error}</div>}
          <Main />
        </main>
      </div>
      <button className="fab" onClick={() => set({ captureOpen: true })} aria-label="Capturer">
        <Icon name="plus" />
      </button>
      <TabBar />
      <Drawer />
      <CaptureSheet />
      <PlanPopover />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </StoreProvider>
  );
}
