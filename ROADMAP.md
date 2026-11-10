# LyonPanel — Roadmap de réalisation

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Remplace `docs/04-roadmap.md`. S'appuie sur : `PRD.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_SPEC.md`, `LLD.md`, `CONVENTIONS.md`, `ENV_SETUP.md`, `TESTING.md`, `SECURITY_NOTES.md`, `CI_CD.md`.

## Règles

1. **Phases courtes** (0 à 16) : chacune tient dans **une session de travail avec l'IA** et se termine par quelque chose que le propriétaire peut voir ou tester.
2. **L'argent d'abord** : compte → recharge → commande. Design simple et propre dès le début (design system) ; page d'accueil soignée et SEO ensuite.
3. **Validation obligatoire** : à la fin de chaque phase, le propriétaire teste et dit « validé » avant la phase suivante.
4. Chaque phase = **une branche + une PR** (`CONVENTIONS.md`), CI verte, tests de la phase écrits avec le code.
5. **🧑 À faire par toi** : préparatifs à finir **avant** la phase indiquée.
6. **Retour visuel** (ajout du 2026-11-09) : toute phase qui contient une action asynchrone inclut ses états de chargement et de succès (`docs/05-design-system.md §6 bis`).
7. **Lancement en deux temps** : version limitée (toi + quelques proches, 1 à 2 semaines), puis ouverture à tous.

## Vue d'ensemble

| # | Phase | Résultat visible | 🧑 Avant cette phase |
|---|---|---|---|
| 0 | Socle du projet | Page « Bonjour LyonPanel » en local, CI verte | Protéger `main` sur GitHub |
| 1 | Base de données | Tables, RLS, fonctions SQL testées | — |
| 2 | Design system + mise en page | Composants aux couleurs, en-tête, pied, FR/EN | — |
| 3 | Comptes | Inscription, connexion email/téléphone, mot de passe oublié | Widget Turnstile (ou clés de test) |
| 4 | Prix + catalogue (faux fournisseur) | Catalogue rangé, prix en XAF/XOF/USD | — |
| 5 | Recharge SasPay (test) | Recharger en mode test, solde crédité | Compte SasPay + clés de test |
| 6 | Commande | Commander, solde débité, envoi au faux fournisseur | — |
| 7 | Suivi + alertes | Statuts qui bougent, alertes Telegram | Bot Telegram |
| 8 | Espace client | Tableau de bord, historiques, favoris, compte | — |
| 9 | Support | Tickets avec captures d'écran | — |
| 10 | Parrainage + remises | Code parrain, bonus 5 %, remise 10 % | — |
| 11 | Admin (1) | Admin caché + code 6 chiffres, stats, clients | Appli d'authentification |
| 12 | Admin (2) | Remboursements, services, réglages, journal | — |
| 13 | Mise en ligne de test | Vercel Preview + Supabase test | Domaine, Supabase, Vercel, email Hostinger |
| 14 | Accueil soigné + SEO | Accueil final, pages plateformes, FAQ, légal | Textes légaux relus |
| 15 | Vrai fournisseur + lancement limité | Test réel, charge, lancement limité | Nouvelle clé fournisseur, SasPay en production |
| 16 | Ouverture publique | Site ouvert à tous | Bilan du lancement limité |

## Détail des phases

### Phase 0 — Socle du projet
- Projet Next.js + TypeScript strict dans `lyon32/lyonpanel`, versions exactes (`CONVENTIONS.md §1`), numéros recopiés dans `ENV_SETUP.md §6`.
- Tailwind, ESLint, Prettier, Husky, Vitest, Playwright ; `src/server/env.ts` (vérification des variables).
- Arborescence vide de `LLD.md §2`.
- GitHub Actions `ci.yml`, `.gitattributes`, Dependabot.
- **Sentry** (`@sentry/nextjs`) selon le skill `sentry-instrument` (portée « première erreur » : erreurs + traces, sans Replay ni profilage), DSN déjà dans `.env.local`, vérifier qu'une erreur de test arrive dans Sentry.
- `.coderabbit.yaml` (déjà créé) pour les relectures automatiques des PR.
- **Terminé quand** : `npm run dev` affiche une page, la CI passe au vert sur une première PR.
- 🧑 Protéger `main` (`CI_CD.md §4`).

### Phase 1 — Base de données
- Migrations : types, tables de `DATA_MODEL.md`, index, RLS, vue `services_public`.
- Fonctions SQL : `place_order`, `credit_payment`, `refund_order`, `admin_adjust`, `anonymize_user`.
- `seed.sql` (réglages + ~20 services fictifs), fabriques de tests.
- Tests base de données de `TESTING.md §2`.
- **Terminé quand** : `npm run test:db` est vert et couvre 100 % des cas d'argent.

### Phase 2 — Design system + mise en page
- Variables de `docs/05-design-system.md`, Public Sans, shadcn/ui adapté (bouton, champ, carte, badge, tableau, dialogue).
- `next-intl` avec adresses traduites (`LLD.md §6`), choix de langue et de devise (cookies).
- En-tête, pied de page, barre latérale, états vides / chargement / erreur.
- Logo et favicon de `brand/lyonpanel-v2/`.
- **Terminé quand** : une page de démonstration montre tous les composants en FR et EN, sur téléphone et ordinateur.

### Phase 3 — Comptes
- Inscription (email, téléphone, pays, devise, langue, Turnstile), connexion email **ou** téléphone, déconnexion, mot de passe oublié.
- Règles de `SECURITY_NOTES.md §2`.
- `handler`, `apiError`, messages d'erreur FR/EN.
- Écrans refaits (2026-11-09) : fond dégradé, deux panneaux sur ordinateur, bande bleue sur téléphone, inscription en 2 étapes, boutons avec chargement et succès, bonjour selon l'heure du navigateur (Bonjour / Bon après-midi / Bonsoir) sur le tableau de bord actuel.
- **Terminé quand** : tu crées un compte, te reconnectes par téléphone et réinitialises ton mot de passe.
- 🧑 Créer un widget Turnstile (sinon on garde les clés de test).

### Phase 4 — Prix + catalogue (faux fournisseur)
- `server/pricing` (100 % testé), faux fournisseur, `syncServices` : classement, noms reconstruits, nouveaux services inactifs, historique de prix.
- Pages catalogue par plateforme, fiche service, prix en XAF/XOF/USD.
- **Terminé quand** : le catalogue s'affiche rangé, les prix respectent les marges, aucun nom ne contient de prix fournisseur.

### Phase 5 — Recharge SasPay (mode test)
- Lire la documentation SasPay (paiements, webhooks, signature, frais) et compléter `saspay-client.ts`.
- Devis avec frais, création du paiement, webhook signé, rattrapage cron, page de retour.
- **Page de paiement dynamique** (demande du propriétaire, 2026-11-07) : pas de page statique ni d'étapes figées ; l'état du paiement se met à jour en direct sous les yeux du client (en attente, confirmé, échoué, délai dépassé) ; téléphone d'abord puis ordinateur ; maquette inspirée des 6 images de `payment page reference/` (à étudier au début de la phase). Le propriétaire teste lui-même en mode test avant toute mise en ligne.
- Progression visible de la recharge (chargement sur le bouton, puis étapes du paiement).
- `SASPAY_MODE=live` refusé hors production (décision du propriétaire, déjà dans `src/server/env.ts`).
- **Terminé quand** : en mode test, tu recharges 3 000 XAF ; le solde est crédité **une seule fois** même si le webhook est renvoyé.
- 🧑 Compte marchand SasPay, clés de **test**, secret de webhook ; installer `cloudflared`.

### Phase 6 — Commande
- Formulaire (service, lien, quantité, commentaires perso), devis en direct, liens par plateforme, plafond journalier, clé d'idempotence.
- Progression par étapes de la commande (envoi, débit, transmission).
- `placeOrder` → `place_order` → `submitToProvider` (faux fournisseur) ; échec → `to_review`.
- **Terminé quand** : tu commandes, le solde baisse du bon montant ; double clic = une commande ; solde insuffisant = message clair.

### Phase 7 — Suivi des commandes + alertes
- Cron des statuts par lots, polling 30 s, badges de statut, barre de progression de la commande.
- `notifyOwner` Telegram, préfixe `[TEST]` hors production.
- **Terminé quand** : une commande passe seule de « en cours » à « terminée » ; un échec t'envoie une alerte.
- 🧑 Créer le bot avec @BotFather, récupérer jeton et `chat_id` (`ENV_SETUP.md §4`).

### Phase 8 — Espace client
- États de chargement et de succès sur toutes les actions du tableau de bord.
- **Suggestion de commande** (décidée avec le propriétaire le 2026-11-09) : le serveur la calcule à partir de la table des commandes (aucune nouvelle table). À partir de 3 commandes : le service le plus commandé ou le plus récent. Moins de 3 commandes : suggestion générale (service le plus vendu). Jamais de nom du fournisseur ni de marge. UNE carte discrète sur le tableau de bord (« Besoin d'abonnés TikTok aujourd'hui ? ») avec un bouton « Commander » qui pré-remplit le formulaire et une croix pour fermer. Le client peut la désactiver. Aucune fenêtre qui s'ouvre à la connexion. Textes FR/EN (`antislop-copywriting`).
- Tableau de bord, historiques commandes et transactions, favoris, page compte (devise, langue, téléphone, suppression).
- **Terminé quand** : tout l'espace client fonctionne sur petit téléphone.

### Phase 9 — Support
- Tickets, messages, captures compressées (≤ 2 Mo, bucket privé), alerte « nouveau ticket ».
- **Terminé quand** : tu ouvres un ticket avec une capture et l'alerte arrive.

### Phase 10 — Parrainage + remises
- Code et lien de parrainage, page parrainage ; bonus 5 % à la 1re recharge ; remise 10 % dès 50 000 XAF.
- **Terminé quand** : un filleul recharge → le parrain reçoit 5 % une seule fois ; la remise s'applique au bon seuil.

### Phase 11 — Admin (1) : accès, stats, clients
- `ADMIN_PATH` secret, code à 6 chiffres sur **2 appareils** (secours), `/admin` = 404, `noindex`.
- Tableau de bord : ventes, bénéfice, solde fournisseur, répartition par pays.
- Clients : recherche, fiche, blocage, remise perso, plafond journalier, notes privées.
- **Terminé quand** : tu entres dans l'admin avec ton code, vois tes chiffres et bloques un client de test.
- 🧑 Installer une appli d'authentification (Google Authenticator ou autre).

### Phase 12 — Admin (2) : commandes, services, réglages
- Commandes `to_review` : rembourser (total/partiel), renvoyer, clôturer.
- Services : activer, renommer, marge par service ; réglages : taux, marges, minimum, seuils.
- Tickets : répondre, fermer ; journal d'audit.
- **Terminé quand** : tu rembourses une commande en échec et le client voit son solde corrigé.

### Phase 13 — Mise en ligne de test
- Projets Supabase test + prod, Vercel Preview + Production (offre gratuite), variables par environnement, **Cloudflare Worker des tâches planifiées**, en-têtes de sécurité, workflows de migration, notifications de déploiement.
- **Terminé quand** : chaque PR a un lien Preview qui marche ; la migration prod se lance par le bouton.
- 🧑 Acheter `lyonpanel.com` (Cloudflare), créer les 2 projets Supabase, connecter Vercel, créer `support@lyonpanel.com` chez Hostinger (MX/SPF/DKIM).

### Phase 14 — Page d'accueil soignée + SEO
- Accueil final sans look IA, animations GSAP/Lenis légères, pages par plateforme, FAQ, confidentialité, conditions, 404.
- SEO : métadonnées FR/EN, `hreflang`, sitemap, robots, données structurées, images de partage, Google Analytics, bouton d'action fixe sur mobile.
- Règles obligatoires : `docs/03-seo-et-design.md §3 ter` (pages indexées / non indexées, balises par page, Search Console, Bing, IndexNow).
- **Terminé quand** : bon score mobile (Lighthouse) ; chaque page publique a titre, description, canonical, hreflang, Open Graph et JSON-LD valides ; toutes les pages privées et l'admin sont en `noindex` ; sitemap envoyé dans Google Search Console et Bing.
- À améliorer dans cette phase (demandé par le propriétaire le 2026-11-08) : le texte et la composition du héros (en lien avec le SEO), l'aperçu du tableau de bord montré sur l'accueil, l'UI et l'UX en général. Le reste de l'accueil fait en phase 2 est jugé « passable » et conservé.
- 🧑 Accès à Google Search Console et Bing Webmaster Tools avec ton compte Google.
- 🧑 Relire les textes légaux ; décider s'il faut une immatriculation.
- 🔔 **RAPPEL À LA FIN DE LA PHASE 14 (obligatoire)** : quand la page d'accueil est complètement finie, **rappeler au propriétaire** de proposer **2 à 3 prototypes de page d'accueil complètement différents** (seules les couleurs du design system sont gardées : blanc, bleu, jaune en accent). S'appuyer sur plusieurs images de `reference-design system/` comme inspiration (sans les copier, viser mieux) et utiliser tous les skills de design du projet (`unslop`, `antislop`, `antislop-ui`, `antislop-layoutmobile`, `baseline-ui`, `improve-ui`, `impeccable`, `ui-ux-pro-max`, etc.). Le propriétaire choisit, puis on garde la feuille de route. Ne rien lancer sans lui avoir posé la question.

### Phase 15 — Vrai fournisseur, tests finaux, lancement limité
- Test de charge 100 clients, test de restauration de sauvegarde (`TESTING.md §6`).
- `PROVIDER_MODE=live`, SasPay production ; test réel : 1 recharge Mobile Money + 2–3 commandes (≈ 0,50 $) + 1 remboursement.
- Ouverture **limitée** : inscription réservée à une liste d'emails (mon choix), 1 à 2 semaines.
- **Terminé quand** : test réel réussi, aucun bug bloquant pendant la période limitée.
- 🧑 Régénérer la clé fournisseur et la mettre dans Vercel Production, passer SasPay en production, recharger 20 $ sur fournisseur.

### Phase 16 — Ouverture publique
- Corriger les retours, retirer la liste d'emails autorisés, vérifier alertes et surveillance.
- **Terminé quand** : le site est ouvert à tous.
- 🧑 Annoncer le lancement.

## Outil à évaluer plus tard : context-mode

- **Quoi** : [context-mode](https://github.com/mksglu/context-mode), plugin local et gratuit qui range les gros résultats de commandes hors de la conversation de l'IA (économie de mémoire sur les longues sessions).
- **Quand** : à la fin de la **Phase 2** (quand il y a du vrai code), pas avant.
- **Conditions avant installation** : mettre Node à jour en **24.15 ou plus** (installé : 24.13.1) ; vérifier sur une branche de test qu'il ne bloque pas graphify ni le contrôle GateGuard ; accord du propriétaire.
- **Si OK** : l'ajouter à `CLAUDE.md` (outils) et `ENV_SETUP.md` (installation).

## Après le lancement (non planifié)

Pages par pays, blog, commandes en lot, notifications client, email « nouvelle connexion », paiement pays anglophones, crypto, API revendeurs, mise à jour automatique du taux.

## Suivi

| Phase | Statut | Date de validation |
|---|---|---|
| 0 | validée | 2026-11-07 |
| 1 | validée | 2026-11-07 |
| 2 | validée | 2026-11-08 |
| 3 | validée | 2026-11-09 |
| 4 | validée (2026-11-10) | — |
| 5 | terminée, en attente de validation du propriétaire (2026-11-10) | — |
| 6 | à faire | — |
| 7 | à faire | — |
| 8 | à faire | — |
| 9 | à faire | — |
| 10 | à faire | — |
| 11 | à faire | — |
| 12 | à faire | — |
| 13 | à faire | — |
| 14 | à faire | — |
| 15 | à faire | — |
| 16 | à faire | — |
