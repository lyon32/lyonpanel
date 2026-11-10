# Tâche 6.5 — Contrôles (relecture, QA, sécurité)
Date : 2026-11-10 · Phase 6 · Statut : rapportée

## En une phrase
Trois contrôles indépendants ont accepté la commande au 2e passage.

## Ce qui a été fait
- Relecture (lp-reviewer) : ACCEPTÉ au 2e passage.
- QA navigateur (lp-qa) : ACCEPTÉ au 2e passage, téléphone 360 px et ordinateur, FR et EN. Parcours complet, double clic, solde insuffisant (« Il vous manque 775 XAF »), plafond, lien et quantité refusés, accès anonyme redirigé. Captures : `qa/r2-*.png`.
- Sécurité (lp-security) : ACCEPTÉ au 2e passage. Aucune faille critique, haute ou moyenne. `npm audit` : 7 vulnérabilités modérées dans les outils de développement, aucune haute ni critique.

## Vérifications (résultats réels)
- 10 commandes simultanées avec un solde pour une seule : 1 seule passe. 10 appels avec la même clé : 1 commande, 1 débit. 4 appels de 50 000 XAF en parallèle contre le plafond : tous refusés. Appel anonyme : refusé.
- QA : aucune requête en erreur serveur ; 3 erreurs 422 en console par contexte, provoquées volontairement. Chargement environ 1,1 s en local.

## Corrections demandées puis faites
- Premier passage sécurité : 5 failles Basses. Corrigées : limites des commentaires, limite du devis, `PROVIDER_MODE` explicite en production. Restent ouvertes, jugées acceptables : clé `idem_key` unique globale, commande bloquée en `submitting` après plantage (phase 7).

## Fichiers modifiés
- Aucun code (lecture seule). Comptes-rendus : `securite-commande.md`, `qa/rapport-qa.md`.

## Ce que tu peux tester toi-même
1. Voir le bilan.

## Ce qui reste / réserves
- Au premier passage, `lp-security` a lu le code sans lancer le site (essais HTTP non faits). À prévoir en phase 15 : refuser le faux fournisseur si SasPay est en mode réel.
