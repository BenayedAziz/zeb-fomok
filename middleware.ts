import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Rafraîchit la session Supabase et protège /app quand les comptes sont activés. */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next(); // mode démo

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Si Supabase ne répond pas (projet en pause, panne), on n'attend pas 25 s : page de connexion avec un message.
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user ?? null, () => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 5000)),
  ]);
  const onApp = request.nextUrl.pathname.startsWith('/app');
  if (user === undefined) {
    if (!onApp) return response;
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '?error=down';
    return NextResponse.redirect(login);
  }
  if (!user && onApp) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = '';
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*', '/auth/:path*'],
};
