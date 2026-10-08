import { NextResponse } from 'next/server';
import { guardAi } from '@/lib/server/guard';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // ~2 à 3 minutes de voix compressée
const ALLOWED = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|flac|m4a|x-m4a|aac)(;.*)?$/i;

/**
 * Transcription vocale avec un modèle Hugging Face (Whisper par défaut).
 * Le client envoie l'audio brut ; on le passe tel quel à l'API d'inférence HF.
 * La clé HF reste côté serveur. Rien n'est stocké.
 */
export async function POST(req: Request) {
  const g = await guardAi(1, 'hf');
  if (!g.ok) return g.res;

  const type = req.headers.get('content-type') || '';
  if (!ALLOWED.test(type)) return NextResponse.json({ error: 'bad_audio_type' }, { status: 415 });
  const audio = await req.arrayBuffer();
  if (!audio.byteLength) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (audio.byteLength > MAX_BYTES) return NextResponse.json({ error: 'too_long' }, { status: 413 });

  const model = process.env.HF_ASR_MODEL || 'openai/whisper-large-v3';
  const base = process.env.HF_ASR_URL || `https://router.huggingface.co/hf-inference/models/${model}`;
  try {
    const r = await fetch(base, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': type.split(';')[0] },
      body: audio,
    });
    const body = (await r.json().catch(() => null)) as { text?: string; error?: string } | null;
    if (!r.ok || !body || typeof body.text !== 'string') {
      // 503 = modèle en cours de chargement chez HF : le client peut réessayer.
      return NextResponse.json({ error: r.status === 503 ? 'model_loading' : 'asr_failed', detail: body?.error?.slice(0, 200) }, { status: r.status === 503 ? 503 : 502 });
    }
    return NextResponse.json({ text: body.text.trim() });
  } catch {
    return NextResponse.json({ error: 'asr_unreachable' }, { status: 502 });
  }
}
