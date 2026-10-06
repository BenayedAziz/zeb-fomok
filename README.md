# Second Cerveau

Tu notes n'importe quoi, l'IA le range. Tes projets, ta journée, ta semaine et ton mois au même endroit, selon la méthode Getting Things Done (GTD).

## Ce que fait l'appli

- **Capture rangée par l'IA** : une barre de capture (touche `C` ou `⌘K`, bouton + sur téléphone). L'IA choisit le projet, le statut, le contexte, la priorité, la date, l'heure, et détecte les récurrences (« tous les mardis 19h »). Un badge **IA** reste sur ce qu'elle a rangé jusqu'à ce que tu valides.
- **Ma journée** en accueil, avec bascule **Semaine / Mois**. Les cartes se glissent dans le calendrier, ou se planifient avec le bouton calendrier (Aujourd'hui, Demain, Lundi prochain…).
- **Listes GTD** : Inbox, Prochaines actions par contexte (@ordi, @téléphone…), En attente, Un jour / peut-être, Journal.
- **Domaines de vie > projets > cartes** : chaque page projet a ses infos (résultat attendu, échéance, objectif relié), son calendrier, ses notes et ses liens.
- **Objectifs** (vision 5 ans, année, comportemental), affichés comme boussole en haut de la journée.
- **Revue hebdo guidée** en 8 étapes, avec la vérification de ce que l'IA a rangé.
- **Accueil des nouveaux comptes** : un entretien avec l'IA sur les objectifs et les projets, un récap à valider, puis l'import depuis les outils.
- **Import depuis les outils** : Notion, Gmail + Google Agenda, Outlook, un calendrier par lien (.ics) ou du texte collé. L'IA propose, on coche ce qu'on garde. Aucun accès n'est enregistré.
- **Comptes par email** (lien magique), données privées par personne, limite d'utilisation de l'IA par jour.
- Installable sur téléphone (« Ajouter à l'écran d'accueil »).

## Technique

Next.js 15 (App Router, TypeScript), Supabase (comptes + Postgres avec Row Level Security), API Anthropic côté serveur, hébergement Vercel.

```
app/            pages et routes API (classify, interview, import, connect, login)
components/     interface (App, vues, tiroir d'édition, accueil, import)
lib/            types, dates, règles GTD, store de données, accès Supabase, IA et connecteurs (lib/server)
supabase/       schéma SQL
docs/SETUP.md   mise en ligne pas à pas
docs/ROADMAP.md suite du projet
```

## Lancer en local

```bash
npm install
cp .env.example .env.local   # facultatif : sans variables, l'appli tourne en mode démo
npm run dev
```

Puis http://localhost:3000. En **mode démo** (aucune variable Supabase), les données restent dans le navigateur et il n'y a pas de comptes ; avec `ANTHROPIC_API_KEY` renseignée, l'IA marche aussi en local.

## Mettre en ligne

Tout est dans [docs/SETUP.md](docs/SETUP.md) : Supabase, Vercel, Anthropic, puis les connexions Notion, Google et Microsoft.
