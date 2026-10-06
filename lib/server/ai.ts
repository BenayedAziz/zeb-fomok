import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
export const MODEL = () => process.env.AI_MODEL || 'claude-haiku-4-5';
export const IMPORT_MODEL = () => process.env.AI_IMPORT_MODEL || process.env.AI_MODEL || 'claude-haiku-4-5';

export type Msg = { role: 'user' | 'assistant'; content: string };

export async function ask(system: string, messages: Msg[], opts: { model?: string; maxTokens?: number } = {}) {
  const res = await anthropic().messages.create({
    model: opts.model || MODEL(),
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
  domains: { id: string; name: string }[];
  projects: { id: string; name: string; domain?: string; outcome?: string }[];
}

function ctxBlock(c: Ctx) {
  const doms = c.domains.map((d) => `- ${d.id} : ${d.name}`).join('\n') || '(aucun)';
  const projs =
    c.projects
      .map((p) => `- ${p.id} : ${p.name}${p.domain ? ` [domaine : ${p.domain}]` : ''}${p.outcome ? ` | résultat attendu : ${p.outcome}` : ''}`)
      .join('\n') || '(aucun)';
  return `${todayLine(c.today)}\n\nDomaines de vie (id : nom) :\n${doms}\n\nProjets en cours (id : nom) :\n${projs}`;
}

/* ------------------------------------------------------------------ */
/* Rangement d'une capture                                              */
/* ------------------------------------------------------------------ */
export const CLASSIFY_SYSTEM = `Tu es l'assistant d'organisation d'une personne qui applique la méthode Getting Things Done (GTD) de David Allen. Tu ranges ce qu'elle capture, comme un praticien GTD rigoureux. Tu réponds uniquement avec un objet JSON valide, sans texte autour.`;

export function classifyPrompt(text: string, c: Ctx) {
  return `Élément capturé, pas encore rangé :
"""
${text.slice(0, 4000)}
"""

${ctxBlock(c)}

Champs à renvoyer :
- status : "todo" si c'est une action concrète à faire par la personne ; "waiting" si elle attend quelque chose de quelqu'un ; "someday" pour une idée, une envie ou un outil à tester plus tard sans engagement ; "inbox" seulement si c'est impossible à interpréter.
- title : reformulation courte, qui commence par un verbe d'action si status vaut "todo". Garde la langue d'origine, n'ajoute aucune information absente du texte.
- projectId : l'id d'un projet existant seulement si le lien est clair, sinon null.
- domainId : l'id du domaine le plus probable, sinon null.
- context : "@ordi", "@telephone", "@dehors", "@maison", "@bureau" ou null.
- priority : "high", "med", "low" ou null. "high" seulement en cas d'urgence ou d'échéance proche explicite.
- date : AAAA-MM-JJ seulement si le texte donne une date ou un jour ("demain", "jeudi" : calcule depuis aujourd'hui), sinon null. Pour une récurrence, la prochaine occurrence.
- time : HH:MM seulement si une heure est donnée, sinon null.
- recurrence : "daily", "weekdays", "weekly", "monthly" si le texte dit que ça se répète ("tous les mardis", "chaque matin"), sinon null.
- waitingFor : qui on attend si status vaut "waiting", sinon null.
- newProject : si l'élément demande plusieurs étapes et ne correspond à aucun projet existant, {"name":"...","domainId":"id ou null","outcome":"à quoi ressemble terminé, en une phrase"} ; title devient alors la toute première action concrète. Sinon null.
- reason : une phrase courte qui explique le rangement.

Exemple :
{"status":"todo","title":"Appeler le comptable pour le devis","projectId":null,"domainId":null,"context":"@telephone","priority":"med","date":null,"time":null,"recurrence":null,"waitingFor":null,"newProject":null,"reason":"Action unique à faire au téléphone, sans date imposée."}`;
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
  "items": [ {"title": "action qui commence par un verbe", "project": "key d'un projet ci-dessus ou null", "status": "todo" | "waiting" | "someday", "date": "AAAA-MM-JJ ou null", "time": "HH:MM ou null", "priority": "high" | "med" | "low" | null, "context": "@ordi" | "@telephone" | "@dehors" | "@maison" | "@bureau" | null, "waitingFor": "qui, si waiting", "reason": "d'où ça vient, en une phrase courte (ex. mail de François du 2 oct.)"} ]
}
Règles : un projet existant se réutilise via existingId plutôt que d'être recréé. Les rendez-vous à venir deviennent des items avec date et heure. Une échéance passée non faite devient un item sans date avec la date d'origine dans reason. Au maximum 25 projets et 80 items, les plus utiles d'abord.`;
}
