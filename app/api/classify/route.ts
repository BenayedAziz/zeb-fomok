import { NextResponse } from 'next/server';
import { guardAi } from '@/lib/server/guard';
import { ask, CLASSIFY_SYSTEM, classifyPrompt, parseJson, safeLinks, type Ctx } from '@/lib/server/ai';

export async function POST(req: Request) {
  const g = await guardAi(1);
  if (!g.ok) return g.res;
  const { text, ctx } = (await req.json().catch(() => ({}))) as { text?: string; ctx?: Ctx };
  if (!text || !ctx) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    // Effort moyen : le rangement est la fonction centrale, on laisse l'IA réfléchir un peu (Haiku reste très bon marché).
    const out = await ask(CLASSIFY_SYSTEM, [{ role: 'user', content: classifyPrompt(text, ctx) }], { maxTokens: 8000, effort: 'medium' });
    const parsed = parseJson<{ items?: Record<string, unknown>[] }>(out);
    if (!parsed) {
      console.error('classify: réponse IA illisible', out.slice(0, 300));
      return NextResponse.json({ error: 'invalid_json' }, { status: 502 });
    }
    // Seuls les liens de sites sûrs passent ; un lieu cité devient un lien vers le plan.
    if (Array.isArray(parsed.items)) parsed.items.forEach((it) => it && typeof it === 'object' && (it.links = safeLinks(it.links, it.place, ctx.city)));
    return NextResponse.json({ result: parsed });
  } catch (e) {
    console.error('classify: appel IA en échec', (e as Error).message); // visible dans Vercel > Logs
    return NextResponse.json({ error: 'ai_failed', detail: (e as Error).message }, { status: 502 });
  }
}
