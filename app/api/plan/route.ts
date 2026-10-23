import { NextResponse } from 'next/server';
import { guardAi } from '@/lib/server/guard';
import { ask, parseJson, PLAN_SYSTEM, planPrompt, type PlanInput } from '@/lib/server/ai';

/* Planifie une journée : l'IA place les tâches dans les créneaux libres et estime leur durée. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<PlanInput>;
  if (!body.date || !Array.isArray(body.tasks) || !Array.isArray(body.events) || !body.tasks.length) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const g = await guardAi(1);
  if (!g.ok) return g.res;
  try {
    const out = await ask(PLAN_SYSTEM, [{ role: 'user', content: planPrompt({ ...(body as PlanInput), tasks: body.tasks.slice(0, 40), events: body.events.slice(0, 40) }) }], { maxTokens: 8000, effort: 'medium' });
    const parsed = parseJson(out);
    if (!parsed) {
      console.error('plan: réponse IA illisible', out.slice(0, 300));
      return NextResponse.json({ error: 'invalid_json' }, { status: 502 });
    }
    return NextResponse.json({ result: parsed });
  } catch (e) {
    console.error('plan: appel IA en échec', (e as Error).message);
    return NextResponse.json({ error: 'ai_failed' }, { status: 502 });
  }
}
