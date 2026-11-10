# Tâche 7.3a — Faux fournisseur, routes de test, alertes Telegram

Statut : TERMINÉ AVEC RÉSERVES (voir bas de page).

## Ce qui a été fait
- Faux fournisseur : chaque appel à `status()` fait avancer la commande d'un pas (En attente, En cours, Terminé ; reste à 0 à la fin). `forceMockOrderStatus(id, 'Partial' | 'Canceled')` impose un statut.
- Nouvelle route `POST /api/test/provider/force-status` (corps `{providerOrderId, status}`).
- Secret dédié `TEST_ROUTE_SECRET` (env.ts + .env.example, valeur vide) pour `fail-next` et `force-status`. Contrôle commun dans `src/app/api/test/provider/guard.ts` : 404 hors faux fournisseur ou en production, 403 si mauvais secret, comparaison à temps constant. `SASPAY_WEBHOOK_SECRET` n'est plus accepté.
- `notifyOwner` : préfixe `[TEST]` hors production, jamais de levée, jeton absent du texte.

## Fichiers
src/server/providers/mock-provider.ts, src/server/providers/telegram.ts, src/server/env.ts, .env.example, src/app/api/test/provider/guard.ts (nouveau), fail-next/route.ts, force-status/route.ts (nouveau).

## Résultats réels
- `npx vitest run tests/unit/providers tests/unit/orders/cron-orders-route.test.ts` : 6 fichiers, 74 tests passés, 0 échec.
- lint : 0 erreur sur mes fichiers (2 erreurs d'ordre d'import corrigées avec --fix). Le lint global ne montre que des avertissements de taille de fichier existants.
- typecheck : erreurs restantes, aucune dans mes fichiers de source :
  - `tests/unit/providers/mock-provider-progress.test.ts` appelle les routes avec 2 arguments (`POST(req, ctx)`), mais `handler()` (src/server/http/handler.ts, hors de mon périmètre) renvoie une fonction à 1 seul argument. Correction suggérée : faire renvoyer à `handler` le type `(req: NextRequest, ctx?: unknown) => Promise<Response>`.
  - `tests/db/orders-sync.test.ts` et `tests/unit/components/*` : dépendent de 7.3b et des composants à venir.

## Choix
- La garde lit `process.env` directement : avec `PROVIDER_MODE=live` hors production, `loadServerEnv()` lève une erreur, ce qui donnait un 500 au lieu du 404 demandé.
- `createMockProvider()` remet à zéro la panne armée : sans cela, un `fail-next` armé dans un test fuyait sur la commande suivante.

## Réserves
- Typecheck : voir ci-dessus (à régler par le chef de projet côté `handler.ts`).
- Pas de commit, comme demandé.
