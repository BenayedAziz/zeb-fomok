import { NextResponse } from 'next/server';
import { getServerSupabase, isAllowedEmail, serverSupabaseConfigured } from '@/lib/supabase/server';

export async function POST(req: Request) {
  if (!serverSupabaseConfigured()) return NextResponse.json({ error: 'demo' }, { status: 400 });
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const clean = (email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return NextResponse.json({ error: 'bad_email' }, { status: 400 });
  if (!isAllowedEmail(clean)) return NextResponse.json({ error: 'not_invited' }, { status: 403 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: { emailRedirectTo: `${origin}/auth/callback`, shouldCreateUser: true },
  });
  if (error) return NextResponse.json({ error: 'send_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
