import { NextResponse } from 'next/server';
import { getEmailLinkSupabase, isAllowedEmail, serverSupabaseConfigured } from '@/lib/supabase/server';

/** Mot de passe oublié (ou premier mot de passe pour un compte créé par lien) : envoie un lien pour en choisir un. */
export async function POST(req: Request) {
  if (!serverSupabaseConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const mail = (email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return NextResponse.json({ error: 'bad_email' }, { status: 400 });
  // On répond pareil que l'adresse soit invitée ou non : on ne dit pas qui a un compte.
  if (!isAllowedEmail(mail)) return NextResponse.json({ ok: true });
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const supabase = getEmailLinkSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: `${origin}/auth/finish?next=/reset` });
  if (error && ((error as { code?: string }).code || '').includes('rate_limit')) return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
  return NextResponse.json({ ok: true });
}
