'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

type Mode = 'login' | 'signup' | 'forgot';
type Note = { kind: 'info' | 'crit'; text: string; resend?: boolean } | null;

const ERRORS: Record<string, string> = {
  bad_input: 'Entre ton email et ton mot de passe.',
  bad_email: "Cette adresse email n'est pas valide. Vérifie qu'il n'y a pas de faute de frappe.",
  bad_credentials: 'Email ou mot de passe incorrect. Si tu as oublié ton mot de passe, clique sur « Mot de passe oublié ».',
  not_confirmed: "Ton adresse n'est pas encore confirmée : ouvre l'email de confirmation, puis reviens te connecter.",
  not_invited: "Cet email n'est pas encore invité. Demande à Aziz de t'ajouter.",
  weak_password: 'Choisis un mot de passe d’au moins 8 caractères.',
  exists: 'Un compte existe déjà avec cet email. Connecte-toi, ou utilise « Mot de passe oublié ».',
  rate_limit: "Trop d'emails envoyés en peu de temps. Réessaie dans quelques minutes.",
  not_configured: 'Les comptes ne sont pas encore activés sur ce site.',
};

/** Force du mot de passe, de 0 à 3, pour guider sans bloquer. */
function strength(pw: string) {
  if (pw.length < 8) return 0;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = ['Trop court', 'Correct', 'Bien', 'Solide'];

/** Liens vers les boîtes mail les plus courantes, d'après l'adresse. */
function inboxLink(email: string): { label: string; url: string } | null {
  const d = email.split('@')[1]?.toLowerCase() || '';
  if (/gmail|googlemail/.test(d)) return { label: 'Ouvrir Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' };
  if (/outlook|hotmail|live|msn/.test(d)) return { label: 'Ouvrir Outlook', url: 'https://outlook.live.com/mail/0/inbox' };
  if (/yahoo/.test(d)) return { label: 'Ouvrir Yahoo Mail', url: 'https://mail.yahoo.com' };
  if (/icloud|me\.com|mac\.com/.test(d)) return { label: 'Ouvrir iCloud Mail', url: 'https://www.icloud.com/mail' };
  if (/orange|wanadoo/.test(d)) return { label: 'Ouvrir Orange Mail', url: 'https://mail.orange.fr' };
  if (/proton/.test(d)) return { label: 'Ouvrir Proton Mail', url: 'https://mail.proton.me' };
  return null;
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  /** Compte créé : on affiche l'écran « vérifie tes mails ». */
  const [sent, setSent] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const error = q.get('error');
    if (q.get('mode') === 'signup') setMode('signup');
    const e = q.get('email');
    if (e) setEmail(e);
    if (q.get('confirmed')) setNote({ kind: 'info', text: 'Adresse confirmée. Connecte-toi avec ton email et ton mot de passe.' });
    else if (error === 'link') setNote({ kind: 'crit', text: 'Ce lien a expiré ou a déjà servi. Connecte-toi avec ton mot de passe, ou demande un nouveau lien.' });
    else if (error === 'reset_link') {
      setMode('forgot');
      setNote({ kind: 'crit', text: 'Ce lien a expiré, a déjà servi, ou a été ouvert sur un autre appareil. Demande un nouveau lien et ouvre-le sur cet appareil.' });
    } else if (error === 'down') setNote({ kind: 'crit', text: 'Le service de comptes ne répond pas pour le moment. Réessaie dans quelques minutes.' });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchTo = (m: Mode) => {
    setMode(m);
    setNote(null);
  };

  const resend = async (to: string) => {
    if (cooldown > 0) return;
    setCooldown(60);
    const res = await fetch('/api/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: to }) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : { error: 'network' };
    setNote(res?.ok ? { kind: 'info', text: `Nouvel email envoyé à ${to}. Pense à regarder dans les spams.` } : { kind: 'crit', text: ERRORS[body.error] || "L'email n'est pas parti. Réessaie dans une minute." });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const path = mode === 'login' ? '/api/login' : mode === 'signup' ? '/api/signup' : '/api/reset';
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : { error: 'network' };
    setBusy(false);
    if (res?.ok) {
      if (mode === 'login' || (mode === 'signup' && !body.confirm)) {
        window.location.href = '/app';
        return;
      }
      if (mode === 'signup') {
        setSent(email.trim().toLowerCase());
        setCooldown(60);
        return;
      }
      setNote({ kind: 'info', text: `Si ${email} a un compte, un lien vient de partir pour choisir un nouveau mot de passe. Ouvre-le sur cet appareil.` });
      return;
    }
    setNote({ kind: 'crit', text: ERRORS[body.error] || 'Ça n’a pas marché. Vérifie ta connexion et réessaie.', resend: body.error === 'not_confirmed' });
  };

  const st = strength(password);

  if (sent) {
    const box = inboxLink(sent);
    return (
      <main className="login">
        <div className="login-card center">
          <img className="login-mascot" src="/mascots/mail.webp" alt="" width={120} height={120} />
          <div>
            <h1 className="sm">Vérifie tes mails</h1>
            <p className="lede">
              On vient d&apos;envoyer un lien de confirmation à <b>{sent}</b>. Clique dessus pour activer ton compte : tu arriveras directement dans l&apos;appli.
            </p>
          </div>
          {box && (
            <a className="btn primary lg" href={box.url} target="_blank" rel="noopener noreferrer">
              {box.label}
            </a>
          )}
          <ul className="login-tips">
            <li>Rien reçu après 2 minutes ? Regarde dans les spams ou l&apos;onglet Promotions.</li>
            <li>Tu peux ouvrir le lien sur ton téléphone ou ton ordinateur, peu importe.</li>
          </ul>
          <div className="login-row">
            <button className="btn" onClick={() => resend(sent)} disabled={cooldown > 0}>
              {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer l'email"}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setSent(null);
                setNote(null);
                setMode('signup');
              }}
            >
              Changer d&apos;adresse
            </button>
          </div>
          {note && <div className={`alert ${note.kind}`}>{note.text}</div>}
          <button type="button" className="linkish" onClick={() => (setSent(null), switchTo('login'))}>
            J&apos;ai confirmé, je me connecte
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="login split">
      <div className="login-card">
        <Link href="/" className="brand" style={{ padding: 0 }} aria-label="Accueil">
          <span className="logo">
            <Logo size={48} />
          </span>
        </Link>
        <div>
          <h1 className="sm">{mode === 'signup' ? 'Crée ton compte' : mode === 'forgot' ? 'Mot de passe oublié' : 'Content de te revoir'}</h1>
          <p className="lede">
            {mode === 'signup'
              ? 'Gratuit pendant la phase de test. Ton espace est prêt en 5 minutes.'
              : mode === 'forgot'
                ? 'Entre ton email : on t’envoie un lien pour choisir un nouveau mot de passe.'
                : 'Connecte-toi pour retrouver ta journée.'}
          </p>
        </div>

        {mode !== 'forgot' && (
          <div className="seg login-tabs" role="tablist" aria-label="Compte">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => switchTo('login')}>
              Se connecter
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchTo('signup')}>
              Créer un compte
            </button>
          </div>
        )}

        <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
          {mode === 'signup' && (
            <label className="fld">
              <span>Ton prénom</span>
              <input className="inp" required autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aziz" maxLength={60} />
            </label>
          )}
          <label className="fld">
            <span>Email</span>
            <input className="inp" type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" />
          </label>
          {mode !== 'forgot' && (
            <label className="fld">
              <span>Mot de passe{mode === 'signup' ? ' (8 caractères minimum)' : ''}</span>
              <span className="pw">
                <input
                  className="inp"
                  type={show ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? 'Cacher le mot de passe' : 'Afficher le mot de passe'}>
                  {show ? 'Cacher' : 'Voir'}
                </button>
              </span>
              {mode === 'signup' && password && (
                <span className={`pw-meter s${st}`} aria-live="polite">
                  <i />
                  <i />
                  <i />
                  <em>{STRENGTH[st]}</em>
                </span>
              )}
            </label>
          )}
          <button className="btn primary lg" type="submit" disabled={busy}>
            {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
          </button>
          {note && (
            <div className={`alert ${note.kind}`}>
              <span>{note.text}</span>
              {note.resend && email && (
                <button type="button" className="btn sm" onClick={() => resend(email)} disabled={cooldown > 0}>
                  {cooldown > 0 ? `Renvoyer dans ${cooldown} s` : "Renvoyer l'email de confirmation"}
                </button>
              )}
            </div>
          )}
          {mode === 'signup' && <p className="hint" style={{ margin: 0 }}>Tes données restent à toi : elles ne servent qu&apos;à faire marcher ton espace, jamais à de la publicité.</p>}
        </form>

        <div className="login-links">
          {mode === 'forgot' ? (
            <button type="button" className="linkish" onClick={() => switchTo('login')}>
              Retour à la connexion
            </button>
          ) : mode === 'login' ? (
            <button type="button" className="linkish" onClick={() => switchTo('forgot')}>
              Mot de passe oublié ?
            </button>
          ) : (
            <button type="button" className="linkish" onClick={() => switchTo('login')}>
              J&apos;ai déjà un compte
            </button>
          )}
        </div>
      </div>
      <aside className="login-side" aria-hidden="true">
        <div className="ls-inner">
          <img src="/mascots/idee.webp" alt="" width={140} height={140} className="ls-mascot" />
          <h2>
            Vide ta tête.
            <br />
            <em>L&apos;IA range.</em>
          </h2>
          <ul>
            <li>Tu notes en vrac, à l&apos;écrit ou à la voix.</li>
            <li>Chaque idée devient une action claire, dans le bon projet.</li>
            <li>Les liens pour réserver ou faire la démarche sont déjà là.</li>
            <li>Ta journée, ta semaine et ton mois au même endroit.</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
