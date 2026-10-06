'use client';
import { useEffect, useMemo, useState } from 'react';
import { useStore, uuid } from '@/lib/store';
import type { Item } from '@/lib/types';
import { aiContext, useUI } from './ui-context';
import { CTX, PR, ST } from '@/lib/gtd';
import { isDate, isTime, relDate } from '@/lib/dates';

interface PropProject { key: string; name: string; existingId?: string | null; domainId?: string | null; outcome?: string | null; description?: string | null }
interface PropItem { title: string; project?: string | null; status?: string; date?: string | null; time?: string | null; priority?: string | null; context?: string | null; waitingFor?: string | null; reason?: string }
interface Proposals { projects?: PropProject[]; items?: PropItem[] }

const SOURCES: { k: string; name: string; text: string; oauth?: boolean }[] = [
  { k: 'notion', name: 'Notion', text: 'Tes pages et bases récentes : projets, tâches, notes.', oauth: true },
  { k: 'google', name: 'Gmail et Google Agenda', text: 'Les mails des 30 derniers jours et tes rendez-vous des 60 prochains.', oauth: true },
  { k: 'microsoft', name: 'Outlook', text: 'Mails et calendrier Outlook. Les comptes pro peuvent être bloqués par ton entreprise.', oauth: true },
];

const ERRORS: Record<string, string> = {
  not_configured: "Cette connexion n'est pas encore activée sur le site. En attendant, colle un export ou ajoute ton calendrier par lien.",
  denied: 'Connexion annulée.',
  token: "La connexion n'a pas abouti. Réessaie.",
  reconnect: 'La connexion a expiré, relance-la.',
  daily_limit: "Limite IA du jour atteinte. Réessaie demain.",
  ai_not_configured: "L'IA n'est pas encore branchée sur ce site.",
  read_failed: "Impossible de lire cette source. Vérifie le lien ou les droits d'accès.",
  empty: "Rien de lisible dans cette source.",
};

/** Liste des sources + revue des propositions. Utilisé à l'accueil et dans « Importer ». */
export function ImportPanel({ onDone, autoSource }: { onDone?: () => void; autoSource?: string | null }) {
  const store = useStore();
  const { toast } = useUI();
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ics, setIcs] = useState('');
  const [text, setText] = useState('');
  const [props, setProps] = useState<{ source: string; data: Proposals } | null>(null);
  const [offP, setOffP] = useState<Record<string, boolean>>({});
  const [offI, setOffI] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetch('/api/connect/status')
      .then((r) => r.json())
      .then((j) => setStatus(j.providers || {}))
      .catch(() => {});
  }, []);

  const run = async (source: string, extra: { url?: string; text?: string } = {}) => {
    setBusy(source);
    setErr(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, ...extra, ctx: aiContext(store.data) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(ERRORS[body.error] || "L'import n'a pas abouti. Réessaie dans un moment.");
        return;
      }
      setProps({ source, data: body.proposals || {} });
      setOffP({});
      setOffI({});
    } catch {
      setErr('Pas de connexion.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (autoSource && ['notion', 'google', 'microsoft'].includes(autoSource)) run(autoSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSource]);

  const projects = useMemo(() => (props?.data.projects || []).filter((p) => p && p.name), [props]);
  const items = useMemo(() => (props?.data.items || []).filter((i) => i && i.title), [props]);

  const apply = () => {
    if (!props) return;
    const d = store.data;
    const keyToId: Record<string, string> = {};
    const newProjects = projects
      .filter((p) => !offP[p.key])
      .flatMap((p) => {
        if (p.existingId && d.projects[p.existingId]) {
          keyToId[p.key] = p.existingId;
          return [];
        }
        const id = uuid();
        keyToId[p.key] = id;
        return [{ id, name: p.name.slice(0, 120), domainId: p.domainId && d.domains[p.domainId] ? p.domainId : null, outcome: p.outcome || null, description: p.description || null, aiSorted: true }];
      });
    const newItems: Partial<Item>[] = items
      .filter((_, i) => !offI[i])
      .filter((i) => !i.project || !offP[i.project])
      .map((i) => {
        const pid = i.project ? keyToId[i.project] || null : null;
        const status = (['todo', 'waiting', 'someday'].includes(i.status || '') ? i.status : 'todo') as Item['status'];
        const date = isDate(i.date) ? i.date : null;
        return {
          title: i.title.slice(0, 300),
          status,
          projectId: pid,
          domainId: pid ? (d.projects[pid]?.domainId ?? newProjects.find((x) => x.id === pid)?.domainId ?? null) : null,
          date,
          time: date && isTime(i.time) ? i.time : null,
          priority: i.priority && PR[i.priority] ? (i.priority as Item['priority']) : null,
          context: i.context && CTX[i.context] ? i.context : null,
          waitingFor: status === 'waiting' ? i.waitingFor || null : null,
          aiSorted: true,
          aiReason: `Importé depuis ${props.source === 'google' ? 'Gmail / Google Agenda' : props.source === 'microsoft' ? 'Outlook' : props.source === 'ics' ? 'ton calendrier' : props.source === 'notion' ? 'Notion' : 'ton texte'}${i.reason ? ` : ${i.reason}` : '.'}`,
        };
      });
    store.bulk({ projects: newProjects, items: newItems });
    toast({ text: `${newProjects.length} projet${newProjects.length > 1 ? 's' : ''} et ${newItems.length} élément${newItems.length > 1 ? 's' : ''} importés. Tu les retrouves avec le badge IA.` });
    setProps(null);
    onDone?.();
  };

  if (props) {
    const nP = projects.filter((p) => !offP[p.key]).length;
    const nI = items.filter((it, i) => !offI[i] && (!it.project || !offP[it.project])).length;
    return (
      <div className="stack">
        <div className="sec">
          <div className="sec-head">
            <h2>
              Projets proposés <span className="n">{projects.length}</span>
            </h2>
          </div>
          {projects.length ? (
            <div className="review-list">
              {projects.map((p) => (
                <label key={p.key} className={`check-row${offP[p.key] ? ' off' : ''}`}>
                  <input type="checkbox" checked={!offP[p.key]} onChange={() => setOffP((o) => ({ ...o, [p.key]: !o[p.key] }))} />
                  <span>
                    <span className="t">{p.name}</span>
                    <span className="m">
                      {p.existingId && store.data.projects[p.existingId] ? <span className="chip">Déjà dans tes projets</span> : <span className="chip ai">Nouveau</span>}
                      {p.domainId && store.data.domains[p.domainId] && <span className="chip">{store.data.domains[p.domainId].name}</span>}
                      {p.description && <span>{p.description}</span>}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <div className="empty">Aucun projet détecté.</div>
          )}
        </div>
        <div className="sec">
          <div className="sec-head">
            <h2>
              Actions et rendez-vous <span className="n">{items.length}</span>
            </h2>
          </div>
          {items.length ? (
            <div className="review-list">
              {items.map((it, i) => {
                const proj = projects.find((p) => p.key === it.project);
                const off = offI[i] || (it.project && offP[it.project]);
                return (
                  <label key={i} className={`check-row${off ? ' off' : ''}`}>
                    <input type="checkbox" checked={!off} disabled={!!(it.project && offP[it.project])} onChange={() => setOffI((o) => ({ ...o, [i]: !o[i] }))} />
                    <span>
                      <span className="t">{it.title}</span>
                      <span className="m">
                        <span className="chip">{ST[it.status || 'todo'] || 'À faire'}</span>
                        {proj && <span className="chip">{proj.name}</span>}
                        {isDate(it.date) && <span className="chip date">{relDate(it.date)}{isTime(it.time) ? ` ${it.time}` : ''}</span>}
                        {it.reason && <span>{it.reason}</span>}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aucune action détectée.</div>
          )}
        </div>
        <div className="vh-actions">
          <button className="btn primary lg" onClick={apply} disabled={!nP && !nI}>
            Importer {nP} projet{nP > 1 ? 's' : ''} et {nI} élément{nI > 1 ? 's' : ''}
          </button>
          <button className="btn lg" onClick={() => setProps(null)}>
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {err && <div className="alert crit">{err}</div>}
      {busy && (
        <div className="alert info">
          <span>
            <i className="spin" /> L&apos;IA lit {busy === 'text' ? 'ton texte' : busy === 'ics' ? 'ton calendrier' : 'tes données'} et prépare des propositions. Ça peut prendre une minute.
          </span>
        </div>
      )}
      <div className="tools">
        {SOURCES.map((s) => {
          const ready = status[s.k];
          return (
            <div className="tool" key={s.k}>
              <b>{s.name}</b>
              <p>{s.text}</p>
              {ready ? (
                <a className="btn primary" href={`/api/connect/${s.k}`} aria-disabled={!!busy} onClick={(e) => busy && e.preventDefault()}>
                  Connecter
                </a>
              ) : (
                <span className="chip tag">Bientôt disponible</span>
              )}
            </div>
          );
        })}
        <div className="tool">
          <b>Un calendrier par lien</b>
          <p>Google, Outlook et iPhone donnent un lien d&apos;abonnement (.ics). Colle-le ici.</p>
          <input className="inp" value={ics} onChange={(e) => setIcs(e.target.value)} placeholder="https://… ou webcal://…" aria-label="Lien du calendrier" />
          <button className="btn" disabled={!ics.trim() || !!busy} onClick={() => run('ics', { url: ics })}>
            Importer le calendrier
          </button>
        </div>
      </div>
      <div className="tool">
        <b>Coller du texte</b>
        <p>Un export Notion, une liste de tâches, tes notes, un mail : l&apos;IA en tire tes projets et tes actions.</p>
        <textarea className="inp" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Colle ici…" aria-label="Texte à importer" />
        <div>
          <button className="btn" disabled={!text.trim() || !!busy} onClick={() => run('text', { text })}>
            Analyser le texte
          </button>
        </div>
      </div>
      <p className="hint">Aucun accès n&apos;est enregistré : la connexion sert le temps de l&apos;import, puis elle est effacée. Tu valides tout avant que ce soit ajouté.</p>
    </div>
  );
}
