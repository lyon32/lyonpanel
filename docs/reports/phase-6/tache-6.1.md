# Tâche 6.1 — Tests d'abord (commande)
Date : 2026-11-10 · Phase 6 · Statut : rapportée

## En une phrase
Le comportement attendu de la commande est décrit par des tests écrits avant le code.

## Ce qui a été fait
- Tests unitaires (`tests/unit/orders/`) : validation du lien par plateforme, schéma de la commande, limite de 10 commandes par minute, branches de `placeOrder`. Plus `tests/unit/pricing/compute-discounted-total.test.ts`.
- Tests de base de données (`tests/db/orders-*.test.ts`) : devis, `place_order` en SQL, `placeOrder`, envoi au fournisseur, routes. Outil commun : `tests/helpers/orders-db.ts`.
- Parcours navigateur : `tests/e2e/order.spec.ts`.
- Sujets couverts : double clic, prix changé, solde insuffisant, plafond de 100 000 XAF, quantité hors limites, commentaires, échec fournisseur, jamais de 2e appel au fournisseur.

## Vérifications (résultats réels)
- Résultat de fin de phase : 1 252 tests unitaires sur 1 252 verts ; `order.spec.ts` 6 sur 6 verts ; base de données : voir le bilan.

## Corrections demandées puis faites
- Les comptes-rendus ne détaillent pas de correction propre à cette tâche.

## Fichiers modifiés
- `tests/unit/orders/*`, `tests/unit/pricing/compute-discounted-total.test.ts`, `tests/db/orders-*.test.ts`, `tests/helpers/orders-db.ts`, `tests/e2e/order.spec.ts`, `tests/db/seed.test.ts`, `tests/unit/env.test.ts`.

## Ce que tu peux tester toi-même
1. Lancer `npx vitest run tests/unit/orders` : tous les tests doivent passer.

## Ce qui reste / réserves
- Nombre de tests écrits par fichier : non détaillé dans les comptes-rendus.
