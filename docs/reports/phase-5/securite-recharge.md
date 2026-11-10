VERDICT : ACCEPTÉ (2e passage, 2026-11-10) — aucune faille Critique, Haute ni Moyenne ouverte
Tâche : Phase 5 — Recharge SasPay (mode test), commits c2f4eab, 33b5461, eb57ede en plus de 6a5d183, 7b71894, 77f684c

== 2e PASSAGE ==
Essais réels : `npm run test:db -- tests/db/payments` sur la base Supabase locale : 4 fichiers, 94 tests verts (login et captcha OK). `npm audit --omit=dev --audit-level=high` : 0 vulnérabilité.
1. Ancien point Moyen 1 (limite 5/min) : CORRIGÉ. POST /payments consomme le limiteur (scope payments, clé user.id, 5, 60 s) après requireApiUser et avant Zod/createPayment/SasPay. Les `created` périmés sont aussi fermés.
2. Ancien point Moyen 2 (verifyPayment avant crédit) : CORRIGÉ. handle-webhook.ts appelle verifyPayment(data.id), exige status SUCCESS, et crédite avec netAmount/fee/charged renvoyés par SasPay (pas ceux du corps). creditSettlement compare net à credited_xaf, puis credit_payment recontrôle en SQL.
3. Route /api/test/saspay/settle : répond 404 si SASPAY_MODE != test, si SASPAY_API_KEY est posée, si NODE_ENV=production ou VERCEL_ENV=production. Ensuite secret x-test-secret (= SASPAY_WEBHOOK_SECRET) comparé par empreintes SHA-256 + timingSafeEqual ; secret absent = refus. Route serveur seulement, pas de NEXT_PUBLIC_, donc absente du bundle client. Elle ne crédite rien : elle modifie l'état du FAUX SasPay en mémoire et renvoie la charge ; le crédit exige encore un webhook signé puis verifyPayment puis credit_payment. getSaspay() refuse aussi le faux SasPay en VERCEL_ENV=production (ancien point Bas 4 corrigé). net_amount falsifié via settle : verifyPayment le renvoie, mismatch, aucun crédit (testé).
4. Panne SasPay : verifyPayment lève, pas de try/catch, la route répond 5xx, aucun crédit ; le rejeu crédite une seule fois (credit_payment : for update + statut + saspay_transaction_id unique). Webhook SUCCESS valide sur paiement déjà `failed` : PAYMENT_NOT_PAYABLE, alerte, aucun crédit. Rejeu parallèle : un seul crédit. Montant différent : alerte, aucun crédit. Tous couverts par les tests db verts.

Failles restantes (non bloquantes) :
- [Basse] route settle : sur un déploiement preview (VERCEL_ENV=preview) sans clé SasPay, elle reste active, protégée par le secret de webhook. Correction : ne jamais réutiliser en preview un secret de production ; la phase 15 pose une clé. Responsable : lp-coder / propriétaire (config Vercel).
- [Basse] handle-webhook.ts : verifyPayment ne prouve pas que la transaction appartient au paiement désigné par la metadata ; le risque est borné (webhook signé + unicité du transaction_id + montant). Optionnel : comparer aussi l'identifiant de session avant phase 15.
- Points Bas 3 (repli 50 paiements), 5 (failed puis payé), 6 (URL dans raw_webhook) du 1er passage : inchangés, acceptables en test, à revoir en phase 15.
- Non exécuté : tests e2e (add-funds.spec.ts) et gitleaks ; recherche de motifs sur le diff récent : rien.

== 1er PASSAGE (conservé) ==
(1er passage) VERDICT : À CORRIGER (2 points Moyens à régler avant "validé" ; aucune faille Critique ni Haute)
Tâche : Phase 5 — Recharge SasPay (mode test), commits 6a5d183, 7b71894, 77f684c

Surface examinée : routes POST /payments/quote, POST/GET /payments, GET /payments/{id}, POST /webhooks/saspay, GET /cron/payments ; fonction SQL credit_payment (migration 20261107160000, déjà appliquée, non modifiée) ; table payments (RLS + droits par colonnes) ; secrets SASPAY_*, CRON_SECRET.

Limites : pas de base locale ici. Les tests db et e2e (tests/db/payments-*.test.ts, tests/e2e/add-funds.spec.ts) n'ont PAS été lancés ; le parallélisme du crédit est jugé par lecture du SQL. Unitaires payments lancés : 5 fichiers, 68 tests verts.

Essais / vérifications (résultat réel) :
- Signature HMAC sur corps brut, `timestamp.corps`, hex 64, timingSafeEqual, secret absent = refus → OK
- Horodatage ±300 s, format numérique strict → OK
- Sans en-têtes / mauvaise signature / vieux timestamp → 'rejected' → 403 → OK (lecture + tests unitaires)
- Vérification de la signature avant tout JSON.parse → OK
- Rejeu / doublon → statut `succeeded` + `for update` + unique saspay_transaction_id dans credit_payment : un seul crédit, y compris en parallèle (verrou de ligne) → OK (lecture SQL, pas exécuté)
- Montant différent → comparaison net_amount vs credited_xaf côté TS ET côté SQL (AMOUNT_MISMATCH), alerte Telegram, aucun crédit → OK
- Lien paiement↔webhook : si metadata présente, c'est la seule source (pas de repli) ; sinon saspay_transaction_id, puis repli sur 50 paiements pending comparés à la transaction de la session SasPay. Pas de risque de créditer le mauvais paiement (identité confirmée par SasPay), seulement un coût (voir 3) → OK
- Droits : GET liste et GET {id} filtrés par user_id + RLS ; id d'un autre client ou invalide = même 404 → OK. Colonnes lisibles par `authenticated` : raw_webhook, saspay_transaction_id et idem_key non accordées → l'URL de paiement stockée dans raw_webhook n'est pas lisible via la clé publique → OK
- Idempotence : rejeu avec même clé, autre client ou autre montant = IDEMPOTENCY_CONFLICT, rien de l'autre paiement n'est renvoyé → OK
- Zod : amount entier positif, champs inconnus retirés (frais/total du navigateur ignorés), Idempotency-Key 8–100 caractères, limit ≤ 100, cursor ISO → OK
- Same-origin sur les deux POST ; webhook exempté (signature) → OK
- Cron : CRON_SECRET vide ou token vide = 401, comparaison sur empreintes SHA-256 en temps constant → OK
- Numéro de téléphone : msisdn retiré de raw_webhook ; aucun console.log dans les modules payments/saspay ; clé SasPay uniquement en en-tête Authorization, erreurs génériques PROVIDER_ERROR → OK
- Mode live sans clé : getSaspay() lève une erreur ; SASPAY_MODE=live refusé hors VERCEL_ENV=production ; préfixe de clé sk_test_/sk_live_ imposé → OK, mais voir 4
- Secrets : motifs sk_live_/sk_test_ réels, service_role, chaînes hex ≥ 40 dans le diff hors tests → aucun. Pas de NEXT_PUBLIC_ secret (loadServerEnv le refuse) → OK
- Limite de débit 5/min sur POST /payments → ÉCHEC (voir 1)
- npm audit : lancé, a dépassé 120 s (réseau) ; relancé en tâche de fond, résultat non reçu au moment du rapport → à confirmer en CI.

Recherche de secrets : recherche de motifs sur le diff 8c8754b..HEAD (gitleaks non lancé), aucun résultat.

Failles :
1. [Moyenne] src/app/api/v1/payments/route.ts (POST) — API_SPEC §5 impose 5 requêtes/min par client sur POST /payments ; rien n'est en place (RateLimiter existe dans src/server/auth/rate-limit.ts mais n'est pas utilisé). Scénario : un client authentifié enchaîne des Idempotency-Key différentes → des centaines de lignes `payments` et de sessions SasPay par minute (pollution, quota SasPay, bruit pour l'admin). Correction : consommer le limiteur (scope 'payments', clé user.id, max 5, fenêtre 60 s) avant createPayment, réponse 429 RATE_LIMITED + Retry-After, avec test. Responsable : lp-coder
2. [Moyenne] src/server/payments/handle-webhook.ts (~l.113-135) — SECURITY_NOTES §3 : verifyPayment auprès de SasPay avant tout crédit. Le webhook crédite sur la seule foi de la signature (le rattrapage, lui, appelle bien verifyPayment). Scénario : fuite ou faiblesse du secret de webhook (ou bug de signature) → faux crédit sans contre-contrôle. Correction : avant creditSettlement, appeler saspay.verifyPayment(data.id), exiger status SUCCESS et utiliser net_amount/fee/charged renvoyés (pas ceux du corps) ; en cas de panne SasPay, répondre 5xx pour que SasPay renvoie. Responsable : lp-coder (ou décision écrite du propriétaire pour déroger au document)
3. [Basse] handle-webhook.ts findPayment — repli : jusqu'à 50 appels SasPay par webhook signé sans metadata ni transaction connue ; sans risque de sécurité (signé) mais amplifiable si SasPay rejoue. Correction : acceptable en test ; borner à moins de paiements ou à la fenêtre de 30 min avant la phase 15. Responsable : lp-coder
4. [Basse] src/server/env.ts / saspay-client.ts getSaspay — SASPAY_MODE vaut 'test' par défaut ; en production sans SASPAY_API_KEY le faux SasPay est utilisé en silence (il ne paie rien, mais le site paraîtrait fonctionner et ses webhooks seraient acceptés avec le secret configuré). Correction : refuser le faux quand VERCEL_ENV=production (lever l'erreur), à poser avant la phase 15. Responsable : lp-coder
5. [Basse] transaction.failed/cancelled marque aussitôt le paiement `failed` ; si SasPay permet de réessayer dans la même session et que le client paie ensuite, credit_payment lève PAYMENT_NOT_PAYABLE → alerte propriétaire, pas de crédit (sûr, mais cas à examiner à la main). Correction : documenter dans le guide admin ; pas de blocage. Responsable : lp-coder
6. [Basse] src/server/payments/create-payment.ts — l'URL de paiement est gardée dans raw_webhook (non lisible côté client, écrasée au webhook). Acceptable ; une colonne dédiée serait plus propre (changement de schéma : accord requis). Responsable : lp-db

Conclusion : crédit unique, signature, droits, secrets et cron sont solides. Corriger 1 et 2 (ou obtenir une dérogation écrite pour 2), relancer lp-security ; les points 3 à 6 peuvent attendre la phase 15. À faire en CI/avec base : lancer tests/db et tests/e2e et confirmer npm audit.
