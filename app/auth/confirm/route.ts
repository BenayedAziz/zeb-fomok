import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase/server';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/app');

/**
 * Liens au format token_hash (modèles d'email Supabase) : ils marchent sur n'importe quel appareil,
 * contrairement aux liens avec code qui doivent s'ouvrir dans le navigateur de la demande.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(url.searchParams.get('next') || (type === 'recovery' ? '/reset' : '/app'));
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  if (tokenHash && type) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${type === 'recovery' ? 'reset_link' : 'link'}`);
}
