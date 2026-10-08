import { NextResponse } from 'next/server';
import { llmConfigured } from '@/lib/server/ai';
import { PROVIDERS, providerConfigured } from '@/lib/server/connectors';

export async function GET() {
  return NextResponse.json({
    ai: llmConfigured(),
    voice: Boolean(process.env.HF_TOKEN),
    providers: Object.fromEntries(PROVIDERS.map((p) => [p, providerConfigured(p)])),
  });
}
