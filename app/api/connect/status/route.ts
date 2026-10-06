import { NextResponse } from 'next/server';
import { PROVIDERS, providerConfigured } from '@/lib/server/connectors';

export async function GET() {
  return NextResponse.json({
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    providers: Object.fromEntries(PROVIDERS.map((p) => [p, providerConfigured(p)])),
  });
}
