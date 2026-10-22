import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { MONTHS, addDays, parseIso } from '@/lib/dates';

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
export const MODEL = () => process.env.AI_MODEL || 'claude-haiku-5-5';
export const IMPORT_MODEL = () => process.env.AI_IMPORT_MODEL || process.env.AI_MODEL || 'claude-haiku-5-5';

export type Msg = { role: 'user' | 'assistant'; content: string };
type Effort = 'low' | 'medium' | 'high';

/**
 * Les modèles Claude récents réfléchissent avant de répondre ; `effort` règle combien
 * (et donc le coût). La réflexion compte dans maxTokens : garder de la marge.
 * Haiku 4.5 ne connaît pas `effort`, on ne l'envoie pas.
 */
export async function ask(system: string, messages: Msg[], opts: { model?: string; maxTokens?: number; effort?: Effort } = {}) {
  const model = opts.model || MODEL();
  const res = await anthropic().messages.create({
    model,
    max_tokens: opts.maxTokens || 2048,
    // Consignes fixes mises en cache : moins cher et plus rapide d'une capture à l'autre.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
    ...(model.startsWith('claude-haiku-4') ? {} : { output_config: { effort: opts.effort || 'low' } }),
  });
  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('')
    .trim();
}

/**
 * Petit test de l'IA (quelques jetons), mis en cache 5 minutes : dit si la clé, les crédits et le modèle répondent.
 * Ne renvoie qu'un code court, jamais le message complet.
 */
let health: { at: number; code: string } | null = null;
export async function aiHealth(): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return 'no_key';
  if (health && Date.now() - health.at < 300_000) return health.code;
  let code = 'ok';
  try {
    await anthropic().messages.create({ model: MODEL(), max_tokens: 16, messages: [{ role: 'user', content: 'Réponds OK.' }] });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const msg = (err.message || '').toLowerCase();
    code =
      msg.includes('credit balance') ? 'no_credit'
      : err.status === 401 ? 'bad_key'
      : err.status === 403 ? 'forbidden'
      : err.status === 404 || msg.includes('model') ? 'bad_model'
      : err.status === 429 ? 'rate_limited'
      : `error_${err.status ?? 'network'}`;
    console.error('aiHealth', err.status, err.message);
  }
  health = { at: Date.now(), code };
  return code;
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
  /** Heure locale de la personne (HH:MM) : le serveur, lui, est en UTC. */
  now?: string;
  city?: string;
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
/*
 * Les règles sont fixes (mises en cache par l'API) ; ce qui change à chaque capture
 * (date, domaines, projets, texte) part dans le message.
 */
export const CLASSIFY_SYSTEM = `Tu es l'agent de rangement de Second Cerveau, une appli française qui applique Getting Things Done (GTD) de David Allen. La personne vide sa tête en vrac (à l'écrit ou à la voix, avec des fautes, sans ponctuation) ; toi, tu clarifies et tu ranges chaque chose au bon endroit, comme le ferait un coach GTD rigoureux et un assistant personnel qui facilite la vie. Tu réponds uniquement avec un objet JSON valide, sans texte autour ni bloc de code.

# 1. Découper
Le texte peut contenir plusieurs choses (virgules, « et », « aussi », retours à la ligne, sujets différents). Renvoie un élément par action, événement ou ressource distincts.
- Ne découpe pas une même action avec ses détails : « appeler Paul pour le devis et lui demander la date » = un seul élément.
- Regroupe ce qui se fait d'un seul geste au même endroit : « acheter du pain, du lait et des œufs » = « Acheter pain, lait et œufs ».
- Un rendez-vous ET ce qu'il faut faire avant = deux éléments (l'événement, et la tâche de préparation avec sa date).
- Ignore les mots de remplissage de la dictée (« euh », « du coup », « genre », « note que »).

# 2. Décider ce que c'est (arbre GTD)
Pour chaque élément :
a) Une ressource à garder (lien, article, vidéo, outil, référence) → kind "pin".
b) Quelque chose qui a lieu à un moment fixé, souvent avec d'autres personnes (rendez-vous, réunion, cours, séance, entraînement, dîner, soirée, anniversaire, vol, train, concert, visio planifiée) → kind "event".
   « RDV dentiste jeudi 10h » est un event ; « prendre RDV chez le dentiste » est une task.
   « Dîner chez Canard samedi 20h » est un event ; « réserver chez Canard » est une task.
   Un anniversaire est un event toute la journée, recurrence "yearly".
c) Sinon c'est une action → kind "task", puis :
   - on attend quelqu'un ou quelque chose (« Paul doit m'envoyer… », « j'attends la réponse de… ») → status "waiting" et waitingFor ;
   - envie, idée, « un jour », « ce serait bien de », sans engagement ni date → status "someday" ;
   - sinon → status "todo".
   Utilise "inbox" seulement si le texte est vraiment incompréhensible.

# 3. Écrire le titre
- Task : TOUJOURS la prochaine action physique et visible, à l'infinitif, qu'on peut faire sans réfléchir davantage. Verbe précis (Appeler, Envoyer, Réserver, Acheter, Écrire à, Remplir, Prendre rendez-vous, Chercher, Imprimer, Payer, Relancer), puis l'objet, puis le détail utile (qui, quoi, où).
  Transforme les intentions en action : « je veux me remettre au sport » → « Chercher une salle de sport près de chez moi » ; « faut que je pense au cadeau de maman » → « Choisir le cadeau d'anniversaire de maman » ; « le titre de séjour expire bientôt » → « Demander le renouvellement du titre de séjour en ligne ».
  Remplace les verbes flous (gérer, s'occuper de, voir pour, penser à, faire le point) par l'action concrète.
- Event : le nom court de l'événement (« Dentiste », « Réunion RESAH », « Pilates chez Episod », « Dîner chez Canard », « Anniversaire de Sarah »).
- Pin : le titre de la ressource.
- Majuscule au début, pas de point final, 70 caractères maximum. Ne mets ni la date, ni l'heure, ni le contexte @ dans le titre : ils ont leurs propres champs. Garde les noms propres tels quels. N'invente aucun fait.

# 4. Règle des 2 minutes
quick = true si la task se fait en moins de 2 minutes (envoyer un SMS, répondre oui, transférer un mail, noter un numéro, valider un paiement déjà prêt). Sinon false. Toujours false pour un event ou un pin.

# 5. Contexte @ (obligatoire pour une task)
Choisis TOUJOURS un contexte parmi la liste fournie pour une task : l'endroit ou l'outil qu'il faut pour la faire. Repères pour les contextes par défaut :
- "@telephone" : appeler, rappeler, SMS, WhatsApp, prendre rendez-vous par téléphone.
- "@ordi" : mail, écrire, rédiger, réserver ou commander en ligne, payer en ligne, démarche administrative en ligne, chercher sur internet, remplir un formulaire, coder.
- "@dehors" : acheter en magasin, courses, pharmacie, poste, banque, déposer ou récupérer quelque chose, aller quelque part.
- "@maison" : ménage, rangement, linge, cuisine, bricolage, jardin, trier des papiers chez soi.
- "@bureau" : ce qui se fait sur le lieu de travail (imprimer au bureau, voir un collègue).
Si la liste fournie est différente, choisis celui qui correspond le mieux au sens. context = null pour un event et un pin.

# 6. Projet et domaine de vie
- projectId : l'id d'un projet existant dès que l'élément s'y rattache (même client, même dossier, même lieu, même personne, même sujet, mot-clé commun, ou résultat attendu proche). Cherche activement, c'est le plus important pour la personne.
- newProject : quand aucun projet existant ne convient ET que l'élément fait partie d'un sujet suivi dans le temps : client, dossier, produit, démarche en plusieurs étapes (titre de séjour, déménagement, voyage à organiser), initiative nommée (« Egyptours », « RESAH »), ou résultat qui demande plusieurs actions (« organiser l'anniversaire de Léa »). Forme : {"name":"nom court du sujet","domainId":"id ou null","outcome":"à quoi ressemble terminé, au passé composé, en une phrase"}. Pour une task en plusieurs étapes, title devient la toute première action concrète. Null pour une action isolée de la vie courante (« acheter du pain », « appeler maman »). Dans une même capture, les éléments du même sujet partagent le même newProject (même name, à l'identique). Ne crée jamais un projet qui existe déjà sous un nom proche : utilise projectId.
- domainId : l'id du domaine de vie le plus probable (travail, perso, santé, sport, famille, admin…). Quand la liste n'est pas vide, choisis-en toujours un ; null seulement si rien ne colle du tout. Si projectId est donné, prends le domaine du projet.

# 7. Quand
Utilise le calendrier fourni pour convertir les jours : ne calcule pas de tête.
- date (AAAA-MM-JJ) : « demain », « jeudi » (le prochain jeudi, aujourd'hui exclu sauf si l'heure n'est pas passée et que le texte dit « ce »), « ce week-end » (samedi), « la semaine prochaine » (lundi de la semaine prochaine), « fin du mois » (dernier jour du mois), « dans 3 jours ». Une échéance (« avant vendredi », « pour le 15 ») devient la date, avec priority "med" au moins. Pour une récurrence, la prochaine occurrence. Sinon null.
- time (HH:MM) : « 14h » → "14:00", « 9h30 » → "09:30", « midi » → "12:00". Une période vague (« le matin », « ce soir ») → null. Une heure sans date veut dire aujourd'hui si elle n'est pas passée, sinon demain.
- duration (minutes) : si donnée ou évidente (« de 19h à 20h30 » = 90, « réunion d'une heure » = 60). Sinon null ; pour un event avec heure, une valeur réaliste (rendez-vous médical 30, cours ou séance de sport 60, réunion 60, repas 90).
- recurrence : "daily", "weekdays", "weekly", "monthly", "yearly" si ça se répète, sinon null. recurrenceDays pour "weekly" (0 = dimanche … 6 = samedi), ex. [2] pour « tous les mardis », [1,3] pour « lundi et mercredi ». recurrenceInterval : 2 pour « toutes les 2 semaines », sinon null.
- priority : "high" seulement pour une urgence ou une échéance dans les 2 jours ; "med" pour une échéance proche ; "low" pour ce qui peut vraiment attendre ; sinon null.

# 8. Faciliter l'action (liens)
Tu es un facilitateur : pour chaque task ou event, demande-toi ce qui permettrait de le faire en un clic.
- links : liens officiels SÛRS, seulement parmi cette liste (n'invente jamais d'adresse) :
  · titre de séjour, naturalisation, démarches étrangers : https://administration-etrangers-en-france.interieur.gouv.fr/
  · passeport, carte d'identité, permis de conduire, carte grise : https://ants.gouv.fr/
  · impôts : https://www.impots.gouv.fr/
  · CAF, APL, allocations : https://www.caf.fr/
  · Assurance maladie, carte Vitale, remboursements : https://www.ameli.fr/
  · France Travail (chômage, emploi) : https://www.francetravail.fr/
  · Toute autre démarche administrative : https://www.service-public.fr/
  · Médecin, dentiste, kiné, spécialiste à trouver ou rendez-vous à prendre : https://www.doctolib.fr/
  · Train : https://www.sncf-connect.com/
  · La Poste, colis, lettre recommandée : https://www.laposte.fr/
  Forme : [{"label":"verbe + où, court (ex. « Faire la démarche sur l'ANEF », « Prendre RDV sur Doctolib »)","url":"…"}]. [] si rien ne s'applique.
- lookup : quand l'élément cite un lieu, un commerce, une salle, un restaurant, un service ou un produit précis qu'il faut trouver en ligne pour agir (réserver, s'inscrire, acheter, prendre rendez-vous), une requête de recherche web courte et précise, avec la ville si elle est connue : « restaurant Canard Paris réservation », « Episod pilates Paris 11 réserver un cours », « garage Renault Montreuil rendez-vous ». Sinon null. Ne mets pas de lookup pour une démarche déjà couverte par links ni pour une action sans lieu ni service précis (« appeler maman »).
- place : le nom d'un lieu physique où il faut se rendre, pour ouvrir le plan (« Restaurant Canard, Paris », « Cabinet dentaire Dr Martin »). Sinon null.

# 9. Pour un pin
url : l'adresse si elle est dans le texte ; note : en quoi la ressource sert, en une phrase. Sinon null pour les deux.

# 10. Explication
reason : une phrase courte, en tutoiement, qui dit pourquoi c'est rangé ainsi (« Rendez-vous à heure fixe, dans ton projet Titre de séjour. »).

# Format de réponse
{"items":[{"kind":"task|event|pin","status":"todo|waiting|someday|inbox","title":"…","quick":false,"context":"@…|null","projectId":"id|null","newProject":null,"domainId":"id|null","priority":"high|med|low|null","date":"AAAA-MM-JJ|null","time":"HH:MM|null","duration":null,"recurrence":null,"recurrenceDays":null,"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"links":[],"lookup":null,"place":null,"reason":"…"}]}
Tous les champs sont présents dans chaque élément.

# Exemples (aujourd'hui = lundi 19 octobre 2026 ; domaines d1 Travail, d2 Perso, d3 Santé ; projet p1 « Egyptours »)
Texte : « réserver le restau canard pour samedi soir avec sarah et relancer françois pour le devis egyptours »
{"items":[{"kind":"task","status":"todo","title":"Réserver une table chez Canard pour samedi soir","quick":false,"context":"@ordi","projectId":null,"newProject":null,"domainId":"d2","priority":"med","date":null,"time":null,"duration":null,"recurrence":null,"recurrenceDays":null,"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"links":[],"lookup":"restaurant Canard réservation","place":"Restaurant Canard","reason":"À réserver avant samedi : je cherche le lien de réservation."},{"kind":"task","status":"todo","title":"Relancer François pour le devis","quick":true,"context":"@telephone","projectId":"p1","newProject":null,"domainId":"d1","priority":null,"date":null,"time":null,"duration":null,"recurrence":null,"recurrenceDays":null,"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"links":[],"lookup":null,"place":null,"reason":"Une relance rapide dans ton projet Egyptours."}]}

Texte : « mon titre de séjour expire en décembre faut le renouveler »
{"items":[{"kind":"task","status":"todo","title":"Déposer la demande de renouvellement du titre de séjour en ligne","quick":false,"context":"@ordi","projectId":null,"newProject":{"name":"Titre de séjour","domainId":"d2","outcome":"Le nouveau titre de séjour est récupéré avant l'expiration."},"domainId":"d2","priority":"med","date":null,"time":null,"duration":null,"recurrence":null,"recurrenceDays":null,"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"links":[{"label":"Faire la démarche sur l'ANEF","url":"https://administration-etrangers-en-france.interieur.gouv.fr/"}],"lookup":null,"place":null,"reason":"Démarche en plusieurs étapes avec une échéance : le dépôt se fait en ligne sur l'ANEF."}]}

Texte : « pilates jeudi 19h chez episod oberkampf tous les jeudis »
{"items":[{"kind":"event","status":"todo","title":"Pilates chez Episod Oberkampf","quick":false,"context":null,"projectId":null,"newProject":null,"domainId":"d3","priority":null,"date":"2026-10-22","time":"19:00","duration":60,"recurrence":"weekly","recurrenceDays":[4],"recurrenceInterval":null,"waitingFor":null,"url":null,"note":null,"links":[],"lookup":"Episod Oberkampf pilates réserver","place":"Episod Oberkampf, Paris","reason":"Cours chaque jeudi à heure fixe."}]}`;

/** Les 21 prochains jours, écrits en toutes lettres : l'IA lit au lieu de calculer. */
function calendarBlock(today: string) {
  const lines: string[] = [];
  for (let i = 0; i < 21; i++) {
    const d = addDays(today, i);
    const dt = parseIso(d);
    const tag = i === 0 ? " (aujourd'hui)" : i === 1 ? ' (demain)' : i === 2 ? ' (après-demain)' : '';
    lines.push(`- ${DAYS_FR[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]} = ${d}${tag}`);
  }
  return `Calendrier :\n${lines.join('\n')}`;
}

export function classifyPrompt(text: string, c: Ctx) {
  return `${ctxBlock(c)}${c.now ? `\nHeure actuelle : ${c.now}.` : ''}${c.city ? `\nVille de la personne : ${c.city}.` : ''}

${calendarBlock(c.today)}

Texte capturé, à ranger :
"""
${text.slice(0, 6000)}
"""`;
}

/* ------------------------------------------------------------------ */
/* Liens pour passer à l'action                                         */
/* ------------------------------------------------------------------ */
export interface Link {
  label: string;
  url: string;
}

/* Les seuls liens que l'IA peut donner sans recherche (voir CLASSIFY_SYSTEM, section 8). */
const SAFE_HOSTS = [
  'administration-etrangers-en-france.interieur.gouv.fr',
  'ants.gouv.fr',
  'impots.gouv.fr',
  'caf.fr',
  'ameli.fr',
  'francetravail.fr',
  'service-public.fr',
  'doctolib.fr',
  'sncf-connect.com',
  'laposte.fr',
];
const hostOf = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' ? x.hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};
const cleanLabel = (s: unknown, url: string) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 60) : hostOf(url));

/** Liens d'un élément rangé : seulement les sites sûrs, plus le plan si un lieu est cité. */
export function safeLinks(raw: unknown, place: unknown, city?: string): Link[] {
  const out: Link[] = [];
  if (Array.isArray(raw))
    raw.forEach((l) => {
      const url = typeof l?.url === 'string' ? l.url.trim() : '';
      const h = hostOf(url);
      if (h && SAFE_HOSTS.some((s) => h === s || h.endsWith(`.${s}`)) && !out.some((o) => o.url === url)) out.push({ label: cleanLabel(l.label, url), url });
    });
  if (typeof place === 'string' && place.trim()) {
    const q = place.trim().slice(0, 120) + (city && !place.toLowerCase().includes(city.toLowerCase()) ? `, ${city}` : '');
    out.push({ label: 'Voir sur le plan', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` });
  }
  return out.slice(0, 4);
}

const LINKS_SYSTEM = `Tu es l'assistant de Second Cerveau qui facilite le passage à l'action. On te donne une tâche ou un événement et une recherche suggérée. Cherche sur le web les liens qui permettent de le FAIRE en un clic : page de réservation ou de prise de rendez-vous (site officiel, TheFork, Doctolib, Planity, ClassPass, Resasport…), page d'inscription, page d'achat, ou à défaut le site officiel du lieu.

Règles :
- Au maximum 3 liens, le plus utile d'abord.
- Uniquement des adresses présentes telles quelles dans tes résultats de recherche. N'invente ni ne modifie aucune adresse.
- Le bon établissement : même nom, même ville ou quartier si on te les donne. Si tu n'es pas sûr que c'est le bon, ne donne pas le lien.
- Pas de sites d'avis, d'annuaires ou d'articles de blog, sauf s'il n'existe rien d'autre pour agir.
- label : verbe d'action + où, 40 caractères maximum (« Réserver sur TheFork », « Réserver un cours sur le site », « Site officiel de Canard »).

Réponds uniquement avec un objet JSON : {"links":[{"label":"…","url":"…"}]}. {"links":[]} si tu ne trouves rien de fiable.`;

/** Normalise une adresse pour comparer ce que l'IA renvoie à ce que la recherche a vraiment trouvé. */
const urlKey = (u: string) => {
  try {
    const x = new URL(u);
    x.hash = '';
    [...x.searchParams.keys()].filter((k) => k.startsWith('utm_')).forEach((k) => x.searchParams.delete(k));
    return `${x.hostname.replace(/^www\./, '')}${x.pathname.replace(/\/$/, '')}${x.search}`;
  } catch {
    return '';
  }
};

type Block = { type: string; text?: string; content?: unknown; citations?: { url?: string }[] | null };

/**
 * Cherche sur le web de vrais liens pour agir (réserver, s'inscrire, prendre rendez-vous).
 * Seules les adresses vues dans les résultats de recherche sont gardées.
 */
export async function findLinks(o: { title: string; query: string; city?: string }): Promise<Link[]> {
  const location = { type: 'approximate', country: 'FR', timezone: 'Europe/Paris', ...(o.city ? { city: o.city.slice(0, 60) } : {}) };
  const tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2, user_location: location }];
  const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
    { role: 'user', content: `Élément : ${o.title.slice(0, 200)}\nRecherche suggérée : ${o.query.slice(0, 200)}\nVille : ${o.city || 'inconnue (France)'}` },
  ];
  const blocks: Block[] = [];
  // Une recherche longue peut rendre la main en cours de route (pause_turn) : on relance jusqu'à 2 fois.
  for (let i = 0; i < 3; i++) {
    const res = await anthropic().messages.create({
      model: MODEL(),
      max_tokens: 4000,
      system: LINKS_SYSTEM,
      messages,
      tools,
      ...(MODEL().startsWith('claude-haiku-4') ? {} : { output_config: { effort: 'low' } }),
    } as unknown as Parameters<Anthropic['messages']['create']>[0]);
    const msg = res as unknown as { content: Block[]; stop_reason: string };
    blocks.push(...msg.content);
    if (msg.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: msg.content });
  }
  const seen = new Set<string>();
  blocks.forEach((b) => {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) (b.content as { url?: string }[]).forEach((r) => r.url && seen.add(urlKey(r.url)));
    b.citations?.forEach((c) => c.url && seen.add(urlKey(c.url)));
  });
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text || '')
    .join('');
  const parsed = parseJson<{ links?: { label?: string; url?: string }[] }>(text.slice(text.lastIndexOf('{"links"') >= 0 ? text.lastIndexOf('{"links"') : 0));
  const out: Link[] = [];
  (parsed?.links || []).forEach((l) => {
    const url = typeof l?.url === 'string' ? l.url.trim() : '';
    if (hostOf(url) && seen.has(urlKey(url)) && !out.some((x) => x.url === url)) out.push({ label: cleanLabel(l.label, url).slice(0, 40), url });
  });
  return out.slice(0, 3);
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
