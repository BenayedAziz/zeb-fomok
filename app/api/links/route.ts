import { NextResponse } from 'next/server';
import { guardAi } from '@/lib/server/guard';
import { findLinks } from '@/lib/server/ai';

/* Liens pour passer à l'action : l'IA cherche sur le web la page de réservation, de rendez-vous ou d'inscription. */
export async function POST(req: Request) {
  const { title, query, city } = (await req.json().catch(() => ({}))) as { title?: string; query?: string; city?: string };
  if (typeof title !== 'string' || typeof query !== 'string' || !query.trim()) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const g = await guardAi(1);
  if (!g.ok) return g.res;
  try {
    const links = await findLinks({ title, query, city: typeof city === 'string' ? city : undefined });
    return NextResponse.json({ links });
  } catch (e) {
    console.error('links: recherche en échec', (e as Error).message);
    return NextResponse.json({ error: 'ai_failed' }, { status: 502 });
  }
}
