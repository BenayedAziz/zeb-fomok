'use client';
import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from '@/lib/store';
import type { Data, Project } from '@/lib/types';
import { UIProvider, useUI, type View } from './ui-context';
import { Icon, type IconName } from './icons';
import { Drawer } from './Drawer';
import { Onboarding, ONB_KEY } from './Onboarding';
import { ImportPanel } from './Import';
import { CalendarView, Head } from './views/Calendar';
import { InboxView, JournalView, NextView, StatusListView } from './views/Lists';
import { ProjectView, ProjectsView } from './views/Projects';
import { GoalsView, ReviewView } from './views/Reflect';
import { PinsView } from './views/Pins';
import { SettingsView } from './views/Settings';
import { HelpView } from './views/Help';
import { TrashView } from './views/Trash';
import { FeedbackButton, FeedbackView, isAdmin } from './Feedback';
import { Mic } from './Mic';
import { Logo } from './Logo';
import { childrenOf, colorOfProject, counts, parentOf, domainsSorted, lastReviewDays, list, projectStats, projectsSorted, reviewDue } from '@/lib/gtd';
import { addDays, longDate, nextMonday, timeOf, todayIso } from '@/lib/dates';

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

/* Domaines ouverts par défaut, sous-projets repliés ; on se souvient des choix. Le chemin du projet affiché se déplie tout seul. */
const readSet = (k: string) => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(k) || '[]'));
  } catch {
    return new Set<string>();
  }
};
const writeSet = (k: string, s: Set<string>) => {
  try {
    localStorage.setItem(k, JSON.stringify([...s]));
  } catch {}
};
function useTree(data: Data, current: string | null) {
  const [closedDoms, setClosedDoms] = useState<Set<string>>(() => new Set());
  const [openProj, setOpenProj] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setClosedDoms(readSet('sc-closed-doms'));
    setOpenProj(readSet('sc-open-proj'));
  }, []);
  useEffect(() => {
    if (!current || !data.projects[current]) return;
    const parents: string[] = [];
    const doms: string[] = [];
    let p: Project | null = parentOf(data, data.projects[current]);
    if (data.projects[current].domainId) doms.push(data.projects[current].domainId!);
    while (p && !parents.includes(p.id)) {
      parents.push(p.id);
      if (p.domainId) doms.push(p.domainId);
      p = parentOf(data, p);
    }
    setOpenProj((o) => (parents.every((x) => o.has(x)) ? o : new Set([...o, ...parents])));
    setClosedDoms((c) => (doms.some((x) => c.has(x)) ? new Set([...c].filter((x) => !doms.includes(x))) : c));
  }, [current, data]);
  const flip = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => (id: string) =>
    set((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      writeSet(key, n);
      return n;
    });
  return { closedDoms, openProj, toggleDom: flip(setClosedDoms, 'sc-closed-doms'), toggleProj: flip(setOpenProj, 'sc-open-proj') };
}

function Caret({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button className={`nav-caret${open ? ' open' : ''}`} onClick={onClick} aria-expanded={open} aria-label={`${open ? 'Replier' : 'Déplier'} ${label}`}>
      <Icon name="right" />
    </button>
  );
}

function ProjNav({ p, depth, projects, opened, toggle }: { p: Project; depth: number; projects: Project[]; opened: Set<string>; toggle: (id: string) => void }) {
  const { data } = useStore();
  const { ui, go } = useUI();
  const kids = depth < 6 ? childrenOf(data, p.id, projects) : [];
  const isOpen = opened.has(p.id);
  const st = projectStats(data, p.id);
  return (
    <>
      <div className="nav-row" style={{ '--depth': depth } as React.CSSProperties}>
        <button className={`nav proj${ui.view === 'project' && ui.projectId === p.id ? ' on' : ''}`} onClick={() => go('project', { projectId: p.id })} title={p.name}>
          <i className="pdot" style={{ background: colorOfProject(data, p) }} />
          <span>{p.name}</span>
          {st.open.length ? <span className="n">{st.open.length}</span> : null}
        </button>
        {kids.length > 0 ? <Caret open={isOpen} onClick={() => toggle(p.id)} label={p.name} /> : <span className="caret-gap" />}
      </div>
      {isOpen && kids.map((k) => <ProjNav key={k.id} p={k} depth={depth + 1} projects={projects} opened={opened} toggle={toggle} />)}
    </>
  );
}

/** Le compte en bas du menu : les réglages et le reste s'ouvrent dans un petit menu, pour laisser la place aux projets. */
function AccountMenu() {
  const store = useStore();
  const { go } = useUI();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const pick = (v: View) => {
    setOpen(false);
    go(v);
  };
  const who = store.name || store.email?.split('@')[0] || 'Mode démo';
  return (
    <div className="acct" ref={ref}>
      {open && (
        <div className="acct-pop" role="menu">
          {isAdmin(store.email) && (
            <button className="nav" role="menuitem" onClick={() => pick('feedback')}>
              <Icon name="chat" />
              <span>Remarques des testeurs</span>
            </button>
          )}
          <button className="nav" role="menuitem" onClick={() => pick('settings')}>
            <Icon name="gear" />
            <span>Réglages</span>
          </button>
          <button className="nav" role="menuitem" onClick={() => pick('trash')}>
            <Icon name="trash" />
            <span>Corbeille</span>
          </button>
          <button className="nav" role="menuitem" onClick={() => pick('help')}>
            <Icon name="help" />
            <span>Comment ça marche</span>
          </button>
          <button className="nav" role="menuitem" onClick={() => pick('onboarding')}>
            <Icon name="chat" />
            <span>Refaire l&apos;entretien</span>
          </button>
          {store.mode === 'db' && (
            <button className="nav" role="menuitem" onClick={() => store.signOut()}>
              <Icon name="out" />
              <span>Se déconnecter</span>
            </button>
          )}
        </div>
      )}
      <button className={`acct-btn${open ? ' on' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <span className="avatar" aria-hidden="true">
          {who.charAt(0).toUpperCase()}
        </span>
        <span className="acct-who">
          <b>{who}</b>
          {store.email && <small>{store.email}</small>}
        </span>
        <Icon name="gear" />
      </button>
    </div>
  );
}

/** Le nuage qui danse quand on coche une action, la fête quand tout un projet est fini. */
function Dance() {
  const { ui } = useUI();
  const d = ui.dance;
  if (!d) return null;
  const puffs = d.big ? [[-120, -80], [110, -90], [-90, 60], [130, 40], [0, -130], [-150, -10]] : [];
  return (
    <div className={`dance${d.big ? ' big' : ''}`} key={d.key} aria-live="polite">
      {puffs.map(([dx, dy], i) => (
        <i key={i} className="puff" style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${0.15 + i * 0.12}s` } as React.CSSProperties} />
      ))}
      {d.src ? <img src={d.src} alt="" /> : <span className="logo-dance"><Logo size={d.big ? 150 : 92} /></span>}
      {d.text && <span className="dance-text">{d.text}</span>}
    </div>
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
  const orphans = projects.filter((p) => (!p.domainId || !data.domains[p.domainId]) && !parentOf(data, p));
  const pinned = projects.filter((p) => p.pinned);
  const { closedDoms, openProj, toggleDom, toggleProj } = useTree(data, ui.view === 'project' ? ui.projectId : null);
  const groups = [
    ...doms.map((d) => ({ id: d.id, name: d.name, color: `var(--${d.color})`, top: projects.filter((p) => p.domainId === d.id && !parentOf(data, p)) })),
    ...(orphans.length ? [{ id: 'none', name: 'Sans domaine', color: 'var(--line-2)', top: orphans }] : []),
  ];
  return (
    <>
      <aside className="side" aria-label="Navigation">
        <div className="side-top">
          <div className="brand">
            <span className="logo">
              <Logo />
            </span>
          </div>
          <nav className="nav-group">
            <NavBtn view="day" label="Ma journée" icon="day" n={c.overdue || undefined} warn />
            <NavBtn view="inbox" label="Inbox" icon="inbox" n={c.inbox || undefined} hot />
            <i className="nav-sep" />
            <NavBtn view="next" label="Prochaines actions" icon="next" n={c.next || undefined} />
            {data.settings.showWaitingSomeday && (
              <>
                <NavBtn view="waiting" label="En attente" icon="wait" n={c.waiting || undefined} />
                <NavBtn view="someday" label="Un jour / peut-être" icon="someday" n={c.someday || undefined} />
              </>
            )}
            <NavBtn view="pins" label="Ressources épinglées" icon="pin" n={c.pins || undefined} />
            <i className="nav-sep" />
            <div className="nav-mini" role="group" aria-label="Prendre du recul">
              {(
                [
                  ['goals', 'Objectifs', 'goal', false],
                  ['review', 'Revue', 'review', reviewDue(data)],
                  ['journal', 'Journal', 'done', false],
                ] as [View, string, IconName, boolean][]
              ).map(([v, l, ic, due]) => (
                <button key={v} className={`${ui.view === v ? 'on' : ''}${due ? ' due' : ''}`} onClick={() => go(v)} aria-current={ui.view === v ? 'page' : undefined} title={v === 'review' && due ? (lr === null ? 'Pas encore de revue' : `Dernière revue il y a ${lr} j`) : l}>
                  <Icon name={ic} />
                  <span>{l}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>

        <div className="side-mid">
          <div className="mid-head">
            <button className={`mid-title${ui.view === 'projects' && !ui.domainFilter ? ' on' : ''}`} onClick={() => go('projects')}>
              <Icon name="proj" />
              Projets
            </button>
            <button className="mid-add" onClick={() => openDrawer({ type: 'project', id: null })} aria-label="Nouveau projet" title="Nouveau projet">
              <Icon name="plus" />
            </button>
          </div>
          {pinned.length > 0 && (
            <div className="proj-group pinned">
              {pinned.map((p) => (
                <div className="nav-row" key={p.id}>
                  <button className={`nav proj${ui.view === 'project' && ui.projectId === p.id ? ' on' : ''}`} onClick={() => go('project', { projectId: p.id })} title={p.name}>
                    <Icon name="pin" />
                    <span>{p.name}</span>
                  </button>
                  <span className="caret-gap" />
                </div>
              ))}
            </div>
          )}
          {groups.map((g) => {
            const isOpen = !closedDoms.has(g.id);
            if (!g.top.length && g.id === 'none') return null;
            return (
              <div className="proj-group" key={g.id}>
                <div className="dom-row">
                  <button className={`nav-caret${isOpen ? ' open' : ''}`} onClick={() => toggleDom(g.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Replier' : 'Déplier'} ${g.name}`} disabled={!g.top.length}>
                    <Icon name="right" />
                  </button>
                  <button className={`dom-name${ui.view === 'projects' && ui.domainFilter === g.id ? ' on' : ''}`} onClick={() => (g.id === 'none' ? go('projects') : go('projects', { domain: g.id }))}>
                    <i className="sw" style={{ background: g.color }} />
                    <span>{g.name}</span>
                    {g.top.length > 0 && <span className="n">{g.top.length}</span>}
                  </button>
                </div>
                {isOpen && g.top.map((p) => <ProjNav key={p.id} p={p} depth={0} projects={projects} opened={openProj} toggle={toggleProj} />)}
              </div>
            );
          })}
          {!projects.length && (
            <button className="mid-empty" onClick={() => openDrawer({ type: 'project', id: null })}>
              Pas encore de projet. Capture une idée, l&apos;IA en crée, ou crée-le ici.
            </button>
          )}
          <button className="mid-dom" onClick={() => openDrawer({ type: 'domain', id: null })}>
            <Icon name="plus" />
            Nouveau domaine de vie
          </button>
        </div>

        <div className="side-foot">
          <NavBtn view="import" label="Importer mes outils" icon="import" />
          <AccountMenu />
        </div>
      </aside>
      <div className="side-scrim" onClick={() => set({ navOpen: false })} />
    </>
  );
}

/**
 * Dictée qui capture toute seule : quand la transcription est finie, le texte part directement à l'IA.
 * Ce qui était déjà tapé dans le champ est gardé devant le texte dicté.
 */
function useVoiceCapture(setV: (s: string) => void, send: (t: string) => void) {
  const typed = useRef('');
  return {
    type: (s: string) => {
      typed.current = s;
      setV(s);
    },
    onText: (t: string, final: boolean) => {
      const all = [typed.current.trim(), t.trim()].filter(Boolean).join(' ');
      if (!final) return setV(all);
      typed.current = '';
      setV('');
      if (all) send(all);
    },
  };
}

function TopBar() {
  const store = useStore();
  const { ui, set, capture, toast } = useUI();
  const [v, setV] = useState('');
  const voice = useVoiceCapture(setV, (t) => capture(t));
  const titles: Partial<Record<View, string>> = { day: 'Ma journée', inbox: 'Inbox', next: 'Prochaines actions', waiting: 'En attente', someday: 'Un jour / peut-être', projects: 'Projets', project: 'Projet', pins: 'Épinglés', goals: 'Objectifs', review: 'Revue', journal: 'Journal', import: 'Importer', settings: 'Réglages', help: 'Aide', trash: 'Corbeille', feedback: 'Remarques' };
  return (
    <header className="top">
      <button className="icon-btn menu-btn" onClick={() => set({ navOpen: true })} aria-label="Ouvrir le menu">
        <Icon name="menu" />
      </button>
      <span className="title-sm">{titles[ui.view] || ''}</span>
      <div className="halo">
      <form
        className="capture"
        onSubmit={(e) => {
          e.preventDefault();
          const t = v;
          voice.type('');
          capture(t);
        }}
      >
        <span className="cap-ico" aria-hidden="true">
          <Icon name="sparkle" />
        </span>
        <label htmlFor="captureInput" className="sr">
          Capturer une idée ou une tâche
        </label>
        <input id="captureInput" value={v} onChange={(e) => voice.type(e.target.value)} placeholder="Note une idée, une tâche, un rendez-vous…" autoComplete="off" enterKeyHint="send" />
        <Mic onText={voice.onText} onError={(m) => toast({ text: m })} />
        <span className="kbd">C</span>
        <button className="btn primary" type="submit" disabled={!v.trim()}>
          Capturer
        </button>
      </form>
      </div>
      <div className={`sync ${store.mode === 'db' ? 'ok' : 'demo'}`}>
        <i />
        <span>{store.mode === 'db' ? 'Synchronisé' : 'Mode démo : données dans ce navigateur'}</span>
      </div>
      <FeedbackButton />
    </header>
  );
}

function CaptureSheet() {
  const { ui, set, capture, toast } = useUI();
  const [v, setV] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const preset = ui.capturePreset;
  const voice = useVoiceCapture(setV, (t) => {
    set({ captureOpen: false, capturePreset: null });
    capture(t, preset || undefined);
  });
  useEffect(() => {
    if (ui.captureOpen) setTimeout(() => ref.current?.focus(), 30);
  }, [ui.captureOpen]);
  if (!ui.captureOpen) return null;
  const close = () => set({ captureOpen: false, capturePreset: null });
  const submit = () => {
    const t = v;
    if (!t.trim()) return;
    voice.type('');
    close();
    capture(t, preset || undefined);
  };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Capturer">
      <div className="scrim" onClick={close} />
      <form
        className="sheet"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="sheet-head">
          <span className="eyebrow" style={{ margin: 0 }}>
            Capturer
          </span>
          {preset?.date && (
            <span className="chip date today">
              {longDate(preset.date)}
              {preset.time ? ` · ${preset.time}` : ''}
            </span>
          )}
        </div>
        <div className="sheet-input">
          <textarea
            ref={ref}
            className="big"
            rows={3}
            value={v}
            onChange={(e) => voice.type(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={preset?.time ? 'Qu’est-ce que tu mets sur ce créneau ?' : "Une ou plusieurs choses : tâches, rendez-vous, liens… L'IA range chaque élément."}
            aria-label="Ce que tu as en tête"
          />
          <Mic onText={voice.onText} onError={(m) => toast({ text: m })} />
        </div>
        <div className="vh-actions" style={{ justifyContent: 'space-between' }}>
          <span className="hint">Ex. « MMA tous les mardis 19h, anniversaire de Sarah le 12 mars, finir le devis Egyptours »</span>
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
      <span className="t-text">
        <Icon name="sparkle" />
        {toastState.text}
      </span>
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
    case 'pins':
      return <PinsView />;
    case 'settings':
      return <SettingsView />;
    case 'help':
      return <HelpView />;
    case 'trash':
      return <TrashView />;
    case 'feedback':
      return <FeedbackView />;
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
    set({ cal: store.data.settings.defaultCal || 'day' });
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
      if (v && ['day', 'inbox', 'next', 'waiting', 'someday', 'projects', 'pins', 'goals', 'review', 'journal', 'settings', 'help', 'trash', 'feedback'].includes(v)) set({ view: v });
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
        if (ui.ui.captureOpen) return set({ captureOpen: false, capturePreset: null });
        if (ui.ui.navOpen) return set({ navOpen: false });
        if (el.id === 'captureInput') el.blur();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCapture();
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'c' || e.key === 'C' || e.key === '/') {
        e.preventDefault();
        openCapture();
        return;
      }
      const cal = ({ j: 'day', s: 'week', m: 'month' } as Record<string, 'day' | 'week' | 'month'>)[e.key.toLowerCase()];
      if (cal && !ui.ui.drawer && !ui.ui.captureOpen) {
        e.preventDefault();
        set({ view: 'day', cal });
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
      if (z.dataset.drop === 'timeline') {
        // L'heure dépend de l'endroit où on lâche la carte, au quart d'heure près.
        const rect = z.getBoundingClientRect();
        const hp = Number(z.dataset.hourpx) || 52;
        const st = Number(z.dataset.start) || 0;
        const min = Math.max(0, Math.min(24 * 60 - 15, Math.round((st * 60 + ((e.clientY - rect.top) / hp) * 60) / 15) * 15));
        return ui.schedule(id, date, timeOf(min));
      }
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
        <svg className="fab-cloud" viewBox="0 0 120 60" aria-hidden="true">
          <path fill="currentColor" d="M32 57 A16 16 0 0 1 21 27 A24 24 0 0 1 67 15 A18 18 0 0 1 99 34 A11.5 11.5 0 0 1 93 57 Z" />
        </svg>
        <Icon name="plus" />
      </button>
      <TabBar />
      <Drawer />
      <CaptureSheet />
      <PlanPopover />
      <Dance />
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
