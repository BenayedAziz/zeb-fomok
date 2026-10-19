# Charte graphique — Second Cerveau

> Vide ta tête. Sens-toi léger.

Document de référence complet. Donne ce fichier à un assistant IA (Claude, Claude Code…) pour générer des écrans, des composants ou du code fidèles à la charte.

## 1. Identité

- **Nom** : Second Cerveau
- **Baseline** : Vide ta tête. Sens-toi léger.
- **Direction artistique** : « 7e ciel » — légèreté, nuages, calme. Fond bleu très clair quadrillé de points (style Miro), cartes blanches arrondies, ombres douces teintées de bleu. Jamais de violet, de néon ni de glassmorphism lourd.
- **Ton** : français, tutoiement, phrases courtes.
- **Typographie unique** : **Lexend** (Google Fonts), graisses 300 (titres), 400 (texte), 600 (boutons/section). Espacement des titres : `letter-spacing: -0.02em`.
  - Titre d'écran : 36px / 300 · Titre de section : 20px / 600 · Texte : 15px / 400 · Petit texte : 12.5px.

## 2. Logo

Nuage plein tout rond (aucun bord plat), dégradé ciel du haut vers le bas, petit reflet en haut à gauche, visage kawaii (2 yeux points, sourire, joues roses) et, en haut à droite, un **croissant de lune avec une étoile à 4 branches centrée dans son creux**.

SVG autonome (couleurs hex, aucune dépendance) — à copier tel quel :

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 32 32" role="img" aria-label="Second Cerveau">
  <defs>
    <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C9E5FF"/>
      <stop offset="1" stop-color="#4FA6EC"/>
    </linearGradient>
    <radialGradient id="sky-h" cx=".35" cy=".25" r=".5">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".7"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <mask id="moon">
      <rect width="32" height="32" fill="white"/>
      <circle cx="26.2" cy="4.2" r="3.2" fill="black"/>
    </mask>
  </defs>
  <path d="M8.6 26.5 A5.4 5.4 0 0 1 6.4 16.4 A7.6 7.6 0 0 1 20.6 12.6 A6 6 0 0 1 27.4 19.6 A3.9 3.9 0 0 1 25.4 26.5 Z" fill="url(#sky-g)"/>
  <path d="M8.6 26.5 A5.4 5.4 0 0 1 6.4 16.4 A7.6 7.6 0 0 1 20.6 12.6 A6 6 0 0 1 27.4 19.6 A3.9 3.9 0 0 1 25.4 26.5 Z" fill="url(#sky-h)"/>
  <circle cx="13.4" cy="20" r=".95" fill="#142133"/>
  <circle cx="19" cy="20" r=".95" fill="#142133"/>
  <path d="M14.9 22.1 q1.3 1.2 2.6 0" fill="none" stroke="#142133" stroke-width=".8" stroke-linecap="round"/>
  <ellipse cx="11.4" cy="22" rx="1.2" ry=".7" fill="#CF5068" opacity=".7"/>
  <ellipse cx="21" cy="22" rx="1.2" ry=".7" fill="#CF5068" opacity=".7"/>
  <circle cx="24" cy="6" r="3.8" fill="#2A7AC4" mask="url(#moon)"/>
  <path d="M26.4 2.55 L26.85 3.55 L27.85 4 L26.85 4.45 L26.4 5.45 L25.95 4.45 L24.95 4 L25.95 3.55 Z" fill="#2A7AC4"/>
</svg>
```

Règles d'usage :
- Versions mono : visage conservé, joues retirées. Fond clair → nuage encre (`#142133`) ; fond sombre (`#2A7AC4`) → nuage blanc.
- Taille mini : 16 px (icône). Icône d'app : nuage centré sur fond `#E4F2FF`, coins arrondis.
- Nuage décoratif (DecoCloud) : une seule forme pleine opaque, arrondie en haut, pas de cercles visibles qui se chevauchent.

## 3. Couleurs

### Palette principale (mode clair)

| Nom | Variable | Hex | Usage |
|---|---|---|---|
| Ciel | `--sky-50` | #F4FAFF | Fond principal |
| Ciel moyen | `--sky-100` | #E4F2FF | Surfaces, pastilles |
| Brume | `--sky-200` | #C9E5FF | Bordures, survol |
| Bleu ciel | `--sky-300` | #9DD1FF | Couleur principale (boutons) |
| Azur | `--sky-500` | #4FA6EC | Accents, icônes |
| Ciel profond | `--sky-700` | #2A7AC4 | Liens, focus, texte sur fond sombre |
| Nuage | `--cloud` | #FFFFFF | Cartes |
| Encre | `--ink` | #142133 | Texte |
| Encre douce | `--ink-soft` | #5C6B7D | Texte secondaire |
| Fait | `--success` | #2F9E6E | Succès |
| Attention | `--warning` | #D9922B | Échéances |
| Erreur | `--danger` | #D9534A | Danger |

### Couleurs par projet — OBLIGATOIRE : chaque type de projet a sa couleur ET son personnage nuage

| Projet | Ton | Couleur | Fond doux |
|---|---|---|---|
| Travail | sky | `--proj-sky` | `--proj-sky-soft` |
| Sport | mint | `--proj-mint` | `--proj-mint-soft` |
| Maison | peach | `--proj-peach` | `--proj-peach-soft` |
| Voyage | sun | `--proj-sun` | `--proj-sun-soft` |
| Santé | lagoon | `--proj-lagoon` | `--proj-lagoon-soft` |
| Créatif | rose | `--proj-rose` | `--proj-rose-soft` |

Contrastes : texte toujours Encre sur bleu ciel (11:1). Ciel profond sur blanc passe AA (4,6:1).

### Mode sombre (« ciel de nuit »)

Activé via `data-theme="dark"` sur `<html>`. Base #0D1626, cartes #15223A, bleu ciel #8FCBFF, texte #EAF3FF, ombres noires plus profondes. Toutes les variables sombres sont dans le bloc CSS de la section 6.

## 4. Personnages nuages (mascottes)

Chaque type de projet a son nuage-personnage (style 3D clay doux, fond transparent) :
Travail = costume/lunettes · Sport = musclé, sourire de bg · Maison = bonnet/mug · Voyage = chapeau de paille + valise · Santé = zen, feuille · Créatif = béret/pinceau.

**52 contextes** : le personnage est choisi automatiquement d'après les mots du titre de la tâche ou de l'événement (ex. « Appeler le dentiste » → nuage dentiste, « Courir 5 km » → nuage coureur). Correspondance : normalisation sans accents/minuscules, score par spécificité des mots, sinon personnage générique du projet.

| Id | Nom | Projet | Mots-clés (normalisés) | Exemple |
|---|---|---|---|---|
| dentiste | Le Dentiste | Santé | dentiste, dentaire, dent | Appeler le dentiste |
| medecin | Le Docteur | Santé | medecin, docteur, consultation, bilan de sante | Prendre rendez-vous chez le médecin |
| pharmacie | Le Pharmacien | Santé | pharmacie, medicament, ordonnance | Passer à la pharmacie |
| train | Le Voyageur en train | Voyage | train, sncf, tgv, gare | Réserver le train pour Lyon |
| avion | Le Pilote | Voyage | avion, vol, aeroport | Réserver un vol pour Rome |
| plage | Le Vacancier | Voyage | plage, mer, baignade | Préparer la journée plage |
| camping | Le Campeur | Voyage | camping, tente, bivouac | Installer la tente au camping |
| carte | L’Explorateur | Voyage | itineraire, visite, tourisme, musee | Préparer notre itinéraire |
| course | Le Coureur | Sport | courir, running, jogging, course a pied, marathon | Courir 5 km |
| velo | Le Cycliste | Sport | velo, cyclisme, pedaler | Sortie vélo dimanche |
| natation | Le Nageur | Sport | nager, natation, piscine | Nager à la piscine |
| foot | Le Footballeur | Sport | foot, football | Match de foot avec les amis |
| tennis | Le Tennisman | Sport | tennis, raquette | Réserver le court de tennis |
| rando | Le Randonneur | Sport | rando, randonnee, trek | Randonnée en montagne |
| menage | Le Nettoyeur | Maison | menage, aspirateur, nettoyer, vaisselle | Passer l’aspirateur |
| cuisine | Le Chef | Maison | cuisiner, cuisine, recette, gateau, preparer le diner | Cuisiner une nouvelle recette |
| lessive | Le Roi du linge | Maison | lessive, linge, repasser | Lancer une lessive |
| bricolage | Le Bricoleur | Maison | bricolage, reparer, plombier, etagere, travaux | Appeler le plombier |
| jardin | Le Jardinier | Maison | jardin, arroser, plante, potager | Arroser les plantes |
| sommeil | Le Dormeur | Maison | dormir, sommeil, sieste, coucher | Faire une sieste |
| eau | Le Nuage frais | Santé | boire, hydratation, eau | Boire un verre d’eau |
| repas | Le Gourmet | Santé | dejeuner, repas, salade, nutrition, restaurant | Déjeuner avec Sam |
| musique | Le Musicien | Créatif | musique, guitare, piano, chanter | Répéter à la guitare |
| photo | Le Photographe | Créatif | photo, photographie, shooting | Organiser un shooting photo |
| ecriture | L’Écrivain | Créatif | ecrire, rediger, roman, article, newsletter | Rédiger la newsletter |
| video | Le Réalisateur | Créatif | video, filmer, tournage, montage | Monter la vidéo |
| idee | L’Inventeur | Créatif | idee, brainstorming, imaginer | Noter une idée |
| courses | Le Marchand | Maison | courses, acheter, supermarche | Faire les courses |
| cadeau | Le Généreux | Maison | cadeau, offrir | Acheter un cadeau pour Léa |
| colis | Le Livreur | Maison | colis, livraison, paquet | Récupérer le colis |
| lecture | Le Lecteur | Travail | lire, lecture, livre, relire | Lire un chapitre |
| examen | Le Diplômé | Travail | examen, revision, reviser, diplome, partiel | Réviser pour l’examen |
| code | Le Développeur | Travail | coder, code, bug, developper, programmation | Corriger un bug |
| anniversaire | Le Fêtard | Maison | anniversaire, bougie | Fêter l’anniversaire de Sam |
| chien | Le Compagnon | Maison | chien, promener, veterinaire | Promener le chien |
| enfants | Le Nounou | Maison | enfant, enfants, bebe, creche | Récupérer les enfants à l’école |
| soiree | Le Sociable | Maison | soiree, apero, fete | Organiser une soirée |
| facture | Le Comptable | Travail | facture, payer, impot, loyer | Payer la facture |
| epargne | L’Économe | Travail | epargne, economiser, budget, banque | Faire le point sur mon budget |
| papiers | L’Archiviste | Travail | papier, papiers, administratif, assurance, contrat | Ranger les papiers administratifs |
| reunion | Le Coéquipier | Travail | reunion, point equipe, visio | Point équipe à 9h30 |
| presentation | L’Orateur | Travail | presentation, demo, pitch, slides | Préparer la démo client |
| deadline | Le Chrono | Travail | deadline, urgent, echeance | Dossier urgent à terminer |
| checklist | L’Organisé | Travail | checklist, planifier, organiser, liste | Planifier la semaine |
| mail | Le Messager | Travail | mail, email, courriel, repondre | Répondre à Léa |
| appel | Le Bavard | Travail | appeler, rappeler, telephone, appel | Appeler maman |
| travail | Le Cadre | Travail | travail, bureau, client | Aller au bureau |
| sport | Le Costaud | Sport | sport, musculation, salle, jambes, halteres | Séance jambes à la salle |
| maison | Le Cocon | Maison | maison, cocon | Une pause à la maison |
| voyage | Le Baroudeur | Voyage | voyage, valise, vacances, hotel | Préparer la valise |
| sante | Le Zen | Santé | yoga, mediter, meditation, respirer, sante | Méditer 10 min |
| creatif | L’Artiste | Créatif | dessin, croquis, peindre, creatif, peinture | Finir le croquis du poster |

## 5. Composants

- **Boutons** : hauteur 42px, rayon 14px, graisse 600. `btn-primary` bleu ciel `--sky-300` + ombre douce ; `btn-secondary` blanc bordure `--sky-200` ; `btn-ghost` transparent ; `btn-danger` fond `--danger-soft`. Survol : fond mélangé vers `--sky-500`, ombre montée ; actif : scale 0.97 ; focus : anneau `--focus-ring`.
- **Cartes** (`cloud-card`) : fond blanc, bordure dégradé 160° (blanc → brume → ligne), rayon 20px, ombre `--shadow-md`, survol : translateY(-4px) + légère rotation −0,4°.
- **Barre de capture** : champ pilule avec halo conique rotatif (10s) autour, icône ronde bleu ciel.
- **Carte tâche** : pastille projet (couleur du projet + personnage), coche animée (rebond + trait dessiné), état fait : fond rayé `done-stripes` + texte barré animé, personnage masqué.
- **Carte événement** : dégradé ciel, bande verticale à gauche, nuage décoratif ou personnage en bas à droite.
- **Pill** : 22px de haut, rayon pill, fond `--sky-100`, texte `--sky-700`.
- **Toast** : remontée animée, bouton Annuler.
- **Rayons** : contrôle 14px · carte 18px · panneau 28px · pill 999px.
- **Ombres** : teintées de bleu — `0 2px 8px rgba(42,122,196,.08)` / `0 8px 30px rgba(42,122,196,.10)` / `0 20px 60px rgba(42,122,196,.16)`. Focus : `0 0 0 3px rgba(42,122,196,.30)`.

## 6. Design tokens (CSS pur, prêt à coller dans un projet)

```css
/* Second Cerveau — design tokens (CSS pur) */
:root {
  /* Ciel */
  --sky-50: #F4FAFF;      /* fond principal */
  --sky-100: #E4F2FF;     /* surfaces secondaires, pastilles */
  --sky-200: #C9E5FF;     /* bordures douces, survol */
  --sky-300: #9DD1FF;     /* couleur principale (boutons) */
  --sky-500: #4FA6EC;     /* accents, icônes */
  --sky-700: #2A7AC4;     /* texte sur fond clair, liens, focus */
  --cloud: #FFFFFF;       /* cartes */
  --ink: #142133;         /* texte */
  --ink-soft: #5C6B7D;    /* texte secondaire */
  --line: #E1ECF7;        /* séparateurs */
  --success: #2F9E6E;
  --success-soft: #E2F5EC;
  --warning: #D9922B;
  --warning-soft: #FCF1DE;
  --danger: #D9534A;
  --danger-soft: #FCE7E5;
  --done-bg: #EEF1F5;
  --done-stripe: #DCE2EA;

  /* Couleurs par projet (texte / fond pastille) */
  --proj-sky: #3B86D0;    --proj-sky-soft: #E6F2FF;
  --proj-mint: #2E9475;   --proj-mint-soft: #E1F5EE;
  --proj-peach: #D2723A;  --proj-peach-soft: #FDEEE3;
  --proj-rose: #CF5068;   --proj-rose-soft: #FCE8EC;
  --proj-sun: #B08A1E;    --proj-sun-soft: #FBF3D6;
  --proj-lagoon: #2A8FA0; --proj-lagoon-soft: #E0F3F5;

  --bg-gradient: linear-gradient(180deg, #F4FAFF 0%, #FFFFFF 70%);

  /* Arrondis */
  --radius-control: 14px;
  --radius-card: 18px;
  --radius-panel: 28px;
  --radius-pill: 999px;

  /* Ombres teintées de bleu */
  --shadow-sm: 0 2px 8px rgba(42, 122, 196, 0.08);
  --shadow-md: 0 8px 30px rgba(42, 122, 196, 0.10);
  --shadow-lg: 0 20px 60px rgba(42, 122, 196, 0.16);
  --focus-ring: 0 0 0 3px rgba(42, 122, 196, 0.30);

  /* Typographie — Lexend 300 / 400 / 600 */
  --font: "Lexend", ui-rounded, sans-serif;
  --text-display: 36px;   /* titre d'écran, 300 */
  --text-section: 20px;   /* titre de section, 600 */
  --text-body: 15px;      /* 400 */
  --text-small: 12.5px;
  --tracking-title: -0.02em;
}

[data-theme="dark"] {
  --sky-50: #0D1626;
  --sky-100: #1B2A45;
  --sky-200: #263A5C;
  --sky-300: #8FCBFF;
  --sky-500: #6DB9FF;
  --sky-700: #A5D6FF;
  --cloud: #15223A;
  --ink: #EAF3FF;
  --ink-soft: #93A4BC;
  --line: #22324F;
  --success: #4CC892;
  --success-soft: #173A33;
  --warning: #F0B457;
  --warning-soft: #3A2F1F;
  --danger: #F2776D;
  --danger-soft: #3D2229;
  --done-bg: #1A263C;
  --done-stripe: #223150;
  --proj-sky: #9CCBFF;    --proj-sky-soft: #1E3354;
  --proj-mint: #7FD8B8;   --proj-mint-soft: #173A33;
  --proj-peach: #F5B48A;  --proj-peach-soft: #3A2A22;
  --proj-rose: #F39AAB;   --proj-rose-soft: #3A2230;
  --proj-sun: #F0D27A;    --proj-sun-soft: #3A3320;
  --proj-lagoon: #86D3DE; --proj-lagoon-soft: #183640;
  --bg-gradient: linear-gradient(180deg, #0D1626 0%, #111C30 70%);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 8px 30px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 20px 60px rgba(0, 0, 0, 0.45);
  --focus-ring: 0 0 0 3px rgba(143, 203, 255, 0.35);
}

```

## 7. Consignes pour un assistant IA

1. Utilise uniquement les variables CSS ci-dessus — jamais de couleur codée en dur.
2. Police : uniquement Lexend 300/400/600 (charger depuis Google Fonts).
3. Chaque projet porte sa couleur ET son personnage nuage ; ne jamais mélanger.
4. Fond de page : quadrillage de points bleus (`radial-gradient` 24px) sur dégradé `--bg-gradient`.
5. Textes en français, tutoiement, courts.
6. Coins toujours très arrondis ; ombres douces bleutées ; pas de violet, pas de néon.
