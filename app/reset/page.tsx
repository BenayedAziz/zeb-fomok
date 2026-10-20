'use client';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { getBrowserSupabase } from '@/lib/supabase/client';

/** Choisir un nouveau mot de passe, après le lien reçu par email. */
export default function Reset() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) return setReady(false);
    sb.auth.getUser().then(({ data }) => setReady(Boolean(data.user)));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg('Choisis un mot de passe d’au moins 8 caractères.');
    if (pw !== pw2) return setMsg('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    const { error } = await getBrowserSupabase()!.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg('Le mot de passe n’a pas pu être changé. Redemande un lien et réessaie.');
    window.location.href = '/app';
  };

  return (
    <main className="login">
      <div className="login-card">
        <div className="brand" style={{ padding: 0 }}>
          <span className="logo">
            <Logo size={56} />
          </span>
        </div>
        <h1>Nouveau mot de passe</h1>
        {ready === false ? (
          <div className="alert crit">
            Ce lien a expiré ou a été ouvert sur un autre appareil. <a href="/login?error=reset_link">Demande un nouveau lien</a>.
          </div>
        ) : (
          <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
            <label className="fld">
              <span>Nouveau mot de passe (8 caractères minimum)</span>
              <input className="inp" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </label>
            <label className="fld">
              <span>Encore une fois</span>
              <input className="inp" type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </label>
            <button className="btn primary lg" type="submit" disabled={busy || ready === null}>
              {busy ? 'Un instant…' : 'Enregistrer et entrer'}
            </button>
            {msg && <div className="alert crit">{msg}</div>}
          </form>
        )}
      </div>
    </main>
  );
}
