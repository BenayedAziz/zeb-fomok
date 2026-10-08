# Mise en ligne pas à pas

Compte environ 30 minutes pour l'essentiel (étapes 1 à 4), puis 15 minutes par connexion d'outil (étape 5). Tout est gratuit à cette échelle, sauf l'IA (plafonnée).

Règle d'or : **les clés ne se collent jamais dans le code ni dans un chat**. Elles vont uniquement dans Vercel (Settings > Environment Variables).

---

## 1. Supabase : comptes et base de données

1. Sur supabase.com, crée un projet `second-cerveau`, région **Paris (eu-west-3)**. Note le mot de passe de la base quelque part de sûr.
2. **SQL Editor > New query** : colle tout le contenu de `supabase/migrations/001_init.sql`, puis **Run**. Ça crée les tables et les règles qui empêchent chacun de voir les données des autres.
   Puis une nouvelle requête avec `supabase/migrations/002_events_pins_settings.sql`, **Run** (événements, durées, couleurs de projet, épingles, réglages). Si ta base existe déjà, lance seulement celle-ci : elle ne touche pas aux données.
   Enfin `supabase/migrations/003_hardening.sql` (sécurité et performance des règles d'accès).
3. **Project Settings > API** : garde l'onglet ouvert, tu auras besoin de :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` (secret) → `SUPABASE_SERVICE_ROLE_KEY`
4. **Authentication > Sign In / Providers** : vérifie que **Email** est activé.
5. **Authentication > URL Configuration** (à faire après l'étape 3, quand tu as l'adresse Vercel) :
   - Site URL : `https://ton-site.vercel.app`
   - Redirect URLs : ajoute `https://ton-site.vercel.app/auth/callback`

> Supabase envoie les emails de connexion avec un petit quota gratuit (quelques emails par heure). Pour 4 personnes ça suffit ; plus tard, branche un vrai service d'emails (Resend, Brevo) dans Authentication > SMTP.

## 2. L'IA : Hugging Face (principal), Anthropic (secours facultatif)

Un seul jeton Hugging Face fait marcher le rangement, l'entretien d'accueil, l'import et la dictée.

1. Sur huggingface.co, **Settings > Access Tokens > Create new token**, type **Fine-grained**, coche **Make calls to Inference Providers** → `HF_TOKEN`.
2. Crédits : un compte gratuit a environ 0,10 $ de crédits par mois et s'arrête net au-delà. Avec **PRO (9 $/mois)** : 2 $ inclus par mois, puis paiement à l'usage au prix du fournisseur, sans marge. Règle un plafond de dépense dans **Settings > Billing**.
3. Modèle : `HF_LLM_MODEL` (par défaut `meta-llama/Llama-3.3-70B-Instruct`), et `HF_LLM_IMPORT_MODEL` pour l'import si tu veux un modèle différent.
4. Facultatif : `ANTHROPIC_API_KEY` (console.anthropic.com). Si les deux sont posés, Hugging Face passe en premier et Claude prend le relais en cas de panne. `AI_PROVIDER=anthropic` inverse l'ordre. Règle aussi une limite de dépense dans **Settings > Limits** chez Anthropic.
5. Dans l'appli, chaque personne a en plus une limite par jour (`AI_DAILY_LIMIT`, 60 par défaut). Un import compte pour 3.

### Dictée vocale (facultatif)

Sans rien configurer, le bouton micro utilise la dictée du navigateur (Chrome, Safari, Edge), en français. Pour une transcription plus fiable avec Whisper :

1. Le même `HF_TOKEN` que pour l'IA suffit.
2. Facultatif : `HF_ASR_MODEL` (par défaut `openai/whisper-large-v3`). Tu peux mettre un autre modèle de reconnaissance vocale du Hub, ou ton propre modèle déployé avec `HF_ASR_URL` (adresse complète d'un Inference Endpoint).
3. Chaque dictée compte comme un appel dans la limite IA du jour. L'audio n'est pas stocké.

## 3. Vercel : le site en ligne

1. Sur vercel.com, **Add New > Project**, importe le dépôt GitHub `zeb-fomok`.
2. Avant de déployer, ouvre **Environment Variables** et ajoute :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | étape 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | étape 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | étape 1 (secret) |
| `HF_TOKEN` | étape 2 (secret) |
| `ANTHROPIC_API_KEY` | étape 2, facultatif (secret) |
| `AI_DAILY_LIMIT` | `60` |
| `ALLOWED_EMAILS` | ton email et ceux de tes 3 amis, séparés par des virgules |
| `NEXT_PUBLIC_SITE_URL` | `https://ton-site.vercel.app` (après le premier déploiement) |
| `IMPORT_SECRET` | une longue phrase aléatoire (sert à chiffrer les connexions temporaires) |

3. **Deploy**. Ensuite, chaque modification poussée sur GitHub met le site à jour toute seule, et chaque branche a son propre lien de prévisualisation pour tester sans casser la version de tes amis.
4. Reviens à l'étape 1.5 pour coller l'adresse du site dans Supabase, puis **Redeploy** une fois `NEXT_PUBLIC_SITE_URL` ajoutée.

## 4. Tester

1. Ouvre le site, entre ton email, clique le lien reçu.
2. Tu arrives sur l'accueil : entretien, récap, import.
3. Envoie l'adresse à tes amis. Seuls les emails de `ALLOWED_EMAILS` peuvent se connecter.
4. Sur iPhone : ouvre le site dans Safari > Partager > **Sur l'écran d'accueil**. L'appli s'ouvre alors comme une vraie appli.

### Récupérer tes données de la version actuelle

Ta version actuelle (la page claude.ai) contient déjà tes domaines, projets, objectifs et l'import Notion/Gmail. Une fois ton compte créé, demande à Claude de les transférer dans Supabase : il les lit et te prépare l'insertion.

---

## 5. Connexions aux outils (facultatif, une par une)

Sans ces étapes, l'import marche déjà avec **un calendrier par lien** et **du texte collé**. Les cartes Notion, Google et Outlook affichent « Bientôt disponible » tant que leurs variables ne sont pas remplies.

Pour chaque outil, l'adresse de retour à déclarer est :
`https://ton-site.vercel.app/api/connect/<outil>/callback` (`notion`, `google` ou `microsoft`).

### Notion
1. notion.so/my-integrations > **New integration** > type **Public**.
2. Redirect URI : `https://ton-site.vercel.app/api/connect/notion/callback`.
3. Capacités : **Read content** uniquement.
4. Copie `OAuth client ID` → `NOTION_CLIENT_ID` et `OAuth client secret` → `NOTION_CLIENT_SECRET` dans Vercel.
5. Au moment de se connecter, chaque personne choisit les pages auxquelles l'appli a accès.

### Gmail et Google Agenda
1. console.cloud.google.com > nouveau projet `second-cerveau`.
2. **APIs & Services > Library** : active **Gmail API** et **Google Calendar API**.
3. **OAuth consent screen** : type **External**, statut **Testing**. Dans **Test users**, ajoute ton email et ceux de tes 3 amis (sinon Google refuse la connexion).
4. Scopes : `gmail.readonly`, `calendar.readonly`, `openid`, `email`.
5. **Credentials > Create credentials > OAuth client ID** > type **Web application**. Authorized redirect URI : `https://ton-site.vercel.app/api/connect/google/callback`.
6. Copie l'ID et le secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

> En mode Testing, c'est limité à 100 testeurs déclarés et Google affiche un avertissement « appli non vérifiée » : normal. Pour ouvrir à tout le monde (abonnement), il faudra passer la vérification Google, longue pour Gmail (audit de sécurité). Le calendrier seul se vérifie plus facilement.

### Outlook (Microsoft)
1. portal.azure.com > **Microsoft Entra ID > App registrations > New registration**.
2. Comptes pris en charge : **comptes de n'importe quel annuaire et comptes Microsoft personnels**.
3. Redirect URI (Web) : `https://ton-site.vercel.app/api/connect/microsoft/callback`.
4. **API permissions** > Microsoft Graph > Delegated : `User.Read`, `Mail.Read`, `Calendars.Read`.
5. **Certificates & secrets** > New client secret.
6. Copie `Application (client) ID` → `MICROSOFT_CLIENT_ID` et la valeur du secret → `MICROSOFT_CLIENT_SECRET`.

> Les comptes Outlook d'entreprise (comme VINCI) demandent souvent l'accord de l'administrateur : la connexion sera refusée tant que la DSI n'a pas validé l'appli. Les comptes perso (outlook.com, hotmail) marchent tout de suite. Alternative sans DSI : dans Outlook, Paramètres > Calendrier > Calendriers partagés > **Publier un calendrier**, puis colle le lien .ics dans l'appli.

### Calendrier iPhone (iCloud)
Pas de connexion directe possible. Dans l'app Calendrier sur icloud.com, partage le calendrier en **Calendrier public**, copie le lien `webcal://…` et colle-le dans « Un calendrier par lien ».

---

## Développer la suite

- Une branche par chantier (`git checkout -b ux-capture`), une pull request, Vercel donne un lien de test, puis fusion dans `main`.
- `npm run typecheck` et `npm run build` doivent passer avant de fusionner.
- Le fichier `CLAUDE.md` décrit le projet pour Claude Code : ouvre le dépôt avec Claude Code et demande les évolutions directement.
