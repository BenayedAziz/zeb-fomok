import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
export const MODEL = () => process.env.AI_MODEL || 'claude-haiku-4-5';
export const IMPORT_MODEL = () => process.env.AI_IMPORT_MODEL || process.env.AI_MODEL || 'claude-haiku-4-5';
/** Modèle Hugging Face (Inference Providers, API compatible OpenAI). */
export const HF_MODEL = () => process.env.HF_LLM_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';
export const HF_IMPORT_MODEL = () => process.env.HF_LLM_IMPORT_MODEL || HF_MODEL();

export type Msg = { role: 'user' | 'assistant'; content: string };
export type LlmProvider = 'hf' | 'anthropic';

/**
 * Fournisseurs disponibles, le principal en premier. AI_PROVIDER force le choix ;
 * sinon Hugging Face si HF_TOKEN est posé, puis Anthropic. L'autre sert de secours.
 */
export function llmProviders(): LlmProvider[] {
  const has: Record<LlmProvider, boolean> = { hf: Boolean(process.env.HF_TOKEN), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) };
  const first: LlmProvider = process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : process.env.AI_PROVIDER === 'hf' ? 'hf' : has.hf ? 'hf' : 'anthropic';
  return ([first, first === 'hf' ? 'anthropic' : 'hf'] as LlmProvider[]).filter((p) => has[p]);
}
export const llmConfigured = () => llmProviders().length > 0;

type AskOpts = { model?: string; maxTokens?: number; purpose?: 'default' | 'import' };

async function askAnthropic(system: string, messages: Msg[], opts: AskOpts) {
  const res = await anthropic().messages.create({
    model: opts.model || (opts.purpose === 'import' ? IMPORT_MODEL() : MODEL()),
    max_tokens: opts.maxTokens || 1024,
    system,
    messages,
  });
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('')
    .trim();
}

async function askHf(system: string, messages: Msg[], opts: AskOpts) {
  const r = await fetch(process.env.HF_LLM_URL || 'https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.purpose === 'import' ? HF_IMPORT_MODEL() : HF_MODEL(),
      max_tokens: opts.maxTokens || 1024,
      temperature: 0.2,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  const body = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string | null } }[]; error?: unknown } | null;
  const text = body?.choices?.[0]?.message?.content;
  if (!r.ok || typeof text !== 'string') {
    const err = typeof body?.error === 'string' ? body.error : JSON.stringify(body?.error ?? '');
    throw new Error(`hf_${r.status}:${err.slice(0, 200)}`);
  }
  // Certains modèles « réfléchissent » à voix haute : on garde seulement la réponse.
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/** Envoie la conversation au fournisseur principal, puis au secours s'il échoue. */
export async function ask(system: string, messages: Msg[], opts: AskOpts = {}) {
  const providers = llmProviders();
  if (!providers.length) throw new Error('ai_not_configured');
  let last: unknown;
  for (const p of providers) {
    try {
      return p === 'hf' ? await askHf(system, messages, opts) : await askAnthropic(system, messages, opts);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Lit un objet ou un tableau JSON dans une réponse, même entourée de texte ou d'un bloc de code. */
export function parseJson<T = unknown>(text: string): T | null {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  const direct = tryParse(text);
  if (direct !== null) return direct;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const f = tryParse(fence[1]);
    if (f !== null) return f;
  }
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start >= 0 && end > start) return tryParse(text.slice(start, end + 1));
  return null;
}

export const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export function todayLine(today: string) {
  const [y, m, d] = today.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return `Aujourd'hui : ${DAYS_FR[wd]} ${today}.`;
}

export interface Ctx {
  today: string;
  contexts?: string[];
  domains: { id: string; name: string }[];
  projects: { id: string; name: string; domain?: string; outcome?: string }[];
}

function ctxBlock(c: Ctx) {
  const doms = c.domains.map((d) => `- ${d.id} : ${d.name}`).join('\n') || '(aucun)';
  const projs =
    c.projects
      .map((p) => `- ${p.id} : ${p.name}${p.domain ? ` [domaine : ${p.domain}]` : ''}${p.outcome ? ` | résultat attendu : ${p.outcome}` : ''}`)
      .join('\n') || '(aucun)';
  const ctxs = (c.contexts?.length ? c.contexts : ['@ordi', '@telephone', '@dehors', '@maison', '@bureau']).map((x) => `"${x}"`).join(', ');
  return `${todayLine(c.today)}\n\nDomaines de vie (id : nom) :\n${doms}\n\nProjets en cours (id : nom) :\n${projs}\n\nContextes possibles : ${ctxs}.`;
}

/* ------------------------------------------------------------------ */
/* Rangement d'une capture                                              */
/* ------------------------------------------------------------------ */
export const CLASSIFY_SYSTEM = `Tu es l'assistant d'organisation d'une personne qui applique la méthode Getting Things Done (GTD) de David Allen. Tu ranges ce qu'elle capture, comme un praticien GTD rigoureux. Tu réponds uniquement avec un objet JSON valide, sans texte autour.`;

export function classifyPrompt(text: string, c: Ctx) {
  return `Texte capturé, pas encore rangé :
"""
${text.slice(0, 6000)}
"""

${ctxBlock(c)}

Le texte peut contenir PLUSIEURS éléments distincts (séparés par des virgules, des « et », des retours à la ligne, ou concernant des projets différents) : renvoie un élément par action, événement ou ressource. S'il n'y en a qu'un, renvoie un seul élément.

Pour chaque élément :
- kind : "event" pour ce qui a lieu à un moment donné (réunion, rendez-vous, anniversaire, cours, séance, appel planifié) ; "task" pour une action à faire ; "pin" pour un article, un outil, une vidéo ou un lien à garder comme ressource (souvent une URL).
- status (task) : "todo" si c'est une action concrète ; "waiting" si on attend quelque chose de quelqu'un ; "someday" pour une idée ou une envie sans engagement ; "inbox" seulement si c'est impossible à interpréter. Pour un event : "todo".
- title : court. Pour une task, commence par un verbe d'action. Pour un event, le nom de l'événement (« Réunion RESAH », « Anniversaire de Sarah »). Pour un pin, le titre de la ressource. Garde la langue d'origine, n'invente rien.
- projectId : l'id d'un projet existant seulement si le lien est clair, sinon null.
- domainId : l'id du domaine le plus probable, sinon null.
- context : un des contextes possibles ou null (task seulement).
- priority : "high", "med", "low" ou null. "high" seulement en cas d'urgence ou d'échéance proche explicite.
- date : AAAA-MM-JJ si le texte donne une date ou un jour (« demain », « jeudi » : calcule depuis aujourd'hui). Pour une récurrence, la prochaine occurrence. Sinon null.
- time : HH:MM si une heure est donnée, sinon null. Un event sans heure est sur toute la journée.
- duration : durée en minutes si elle est donnée ou évidente (« de 19h à 20h » = 60, « réunion d'une heure » = 60), sinon null.
- recurrence : "daily", "weekdays", "weekly", "monthly" ou "yearly" si ça se répète (« tous les mardis », « chaque mois », un anniversaire = "yearly"), sinon null.
- recurrenceDays : pour "weekly", les jours concernés en nombres (0 = dimanche, 1 = lundi … 6 = samedi), ex. [2] pour « tous les mardis », [1,3] pour « lundi et mercredi ». Sinon null.
- recurrenceInterval : 2 pour « toutes les 2 semaines », etc. Sinon null.
- waitingFor : qui on attend si status vaut "waiting", sinon null.
- url : l'adresse si c'est un pin, sinon null.
- note : pour un pin, en quoi la ressource peut servir, en une phrase. Sinon null.
- newProject : si une task demande plusieurs étapes et ne correspond à aucun projet existant, {"name":"...","domainId":"id ou null","outcome":"à quoi ressemble terminé, en une phrase"} ; title devient la toute première action concrète. Sinon null. Ne crée pas deux fois le même nouveau projet.
- reason : une phrase courte qui explique le rangement.

Réponds avec {"items": [ ... ]}. Exemple pour « Réunion RESAH jeudi 14h pendant 1h, et relancer François pour le devis Egyptours » :
{"items":[{"kind":"event","status":"todo","title":"Réunion RESAH","projectId":null,"domainId":null,"context":null,"priority":null,"date":"2026-10-08","time":"14:00","duration":60,"recurrence":null,"recurrenceDays":null,"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"newProject":null,"reason":"Réunion à une date et une heure précises."},{"kind":"task","status":"todo","title":"Relancer François pour le devis","projectId":null,"domainId":null,"context":"@telephone","priority":"med","date":null,"time":null,"duration":null,"recurrence":null,"recurrenceDays":null,"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"newProject":null,"reason":"Action unique liée au client Egyptours."}]}`;
}

/* ------------------------------------------------------------------ */
/* Entretien d'accueil sur les objectifs                                */
/* ------------------------------------------------------------------ */
export const INTERVIEW_SYSTEM = `Tu mènes l'entretien d'accueil de Second Cerveau, une appli de gestion de projets et de calendrier basée sur la méthode Getting Things Done. Ton but : comprendre la personne pour préremplir son espace (domaines de vie, objectifs, projets en cours).

Déroulé, une seule question à la fois, en français, ton chaleureux et direct, phrases courtes, tutoiement :
1. Ce qui occupe sa vie aujourd'hui (travail, side projects, perso) : ce sont ses domaines de vie.
2. Sa vision à 5 ans : à quoi ressemble sa vie si tout se passe bien.
3. Ses objectifs pour les 12 prochains mois, concrets.
4. Comment elle veut être au quotidien (comportements, habitudes, état d'esprit).
5. Ses projets en cours en ce moment, et pour chacun où elle en est.
6. Ce qui la fait perdre le fil aujourd'hui (pour l'aider ensuite).

Règles : rebondis brièvement sur la réponse (une phrase maximum) avant la question suivante. Si une réponse est vague, demande un exemple concret une seule fois puis avance. N'invente rien. Ne fais pas de liste à puces. Quand tu as couvert les 6 points, dis que tu as ce qu'il faut et invite la personne à cliquer sur « Voir le récap ». Ne génère pas toi-même le récap.`;

export const INTERVIEW_OPENING =
  "Salut ! Je vais te poser quelques questions pour préparer ton espace : tes domaines de vie, tes objectifs et tes projets en cours. Ça prend 5 minutes, et tu pourras tout modifier ensuite.\n\nPour commencer : qu'est-ce qui occupe ta vie en ce moment ? Ton travail, tes projets à côté, le perso.";

export const SUMMARY_SYSTEM = `Tu transformes un entretien d'accueil en données structurées pour une appli GTD. Tu n'inventes rien qui n'a pas été dit. Tu réponds uniquement avec un objet JSON valide.`;

export function summaryPrompt(transcript: string, today: string) {
  return `${todayLine(today)}

Entretien :
"""
${transcript.slice(0, 30000)}
"""

Renvoie :
{
  "domains": [ {"name": "nom court, ex. Travail, Freelance, Sport"} ],
  "goals": [ {"title": "objectif formulé à la première personne", "horizon": "vision" | "year" | "behavior"} ],
  "projects": [ {"name": "nom court", "domain": "nom exact d'un domaine ci-dessus ou null", "outcome": "à quoi ressemble terminé, en une phrase, ou null", "goal": "titre exact d'un objectif ci-dessus ou null", "nextAction": "première action concrète si elle a été dite ou se déduit clairement, sinon null"} ]
}
Entre 2 et 8 domaines. "vision" = horizon 3 à 5 ans, "year" = 12 mois, "behavior" = comportements et habitudes. Reprends les mots de la personne.`;
}

/* ------------------------------------------------------------------ */
/* Import depuis des outils                                             */
/* ------------------------------------------------------------------ */
export const IMPORT_SYSTEM = `Tu aides une personne à reprendre en main ses projets avec la méthode Getting Things Done. On te donne des extraits de ses outils (notes, mails, agenda). Tu en déduis ses projets en cours et les prochaines actions concrètes. Tu ne gardes que ce qui est actionnable ou utile, tu ignores les newsletters, notifications, codes de connexion, publicités et tout ce qui est purement informatif. Tu n'inventes rien. Tu réponds uniquement avec un objet JSON valide.`;

export function importPrompt(source: string, raw: string, c: Ctx) {
  return `Source : ${source}

${ctxBlock(c)}

Extraits :
"""
${raw.slice(0, 60000)}
"""

Renvoie :
{
  "projects": [ {"key": "p1", "name": "nom court", "existingId": "id d'un projet existant qui correspond, sinon null", "domainId": "id de domaine ou null", "outcome": "à quoi ressemble terminé, ou null", "description": "une phrase de contexte tirée des extraits"} ],
  "items": [ {"kind": "task" | "event", "title": "action qui commence par un verbe, ou nom de l'événement", "project": "key d'un projet ci-dessus ou null", "status": "todo" | "waiting" | "someday", "duration": "minutes ou null", "date": "AAAA-MM-JJ ou null", "time": "HH:MM ou null", "priority": "high" | "med" | "low" | null, "context": "@ordi" | "@telephone" | "@dehors" | "@maison" | "@bureau" | null, "waitingFor": "qui, si waiting", "reason": "d'où ça vient, en une phrase courte (ex. mail de François du 2 oct.)"} ]
}
Règles : un projet existant se réutilise via existingId plutôt que d'être recréé. Les rendez-vous et réunions à venir deviennent des items kind \"event\" avec date, heure et durée. Une échéance passée non faite devient un item sans date avec la date d'origine dans reason. Au maximum 25 projets et 80 items, les plus utiles d'abord.`;
}
