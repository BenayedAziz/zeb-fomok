'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { useUI } from './ui-context';
import { Icon } from './icons';
import { Head } from './views/Calendar';

/** Seul ce compte voit l'onglet Remarques (même adresse que dans la migration 007). */
export const ADMIN_EMAILS = ['azizbenayed15@gmail.com'];
export const isAdmin = (email: string | null) => !!email && ADMIN_EMAILS.includes(email.toLowerCase());

const PAGES: Record<string, string> = { day: 'Ma journée', inbox: 'Inbox', next: 'Prochaines actions', waiting: 'En attente', someday: 'Un jour', projects: 'Projets', project: 'Projet', pins: 'Épinglés', goals: 'Objectifs', review: 'Revue', journal: 'Journal', settings: 'Réglages', trash: 'Corbeille', help: 'Aide' };

/** Bouton en haut à droite : n'importe quel testeur envoie une remarque en deux secondes. */
export function FeedbackButton() {
  const { ui, toast } = useUI();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
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

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = msg.trim();
    if (!m) return;
    const sb = getBrowserSupabase();
    if (!sb) return toast({ text: 'Mode démo : la remarque ne part nulle part. Connecte-toi pour l’envoyer.' });
    setBusy(true);
    const { data } = await sb.auth.getUser();
    const { error } = data.user
      ? await sb.from('feedback').insert({ user_id: data.user.id, message: m.slice(0, 4000), page: PAGES[ui.view] || ui.view, user_agent: navigator.userAgent.slice(0, 300) })
      : { error: new Error('signed_out') };
    setBusy(false);
    if (error) return toast({ text: "La remarque n'est pas partie. Vérifie ta connexion et réessaie." });
    setMsg('');
    setOpen(false);
    toast({ text: 'Merci ! Ta remarque est bien arrivée.' });
  };

  return (
    <div className="fb" ref={ref}>
      <button className="btn sm fb-btn" onClick={() => setOpen(!open)} aria-expanded={open} title="Un bug, une idée, une gêne ? Dis-le ici">
        <Icon name="chat" />
        <span>Une remarque ?</span>
      </button>
      {open && (
        <form className="fb-pop" onSubmit={send} role="dialog" aria-label="Envoyer une remarque">
          <b>Une remarque, une idée, un bug ?</b>
          <textarea className="inp" autoFocus rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Ce qui t'a gêné, ce qui manque, ce que tu aimerais…" maxLength={4000} onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && send(e)} />
          <div className="fb-foot">
            <span className="hint">Envoyé avec le nom de la page ({PAGES[ui.view] || ui.view}).</span>
            <button className="btn primary sm" type="submit" disabled={busy || !msg.trim()}>
              {busy ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface Feedback {
  id: string;
  email: string | null;
  message: string;
  page: string | null;
  user_agent: string | null;
  status: 'new' | 'done';
  created_at: string;
}

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const device = (ua: string | null) => (!ua ? '' : /iphone|android|mobile/i.test(ua) ? 'Téléphone' : 'Ordinateur');

/** Onglet réservé à l'admin : toutes les remarques des testeurs. */
export function FeedbackView() {
  const store = useStore();
  const { toast } = useUI();
  const [rows, setRows] = useState<Feedback[] | null>(null);
  const [err, setErr] = useState(false);
  const [show, setShow] = useState<'new' | 'all'>('new');

  const load = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!sb) return setRows([]);
    const { data, error } = await sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(500);
    setErr(!!error);
    setRows((data as Feedback[]) || []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin(store.email)) return <div className="empty">Cet onglet est réservé à l&apos;équipe.</div>;
  const setStatus = async (f: Feedback, status: Feedback['status']) => {
    setRows((r) => r && r.map((x) => (x.id === f.id ? { ...x, status } : x)));
    const { error } = await getBrowserSupabase()!.from('feedback').update({ status }).eq('id', f.id);
    if (error) toast({ text: "Pas enregistré. Réessaie." });
  };
  const list = (rows || []).filter((f) => show === 'all' || f.status === 'new');
  const nNew = (rows || []).filter((f) => f.status === 'new').length;
  return (
    <>
      <Head
        eyebrow="Phase de test"
        title="Remarques"
        lede="Tout ce que les testeurs ont envoyé avec le bouton « Une remarque ? ». Toi seul vois cette page."
        actions={
          <>
            <div className="seg">
              <button className={show === 'new' ? 'on' : ''} onClick={() => setShow('new')}>
                À traiter {nNew ? `(${nNew})` : ''}
              </button>
              <button className={show === 'all' ? 'on' : ''} onClick={() => setShow('all')}>
                Toutes
              </button>
            </div>
            <button className="btn" onClick={() => load()}>
              Actualiser
            </button>
          </>
        }
      />
      {err && <div className="alert crit">Impossible de charger les remarques. Actualise dans un instant.</div>}
      {rows === null ? (
        <div className="hint">Chargement…</div>
      ) : !list.length ? (
        <div className="empty">{show === 'new' ? 'Rien à traiter. Les nouvelles remarques arrivent ici.' : 'Aucune remarque pour le moment.'}</div>
      ) : (
        <div className="fb-list">
          {list.map((f) => (
            <div key={f.id} className={`fb-item${f.status === 'done' ? ' done' : ''}`}>
              <div className="fb-meta">
                <b>{f.email || 'Anonyme'}</b>
                <span>{when(f.created_at)}</span>
                {f.page && <span className="chip">{f.page}</span>}
                {device(f.user_agent) && <span className="chip">{device(f.user_agent)}</span>}
              </div>
              <p>{f.message}</p>
              <div className="fb-actions">
                {f.status === 'new' ? (
                  <button className="btn sm primary" onClick={() => setStatus(f, 'done')}>
                    <Icon name="check" /> Traité
                  </button>
                ) : (
                  <button className="btn sm" onClick={() => setStatus(f, 'new')}>
                    Remettre à traiter
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
