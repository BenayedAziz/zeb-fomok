import { NextResponse } from 'next/server';
import { aiHealth } from '@/lib/server/ai';
import { PROVIDERS, providerConfigured } from '@/lib/server/connectors';

export async function GET(req: Request) {
  const check = new URL(req.url).searchParams.has('check');
  return NextResponse.json({
    ...(check ? { aiCheck: await aiHealth(), model: process.env.AI_MODEL || 'claude-haiku-5-5' } : {}),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    voice: Boolean(process.env.HF_TOKEN),
    providers: Object.fromEntries(PROVIDERS.map((p) => [p, providerConfigured(p)])),
  });
}
