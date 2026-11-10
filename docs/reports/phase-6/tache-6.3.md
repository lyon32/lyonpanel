# Tâche 6.3 — Code serveur de la commande
Date : 2026-11-10 · Phase 6 · Statut : rapportée

## En une phrase
Le serveur sait chiffrer, passer et suivre une commande, avec le faux fournisseur.

## Ce qui a été fait
- `validate-link.ts` : le lien doit correspondre à la plateforme du service (domaine exact, http ou https).
- `schemas/order.ts` : contrôle Zod, commentaires limités à 1 000 lignes de 500 caractères.
- `quote.ts` : devis, limité à 60 par minute et par client.
- `place-order.ts` : appelle `place_order`, vérifie le solde du fournisseur (alerte `low_provider_balance`), limite de 10 commandes par minute.
- `submit-to-provider.ts` : une seule tentative d'envoi, 10 s maximum. Échec : commande en `to_review`, alerte au propriétaire, aucun remboursement.
- `list-orders.ts` : liste paginée sans coût, marge ni message du fournisseur.
- Routes : `POST /api/v1/orders/quote`, `POST /api/v1/orders`, `GET /api/v1/orders`, `GET /api/v1/orders/{id}` ; route de test `fail-next` (404 hors mode faux fournisseur ou en production). Messages d'erreur FR/EN et `openapi.yaml`.
- `env.ts` : `PROVIDER_MODE` doit être donné explicitement en production.

## Vérifications (résultats réels)
- Unitaires 1 252 sur 1 252. Lint 0 erreur, types et build verts.
- Couverture : `place-order.ts` 97,5 % des lignes (lignes 95 et 225 : replis défensifs non atteints) ; `submit-to-provider.ts` : pas 100 % strict non plus. Ce n'est donc pas 100 % strict sur tous les modules d'argent.

## Corrections demandées puis faites
- Commentaires sans limite → limites ajoutées. Devis sans limite de débit → 60 par minute. Faux fournisseur par défaut en production → valeur explicite exigée.

## Fichiers modifiés
- `src/server/orders/*`, `src/server/schemas/order.ts`, `src/server/env.ts`, `src/server/http/api-error.ts`, `src/server/providers/mock-provider.ts`, `src/app/api/v1/orders/**`, `src/app/api/test/provider/**`, `src/messages/errors.*.json`, `openapi.yaml`.

## Ce que tu peux tester toi-même
1. Voir la tâche 6.4 (écran).

## Ce qui reste / réserves
- Commande restée « pending » avec `error='submitting'` après un plantage : rattrapage et alerte à faire en phase 7.
- Nom dédié pour le secret de la route de test : à faire.
