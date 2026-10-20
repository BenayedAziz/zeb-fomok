'use client';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';

type Mode = 'login' | 'signup' | 'forgot';
type Note = { kind: 'info' | 'crit'; text: string } | null;

const ERRORS: Record<string, string> = {
  bad_input: 'Entre ton email et ton mot de passe.',
  bad_email: "Cette adresse email n'est pas valide.",
  bad_credentials: 'Email ou mot de passe incorrect. Si tu te connectais avant avec un lien, choisis un mot de passe avec « Mot de passe oublié ».',
  not_confirmed: "Ton adresse n'est pas encore confirmée : ouvre l'email de confirmation, puis reviens te connecter.",
  not_invited: "Cet email n'est pas encore invité. Demande à Aziz de t'ajouter.",
  weak_password: 'Choisis un mot de passe d’au moins 8 caractères.',
  exists: 'Un compte existe déjà avec cet email. Connecte-toi, ou utilise « Mot de passe oublié ».',
  rate_limit: "Trop d'emails envoyés en peu de temps. Réessaie dans quelques minutes.",
  not_configured: 'Les comptes ne sont pas encore activés sur ce site.',
};

export default function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const error = q.get('error');
    if (q.get('confirmed')) setNote({ kind: 'info', text: 'Adresse confirmée. Connecte-toi avec ton email et ton mot de passe.' });
    else if (error === 'link') setNote({ kind: 'crit', text: 'Ce lien a expiré ou a déjà servi. Connecte-toi avec ton mot de passe, ou demande un nouveau lien.' });
    else if (error === 'reset_link') {
      setMode('forgot');
      setNote({ kind: 'crit', text: 'Ce lien a expiré, a déjà servi, ou a été ouvert sur un autre appareil. Demande un nouveau lien et ouvre-le sur cet appareil.' });
    } else if (error === 'down') setNote({ kind: 'crit', text: 'Le service de comptes ne répond pas pour le moment. Réessaie dans quelques minutes.' });
  }, []);

  const switchTo = (m: Mode) => {
    setMode(m);
    setNote(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const path = mode === 'login' ? '/api/login' : mode === 'signup' ? '/api/signup' : '/api/reset';
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : { error: 'network' };
    setBusy(false);
    if (res?.ok) {
      if (mode === 'login') {
        window.location.href = '/app';
        return;
      }
      if (mode === 'signup' && !body.confirm) {
        window.location.href = '/app';
        return;
      }
      setNote({
        kind: 'info',
        text:
          mode === 'signup'
            ? `Compte créé. Ouvre l'email envoyé à ${email} et clique sur le lien pour confirmer ton adresse (pense aux spams). Ensuite, connecte-toi ici, depuis n'importe quel appareil.`
            : `Si ${email} a un compte, un lien vient de partir pour choisir un nouveau mot de passe. Ouvre-le sur cet appareil.`,
      });
      return;
    }
    setNote({ kind: 'crit', text: ERRORS[body.error] || 'Ça n’a pas marché. Vérifie ta connexion et réessaie.' });
  };

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand" style={{ padding: 0 }}>
          <span className="logo">
            <Logo size={56} />
          </span>
        </div>
        <div>
          <h1>
            Tu notes, <em>l&apos;IA range.</em>
          </h1>
          <p className="lede">Tes projets, ta journée, ta semaine et ton mois au même endroit.</p>
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
          {mode === 'forgot' && <p className="hint" style={{ margin: 0 }}>Entre ton email : on t&apos;envoie un lien pour choisir un nouveau mot de passe.</p>}
          <label className="fld">
            <span>Email</span>
            <input className="inp" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" />
          </label>
          {mode !== 'forgot' && (
            <label className="fld">
              <span>Mot de passe{mode === 'signup' ? ' (8 caractères minimum)' : ''}</span>
              <input
                className="inp"
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <button className="btn primary lg" type="submit" disabled={busy}>
            {busy ? 'Un instant…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Recevoir le lien'}
          </button>
          {note && <div className={`alert ${note.kind}`}>{note.text}</div>}
        </form>

        <div className="login-links">
          {mode === 'forgot' ? (
            <button type="button" className="linkish" onClick={() => switchTo('login')}>
              Retour à la connexion
            </button>
          ) : (
            <button type="button" className="linkish" onClick={() => switchTo('forgot')}>
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
