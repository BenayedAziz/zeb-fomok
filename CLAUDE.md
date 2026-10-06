# Second Cerveau : notes pour Claude Code

Appli GTD (Getting Things Done) en français. Tutoiement, ton direct, pas de jargon dans l'interface.

## Pile
- Next.js 15 App Router + TypeScript strict, React 19, pas de framework CSS : tout le style est dans `app/globals.css` (jetons de couleur clair/sombre en haut du fichier, classes par composant).
- Supabase : auth par lien magique, tables `domains`, `goals`, `projects`, `items`, `reviews`, `ai_usage` (voir `supabase/migrations`). Row Level Security partout : `user_id = auth.uid()`. Toute nouvelle table doit avoir sa policy.
- IA : `@anthropic-ai/sdk` côté serveur uniquement (`lib/server/ai.ts`), routes `app/api/*`. Chaque appel passe par `guardAi()` (session + quota par jour).
- Sans variables Supabase, l'appli tourne en **mode démo** (localStorage) : garder ce mode fonctionnel, il sert aux tests.

## Organisation
- `lib/store.tsx` : toutes les données côté client. Mises à jour optimistes, écritures Supabase dans une seule file ordonnée. Colonnes snake_case en base, camelCase dans le code (conversion automatique).
- `components/ui-context.tsx` : état d'interface (vue, calendrier, tiroir, toasts) et actions transverses (capture + rangement IA, cocher, planifier).
- `components/views/*` : une vue par écran. `components/Drawer.tsx` : édition d'un élément, projet, objectif, domaine.
- `lib/server/connectors.ts` : OAuth Notion / Google / Microsoft pour un import ponctuel. Le jeton vit 30 min dans un cookie chiffré puis est supprimé. Ne jamais stocker de jeton d'accès en base sans chiffrement.

## Règles
- Statuts d'un élément : inbox, todo, doing, waiting, someday, done. Tout ce que range l'IA porte `aiSorted: true` jusqu'à validation par l'utilisateur.
- Dates en chaînes `AAAA-MM-JJ` locales (`lib/dates.ts`), heures `HH:MM`.
- Avant de livrer : `npm run typecheck` et `npm run build`.
- Textes d'interface : phrases courtes, verbes d'action sur les boutons, messages d'erreur qui disent quoi faire.
