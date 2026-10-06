import 'server-only';
import crypto from 'node:crypto';

/* ================================================================== */
/* Connexions aux outils, pour un import ponctuel.                      */
/* Aucun accès n'est enregistré : le jeton vit 30 minutes dans un       */
/* cookie chiffré, puis il est effacé après l'import.                   */
/* ================================================================== */

export type Provider = 'notion' | 'google' | 'microsoft';
export const PROVIDERS: Provider[] = ['notion', 'google', 'microsoft'];

const env = (k: string) => process.env[k] || '';

export function providerConfigured(p: Provider) {
  if (p === 'notion') return Boolean(env('NOTION_CLIENT_ID') && env('NOTION_CLIENT_SECRET'));
  if (p === 'google') return Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
  return Boolean(env('MICROSOFT_CLIENT_ID') && env('MICROSOFT_CLIENT_SECRET'));
}

export const redirectUri = (origin: string, p: Provider) => `${env('NEXT_PUBLIC_SITE_URL') || origin}/api/connect/${p}/callback`;

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];
const MS_SCOPES = ['openid', 'User.Read', 'Mail.Read', 'Calendars.Read'];

export function authorizeUrl(p: Provider, origin: string, state: string) {
  const redirect = redirectUri(origin, p);
  if (p === 'notion') {
    const u = new URL('https://api.notion.com/v1/oauth/authorize');
    u.search = new URLSearchParams({ client_id: env('NOTION_CLIENT_ID'), response_type: 'code', owner: 'user', redirect_uri: redirect, state }).toString();
    return u.toString();
  }
  if (p === 'google') {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      redirect_uri: redirect,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'online',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state,
    }).toString();
    return u.toString();
  }
  const u = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  u.search = new URLSearchParams({
    client_id: env('MICROSOFT_CLIENT_ID'),
    response_type: 'code',
    redirect_uri: redirect,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    state,
  }).toString();
  return u.toString();
}

export async function exchangeCode(p: Provider, origin: string, code: string): Promise<string> {
  const redirect = redirectUri(origin, p);
  let res: Response;
  if (p === 'notion') {
    const basic = Buffer.from(`${env('NOTION_CLIENT_ID')}:${env('NOTION_CLIENT_SECRET')}`).toString('base64');
    res = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirect }),
    });
  } else if (p === 'google') {
    res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), redirect_uri: redirect, grant_type: 'authorization_code' }),
    });
  } else {
    res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env('MICROSOFT_CLIENT_ID'), client_secret: env('MICROSOFT_CLIENT_SECRET'), code, redirect_uri: redirect, grant_type: 'authorization_code', scope: MS_SCOPES.join(' ') }),
    });
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`token_exchange_failed:${p}:${body.error || res.status}`);
  return body.access_token;
}

/* ------------------------- cookie chiffré ------------------------- */
function key() {
  const secret = env('IMPORT_SECRET') || env('SUPABASE_SERVICE_ROLE_KEY') || env('ANTHROPIC_API_KEY') || 'demo-secret';
  return crypto.createHash('sha256').update(secret).digest();
}
export function seal(value: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64url');
}
export function unseal(token: string): string | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
export const tokenCookie = (p: Provider) => `sc_tok_${p}`;

/* ------------------------- lecture des données ------------------------- */
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function getJson<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`fetch_failed:${r.status}:${url.split('?')[0]}`);
  return (await r.json()) as T;
}

async function inBatches<T, R>(arr: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < arr.length; i += size) out.push(...(await Promise.all(arr.slice(i, i + size).map(fn))));
  return out;
}

type RichText = { plain_text?: string }[];
type NotionPage = {
  id: string;
  object: 'page' | 'database';
  last_edited_time: string;
  url?: string;
  parent?: { type?: string };
  properties?: Record<string, { type: string; title?: RichText; rich_text?: RichText; status?: { name: string } | null; select?: { name: string } | null; date?: { start?: string; end?: string | null } | null; checkbox?: boolean }>;
  title?: RichText;
};

function notionTitle(p: NotionPage) {
  if (p.object === 'database') return (p.title || []).map((t) => t.plain_text || '').join('') || 'Sans titre';
  for (const v of Object.values(p.properties || {})) if (v.type === 'title') return (v.title || []).map((t) => t.plain_text || '').join('') || 'Sans titre';
  return 'Sans titre';
}
function notionProps(p: NotionPage) {
  const out: string[] = [];
  for (const [k, v] of Object.entries(p.properties || {})) {
    if (v.type === 'status' && v.status) out.push(`${k}: ${v.status.name}`);
    else if (v.type === 'select' && v.select) out.push(`${k}: ${v.select.name}`);
    else if (v.type === 'date' && v.date?.start) out.push(`${k}: ${v.date.start}${v.date.end ? ` → ${v.date.end}` : ''}`);
    else if (v.type === 'checkbox') out.push(`${k}: ${v.checkbox ? 'oui' : 'non'}`);
    else if (v.type === 'rich_text' && v.rich_text?.length) out.push(`${k}: ${clip(v.rich_text.map((t) => t.plain_text || '').join(''), 120)}`);
  }
  return out.join(' · ');
}

async function readNotion(token: string) {
  const h = { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
  const res = await getJson<{ results: NotionPage[] }>('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ sort: { direction: 'descending', timestamp: 'last_edited_time' }, page_size: 100 }),
  });
  const pages = res.results.slice(0, 100);
  const withText = pages.filter((p) => p.object === 'page').slice(0, 20);
  const bodies = await inBatches(withText, 5, async (p) => {
    try {
      const b = await getJson<{ results: Record<string, unknown>[] }>(`https://api.notion.com/v1/blocks/${p.id}/children?page_size=60`, { headers: h });
      const text = b.results
        .map((blk) => {
          const t = blk.type as string;
          const rt = ((blk[t] as { rich_text?: RichText })?.rich_text || []).map((r) => r.plain_text || '').join('');
          const checked = t === 'to_do' ? ((blk[t] as { checked?: boolean }).checked ? '[x] ' : '[ ] ') : '';
          return rt ? `${checked}${rt}` : '';
        })
        .filter(Boolean)
        .join('\n');
      return [p.id, clip(text, 1500)] as const;
    } catch {
      return [p.id, ''] as const;
    }
  });
  const bodyOf = Object.fromEntries(bodies);
  return pages
    .map((p) => {
      const props = notionProps(p);
      const body = bodyOf[p.id];
      return `## ${notionTitle(p)} (${p.object === 'database' ? 'base' : 'page'}, modifiée ${p.last_edited_time.slice(0, 10)})${props ? `\n${props}` : ''}${body ? `\n${body}` : ''}`;
    })
    .join('\n\n');
}

async function readGoogle(token: string) {
  const h = { Authorization: `Bearer ${token}` };
  const parts: string[] = [];
  try {
    const q = 'newer_than:30d -category:promotions -category:social -category:updates -category:forums';
    const list = await getJson<{ messages?: { id: string }[] }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=60&q=${encodeURIComponent(q)}`,
      { headers: h },
    );
    const msgs = await inBatches(list.messages || [], 10, async (m) => {
      try {
        const d = await getJson<{ snippet?: string; payload?: { headers?: { name: string; value: string }[] } }>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: h },
        );
        const hd = Object.fromEntries((d.payload?.headers || []).map((x) => [x.name, x.value]));
        return `- ${hd.Date || ''} | De : ${hd.From || ''} | Objet : ${hd.Subject || ''}\n  ${clip(d.snippet || '', 300)}`;
      } catch {
        return '';
      }
    });
    parts.push(`# Gmail, 30 derniers jours\n${msgs.filter(Boolean).join('\n')}`);
  } catch (e) {
    parts.push(`# Gmail : lecture impossible (${(e as Error).message})`);
  }
  try {
    const now = new Date();
    const max = new Date(now.getTime() + 60 * 864e5);
    const ev = await getJson<{ items?: { summary?: string; start?: { dateTime?: string; date?: string }; location?: string; description?: string }[] }>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=100&timeMin=${now.toISOString()}&timeMax=${max.toISOString()}`,
      { headers: h },
    );
    parts.push(
      `# Google Agenda, 60 prochains jours\n${(ev.items || [])
        .map((e) => `- ${e.start?.dateTime || e.start?.date || ''} : ${e.summary || 'Sans titre'}${e.location ? ` (${e.location})` : ''}${e.description ? ` | ${clip(e.description, 160)}` : ''}`)
        .join('\n')}`,
    );
  } catch (e) {
    parts.push(`# Google Agenda : lecture impossible (${(e as Error).message})`);
  }
  return parts.join('\n\n');
}

async function readMicrosoft(token: string) {
  const h = { Authorization: `Bearer ${token}` };
  const parts: string[] = [];
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  try {
    const m = await getJson<{ value: { subject?: string; from?: { emailAddress?: { name?: string; address?: string } }; receivedDateTime?: string; bodyPreview?: string; inferenceClassification?: string }[] }>(
      `https://graph.microsoft.com/v1.0/me/messages?$top=60&$orderby=receivedDateTime desc&$filter=receivedDateTime ge ${since}&$select=subject,from,receivedDateTime,bodyPreview,inferenceClassification`,
      { headers: h },
    );
    parts.push(
      `# Outlook, 30 derniers jours\n${m.value
        .filter((x) => x.inferenceClassification !== 'other')
        .map((x) => `- ${x.receivedDateTime || ''} | De : ${x.from?.emailAddress?.name || x.from?.emailAddress?.address || ''} | Objet : ${x.subject || ''}\n  ${clip(x.bodyPreview || '', 300)}`)
        .join('\n')}`,
    );
  } catch (e) {
    parts.push(`# Outlook : lecture impossible (${(e as Error).message})`);
  }
  try {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 60 * 864e5).toISOString();
    const c = await getJson<{ value: { subject?: string; start?: { dateTime?: string }; location?: { displayName?: string } }[] }>(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$top=100&$orderby=start/dateTime&$select=subject,start,location`,
      { headers: { ...h, Prefer: 'outlook.timezone="Europe/Paris"' } },
    );
    parts.push(`# Calendrier Outlook, 60 prochains jours\n${c.value.map((e) => `- ${e.start?.dateTime || ''} : ${e.subject || 'Sans titre'}${e.location?.displayName ? ` (${e.location.displayName})` : ''}`).join('\n')}`);
  } catch (e) {
    parts.push(`# Calendrier Outlook : lecture impossible (${(e as Error).message})`);
  }
  return parts.join('\n\n');
}

export async function readProvider(p: Provider, token: string) {
  if (p === 'notion') return readNotion(token);
  if (p === 'google') return readGoogle(token);
  return readMicrosoft(token);
}

/* ------------------------- calendrier par lien (ICS) ------------------------- */
function icsDate(v: string) {
  // 20261016T181500Z, 20261016T181500, 20261016
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return v;
  return m[4] ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}${v.endsWith('Z') ? ' UTC' : ''}` : `${m[1]}-${m[2]}-${m[3]}`;
}

export async function readIcs(url: string) {
  const u = url.trim().replace(/^webcal:\/\//i, 'https://');
  if (!/^https:\/\//i.test(u)) throw new Error('ics_bad_url');
  const r = await fetch(u, { headers: { Accept: 'text/calendar' } });
  if (!r.ok) throw new Error(`ics_fetch_failed:${r.status}`);
  const text = (await r.text()).replace(/\r?\n[ \t]/g, '');
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const limit = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const events: string[] = [];
  for (const block of text.split('BEGIN:VEVENT').slice(1)) {
    const get = (k: string) => {
      const m = block.match(new RegExp(`^${k}(?:;[^:\\n]*)?:(.*)$`, 'm'));
      return m ? m[1].trim().replace(/\\n/g, ' ').replace(/\\,/g, ',') : '';
    };
    const start = get('DTSTART');
    const rrule = get('RRULE');
    if (!start) continue;
    const day = start.slice(0, 8);
    if (!rrule && (day < today || day > limit)) continue;
    events.push(`- ${icsDate(start)} : ${get('SUMMARY') || 'Sans titre'}${rrule ? ` (récurrent : ${rrule})` : ''}${get('LOCATION') ? ` (${get('LOCATION')})` : ''}`);
    if (events.length >= 150) break;
  }
  return `# Calendrier (lien ICS)\n${events.join('\n') || '(aucun événement à venir)'}`;
}
