# Feuille de route

## État au 8 octobre 2026
- En ligne : https://zeb-fomok.vercel.app (Vercel, mise à jour automatique à chaque push sur `main`).
- Supabase `enbldieuxdgzrzmydgjn` : migrations 001 à 003 appliquées, RLS vérifiée, conseiller sécurité sans alerte. URL de connexion réglée.
- Variables Vercel posées : Supabase (URL, clé publique, clé service), `NEXT_PUBLIC_SITE_URL`, `IMPORT_SECRET`, `ALLOWED_EMAILS`, `AI_DAILY_LIMIT`.
- IA : le code passe par Hugging Face (`HF_TOKEN`), Anthropic en secours facultatif. **Reste à poser `HF_TOKEN` sur Vercel** : sans lui, le message « L'IA n'est pas encore branchée » s'affiche.

## Prochaines étapes
1. Tester son propre compte de bout en bout (connexion, accueil, captures, journée) et noter ce qui coince.
2. ~~Brancher l'IA sur Hugging Face~~ (fait, `lib/server/ai.ts`). Poser `HF_TOKEN` sur Vercel, tester rangement, entretien et import, ajuster `HF_LLM_MODEL` si le JSON ou le français déçoivent.
3. Page « Invités » dans les Réglages (liste en base au lieu de `ALLOWED_EMAILS`, sans redéploiement).
4. UX inspirée de Mobbin : choisir des écrans de référence (capture, journée, calendrier, revue) et refaire les vues.
5. Trouver un nom.
6. Connexions durables aux outils (voir plus bas).
7. **Partager vers l'appli** depuis TikTok, Instagram, YouTube… (comme Punkt) : le lien arrive en épinglé, l'IA le range.
   - Android : `share_target` dans `public/manifest.webmanifest` + route qui reçoit le lien. L'appli installée apparaît dans le menu Partager.
   - iPhone : Safari ne propose pas les applis web dans le menu Partager. Solution : un **Raccourci iOS** « Envoyer au Second Cerveau » (apparaît dans Partager) qui poste le lien sur une route `/api/share` avec un jeton personnel, généré dans les Réglages. Plus tard, une vraie appli iOS avec extension de partage.

## Coût de l'IA pour les invités
- Tous les appels passent par **un seul jeton** (le tien) : c'est toi qui paies, les invités n'ont rien à régler.
- Hugging Face : compte gratuit ≈ 0,10 $/mois puis arrêt net ; **PRO 9 $/mois** = 2 $ inclus puis paiement à l'usage au prix du fournisseur. Pour plusieurs invités, PRO est nécessaire. Mettre un plafond dans Billing.
- Garde-fous dans l'appli : `AI_DAILY_LIMIT` par personne et par jour (60), un import compte 3. Mesurer la dépense réelle sur Billing après une semaine de test, puis ajuster.
- Plus tard : limite différente pour toi et pour les invités, puis « ma propre clé » (V3).

## Connexions aux outils (Gmail, Outlook, Notion, agendas)
Objectif : chaque utilisateur branche ses comptes, l'appli récolte et range dans l'inbox (badge IA à valider).

**Étape A, import ponctuel (le code existe déjà).** Il manque seulement les applis OAuth et leurs clés sur Vercel :
- Notion : notion.so/my-integrations, intégration **publique**, retour `https://zeb-fomok.vercel.app/api/connect/notion/callback` → `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`.
- Google : console.cloud.google.com, écran de consentement en mode **Test** avec les emails des invités en testeurs, identifiant OAuth « Web », retour `/api/connect/google/callback` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Microsoft : portail Entra, inscription d'appli « comptes personnels et professionnels », retour `/api/connect/microsoft/callback` → `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.

**Étape B, synchro continue.** Table `connections` (user_id, fournisseur, jeton de rafraîchissement **chiffré** avec une clé serveur dédiée, dernière synchro), RLS `user_id = auth.uid()`. Tâche planifiée Vercel Cron : lit les nouveautés depuis la dernière synchro, l'IA en tire les actions et rendez-vous, ils arrivent dans l'inbox. Bouton « Déconnecter » qui efface le jeton.

**Contraintes à connaître :**
- Gmail (`gmail.readonly`) est un accès **restreint** chez Google : sans vérification, 100 utilisateurs maximum, écran « appli non vérifiée », et en mode Test les accès expirent au bout de 7 jours. Pour ouvrir à tous : vérification Google + audit de sécurité CASA, à renouveler chaque année. Pour un cercle d'amis, le mode Test suffit.
- Google Agenda (`calendar.readonly`) est seulement « sensible » : vérification, sans audit.
- Outlook et Notion : pas d'audit imposé ; la vérification d'éditeur Microsoft évite l'avertissement « non vérifié ».

## V1 (ce dépôt)
- Capture rangée par l'IA, avec récurrences et badge « IA » à valider
- Ma journée / Semaine / Mois, glisser-déposer, bouton Planifier
- Listes GTD, domaines de vie, projets avec calendrier, notes et liens
- Objectifs (boussole), revue hebdo guidée
- Accueil : entretien IA, récap, import des outils (Notion, Google, Outlook, .ics, texte)
- Comptes par email, données privées, limite IA par jour, liste d'invités
- Installable sur téléphone

## V1.1 (ajouts d'octobre)
- Tâche ou événement : les événements (réunion, anniversaire) ne se cochent pas et s'affichent en plein dans l'agenda
- Durée des tâches, blocs d'agenda à étirer et déplacer à la main (au quart d'heure), y compris d'un jour à l'autre en semaine
- Répétitions : chaque jour, en semaine, certains jours (« tous les mardis et jeudis »), toutes les N semaines, chaque mois, chaque année
- Une couleur par projet, légende cliquable pour filtrer le calendrier, « À faire » rangé par projet
- Plusieurs éléments dans une seule capture, pour plusieurs projets
- Épingler des articles et ressources par projet (page « Épinglés » + section sur la page projet)
- Revue au rythme choisi : chaque jour, tous les 3 jours, semaine, quinzaine, mois ; version courte ou complète, passage de chaque projet, bilan du mois
- Réglages : mode Simple ou GTD complet, contextes personnalisés, heures de l'agenda, vue de départ
- Page « Comment ça marche »
- Dictée vocale : navigateur ou Whisper (Hugging Face)

## Retours à recueillir pendant le test (3 amis)
- Combien de captures par jour ? Combien corrigées après l'IA ?
- Est-ce que la revue hebdo est faite ? Où est-ce qu'on décroche dans l'accueil ?
- Ce qui manque le plus au quotidien

## V2
- **Synchro continue des calendriers** (Google, Outlook) au lieu de l'import ponctuel, avec les rendez-vous affichés dans Ma journée
- **L'IA planifie ma semaine** : elle place les prochaines actions dans les créneaux libres, je glisse pour ajuster
- **Brief du matin par email** : agenda du jour, 3 priorités, ce qui est en retard
- **Envoyer une tâche à Hermes** : la tâche passe en « En attente : Hermes », le résultat revient dans le projet
- **Veille qui ressort au bon moment** : l'IA propose une ressource épinglée quand tu travailles sur le projet
- Bilan trimestriel par objectif
- Glisser une tâche d'un jour à l'autre dans la vue mois en gardant l'heure

## V3 : ouverture
- Clé API personnelle par utilisateur (réglage « ma propre clé »)
- Abonnement (Stripe) avec quota IA inclus
- Vérification Google pour ouvrir l'import Gmail à tous
- Emails transactionnels via un vrai fournisseur (Resend, Brevo)
