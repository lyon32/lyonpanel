# Phase 5 — Recharge SasPay (mode test)

Sources : `docs/06-saspay.md` (relu le 2026-11-10 contre l'OpenAPI officielle), `API_SPEC.md` (§ paiements), `DATA_MODEL.md` (`payments`, `credit_payment`), `LLD.md` §4.5.

## Décisions du propriétaire (2026-11-10)
- Frais payés par le client en plus (`ADD_ON`) : il paie montant + frais, son solde reçoit le montant.
- Recharge de 500 à 500 000 XAF (réglage `min_recharge_xaf`, pas en dur).
- Une recharge non payée expire au bout de 30 minutes.
- Pas d'argent réel ni de clés pour cette phase : tout est testé avec un **faux SasPay** et des webhooks signés par nos soins.

## Points de la doc encore inconnus (non écrits dans l'OpenAPI)
- `metadata` revient-elle dans le webhook ? Numéros de test ? → le code relie le webhook au paiement par `saspay_transaction_id` retrouvé via `GET /checkout-sessions/{id}/status/` si `metadata` est absente. À confirmer avec la vraie clé de test (action du propriétaire, hors de cette phase de code).
- Pour que `ADD_ON` s'applique : réglage du compte SasPay sur ADD_ON (action du propriétaire).

## Ordre des tâches
| # | Tâche | Agent |
|---|---|---|
| 5.0 | Plan + CLAUDE.md | chef de projet |
| 5.1 | Tests : client SasPay (faux + vrai), signature webhook, devis, création, webhook (doublon, montant différent, signature fausse, horodatage trop vieux), rattrapage, route retour | lp-tester |
| 5.2 | `saspay-client.ts` + faux SasPay (`SASPAY_MODE=test` sans clé), devis, `POST /payments`, `GET /payments[/id]`, `POST /webhooks/saspay`, cron `/api/cron/payments` | lp-coder (jusqu'à 3) |
| 5.3 | Page de recharge + page de retour dynamique (état en direct, rappel toutes les 5 s, mobile d'abord, inspirée de `payment page reference/`) | lp-designer |
| 5.4 | Relecture, test navigateur, sécurité (argent) | lp-reviewer ∥ lp-qa ∥ lp-security |
| 5.5 | Rapport, bilan, CHANGELOG | lp-reporter |

## Règles
- Le crédit passe **uniquement** par `credit_payment` ; jamais deux fois (dédoublonnage sur `data.id` + `event`).
- Créditer `net_amount` seulement s'il égale le montant demandé, sinon alerte `payment_mismatch` et aucun crédit.
- Vérifier la signature sur le corps brut, en temps constant, horodatage ±300 s ; `403` sinon, `200` rapide si valide.
- Aucune clé SasPay dans le code ou les journaux.

## Terminé quand
Statut : terminée, en attente de validation du propriétaire (2026-11-10).
- [x] En mode test, une recharge de 3 000 XAF crédite le solde **une seule fois**, même si le webhook est renvoyé.
- [x] Lint, types, tests, build verts ; `lp-security` accepté (2e passage).
- [ ] CI GitHub lue et verte (à lire sur la PR par le chef de projet).
- [x] Rapport dans `docs/reports/phase-5/` et résumé en français simple (`bilan.md`).
- [ ] Validation du propriétaire (« validé »).
