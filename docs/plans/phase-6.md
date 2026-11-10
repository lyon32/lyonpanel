# Phase 6 — Commande

Sources : `ROADMAP.md` (phase 6), `API_SPEC.md` §6.5 et §3, `DATA_MODEL.md` §6 (`place_order`), `LLD.md` §4.3 et §4.5, `docs/01-catalogue-et-prix.md`, `SECURITY_NOTES.md`.
Tout se fait avec le **faux fournisseur** (`PROVIDER_MODE=mock`) : aucun argent réel, aucune vraie commande.

## Décisions du propriétaire (2026-11-10, ne pas redemander)
1. Le lien doit correspondre à la plateforme du service (ex. service TikTok = lien TikTok), sinon `INVALID_LINK` avec un message clair.
2. Quantité min/max du catalogue respectée **sans exception** (`QUANTITY_OUT_OF_RANGE`).
3. Plafond journalier par client : **100 000 XAF** sur 24 h glissantes, en **réglage** `daily_order_cap_xaf` (pas en dur). Atteint → `DAILY_LIMIT_REACHED`.
4. Échec chez le fournisseur : commande en `to_review`, propriétaire alerté (`order_failed`), **aucun remboursement ni renvoi automatique**. Le client voit « en cours de vérification ».
5. Solde insuffisant : message « Il vous manque X XAF » (`details.missing_xaf`) avec un bouton vers la recharge.
6. Commentaires personnalisés **seulement** pour les services qui les acceptent (nombre de lignes = quantité).

## Points de départ déjà dans le code
- `place_order` existe (migration `20261107120000`, durcie en `…160000`) : verrou du portefeuille, idempotence par `idem_key`, prix recalculé, remise, débit, journal. Il lit aujourd'hui `profiles.daily_spend_limit_xaf` (défaut 500 000) → à remplacer par le réglage (tâche 6.2).
- `computeOrderTotalXaf` (`server/pricing`), faux fournisseur (`server/providers/mock-provider.ts`), `provider.add`, table `idempotency_keys`, `rate_limits`.
- Pages vides `src/app/[locale]/(app)/order` et `orders`.

## Règles
- Prix **toujours recalculé côté serveur** ; `expected_total_xaf` ≠ total recalculé → `422 PRICE_CHANGED` avant tout débit.
- L'argent bouge **uniquement** par `place_order`. Jamais de `update` direct sur un solde.
- `provider.add` : **une seule tentative**, jamais relancée automatiquement (risque de double commande). Délai max 10 s.
- Si `add` échoue ou expire après le débit : commande `to_review` + alerte + réponse `202`. Pas de remboursement.
- Double clic (même `Idempotency-Key`) = une seule commande, un seul débit, même réponse. Même clé + contenu différent = `409 IDEMPOTENCY_CONFLICT`.
- Limite `POST /orders` : 10 par minute par client (`RATE_LIMITED`).
- Le client ne voit jamais coût, marge, multiplicateur, nom du fournisseur ni message brut du fournisseur.
- Alerte fournisseur : si le solde fournisseur passe sous le réglage `provider_low_balance_usd` (5 $), alerte `low_provider_balance` ; si le solde ne couvre pas la commande → `SERVICE_UNAVAILABLE` (LLD §4.3 étape 4).
- Messages FR/EN dans `messages/errors.{fr,en}.json` et textes d'écran.

## Hors périmètre
Suivi des statuts et alertes Telegram réelles (phase 7 : ici `notifyOwner` ne fait qu'appeler l'interface existante, sans envoi réel hors test), espace client (phase 8), vrai fournisseur et vrais paiements (phase 15), remboursement/renvoi admin (phase 10).

## Ordre des tâches
| # | Tâche | Agent | Fichiers |
|---|---|---|---|
| 6.0 | Plan + CLAUDE.md | chef de projet | `docs/plans/phase-6.md`, `CLAUDE.md` |
| 6.1 | Tests d'abord : validation de lien par plateforme, devis, `placeOrder` (idempotence, PRICE_CHANGED, solde insuffisant, plafond, quantité, commentaires), `submitToProvider` (succès, échec, délai, jamais de 2e appel), routes `/orders/quote`, `/orders`, `GET /orders[/id]`, limite 10/min, tests base (réglage, commentaires), e2e `order.spec.ts` | lp-tester | `tests/**` |
| 6.2 | Migration : réglage `daily_order_cap_xaf` = 100 000 (seed + migration), `place_order` lit le réglage (`least` avec la colonne client), contrôle des commentaires ; types régénérés | lp-db | `supabase/migrations/<nouvelle>`, `supabase/seed.sql`, `src/server/db/types.ts` |
| 6.3a | `validate-link.ts` (plateformes), `schemas/order.ts` (Zod), devis | lp-coder A | `src/server/orders/validate-link.ts`, `src/server/schemas/order.ts`, `src/server/orders/quote.ts` |
| 6.3b | `place-order.ts`, `submit-to-provider.ts` (échec → `to_review` + `notifyOwner`) | lp-coder B | `src/server/orders/place-order.ts`, `submit-to-provider.ts` |
| 6.3c | Routes `POST /orders/quote`, `POST /orders`, `GET /orders`, `GET /orders/{id}`, messages d'erreur FR/EN, `openapi.yaml` | lp-coder C (après A et B) | `src/app/api/v1/orders/**`, `messages/errors.*.json`, `openapi.yaml` |
| 6.4 | Écran : formulaire de commande (service, lien, quantité, commentaires), devis en direct (anti-rebond 300 ms), progression par étapes (envoi, débit, transmission), état « en cours de vérification », message solde insuffisant + bouton recharge, mobile d'abord | lp-designer | `src/app/[locale]/(app)/order/**`, `src/components/order/**`, `src/hooks/**`, textes FR/EN |
| 6.5 | Relecture, test navigateur, sécurité (argent) | lp-reviewer ∥ lp-qa ∥ lp-security | lecture seule |
| 6.6 | Rapport, bilan, CHANGELOG | lp-reporter | `docs/reports/phase-6/` |

6.3a et 6.3b n'ont aucun fichier en commun : elles peuvent tourner en parallèle. 6.3c attend les deux. 6.4 attend 6.3c. Pas de `lp-seo` : les pages sont privées (noindex).

## Règle donnée à chaque sous-agent
« graphify : si `graphify-out/graph.json` existe, lancer `graphify query "<question>"` avant votre premier grep ou lecture de code ; lire un fichier brut seulement pour les lignes déjà repérées. Après toute modification de code, lancer `graphify update .`. »

## Terminé quand
Statut : validée par le propriétaire (2026-11-10).
- [x] Une commande débite le bon montant (ex. 1 000 abonnés à 1 155 XAF → solde −1 155 XAF).
- [x] Double clic = une seule commande, un seul débit.
- [x] Solde insuffisant = « Il vous manque X XAF » + bouton vers la recharge.
- [x] Échec fournisseur simulé = `to_review`, alerte, aucun remboursement, client voit « en cours de vérification ».
- [x] Lien d'une autre plateforme refusé ; quantité hors limites refusée ; plafond 100 000 XAF appliqué ; commentaires refusés si le service n'en accepte pas.
- [x] Lint, types, tests, build verts ; `lp-security` accepté.
- [x] CI GitHub lue sur la PR (vraie CI, pas supposée) et verte : exécution 42855000877, job `ci` réussi (12 min 57 s), Vercel vert.
- [x] Rapport dans `docs/reports/phase-6/` et résumé en français simple (`bilan.md`).
- [x] Validation du propriétaire (« valide », écrit par lui dans la session, 2026-11-10).
