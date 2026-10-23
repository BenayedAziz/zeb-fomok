'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/store';
import type { Project } from '@/lib/types';
import { useUI } from './ui-context';
import { Icon } from './icons';
import { COLORS, childrenOf, colorOfProject, domainsSorted, familyIds, projectStats } from '@/lib/gtd';

/* Menu des projets : glisser un projet sur un domaine de vie pour l'y ranger (souris : on glisse ;
   doigt : appui long puis on glisse), et un menu « ⋯ » pour le reste (déplacer, épingler, archiver, supprimer). */

const HOLD_MS = 450;
type Menu = { id: string; x: number; y: number } | null;
type Drag = { id: string; name: string; x: number; y: number; over: string | null; family: string[] } | null;

interface TreeApi {
  start: (e: React.PointerEvent, p: Project) => void;
  /** Vrai juste après un glisser : le clic qui suit ne doit pas ouvrir le projet. */
  swallowClick: () => boolean;
  openMenu: (id: string, el: HTMLElement) => void;
  openDomainMenu: (id: string, el: HTMLElement) => void;
  dragId: string | null;
  over: string | null;
}
const TreeCtx = createContext<TreeApi | null>(null);
const useTree = () => useContext(TreeCtx)!;

/** Ce qu'il y a sous le pointeur : un projet (pour en faire un sous-projet) ou un domaine. Clé « p:id » ou « d:id ». */
function targetAt(x: number, y: number, family: string[]) {
  const el = document.elementFromPoint(x, y);
  const proj = (el?.closest('[data-proj]') as HTMLElement | null)?.dataset.proj;
  if (proj && !family.includes(proj)) return `p:${proj}`;
  const dom = (el?.closest('[data-dom]') as HTMLElement | null)?.dataset.dom;
  return dom ? `d:${dom}` : null;
}

export function ProjectTreeProvider({ scrollRef, children }: { scrollRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) {
  const { data } = useStore();
  const dataRef = useRef(data);
  dataRef.current = data;
  const { moveProject } = useUI();
  const [drag, setDrag] = useState<Drag>(null);
  const [menu, setMenu] = useState<Menu>(null);
  const [domMenu, setDomMenu] = useState<Menu>(null);
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
    const family = familyIds(dataRef.current, p.id);
    setDrag({ id: p.id, name: p.name, x, y, over: targetAt(x, y, family), family });
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
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY, d.family) } : d));
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
      const target = targetAt(e.clientX, e.clientY, d.family);
      // Appui long sans bouger, au doigt : on ouvre le menu du projet.
      if (pd.touch && !pd.moved) setMenu({ id: pd.p.id, x: e.clientX, y: e.clientY });
      else if (target?.startsWith('p:')) moveProject(pd.p.id, { parentId: target.slice(2) });
      else if (target?.startsWith('d:')) moveProject(pd.p.id, { domainId: target === 'd:none' ? null : target.slice(2), parentId: null });
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
    openDomainMenu: (id, el) => {
      const r = el.getBoundingClientRect();
      setDomMenu((m) => (m?.id === id ? null : { id, x: r.right, y: r.bottom }));
    },
    dragId: drag?.id || null,
    over: drag?.over ?? null,
  };

  const overName = !drag?.over
    ? null
    : drag.over.startsWith('p:')
      ? `dans ${data.projects[drag.over.slice(2)]?.name || ''}`
      : drag.over === 'd:none'
        ? 'Sans domaine'
        : data.domains[drag.over.slice(2)]?.name;
  return (
    <TreeCtx.Provider value={api}>
      {children}
      {drag &&
        createPortal(
        <div className="proj-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <Icon name="proj" />
          <span>{drag.name}</span>
          {overName && <em>→ {overName}</em>}
        </div>,
        document.body,
      )}
      {menu && data.projects[menu.id] && createPortal(<ProjMenu p={data.projects[menu.id]} at={menu} onClose={() => setMenu(null)} />, document.body)}
      {domMenu && data.domains[domMenu.id] && createPortal(<DomainMenu id={domMenu.id} at={domMenu} onClose={() => setDomMenu(null)} />, document.body)}
    </TreeCtx.Provider>
  );
}

/** Menu d'un projet : ouvrir, modifier, déplacer vers un domaine, épingler, archiver, supprimer. */
export function ProjMenu({ p, at, onClose }: { p: Project; at: { x: number; y: number }; onClose: () => void }) {
  const store = useStore();
  const { go, openDrawer, toast, deleteProject, moveProject, projectToDomain } = useUI();
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
              <button key={d.id} role="menuitem" className={p.domainId === d.id ? 'on' : ''} onClick={act(() => moveProject(p.id, { domainId: d.id, parentId: null }))}>
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
          {p.parentId && store.data.projects[p.parentId] && (
            <button role="menuitem" onClick={act(() => moveProject(p.id, { parentId: null }))}>
              <Icon name="left" />
              Sortir de « {store.data.projects[p.parentId].name} »
            </button>
          )}
          <button role="menuitem" onClick={act(() => projectToDomain(p.id))} title="Le projet devient un domaine de vie ; ses sous-projets deviennent ses projets">
            <Icon name="proj" />
            En faire un domaine de vie
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
      <div className={`nav-row prow${tree.dragId === p.id ? ' lifted' : ''}${tree.over === `p:${p.id}` ? ' drop-into' : ''}`} style={{ '--depth': pinned ? 0 : depth } as React.CSSProperties} data-proj={pinned ? undefined : p.id}>
        <button
          className={`nav proj${ui.view === 'project' && ui.projectId === p.id ? ' on' : ''}`}
          onPointerDown={(e) => tree.start(e, p)}
          onClick={() => !tree.swallowClick() && go('project', { projectId: p.id })}
          onContextMenu={(e) => {
            e.preventDefault();
            tree.openMenu(p.id, e.currentTarget);
          }}
          title={`${p.name} : glisse-le sur un domaine ou sur un autre projet pour l'y ranger`}
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

/** Un domaine de vie dans le menu : en-tête (déplier, ouvrir, renommer d'un double-clic, menu ⋯) et ses projets. Zone de dépôt. */
export function DomainGroup({ id, name, color, count, open, onToggle, children }: { id: string; name: string; color: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const store = useStore();
  const { ui, go } = useUI();
  const tree = useTree();
  const [editing, setEditing] = useState(false);
  const real = id !== 'none';
  const save = (v: string) => {
    setEditing(false);
    if (real && v.trim() && v.trim() !== name) store.updateDomain(id, { name: v.trim().slice(0, 60) });
  };
  return (
    <div className={`proj-group${tree.dragId ? ' droppable' : ''}${tree.over === `d:${id}` ? ' drop-over' : ''}`} data-dom={id}>
      <div className="dom-row">
        <button className={`nav-caret${open ? ' open' : ''}`} onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Replier' : 'Déplier'} ${name}`} disabled={!count}>
          <Icon name="right" />
        </button>
        {editing ? (
          <input
            className="dom-edit"
            autoFocus
            defaultValue={name}
            aria-label="Nom du domaine"
            onBlur={(e) => save(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            className={`dom-name${ui.view === 'projects' && ui.domainFilter === id ? ' on' : ''}`}
            onClick={() => (real ? go('projects', { domain: id }) : go('projects'))}
            onDoubleClick={() => real && setEditing(true)}
            title={real ? 'Double-clic pour renommer' : undefined}
          >
            <i className="sw" style={{ background: color }} />
            <span>{name}</span>
            {count > 0 && <span className="n">{count}</span>}
          </button>
        )}
        {real && !editing && (
          <button className="row-more dom-more" onClick={(e) => tree.openDomainMenu(id, e.currentTarget)} aria-label={`Actions pour ${name}`} title="Renommer, couleur, supprimer">
            <Icon name="more" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** Menu d'un domaine : renommer, changer de couleur, ajouter un projet, supprimer. */
function DomainMenu({ id, at, onClose }: { id: string; at: { x: number; y: number }; onClose: () => void }) {
  const store = useStore();
  const { openDrawer, deleteDomain } = useUI();
  const ref = useRef<HTMLDivElement>(null);
  const dom = store.data.domains[id];
  const [name, setName] = useState(dom?.name || '');
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
  if (!dom) return null;
  const W = 248;
  const left = Math.max(8, Math.min(at.x - 24, window.innerWidth - W - 8));
  const top = Math.min(at.y + 6, window.innerHeight - 330);
  const rename = () => name.trim() && name.trim() !== dom.name && store.updateDomain(id, { name: name.trim().slice(0, 60) });
  return (
    <div className="proj-menu" ref={ref} style={{ left, top, width: W }} role="menu" aria-label={`Domaine ${dom.name}`}>
      <div className="pm-title">Domaine de vie</div>
      <input
        className="inp pm-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            rename();
            onClose();
          }
        }}
        aria-label="Nom du domaine"
      />
      <div className="pm-colors" role="group" aria-label="Couleur">
        {COLORS.map((c) => (
          <button key={c} className={dom.color === c ? 'on' : ''} style={{ background: `var(--${c})` }} onClick={() => store.updateDomain(id, { color: c })} aria-label={`Couleur ${c}`} />
        ))}
      </div>
      <button
        role="menuitem"
        onClick={() => {
          onClose();
          openDrawer({ type: 'project', id: null, draft: { domainId: id } });
        }}
      >
        <Icon name="plus" />
        Nouveau projet ici
      </button>
      <button
        role="menuitem"
        className="danger"
        onClick={() => {
          onClose();
          deleteDomain(id);
        }}
      >
        <Icon name="trash" />
        Supprimer le domaine
      </button>
    </div>
  );
}
