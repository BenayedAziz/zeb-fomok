import { NextResponse } from 'next/server';
import { getEmailLinkSupabase, isAllowedEmail, serverSupabaseConfigured } from '@/lib/supabase/server';

/** Création de compte : email + mot de passe, puis lien de confirmation envoyé par email. */
export async function POST(req: Request) {
  if (!serverSupabaseConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const mail = (email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return NextResponse.json({ error: 'bad_email' }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  if (!isAllowedEmail(mail)) return NextResponse.json({ error: 'not_invited' }, { status: 403 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const supabase = getEmailLinkSupabase();
  const { data, error } = await supabase.auth.signUp({ email: mail, password, options: { emailRedirectTo: `${origin}/auth/finish?next=/app` } });
  if (error) {
    const code = (error as { code?: string }).code || '';
    if (code === 'weak_password') return NextResponse.json({ error: 'weak_password' }, { status: 400 });
    if (code.includes('rate_limit')) return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
    return NextResponse.json({ error: 'signup_failed' }, { status: 500 });
  }
  // Compte déjà existant : Supabase ne renvoie aucune identité.
  if (data.user && !data.user.identities?.length) return NextResponse.json({ error: 'exists' }, { status: 409 });
  return NextResponse.json({ ok: true, confirm: !data.session });
}
