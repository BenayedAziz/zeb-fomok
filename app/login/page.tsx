'use client';
import { useEffect, useState } from 'react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'link') {
      setState('error');
      setMsg('Ce lien de connexion a expiré ou a déjà servi. Demande-en un nouveau.');
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setState('sent');
      return;
    }
    setState('error');
    setMsg(
      body.error === 'not_invited'
        ? "Cet email n'est pas encore invité. Demande à Aziz de t'ajouter à la liste des testeurs."
        : body.error === 'bad_email'
          ? "Cette adresse email n'est pas valide."
          : body.error === 'demo'
            ? "Les comptes ne sont pas encore activés sur ce site : l'appli tourne en mode démo."
            : "L'email n'a pas pu partir. Réessaie dans une minute.",
    );
  };

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand" style={{ padding: 0 }}>
          <span className="logo">SC</span>
          <div>
            <b>Second Cerveau</b>
            <small>Méthode GTD</small>
          </div>
        </div>
        <div>
          <h1>
            Tu notes, <em>l&apos;IA range.</em>
          </h1>
          <p className="lede">Tes projets, ta journée, ta semaine et ton mois au même endroit. Connecte-toi avec ton email : on t&apos;envoie un lien, pas de mot de passe.</p>
        </div>
        {state === 'sent' ? (
          <div className="alert info">
            <span>
              Lien envoyé à <b>{email}</b>. Ouvre-le depuis cet appareil pour te connecter. Pense à regarder dans les spams.
            </span>
          </div>
        ) : (
          <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
            <label className="fld">
              <span>Ton email</span>
              <input className="inp" style={{ height: 42 }} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.com" />
            </label>
            <button className="btn primary lg" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Envoi…' : 'Recevoir mon lien de connexion'}
            </button>
            {state === 'error' && <div className="alert crit">{msg}</div>}
          </form>
        )}
        <a href="/app" className="hint">
          Mode démo (sans compte)
        </a>
      </div>
    </main>
  );
}
