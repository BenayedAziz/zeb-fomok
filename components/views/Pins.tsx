'use client';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Pin } from '@/lib/types';
import { useUI } from '../ui-context';
import { Icon } from '../icons';
import { Head } from './Calendar';
import { colorOfProject, hostOf, list, projectsSorted } from '@/lib/gtd';

const normUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

/** Titre lisible tiré d'une adresse : « youtube.com · comment-structurer… ». */
export function titleFromUrl(u: string) {
  try {
    const url = new URL(normUrl(u));
    const last = url.pathname.split('/').filter(Boolean).pop() || '';
    const slug = decodeURIComponent(last).replace(/[-_]+/g, ' ').replace(/\.\w+$/, '').trim();
    return slug && slug.length > 3 && !/^\d+$/.test(slug) ? `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`.slice(0, 90) : hostOf(u);
  } catch {
    return u.slice(0, 90);
  }
}

export function PinList({ pins, noProject }: { pins: Pin[]; noProject?: boolean }) {
  const { data } = useStore();
  const { openDrawer } = useUI();
  if (!pins.length) return null;
  return (
    <div className="pins">
      {pins.map((p) => {
        const pr = p.projectId ? data.projects[p.projectId] : null;
        return (
          <div className="pin" key={p.id} style={{ '--pc': pr ? colorOfProject(data, pr) : 'var(--line-2)' } as React.CSSProperties}>
            <a className="pin-main" href={normUrl(p.url)} target="_blank" rel="noopener noreferrer">
              <span className="fav" aria-hidden="true">
                {hostOf(p.url).charAt(0).toUpperCase()}
              </span>
              <span className="pin-text">
                <span className="pin-title">{p.title}</span>
                <span className="pin-sub">
                  {hostOf(p.url)}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </span>
            </a>
            <div className="pin-side">
              {pr && !noProject && (
                <span className="chip">
                  <i className="dot" style={{ background: colorOfProject(data, pr) }} />
                  <span>{pr.name}</span>
                </span>
              )}
              {p.aiSorted && <span className="chip ai">IA</span>}
              <button className="icon-btn sm" onClick={() => openDrawer({ type: 'pin', id: p.id })} aria-label="Modifier la ressource" title="Modifier">
                <Icon name="gear" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AddPin({ projectId, compact }: { projectId?: string | null; compact?: boolean }) {
  const store = useStore();
  const { toast } = useUI();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [pid, setPid] = useState(projectId || '');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(u)) return toast({ text: 'Colle une adresse web (ex. youtube.com/…).' });
    store.addPin({ url: normUrl(u), title: titleFromUrl(u), note: note.trim() || null, projectId: projectId || pid || null });
    setUrl('');
    setNote('');
    toast({ text: 'Ressource épinglée' });
  };
  return (
    <form className={`addpin${compact ? ' compact' : ''}`} onSubmit={submit}>
      <div className="addrow">
        <label className="sr" htmlFor={`pin-url-${projectId || 'all'}`}>
          Adresse
        </label>
        <input className="inp" id={`pin-url-${projectId || 'all'}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Coller un lien : article, vidéo, outil…" />
        <button className="btn" type="submit">
          <Icon name="pin" /> Épingler
        </button>
      </div>
      {!compact && (
        <div className="addrow">
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pourquoi tu la gardes (facultatif)" />
          <select className="inp" style={{ flex: '0 1 220px' }} value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Projet">
            <option value="">Sans projet</option>
            {projectsSorted(store.data)
              .filter((p) => p.status !== 'done')
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </form>
  );
}

export function PinsView() {
  const { data } = useStore();
  const [f, setF] = useState<string>('all');
  const all = list(data.pins).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const used = projectsSorted(data).filter((p) => all.some((x) => x.projectId === p.id));
  const shown = f === 'all' ? all : f === 'none' ? all.filter((x) => !x.projectId || !data.projects[x.projectId]) : all.filter((x) => x.projectId === f);
  return (
    <>
      <Head
        eyebrow="Ressources"
        title="Épinglés"
        lede="Articles, vidéos et outils que tu veux garder sous la main. Rattache-les à un projet : ils s'affichent sur sa page. Tu peux aussi les coller dans la capture, l'IA les range."
      />
      <div className="sec">
        <AddPin />
      </div>
      {all.length > 0 && (
        <div className="filters">
          <div className="pick">
            <button className={f === 'all' ? 'on' : ''} onClick={() => setF('all')}>
              Tout <span className="n">{all.length}</span>
            </button>
            {used.map((p) => (
              <button key={p.id} className={f === p.id ? 'on' : ''} onClick={() => setF(p.id)}>
                <i className="dot" style={{ background: colorOfProject(data, p) }} /> {p.name}
              </button>
            ))}
            <button className={f === 'none' ? 'on' : ''} onClick={() => setF('none')}>
              Sans projet
            </button>
          </div>
        </div>
      )}
      {shown.length ? (
        <PinList pins={shown} />
      ) : (
        <div className="empty">
          <b>Rien d&apos;épinglé {f === 'all' ? 'pour l’instant' : 'ici'}.</b> Colle un lien au-dessus, ou écris « garder cet article pour le projet X : https://… » dans la capture.
        </div>
      )}
    </>
  );
}
