'use client';
import { useEffect } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

/** Arrivée depuis un lien d'email : la session est dans l'adresse (#access_token…), on l'enregistre puis on continue. */
export default function Finish() {
  useEffect(() => {
    const next = safeNext(new URLSearchParams(window.location.search).get('next'));
    const h = new URLSearchParams(window.location.hash.slice(1));
    const access_token = h.get('access_token');
    const refresh_token = h.get('refresh_token');
    const fail = () => window.location.replace(`/login?error=${next === '/reset' ? 'reset_link' : 'link'}`);
    const sb = getBrowserSupabase();
    if (!sb || !access_token || !refresh_token) return fail();
    sb.auth.setSession({ access_token, refresh_token }).then(({ error }) => (error ? fail() : window.location.replace(next)));
  }, []);
  return (
    <main className="login">
      <div className="login-card">
        <p className="lede">Connexion en cours…</p>
      </div>
    </main>
  );
}
