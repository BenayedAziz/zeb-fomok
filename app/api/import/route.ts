import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { guardAi } from '@/lib/server/guard';
import { ask, IMPORT_SYSTEM, importPrompt, parseJson, type Ctx } from '@/lib/server/ai';
import { PROVIDERS, readIcs, readProvider, tokenCookie, unseal, type Provider } from '@/lib/server/connectors';

export const maxDuration = 60;

const LABEL: Record<string, string> = { notion: 'Notion', google: 'Gmail et Google Agenda', microsoft: 'Outlook', ics: 'Calendrier (lien)', text: 'Texte collé' };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { source?: string; url?: string; text?: string; ctx?: Ctx };
  const source = body.source || '';
  if (!body.ctx || !(['ics', 'text'].includes(source) || PROVIDERS.includes(source as Provider))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const g = await guardAi(3);
  if (!g.ok) return g.res;

  let raw = '';
  const store = await cookies();
  try {
    if (source === 'text') raw = (body.text || '').slice(0, 60000);
    else if (source === 'ics') raw = await readIcs(body.url || '');
    else {
      const sealed = store.get(tokenCookie(source as Provider))?.value;
      const token = sealed ? unseal(sealed) : null;
      if (!token) return NextResponse.json({ error: 'reconnect' }, { status: 401 });
      raw = await readProvider(source as Provider, token);
    }
  } catch (e) {
    return NextResponse.json({ error: 'read_failed', detail: (e as Error).message }, { status: 502 });
  }
  if (!raw.trim()) return NextResponse.json({ error: 'empty' }, { status: 422 });

  try {
    const out = await ask(IMPORT_SYSTEM, [{ role: 'user', content: importPrompt(LABEL[source] || source, raw, body.ctx) }], {
      purpose: 'import',
      maxTokens: 8000,
    });
    const parsed = parseJson(out);
    if (!parsed) return NextResponse.json({ error: 'invalid_json' }, { status: 502 });
    const res = NextResponse.json({ proposals: parsed, source });
    if (PROVIDERS.includes(source as Provider)) res.cookies.delete(tokenCookie(source as Provider)); // accès effacé après usage
    return res;
  } catch (e) {
    return NextResponse.json({ error: 'ai_failed', detail: (e as Error).message }, { status: 502 });
  }
}
