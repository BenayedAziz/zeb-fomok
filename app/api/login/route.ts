import { NextResponse } from 'next/server';
import { getServerSupabase, isAllowedEmail, serverSupabaseConfigured } from '@/lib/supabase/server';

const clean = (s?: string) => (s || '').trim().toLowerCase();

/** Connexion par email et mot de passe. La session est posée en cookie : elle marche sur n'importe quel appareil. */
export async function POST(req: Request) {
  if (!serverSupabaseConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const { email, password } = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const mail = clean(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) || !password) return NextResponse.json({ error: 'bad_input' }, { status: 400 });
  if (!isAllowedEmail(mail)) return NextResponse.json({ error: 'not_invited' }, { status: 403 });
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === 'email_not_confirmed') return NextResponse.json({ error: 'not_confirmed' }, { status: 403 });
    return NextResponse.json({ error: 'bad_credentials' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
