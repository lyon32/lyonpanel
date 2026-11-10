# Relecture Phase 5 — Recharge SasPay (mode test), 2e passage

VERDICT : ACCEPTÉ (sous réserve de 2 accords du propriétaire sur des documents validés, voir plus bas)

Vérifications relancées (résultat réel) :
- lint : 0 erreur, 8 avertissements max-lines (anciens fichiers)
- typecheck : propre
- build : OK
- tests unitaires : 83 fichiers, 1124/1124 OK (avec --maxWorkers=4 ; à pleine charge, seuls des « Timeout waiting for worker » apparaissent, sans lien avec le code)
- test:db : 16 fichiers, 373/373 OK. Un premier passage a donné 11 échecs (réglages, limiteur, paiements) qui ont disparu en isolé puis en relance complète : base partagée utilisée en même temps par un autre agent. À ne pas lancer deux suites en parallèle. seed.test.ts (correctif lp-tester) passe.
- couverture : non mesurée.

Points « Important » du 1er passage :
1. Limite 5/min : LEVÉE. route.ts applique createRateLimiter (scope payments, 5/60 s) avant tout appel SasPay ; test tests/unit/payments/payments-rate-limit.test.ts.
2. DATA_MODEL.md 500 / 500 000 : NON LEVÉ par moi, décision du propriétaire requise (voir ci-dessous).

Suggestion du 1er passage reprise : les `created` périmés passent à `failed` dans reconcile.ts, avec test db.

Contrôle des nouveaux commits :
- 33b5461 : le webhook ne crédite plus d'après son corps, il redemande la transaction (verifyPayment) et crédite avec ces montants ; une panne SasPay remonte en 5xx (le webhook sera renvoyé), pas de crédit. Faux SasPay refusé si VERCEL_ENV=production. Route de test settle : 404 hors mode test / si clé SasPay présente / en production, secret en temps constant. Conforme.
- c2f4eab : fermeture des `created` de plus de 30 min via update de statut (pas de mouvement d'argent). Conforme.
- Aucun secret, aucun nom de fournisseur côté client.

Documents validés à faire confirmer par le propriétaire (non faits, à signaler) :
- DATA_MODEL.md : minimum 500 / maximum 500 000 XAF (décision 2026-11-10).
- LLD.md §4.4 : le résultat 'ignored' du webhook n'y figure pas (aucune occurrence) ; à ajouter. La route de test /api/test/saspay/settle n'est pas non plus dans LLD.md ni API_SPEC.md ; à ajouter (ou à accepter comme outil de test non documenté).
- URL de paiement stockée dans payments.raw_webhook : provisoire, une colonne dédiée demande son accord.

Suggestion restante : payment-status.tsx, ternaires imbriqués, extraire une table d'états.
