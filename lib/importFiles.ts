'use client';
import { unzipSync } from 'fflate';

/* Lecture des fichiers d'export (Notion, Todoist, Trello, TickTick, Asana, calendriers…) dans le navigateur.
   On n'envoie à l'IA que du texte, raccourci : les fichiers eux-mêmes ne quittent pas l'appareil. */

const PER_FILE = 6000;
const TOTAL = 60000;
const ACCEPT = /\.(md|markdown|txt|csv|tsv|json|ics|ical|html?|zip)$/i;
export const ACCEPT_ATTR = '.md,.markdown,.txt,.csv,.tsv,.json,.ics,.ical,.html,.htm,.zip';

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}\n[…]` : s);
/** Notion ajoute un identifiant aux noms de fichiers : « Projet 1a2b…32 caractères.md ». */
const cleanName = (n: string) => n.replace(/\s[0-9a-f]{32}(?=\.|\/|$)/gi, '').replace(/^.*\//, '');

type TrelloBoard = {
  name?: string;
  lists?: { id: string; name: string; closed?: boolean }[];
  cards?: { name: string; desc?: string; due?: string | null; dueComplete?: boolean; closed?: boolean; idList: string; idChecklists?: string[] }[];
  checklists?: { id: string; name: string; checkItems?: { name: string; state: string }[] }[];
};

/** Un tableau Trello exporté pèse lourd : on n'en garde que les listes et les cartes ouvertes. */
function trelloText(b: TrelloBoard) {
  const lists = Object.fromEntries((b.lists || []).filter((l) => !l.closed).map((l) => [l.id, l.name]));
  const checks = Object.fromEntries((b.checklists || []).map((c) => [c.id, c]));
  const lines = (b.cards || [])
    .filter((c) => !c.closed && lists[c.idList])
    .map((c) => {
      const todo = (c.idChecklists || [])
        .flatMap((id) => checks[id]?.checkItems || [])
        .map((i) => `    ${i.state === 'complete' ? '[x]' : '[ ]'} ${i.name}`)
        .join('\n');
      return `- [${lists[c.idList]}] ${c.name}${c.due ? ` (échéance ${c.due.slice(0, 10)}${c.dueComplete ? ', faite' : ''})` : ''}${c.desc ? ` : ${clip(c.desc.replace(/\s+/g, ' '), 200)}` : ''}${todo ? `\n${todo}` : ''}`;
    });
  return `Tableau Trello « ${b.name || 'sans nom'} »\n${lines.join('\n')}`;
}

function jsonText(raw: string) {
  try {
    const j = JSON.parse(raw);
    if (j && Array.isArray(j.cards) && Array.isArray(j.lists)) return trelloText(j);
    return JSON.stringify(j, null, 1);
  } catch {
    return raw;
  }
}

const htmlText = (raw: string) =>
  raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n');

export interface ReadResult {
  /** Texte des fichiers, prêt pour l'IA. */
  text: string;
  /** Calendriers trouvés (.ics), lus côté serveur. */
  ics: string[];
  /** Noms des fichiers lus. */
  names: string[];
  skipped: string[];
}

export async function readFiles(files: File[]): Promise<ReadResult> {
  const out: ReadResult = { text: '', ics: [], names: [], skipped: [] };
  const parts: string[] = [];
  const add = (name: string, raw: string) => {
    const n = cleanName(name);
    if (/\.(ics|ical)$/i.test(name)) {
      out.ics.push(raw.slice(0, 400000));
      out.names.push(n);
      return;
    }
    const body = /\.json$/i.test(name) ? jsonText(raw) : /\.html?$/i.test(name) ? htmlText(raw) : raw;
    if (!body.trim()) return;
    parts.push(`## Fichier : ${n}\n${clip(body.trim(), PER_FILE)}`);
    out.names.push(n);
  };
  const dec = new TextDecoder();
  for (const f of files) {
    if (!ACCEPT.test(f.name)) {
      out.skipped.push(f.name);
      continue;
    }
    if (/\.zip$/i.test(f.name)) {
      try {
        const entries = unzipSync(new Uint8Array(await f.arrayBuffer()), { filter: (e) => ACCEPT.test(e.name) && !/\.zip$/i.test(e.name) && e.originalSize < 3_000_000 && !e.name.startsWith('__MACOSX') });
        // Les pages les plus haut placées d'abord : ce sont souvent les projets.
        Object.keys(entries)
          .sort((a, b) => a.split('/').length - b.split('/').length)
          .forEach((k) => add(k, dec.decode(entries[k])));
      } catch {
        out.skipped.push(f.name);
      }
      continue;
    }
    add(f.name, await f.text());
  }
  let total = 0;
  out.text = parts
    .filter((p) => {
      total += p.length;
      return total <= TOTAL;
    })
    .join('\n\n');
  return out;
}
