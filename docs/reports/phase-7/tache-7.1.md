# Tâche 7.1 — Tests d'abord (suivi des commandes + alertes)
Date : 2026-11-10 · Phase 7 · Statut : TERMINÉ AVEC RÉSERVES

## En une phrase
Le comportement attendu du suivi (synchro des statuts, rattrapage des commandes bloquées, cron, alertes Telegram, faux fournisseur qui avance, badges, barre, polling 30 s) est décrit par des tests écrits avant le code.

## Fichiers créés (tests/** uniquement)
- `tests/db/orders-sync.test.ts` (14 tests) : `syncOrderStatuses` et `recoverStuckOrders`, base locale.
- `tests/db/orders-idem-key.test.ts` (3) : `idem_key` unique par (user_id, idem_key), colonne `alerted_at`.
- `tests/unit/orders/cron-orders-route.test.ts` (4) : `GET /api/cron/orders`.
- `tests/unit/providers/telegram.test.ts` (7) : `notifyOwner`.
- `tests/unit/providers/mock-provider-progress.test.ts` (11) : faux fournisseur qui avance, routes `fail-next` et `force-status`.
- `tests/unit/components/order-tracking-parts.test.tsx` (≈ 37 avec les cas paramétrés) : badge de statut et barre de progression.
- `tests/unit/hooks/use-order-polling.test.tsx` (6) : polling 30 s.
- `tests/e2e/order-tracking.spec.ts` (2) : passage seul à « terminée », cas partiel.
- `tests/helpers/sync-orders.ts` : aides (commande en cours, commande bloquée « en envoi »).
- Modifié : `tests/e2e/order.spec.ts` (le secret de `fail-next` devient `TEST_ROUTE_SECRET`, décision du plan).

## Noms choisis (non fixés par le plan : lp-coder / lp-designer doivent les suivre)
- `syncOrderStatuses()` et `recoverStuckOrders()` : sans paramètre, valeur de retour libre.
- Statuts fournisseur : `Pending`, `In progress`, `Completed`, `Partial`, `Canceled`, autre = inconnu (to_review).
- Alerte : `notifyOwner('order_failed', { order_id, ... })`, mémorisée dans `orders.alerted_at`.
- Mock : `forceMockOrderStatus(providerOrderId, 'Partial' | 'Canceled')` exporté de `mock-provider.ts`, mémoire du module (visible de toutes les instances) ; route `POST /api/test/provider/force-status` `{ providerOrderId, status }` (en-tête `x-test-secret` = `TEST_ROUTE_SECRET` ; 403 mauvais secret, 400 statut invalide, 404 hors mock/production). `status()` avance d'un pas par appel jusqu'à `Completed` (remains = 0).
- Composants : `@/components/order/order-status-badge` (`OrderStatusBadge({status})`, `data-testid="order-status-badge"` + `data-status`) ; `@/components/order/order-progress-bar` (`OrderProgressBar({quantity, remains})`, `role="progressbar"`, `aria-valuenow` entier borné 0..100) ; `partial`/`canceled` s'affichent « en cours de vérification ».
- Hook : `@/hooks/use-order-polling` → `useOrderPolling(isFinal: boolean)`, `router.refresh()` toutes les 30 s, pause onglet caché.
- Page `/fr/orders` : `order-status-badge` avec `data-status`.
- Rattrapage : lit `created_at` / `updated_at` (les deux sont posés vieux dans les tests).

## Résultats réels
Le poste n'a ni `node_modules` complet (pas de `jsdom`, `@testing-library`, `@supabase/supabase-js`), ni `.env.local`, ni Supabase local joignable. Lancé avec une config temporaire (hors dépôt) :
- `telegram.test.ts` : 2 échouent (attendu), 5 passent (garde-fous déjà vrais : pas de préfixe en production, sans variables, jamais de levée, jeton absent).
  Raison : `expected false to be true` sur `startsWith('[TEST]')`.
- `cron-orders-route.test.ts` : échoue, `Cannot find package '@/app/api/cron/orders/route'` (route absente).
- `mock-provider-progress.test.ts` : échoue, `.../force-status/route` absent et `forceMockOrderStatus` absent.
- Non exécutés ici (dépendances absentes), échec attendu pour modules/colonnes absents : `orders-sync`, `orders-idem-key` (`sync-order-statuses`, `recover-stuck-orders`, `alerted_at`, unicité globale actuelle), composants, hook, e2e. Les imports de base (`tests/db/...`) se transforment correctement : seul le paquet manquant stoppe.

## Commandes
- `npx vitest run tests/unit/orders/cron-orders-route.test.ts tests/unit/providers tests/unit/components tests/unit/hooks`
- `npm run test:db -- tests/db/orders-sync.test.ts tests/db/orders-idem-key.test.ts`
- `npm run test:e2e -- order-tracking.spec.ts` (serveur avec `PROVIDER_MODE=mock`, `CRON_SECRET`, `TEST_ROUTE_SECRET`)

## Réserves
- À relancer après `npm install` + Supabase local (port 55321) pour confirmer les échecs des fichiers non exécutés.
- Le test « 250 commandes = 3 appels » suppose qu'aucune autre commande `in_progress` ne traîne dans la base.
- `.env.example` doit recevoir `TEST_ROUTE_SECRET` (tâche 7.3a).
