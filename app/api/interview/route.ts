import { NextResponse } from 'next/server';
import { guardAi } from '@/lib/server/guard';
import { ask, INTERVIEW_SYSTEM, SUMMARY_SYSTEM, summaryPrompt, parseJson, type Msg } from '@/lib/server/ai';

/** mode "chat" : prochaine question. mode "summary" : récap structuré à valider. */
export async function POST(req: Request) {
  const g = await guardAi(1);
  if (!g.ok) return g.res;
  const { mode, messages, today } = (await req.json().catch(() => ({}))) as { mode?: string; messages?: Msg[]; today?: string };
  const msgs = (messages || []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-40);
  if (!msgs.length) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  try {
    if (mode === 'summary') {
      const transcript = msgs.map((m) => `${m.role === 'user' ? 'Personne' : 'Assistant'} : ${m.content}`).join('\n\n');
      const out = await ask(SUMMARY_SYSTEM, [{ role: 'user', content: summaryPrompt(transcript, today || new Date().toISOString().slice(0, 10)) }], { maxTokens: 2500 });
      const parsed = parseJson(out);
      if (!parsed) return NextResponse.json({ error: 'invalid_json' }, { status: 502 });
      return NextResponse.json({ summary: parsed });
    }
    // L'API exige que la conversation commence par la personne : on retire le message d'accueil.
    const conv = msgs[0].role === 'assistant' ? [{ role: 'user' as const, content: '(La personne ouvre l’entretien.)' }, ...msgs] : msgs;
    const reply = await ask(INTERVIEW_SYSTEM, conv, { maxTokens: 400 });
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: 'ai_failed', detail: (e as Error).message }, { status: 502 });
  }
}
