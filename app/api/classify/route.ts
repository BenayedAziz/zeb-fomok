import { NextResponse } from 'next/server';
import { guardAi } from '@/lib/server/guard';
import { ask, CLASSIFY_SYSTEM, classifyPrompt, parseJson, type Ctx } from '@/lib/server/ai';

export async function POST(req: Request) {
  const g = await guardAi(1);
  if (!g.ok) return g.res;
  const { text, ctx } = (await req.json().catch(() => ({}))) as { text?: string; ctx?: Ctx };
  if (!text || !ctx) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    const out = await ask(CLASSIFY_SYSTEM, [{ role: 'user', content: classifyPrompt(text, ctx) }], { maxTokens: 3000, effort: 'low' });
    const parsed = parseJson(out);
    if (!parsed) {
      console.error('classify: réponse IA illisible', out.slice(0, 300));
      return NextResponse.json({ error: 'invalid_json' }, { status: 502 });
    }
    return NextResponse.json({ result: parsed });
  } catch (e) {
    console.error('classify: appel IA en échec', (e as Error).message); // visible dans Vercel > Logs
    return NextResponse.json({ error: 'ai_failed', detail: (e as Error).message }, { status: 502 });
  }
}
