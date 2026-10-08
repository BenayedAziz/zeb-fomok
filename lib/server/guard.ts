import 'server-only';
import { NextResponse } from 'next/server';
import { getAdminSupabase, getServerSupabase, serverSupabaseConfigured } from '@/lib/supabase/server';

export type Guard = { ok: true; userId: string | null } | { ok: false; res: NextResponse };

const json = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Vérifie que la personne est connectée et qu'il lui reste du quota IA aujourd'hui.
 * En mode démo (Supabase pas configuré), on laisse passer : utile en local seulement.
 */
export async function guardAi(cost = 1, need: 'anthropic' | 'hf' = 'anthropic'): Promise<Guard> {
  if (need === 'anthropic' && !process.env.ANTHROPIC_API_KEY) return { ok: false, res: json(503, 'ai_not_configured') };
  if (need === 'hf' && !process.env.HF_TOKEN) return { ok: false, res: json(503, 'voice_not_configured') };
  if (!serverSupabaseConfigured()) return { ok: true, userId: null };

  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { ok: false, res: json(401, 'not_signed_in') };

  const admin = getAdminSupabase();
  if (admin) {
    const limit = Number(process.env.AI_DAILY_LIMIT || 60);
    for (let i = 0; i < cost; i++) {
      const { data: n, error } = await admin.rpc('bump_ai_usage', { p_user: user.id, p_limit: limit });
      if (error) return { ok: false, res: json(500, 'usage_error') };
      if (n === -1) return { ok: false, res: json(429, 'daily_limit') };
    }
  }
  return { ok: true, userId: user.id };
}
