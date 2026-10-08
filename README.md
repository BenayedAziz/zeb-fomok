# Second Cerveau

Tu notes n'importe quoi, l'IA le range. Tes projets, ta journée, ta semaine et ton mois au même endroit, selon la méthode Getting Things Done (GTD).

## Ce que fait l'appli

- **Capture rangée par l'IA** : une barre de capture (touche `C` ou `⌘K`, bouton + sur téléphone, ou au micro). Plusieurs choses dans une seule phrase, pour plusieurs projets : l'IA crée un élément par chose. Elle distingue **tâches**, **événements** et **liens à épingler**, choisit le projet, la date, l'heure, la durée, et les répétitions (« tous les mardis », « chaque année »). Un badge **IA** reste sur ce qu'elle a rangé jusqu'à ce que tu valides.
- **Ma journée** en accueil, avec bascule **Semaine / Mois** (touches `J`, `S`, `M`). Agenda à l'heure : on glisse une carte dessus, on étire un bloc pour changer sa durée, on le déplace, on clique un créneau vide pour y ajouter quelque chose. Une couleur par projet, légende cliquable pour filtrer.
- **Épinglés** : articles, vidéos et outils gardés par projet.
- **Réglages** : mode Simple ou GTD complet, contextes à toi, heures de l'agenda, rythme de la revue.
- **Listes GTD** : Inbox, Prochaines actions par contexte (@ordi, @téléphone…), En attente, Un jour / peut-être, Journal.
- **Domaines de vie > projets > cartes** : chaque page projet a ses infos (résultat attendu, échéance, objectif relié), son calendrier, ses notes et ses liens.
- **Objectifs** (vision 5 ans, année, comportemental), affichés comme boussole en haut de la journée.
- **Revue guidée** au rythme choisi (chaque jour, tous les 3 jours, chaque semaine, chaque mois) : courte ou complète, passage de chaque projet, bilan du mois.
- **Accueil des nouveaux comptes** : un entretien avec l'IA sur les objectifs et les projets, un récap à valider, puis l'import depuis les outils.
- **Import depuis les outils** : Notion, Gmail + Google Agenda, Outlook, un calendrier par lien (.ics) ou du texte collé. L'IA propose, on coche ce qu'on garde. Aucun accès n'est enregistré.
- **Comptes par email** (lien magique), données privées par personne, limite d'utilisation de l'IA par jour.
- Installable sur téléphone (« Ajouter à l'écran d'accueil »).

## Technique

Next.js 15 (App Router, TypeScript), Supabase (comptes + Postgres avec Row Level Security), API Anthropic côté serveur, hébergement Vercel.

```
app/            pages et routes API (classify, interview, import, connect, login, transcribe)
components/     interface (App, vues, tiroir d'édition, accueil, import)
lib/            types, dates, règles GTD, store de données, accès Supabase, IA et connecteurs (lib/server)
supabase/       schéma SQL
docs/SETUP.md   mise en ligne pas à pas
docs/ROADMAP.md suite du projet
docs/UX-REFERENCES.md où trouver de l'inspiration pour l'interface
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
