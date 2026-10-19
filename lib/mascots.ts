/* Personnages nuages (docs/CHARTE.md, section 4).
   Le personnage est choisi d'après les mots du titre, sinon d'après le type du domaine de vie. */

export type MascotType = 'travail' | 'sport' | 'maison' | 'voyage' | 'sante' | 'creatif';

interface Mascot {
  id: string;
  name: string;
  type: MascotType;
  words: string[];
}

const M = (id: string, name: string, type: MascotType, words: string): Mascot => ({ id, name, type, words: words.split(',').map((w) => w.trim()) });

const MASCOTS: Mascot[] = [
  M('dentiste', 'Le Dentiste', 'sante', 'dentiste, dentaire, dent'),
  M('medecin', 'Le Docteur', 'sante', 'medecin, docteur, consultation, bilan de sante'),
  M('pharmacie', 'Le Pharmacien', 'sante', 'pharmacie, medicament, ordonnance'),
  M('train', 'Le Voyageur en train', 'voyage', 'train, sncf, tgv, gare'),
  M('avion', 'Le Pilote', 'voyage', 'avion, vol, aeroport'),
  M('plage', 'Le Vacancier', 'voyage', 'plage, mer, baignade'),
  M('camping', 'Le Campeur', 'voyage', 'camping, tente, bivouac'),
  M('carte', "L'Explorateur", 'voyage', 'itineraire, visite, tourisme, musee'),
  M('course', 'Le Coureur', 'sport', 'courir, running, jogging, course a pied, marathon'),
  M('velo', 'Le Cycliste', 'sport', 'velo, cyclisme, pedaler'),
  M('natation', 'Le Nageur', 'sport', 'nager, natation, piscine'),
  M('foot', 'Le Footballeur', 'sport', 'foot, football'),
  M('tennis', 'Le Tennisman', 'sport', 'tennis, raquette'),
  M('rando', 'Le Randonneur', 'sport', 'rando, randonnee, trek'),
  M('menage', 'Le Nettoyeur', 'maison', 'menage, aspirateur, nettoyer, vaisselle'),
  M('cuisine', 'Le Chef', 'maison', 'cuisiner, cuisine, recette, gateau, preparer le diner'),
  M('lessive', 'Le Roi du linge', 'maison', 'lessive, linge, repasser'),
  M('bricolage', 'Le Bricoleur', 'maison', 'bricolage, reparer, plombier, etagere, travaux'),
  M('jardin', 'Le Jardinier', 'maison', 'jardin, arroser, plante, plantes, potager'),
  M('sommeil', 'Le Dormeur', 'maison', 'dormir, sommeil, sieste, coucher'),
  M('eau', 'Le Nuage frais', 'sante', 'boire, hydratation, eau'),
  M('repas', 'Le Gourmet', 'sante', 'dejeuner, repas, salade, nutrition, restaurant'),
  M('musique', 'Le Musicien', 'creatif', 'musique, guitare, piano, chanter'),
  M('photo', 'Le Photographe', 'creatif', 'photo, photographie, shooting'),
  M('ecriture', "L'Écrivain", 'creatif', 'ecrire, rediger, roman, article, newsletter'),
  M('video', 'Le Réalisateur', 'creatif', 'video, filmer, tournage, montage'),
  M('idee', "L'Inventeur", 'creatif', 'idee, brainstorming, imaginer'),
  M('courses', 'Le Marchand', 'maison', 'courses, acheter, supermarche'),
  M('cadeau', 'Le Généreux', 'maison', 'cadeau, offrir'),
  M('colis', 'Le Livreur', 'maison', 'colis, livraison, paquet'),
  M('lecture', 'Le Lecteur', 'travail', 'lire, lecture, livre, relire'),
  M('examen', 'Le Diplômé', 'travail', 'examen, revision, reviser, diplome, partiel'),
  M('code', 'Le Développeur', 'travail', 'coder, code, bug, developper, programmation'),
  M('anniversaire', 'Le Fêtard', 'maison', 'anniversaire, bougie'),
  M('chien', 'Le Compagnon', 'maison', 'chien, promener, veterinaire'),
  M('enfants', 'Le Nounou', 'maison', 'enfant, enfants, bebe, creche'),
  M('soiree', 'Le Sociable', 'maison', 'soiree, apero, fete'),
  M('facture', 'Le Comptable', 'travail', 'facture, payer, impot, impots, loyer'),
  M('epargne', "L'Économe", 'travail', 'epargne, economiser, budget, banque'),
  M('papiers', "L'Archiviste", 'travail', 'papier, papiers, administratif, assurance, contrat'),
  M('reunion', 'Le Coéquipier', 'travail', 'reunion, point equipe, visio'),
  M('presentation', "L'Orateur", 'travail', 'presentation, demo, pitch, slides'),
  M('deadline', 'Le Chrono', 'travail', 'deadline, urgent, echeance'),
  M('checklist', "L'Organisé", 'travail', 'checklist, planifier, organiser, liste'),
  M('mail', 'Le Messager', 'travail', 'mail, email, courriel, repondre'),
  M('appel', 'Le Bavard', 'travail', 'appeler, rappeler, telephone, appel'),
  M('mascot-travail', 'Le Cadre', 'travail', 'travail, bureau, client'),
  M('mascot-sport', 'Le Costaud', 'sport', 'sport, musculation, salle, jambes, halteres'),
  M('mascot-maison', 'Le Cocon', 'maison', 'maison, cocon'),
  M('mascot-voyage', 'Le Baroudeur', 'voyage', 'voyage, valise, vacances, hotel'),
  M('mascot-sante', 'Le Zen', 'sante', 'yoga, mediter, meditation, respirer, sante'),
  M('mascot-creatif', "L'Artiste", 'creatif', 'dessin, croquis, peindre, creatif, peinture'),
];

const TYPE_DEFAULT: Record<MascotType, string> = {
  travail: 'mascot-travail',
  sport: 'mascot-sport',
  maison: 'mascot-maison',
  voyage: 'mascot-voyage',
  sante: 'mascot-sante',
  creatif: 'mascot-creatif',
};

/* Le nom d'un domaine de vie (« Freelance », « Famille »…) donne son type de personnage. */
const DOMAIN_TYPES: [MascotType, string[]][] = [
  ['travail', ['travail', 'job', 'boulot', 'bureau', 'freelance', 'business', 'entreprise', 'client', 'pro', 'etudes', 'ecole', 'apprendre', 'formation', 'argent', 'finance', 'admin']],
  ['sport', ['sport', 'fitness', 'muscu', 'course', 'velo', 'foot', 'mma', 'boxe']],
  ['sante', ['sante', 'bien-etre', 'bien etre', 'medit', 'yoga', 'forme']],
  ['voyage', ['voyage', 'vacances', 'trip']],
  ['creatif', ['creatif', 'musique', 'art', 'photo', 'video', 'ecriture', 'design', 'dessin']],
  ['maison', ['maison', 'famille', 'perso', 'personnel', 'couple', 'amis', 'foyer', 'enfants']],
];

export const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

export function domainType(name: string | null | undefined): MascotType | null {
  if (!name) return null;
  const n = norm(name);
  for (const [t, words] of DOMAIN_TYPES) if (words.some((w) => n.includes(` ${w}`))) return t;
  return null;
}

/**
 * Personnage pour un titre : le mot-clé le plus précis gagne (« course à pied » avant « course »),
 * sinon le personnage du type du domaine, sinon aucun.
 */
/* Les actions génériques passent après les sujets précis : le dentiste avant « appeler », le cadeau avant « acheter ». */
const GENERIC = new Set(['appel', 'mail', 'courses', 'checklist', 'lecture', ...Object.values(TYPE_DEFAULT)]);

export function mascotFor(title: string, domainName?: string | null): { src: string; name: string } | null {
  const t = norm(title);
  const type = domainType(domainName);
  let best: Mascot | null = null;
  let score = -1;
  MASCOTS.forEach((m) => {
    const hits = m.words.filter((w) => t.includes(` ${w} `));
    if (!hits.length) return;
    const sc = (GENERIC.has(m.id) ? 0 : 100) + Math.max(...hits.map((w) => w.length)) + (m.type === type ? 2 : 0);
    if (sc > score) {
      best = m;
      score = sc;
    }
  });
  const pick: Mascot | null = best || (type ? MASCOTS.find((m) => m.id === TYPE_DEFAULT[type]) || null : null);
  return pick ? { src: `/mascots/${pick.id}.webp`, name: pick.name } : null;
}

/** Le personnage générique d'un domaine (pour la pastille du projet). */
export function typeMascot(domainName?: string | null): string | null {
  const type = domainType(domainName);
  return type ? `/mascots/${TYPE_DEFAULT[type]}.webp` : null;
}
