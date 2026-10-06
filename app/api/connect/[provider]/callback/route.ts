import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCode, PROVIDERS, seal, tokenCookie, type Provider } from '@/lib/server/connectors';

export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const p = provider as Provider;
  const store = await cookies();
  const expected = store.get('sc_oauth_state')?.value;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!PROVIDERS.includes(p) || !code || !state || expected !== `${p}:${state}`) {
    return NextResponse.redirect(`${origin}/app?import_error=denied&source=${p}`);
  }
  try {
    const token = await exchangeCode(p, origin, code);
    const res = NextResponse.redirect(`${origin}/app?import=${p}`);
    res.cookies.set(tokenCookie(p), seal(token), { httpOnly: true, secure: origin.startsWith('https'), sameSite: 'lax', maxAge: 1800, path: '/' });
    res.cookies.delete('sc_oauth_state');
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/app?import_error=token&source=${p}`);
  }
}
