VERDICT : ACCEPTÉ
Tâche : 6 — Commande (/fr/commander, /en/order), 2e passage
Environnement : local, faux JAP (mock), Supabase 55321, Chromium Playwright
Parcours testés :
  - [téléphone 360x740 Android] parcours complet (devis 1 155, commande, in_progress, solde 5 000 -> 3 845 affiché et en base) -> OK
  - [ordinateur 1366x768] idem -> OK
  - Double clic : 1 commande, 1 débit (les deux contextes) -> OK
  - Solde insuffisant : « Il vous manque 775 XAF » + lien recharge, aucun débit -> OK
  - Plafond 100 000 : message clair, aucune commande créée -> OK
  - Quantité hors limites, lien d'une autre plateforme : messages clairs FR et EN -> OK
  - Service 900007 : zone commentaires affichée -> OK
  - Accès anonyme -> redirigé vers /fr/connexion -> OK
  - tests/e2e/order.spec.ts : 6/6 passés
Mesures : erreurs console 3 par contexte (toutes des 422 attendues, provoquées volontairement : quantité, lien, plafond ; 0 requête 5xx), débordement non (360 px), cibles < 44 px 0, chargement ~1,1 s (local, sans limitation réseau)
Problèmes :
  1. [Mineur] La mention « Failed to load resource 422 » apparaît en console pour chaque refus serveur : normal, c'est la réponse d'erreur voulue.
Captures : docs/reports/phase-6/qa/r2-*.png (tel et pc)
