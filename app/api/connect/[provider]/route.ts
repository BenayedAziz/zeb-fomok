import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { authorizeUrl, providerConfigured, PROVIDERS, type Provider } from '@/lib/server/connectors';
import { getServerSupabase, serverSupabaseConfigured } from '@/lib/supabase/server';

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  if (!PROVIDERS.includes(provider as Provider)) return NextResponse.redirect(`${origin}/app?import_error=unknown`);
  const p = provider as Provider;
  if (!providerConfigured(p)) return NextResponse.redirect(`${origin}/app?import_error=not_configured&source=${p}`);
  if (serverSupabaseConfigured()) {
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.redirect(`${origin}/login`);
  }
  const state = crypto.randomBytes(16).toString('hex');
  const res = NextResponse.redirect(authorizeUrl(p, origin, state));
  res.cookies.set('sc_oauth_state', `${p}:${state}`, { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
