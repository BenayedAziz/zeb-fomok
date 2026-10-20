import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

/** Retour des liens envoyés par email (confirmation de compte, mot de passe oublié). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // Lien ouvert sur un autre appareil que celui de la demande : l'adresse est bien confirmée
    // (Supabase ne renvoie un code qu'après vérification), il suffit de se connecter ici.
    if (next === '/app') return NextResponse.redirect(`${origin}/login?confirmed=1`);
  }
  return NextResponse.redirect(`${origin}/login?error=${next === '/reset' ? 'reset_link' : 'link'}`);
}
