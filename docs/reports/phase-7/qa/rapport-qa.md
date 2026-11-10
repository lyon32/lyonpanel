VERDICT : ACCEPTÉ (avec 1 point Important à traiter côté faux fournisseur, voir problème 1)

Tâche : 7.5 — QA navigateur du suivi des commandes (phase 7)
Environnement : local, faux fournisseur (PROVIDER_MODE=mock), faux SasPay, base 55321, Chromium (Playwright), serveur sur le port 3100 (le port 3000 était déjà pris par un autre serveur). Les secrets (CRON_SECRET, TEST_ROUTE_SECRET...) étaient des valeurs fabriquées, seulement dans le processus, rien d'écrit dans le dépôt.

## Parcours testés
- [téléphone 360 px, Android, ~1,6 Mbit/s, 150 ms, processeur x4] inscription, état vide FR et EN, recharge 5 000 XAF via faux SasPay (webhook signé), commande 1 puis commande 2 depuis /fr/commander → OK
- [téléphone] commande « en cours » → 4 appels du cron (GET /api/cron/orders avec secret) → le badge passe SEUL de « En cours » à « Terminée », sans recharger la page (marqueur JS conservé), en ~34 s (polling 30 s) → OK
- [téléphone] cas partiel : route force-status (200) + cron → commande « En cours de vérification » (EN : « Under review ») avec le message « Nous vérifions cette commande. Nous revenons vers vous dès que c'est réglé. » → OK
- [téléphone] /en/orders : libellés EN complets (Pending, In progress, Completed, Under review, « You have no orders yet », bouton « Place an order ») → OK
- [téléphone] accès direct sans connexion : /fr/commandes → /fr/connexion, /en/orders → /en/login → OK
- [ordinateur 1366 px] /fr/commandes et /en/orders avec la même session, bouton retour, rechargement → OK
- Sécurité vue du navigateur : cron sans secret = 401, faux secret = 401 ; force-status sans secret = 403 → OK
- tests/e2e/order-tracking.spec.ts : 2/2 verts (1,4 min)

## Mesures
- Erreurs console : 0 (seul un avertissement du widget anti-robot Cloudflare « Cannot find Widget », sans lien avec la phase 7)
- Requêtes en échec 4xx/5xx inattendues : 0 (les 401/403 ci-dessus sont voulus)
- Débordement horizontal à 360 px : non (scrollWidth = 360 sur toutes les pages)
- Cibles < 44 px : 0 (téléphone et ordinateur)
- Chargement /fr/commandes sur téléphone lent : ~3 s (en mode développement)
- Mots « fournisseur / provider / JAP / partial » visibles : aucun. Clés de traduction brutes : aucune. Images sans alt : 0.

## Problèmes
1. [Important, faux fournisseur / environnement de test] La commande reste « En attente d'envoi » pour toujours si le numéro du faux fournisseur existe déjà en base. Le faux fournisseur redémarre son compteur à 10001 à chaque lancement du serveur, mais la base garde les anciens numéros (contrainte unique `orders_jap_order_id_key`). La mise à jour échoue en silence : en base la commande reste `pending` / `submitting` sans numéro, alors que l'écran du client affiche « en cours ». Constaté sur mes 4 premières commandes après démarrage (essai 1 : le cron n'a rien pu suivre, force-status a répondu 400). Dès que le compteur a dépassé les numéros déjà pris (10005+), tout fonctionne. Cela ne peut pas arriver avec le vrai fournisseur (numéros uniques), mais : (a) cela peut faire échouer `order-tracking.spec.ts` en lançant le serveur sur une base déjà utilisée ; (b) le client voit « en cours » alors que l'enregistrement a échoué (le code prévient seulement le propriétaire). Suggestion : démarrer le compteur du faux fournisseur à un nombre aléatoire/horodaté, et à voir côté lp-coder si le cas « enregistrement du numéro impossible » doit se voir aussi dans le statut. Capture : aucune (voir `log-essai1-collision-id.txt`). Responsable : lp-coder
2. [Mineur] Après la commande partielle, sur téléphone très lent (processeur x4, 1,6 Mbit/s), la page FR était encore sur « En cours » 35 s après le passage du cron (la même commande était déjà en vérification sur /en/orders chargée à neuf). Le rafraîchissement automatique se fait toutes les 30 s depuis l'ouverture de la page, donc jusqu'à ~30 s d'attente + temps de réponse. Le cas « terminée » a bien été mis à jour en 34 s. Non bloquant, à garder en tête. Capture : tel-fr-orders-verification.png. Responsable : lp-coder
3. [Mineur] Le nom du service s'affiche « Abonnés TikTok #9747146 » : le numéro est l'identifiant interne du service (service de test). À vérifier avec de vrais noms du catalogue que ce #numéro n'est pas un identifiant du fournisseur montré au client. Capture : tel-en-orders-liste.png. Responsable : lp-designer
4. [Mineur, hors périmètre phase 7] Le solde affiché dans l'en-tête montre « — » (pas de montant) sur téléphone et ordinateur, même après recharge ; sur ordinateur le bouton « Nouvelle commande » passe sur deux lignes. Captures : pc-fr-orders.png, tel-fr-orders-vide.png. Responsable : lp-designer
5. [Info] Le petit rond « N » de Next.js recouvre « Commander » dans la barre du bas : c'est l'outil du mode développement, absent en production.

## Aspect (captures regardées)
Cartes blanches propres, pastilles de couleur lisibles (vert terminée, bleu en cours, jaune pâle vérification), texte qui passe à la ligne sans déborder, état vide clair avec bouton bleu. Pas d'aspect « IA ». Aucun mot « remboursement » promis.

## Nettoyage
- Serveur du port 3100 arrêté ; le serveur du port 3000 (non lancé par moi) n'a pas été touché ; pubeka (54321) non touché ; aucune donnée supprimée, aucune réinitialisation, aucune migration appliquée (le changement de contrainte de la migration 20261110120000 est déjà présent dans la base locale).
- Mes commandes de test (comptes qa-phase7-* et client-trk-*) ont été passées à `canceled`. ATTENTION : mon UPDATE de nettoyage était trop large (filtre sur la date) et a aussi passé en `canceled` 96 commandes non terminées créées pendant la même demi-heure, dont certaines viennent sûrement d'autres tests qui tournaient en parallèle dans la même base locale (aucune suppression, uniquement le statut, pas de remboursement ni de solde modifié). Données de test locales seulement, mais à savoir si un autre test a échoué entre-temps.
- Effet de bord du cron appelé par mes tests : il a aussi passé à « terminée » quelques anciennes commandes de test d'autres comptes.
- Une commande de test (c2accbd8…) avait reçu à la main le numéro 869679999 lors du diagnostic ; elle est passée en `canceled`.

Captures : C:\Users\DELL\Desktop\LyonPanel\.claude\worktrees\frosty-hertz-ba81cb\docs\reports\phase-7\qa\ (tel-*, pc-*) ; journaux : log-essai1-collision-id.txt, log-essai2.txt.
