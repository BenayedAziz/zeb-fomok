# Feuille de route

## État au 8 octobre 2026
- En ligne : https://zeb-fomok.vercel.app (Vercel, mise à jour automatique à chaque push sur `main`).
- Supabase `enbldieuxdgzrzmydgjn` : migrations 001 à 003 appliquées, RLS vérifiée, conseiller sécurité sans alerte. URL de connexion réglée.
- Variables Vercel posées : Supabase (URL, clé publique, clé service), `NEXT_PUBLIC_SITE_URL`, `IMPORT_SECRET`, `ALLOWED_EMAILS`, `AI_DAILY_LIMIT`.
- **Pas encore d'IA en ligne** : ni `ANTHROPIC_API_KEY` ni `HF_TOKEN` sur Vercel.

## Prochaines étapes
1. Tester son propre compte de bout en bout (connexion, accueil, captures, journée) et noter ce qui coince.
2. LLM via Hugging Face : `HF_TOKEN` sur Vercel (dictée Whisper), puis brancher le rangement IA sur un modèle Hugging Face (Inference Providers, API compatible OpenAI) à la place ou en secours d'Anthropic. Garder `guardAi()` et le format JSON attendu.
3. Page « Invités » dans les Réglages (liste en base au lieu de `ALLOWED_EMAILS`, sans redéploiement).
4. UX inspirée de Mobbin : choisir des écrans de référence (capture, journée, calendrier, revue) et refaire les vues.
5. Trouver un nom.

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
