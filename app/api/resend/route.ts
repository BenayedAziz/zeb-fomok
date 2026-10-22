import { NextResponse } from 'next/server';
import { getEmailLinkSupabase, serverSupabaseConfigured } from '@/lib/supabase/server';

/** Renvoie l'email de confirmation d'un compte pas encore confirmé. */
export async function POST(req: Request) {
  if (!serverSupabaseConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const mail = (email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return NextResponse.json({ error: 'bad_email' }, { status: 400 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { error } = await getEmailLinkSupabase().auth.resend({ type: 'signup', email: mail, options: { emailRedirectTo: `${origin}/auth/finish?next=/app` } });
  if (error) {
    const code = (error as { code?: string }).code || '';
    if (code.includes('rate_limit') || error.status === 429) return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
    console.error('resend', code, error.message);
    return NextResponse.json({ error: 'resend_failed' }, { status: 500 });
  }
  // Même réponse que l'adresse ait un compte ou non : on ne révèle pas qui est inscrit.
  return NextResponse.json({ ok: true });
}
