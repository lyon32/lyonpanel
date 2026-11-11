# Phase 7 — Suivi des commandes + alertes

Sources : `ROADMAP.md` (phase 7), `API_SPEC.md` §6.5 et §7 (cron), `DATA_MODEL.md` (`orders`), `LLD.md` §4.3 et §4.5, `ARCHITECTURE.md` §5.5, `ENV_SETUP.md` §4, `docs/reports/phase-6/bilan.md`.
Tout se fait avec le **faux fournisseur** (`PROVIDER_MODE=mock`) et un **faux Telegram** en tests : aucun argent réel, aucun vrai fournisseur.

## Décisions du propriétaire (2026-11-10, ne pas redemander)
1. **Commande restée « en envoi »** (`status='pending'` et `error='submitting'`) depuis plus de **5 minutes** après un plantage : passer en `to_review` + alerte. **Jamais** de renvoi de `provider.add`.
2. **Partiel ou annulé chez le fournisseur** : `to_review` + alerte, **sans remboursement automatique**. Le client voit « en cours de vérification ». Le propriétaire décide (phase 12).
3. **Telegram** : faux Telegram dans les tests ; un vrai message `[TEST]` seulement à la fin, quand le propriétaire a créé le bot (🧑 `ENV_SETUP.md §4`). Le jeton et le `chat_id` vont dans `.env.local`, **jamais** dans le dépôt.
4. **Une seule alerte par commande et par type** (le cron passe toutes les 10 min : pas de spam). Mémorisée dans une colonne `orders.alerted_at` (changement de schéma minimal, validé avec ce plan).

## Points de départ déjà dans le code
- `submitToProvider` (échec → `to_review` + `notifyOwner('order_failed')`), `notifyOwner` dans `src/server/providers/telegram.ts` (sans variables : ne fait rien), route cron modèle `src/app/api/cron/payments/route.ts` + `assertCronSecret`.
- Faux fournisseur `mock-provider.ts` : `status()` renvoie toujours `Pending` → il faut le faire avancer pour que « une commande passe seule à terminée ».
- Écran `src/components/order/*`, page `src/app/[locale]/(app)/orders` vide, `GET /orders` et `GET /orders/{id}` existent.
- `orders.idem_key` est unique pour toute la base ; le secret de `fail-next` réutilise `SASPAY_WEBHOOK_SECRET`.
- Alerte `low_provider_balance` (5 $) déjà dans `placeOrder` : ne pas toucher.

## Règles
- Cron `/api/cron/orders` : `CRON_SECRET`, lots de **100** commandes `in_progress`, un seul appel `provider.status(ids)` par lot, délai 10 s.
- Statuts fournisseur → `in_progress` / `completed` / `to_review` (partiel, annulé, inconnu). `start_count` et `remains` mis à jour. Aucune écriture de solde (pas de remboursement).
- Une commande déjà `completed` ou `to_review` n'est plus relue ; le cron est rejouable sans effet de bord.
- Le client ne voit jamais le nom du fournisseur ni le message brut ; progression calculée = `(quantity − remains) / quantity`.
- Polling client : toutes les **30 s**, seulement si l'onglet est visible et la commande non terminée, arrêt à `completed`/`to_review`. Pas de `useEffect` pour charger des données (hook de requête existant du projet).
- `notifyOwner` : préfixe `[TEST]` quand `VERCEL_ENV !== 'production'`.
- Alertes : une par commande et par type (`orders.alerted_at`), jamais de secret dans le message.
- `fail-next` : secret dédié `TEST_ROUTE_SECRET` (plus `SASPAY_WEBHOOK_SECRET`), `.env.example` mis à jour.
- Aucune nouvelle bibliothèque.

## Hors périmètre
Espace client complet (phase 8), vrai fournisseur et vrais paiements (phase 15), remboursement/renvoi/clôture admin (phase 12), Worker Cloudflare réel (phase 13 ; ici le cron s'appelle à la main ou par test), interdiction `mock` + `SASPAY_MODE=live` (phase 15).

## Ordre des tâches
| # | Tâche | Agent | Fichiers |
|---|---|---|---|
| 7.0 | Plan + CLAUDE.md | chef de projet | `docs/plans/phase-7.md`, `CLAUDE.md` |
| 7.1 | Tests d'abord : `syncOrderStatuses` (transitions, lots de 100, partiel/annulé → `to_review`, rejouable, une alerte), rattrapage `submitting` (> 5 min, jamais de 2e `add`), route cron (secret, 401), `notifyOwner` (préfixe `[TEST]`, sans variables, jamais de levée), tests base (`idem_key` unique par `(user_id, idem_key)`, `alerted_at`), badges et barre de progression (composants), polling 30 s, e2e `order-tracking.spec.ts` | lp-tester | `tests/**` |
| 7.2 | Migration : `idem_key` unique `(user_id, idem_key)` (retirer l'unicité globale, `place_order` inchangé en logique), colonne `orders.alerted_at`, types régénérés | lp-db | `supabase/migrations/<nouvelle>`, `src/server/db/types.ts` |
| 7.3a | Faux fournisseur qui avance (Pending → In progress → Completed, un pas par appel `status`) + route de test pour forcer partiel/annulé ; secret `TEST_ROUTE_SECRET` ; `notifyOwner` préfixe `[TEST]` | lp-coder A | `src/server/providers/mock-provider.ts`, `telegram.ts`, `src/app/api/test/**`, `src/server/env.ts`, `.env.example` |
| 7.3b | `sync-order-statuses.ts` + `recover-stuck-orders.ts` + route `GET /api/cron/orders`, `openapi.yaml` | lp-coder B | `src/server/orders/**`, `src/app/api/cron/orders/route.ts`, `openapi.yaml` |
| 7.4 | Écrans : badges de statut, barre de progression, polling 30 s, liste `/orders` avec statuts, mobile d'abord, FR/EN (`antislop-copywriting`) | lp-designer (après 7.3) | `src/app/[locale]/(app)/orders/**`, `src/components/order/**`, `src/hooks/**`, `messages/**` |
| 7.5 | Relecture, navigateur, sécurité (cron, alertes, secret de test) | lp-reviewer ∥ lp-qa ∥ lp-security | lecture seule |
| 7.6 | Rapport, bilan, CHANGELOG | lp-reporter | `docs/reports/phase-7/` |

7.3a et 7.3b n'ont aucun fichier en commun (7.3b lit le faux fournisseur via l'interface) : elles peuvent tourner en parallèle après 7.2. 7.4 attend 7.3. Pas de `lp-seo` : pages privées.

## Règle donnée à chaque sous-agent
« graphify : si `graphify-out/graph.json` existe, lancer `graphify query "<question>"` avant votre premier grep ou lecture de code ; lire un fichier brut seulement pour les lignes déjà repérées. Après toute modification de code, lancer `graphify update .`. »

## Terminé quand
- [x] Une commande passe seule de « en cours » à « terminée » (cron + faux fournisseur), la page se met à jour sans recharger.
- [x] Partiel ou annulé → « à vérifier » + une seule alerte, aucun remboursement.
- [x] Commande bloquée « en envoi » > 5 min → « à vérifier » + alerte, aucun 2e `add`.
- [x] Échec fournisseur → alerte Telegram (faux en test ; vrai `[TEST]` si le bot est créé).
- [x] `idem_key` unique par client ; secret `TEST_ROUTE_SECRET` dédié.
- [x] Lint, types, tests, build verts ; `lp-security` accepté.
- [x] CI GitHub lue sur la PR (vraie CI) et verte.
- [x] Rapport dans `docs/reports/phase-7/` et résumé en français simple.
- [x] Validation du propriétaire (« valide », écrit par lui, 2026-11-10).
