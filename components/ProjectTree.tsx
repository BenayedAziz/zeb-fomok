'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Project } from '@/lib/types';
import { useUI } from './ui-context';
import { Icon } from './icons';
import { childrenOf, colorOfProject, domainsSorted, projectStats } from '@/lib/gtd';

/* Menu des projets : glisser un projet sur un domaine de vie pour l'y ranger (souris : on glisse ;
   doigt : appui long puis on glisse), et un menu « ⋯ » pour le reste (déplacer, épingler, archiver, supprimer). */

const HOLD_MS = 450;
type Menu = { id: string; x: number; y: number } | null;
type Drag = { id: string; name: string; x: number; y: number; over: string | null } | null;

interface TreeApi {
  start: (e: React.PointerEvent, p: Project) => void;
  /** Vrai juste après un glisser : le clic qui suit ne doit pas ouvrir le projet. */
  swallowClick: () => boolean;
  openMenu: (id: string, el: HTMLElement) => void;
  dragId: string | null;
  over: string | null;
}
const TreeCtx = createContext<TreeApi | null>(null);
const useTree = () => useContext(TreeCtx)!;

/** Domaine sous le pointeur ('none' = sans domaine). */
const domainAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-dom]') as HTMLElement | null)?.dataset.dom ?? null;

export function ProjectTreeProvider({ scrollRef, children }: { scrollRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const { data } = useStore();
  const { moveProject } = useUI();
  const [drag, setDrag] = useState<Drag>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const pending = useRef<{ p: Project; x0: number; y0: number; touch: boolean; timer: ReturnType<typeof setTimeout> | null; moved: boolean } | null>(null);
  const dragRef = useRef<Drag>(null);
  dragRef.current = drag;
  const swallow = useRef(false);

  // Au doigt, pendant un déplacement, la liste ne défile pas.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => dragRef.current && e.cancelable && e.preventDefault();
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, [scrollRef]);

  // Écouteurs stables posés sur la fenêtre, qui appellent toujours la version à jour des fonctions ci-dessous.
  const handlers = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void }>({ move: () => {}, up: () => {} });
  const stable = useRef({ move: (e: PointerEvent) => handlers.current.move(e), up: (e: PointerEvent) => handlers.current.up(e), cancel: () => finishRef.current() }).current;
  const finish = useCallback(() => {
    const pd = pending.current;
    if (pd?.timer) clearTimeout(pd.timer);
    pending.current = null;
    setDrag(null);
    window.removeEventListener('pointermove', stable.move);
    window.removeEventListener('pointerup', stable.up);
    window.removeEventListener('pointercancel', stable.cancel);
  }, [stable]);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const begin = (p: Project, x: number, y: number) => {
    swallow.current = true;
    try {
      navigator.vibrate?.(15);
    } catch {}
    setMenu(null);
    setDrag({ id: p.id, name: p.name, x, y, over: domainAt(x, y) });
  };

  function onMove(e: PointerEvent) {
    const pd = pending.current;
    if (!pd) return;
    const dist = Math.hypot(e.clientX - pd.x0, e.clientY - pd.y0);
    if (!dragRef.current) {
      if (pd.touch) {
        if (dist > 10) finish(); // c'est un défilement
      } else if (dist > 6) begin(pd.p, e.clientX, e.clientY);
      return;
    }
    if (dist > 6) pd.moved = true;
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: domainAt(e.clientX, e.clientY) } : d));
    // Près des bords de la liste, on la fait défiler pour atteindre les domaines cachés.
    const box = scrollRef.current?.getBoundingClientRect();
    if (box) {
      if (e.clientY < box.top + 36) scrollRef.current!.scrollBy({ top: -14 });
      else if (e.clientY > box.bottom - 36) scrollRef.current!.scrollBy({ top: 14 });
    }
  }
  function onUp(e: PointerEvent) {
    const pd = pending.current;
    const d = dragRef.current;
    if (pd && d) {
      const target = domainAt(e.clientX, e.clientY);
      // Appui long sans bouger, au doigt : on ouvre le menu du projet.
      if (pd.touch && !pd.moved) setMenu({ id: pd.p.id, x: e.clientX, y: e.clientY });
      else if (target) moveProject(pd.p.id, target === 'none' ? null : target);
    }
    finish();
  }
  handlers.current = { move: onMove, up: onUp };

  const start = (e: React.PointerEvent, p: Project) => {
    if (e.button !== 0) return;
    swallow.current = false;
    const touch = e.pointerType !== 'mouse';
    const { clientX: x0, clientY: y0 } = e;
    pending.current = { p, x0, y0, touch, moved: false, timer: touch ? setTimeout(() => pending.current && begin(p, x0, y0), HOLD_MS) : null };
    window.addEventListener('pointermove', stable.move);
    window.addEventListener('pointerup', stable.up);
    window.addEventListener('pointercancel', stable.cancel);
  };

  useEffect(() => finish, [finish]);

  const api: TreeApi = {
    start,
    swallowClick: () => {
      const v = swallow.current;
      swallow.current = false;
      return v;
    },
    openMenu: (id, el) => {
      const r = el.getBoundingClientRect();
      setMenu((m) => (m?.id === id ? null : { id, x: r.right, y: r.bottom }));
    },
    dragId: drag?.id || null,
    over: drag?.over ?? null,
  };

  const overName = drag?.over ? (drag.over === 'none' ? 'Sans domaine' : data.domains[drag.over]?.name) : null;
  return (
    <TreeCtx.Provider value={api}>
      {children}
      {drag && (
        <div className="proj-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <Icon name="proj" />
          <span>{drag.name}</span>
          {overName && <em>→ {overName}</em>}
        </div>
      )}
      {menu && data.projects[menu.id] && <ProjMenu p={data.projects[menu.id]} at={menu} onClose={() => setMenu(null)} />}
    </TreeCtx.Provider>
  );
}

/** Menu d'un projet : ouvrir, modifier, déplacer vers un domaine, épingler, archiver, supprimer. */
function ProjMenu({ p, at, onClose }: { p: Project; at: { x: number; y: number }; onClose: () => void }) {
  const store = useStore();
  const { go, openDrawer, toast, deleteProject, moveProject } = useUI();
  const ref = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    const away = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('pointerdown', away), 0);
    document.addEventListener('keydown', esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const W = 232;
  const left = Math.max(8, Math.min(at.x - 24, window.innerWidth - W - 8));
  const top = Math.min(at.y + 6, window.innerHeight - (moving ? 360 : 300));
  const act = (f: () => void) => () => {
    onClose();
    f();
  };
  const doms = domainsSorted(store.data);
  return (
    <div className="proj-menu" ref={ref} style={{ left, top, width: W }} role="menu" aria-label={`Projet ${p.name}`}>
      <div className="pm-title">{p.name}</div>
      {moving ? (
        <>
          <button role="menuitem" onClick={() => setMoving(false)}>
            <Icon name="left" />
            Ranger dans…
          </button>
          <div className="pm-doms">
            {doms.map((d) => (
              <button key={d.id} role="menuitem" className={p.domainId === d.id ? 'on' : ''} onClick={act(() => moveProject(p.id, d.id))}>
                <i className="sw" style={{ background: `var(--${d.color})` }} />
                {d.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button role="menuitem" onClick={act(() => go('project', { projectId: p.id }))}>
            <Icon name="proj" />
            Ouvrir
          </button>
          <button role="menuitem" onClick={act(() => openDrawer({ type: 'project', id: p.id }))}>
            <Icon name="edit" />
            Renommer, modifier
          </button>
          <button role="menuitem" onClick={() => setMoving(true)}>
            <Icon name="next" />
            Ranger dans un domaine
          </button>
          <button role="menuitem" onClick={act(() => store.updateProject(p.id, { pinned: !p.pinned }))}>
            <Icon name="pin" />
            {p.pinned ? 'Désépingler' : 'Épingler en haut'}
          </button>
          <button
            role="menuitem"
            onClick={act(() => {
              store.updateProject(p.id, { archivedAt: new Date().toISOString(), pinned: false });
              toast({ text: `${p.name} archivé : rien n'est supprimé.`, actions: [{ label: 'Annuler', run: () => store.updateProject(p.id, { archivedAt: null, pinned: p.pinned }) }] });
            })}
          >
            <Icon name="archive" />
            Archiver
          </button>
          <button role="menuitem" className="danger" onClick={act(() => deleteProject(p.id))}>
            <Icon name="trash" />
            Supprimer
          </button>
        </>
      )}
    </div>
  );
}

/** Une ligne de projet dans le menu : clic pour ouvrir, glisser pour ranger, « ⋯ » pour les actions. */
export function ProjNav({ p, depth, projects, opened, toggle, pinned }: { p: Project; depth: number; projects: Project[]; opened: Set<string>; toggle: (id: string) => void; pinned?: boolean }) {
  const { data } = useStore();
  const { ui, go } = useUI();
  const tree = useTree();
  const kids = !pinned && depth < 6 ? childrenOf(data, p.id, projects) : [];
  const isOpen = opened.has(p.id);
  const st = projectStats(data, p.id);
  return (
    <>
      <div className={`nav-row prow${tree.dragId === p.id ? ' lifted' : ''}`} style={{ '--depth': pinned ? 0 : depth } as React.CSSProperties}>
        <button
          className={`nav proj${ui.view === 'project' && ui.projectId === p.id ? ' on' : ''}`}
          onPointerDown={(e) => tree.start(e, p)}
          onClick={() => !tree.swallowClick() && go('project', { projectId: p.id })}
          onContextMenu={(e) => {
            e.preventDefault();
            tree.openMenu(p.id, e.currentTarget);
          }}
          title={`${p.name} : glisse-le sur un domaine pour l'y ranger`}
        >
          {pinned ? <Icon name="pin" /> : <i className="pdot" style={{ background: colorOfProject(data, p) }} />}
          <span>{p.name}</span>
          {st.open.length ? <span className="n">{st.open.length}</span> : null}
        </button>
        <button className="row-more" onClick={(e) => tree.openMenu(p.id, e.currentTarget)} aria-label={`Actions pour ${p.name}`} title="Déplacer, épingler, archiver, supprimer">
          <Icon name="more" />
        </button>
        {kids.length > 0 ? (
          <button className={`nav-caret${isOpen ? ' open' : ''}`} onClick={() => toggle(p.id)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Replier' : 'Déplier'} ${p.name}`}>
            <Icon name="right" />
          </button>
        ) : (
          <span className="caret-gap" />
        )}
      </div>
      {isOpen && kids.map((k) => <ProjNav key={k.id} p={k} depth={depth + 1} projects={projects} opened={opened} toggle={toggle} />)}
    </>
  );
}

/** Zone de dépôt : un domaine de vie (en-tête et projets qu'il contient). */
export function DomainDrop({ id, children }: { id: string; children: React.ReactNode }) {
  const tree = useTree();
  return (
    <div className={`proj-group${tree.dragId ? ' droppable' : ''}${tree.over === id ? ' drop-over' : ''}`} data-dom={id}>
      {children}
    </div>
  );
}
