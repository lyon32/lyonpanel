# SasPay — ce qu'on sait (lu le 2026-11-07 sur docs.saspay.me)

Source de vérité pour l'intégration. Les autres documents renvoient ici.
« (à vérifier) » = non écrit dans la doc, à confirmer en mode test (Phase 5) ou auprès du support SasPay.

## 1. Bases

- **Adresse API** : `https://api.saspay.me/api/v1` (une seule adresse pour test et production).
- **Clé** : en-tête `Authorization: Bearer sk_...`. `sk_test_...` = test (sans vrai argent), `sk_live_...` = production. Portée de la clé : `PAYIN` ou `BOTH`.
- **Réponses** : enveloppe `{ success, data | error, code }` ; erreurs métier avec `code` stable (ex. `insufficient_balance`).
- **Limite** : 300 requêtes/min par compte (sinon `429`).
- **Idempotence** : en-tête `Idempotency-Key` accepté sur softpay, retry, payouts. **Pas** sur `POST /checkout-sessions/` → c'est notre propre clé (`payments.idem_key`) qui empêche la double création.
- La doc propose un skill IA officiel : `docs.saspay.me/ai/skill` (à lire en Phase 5).

## 2. Méthode choisie : page de paiement hébergée (checkout)

Mon choix : **checkout hébergé** plutôt que « softpay » (paiement poussé), car SasPay affiche lui-même les opérateurs, gère Wave / Orange Money / carte (qui exigent une redirection) et les codes OTP.

`POST /checkout-sessions/`

| Champ | Requis | Valeur LyonPanel |
|---|---|---|
| `amount` | oui | texte décimal, ex. `"5000.00"` (montant **crédité** au client) |
| `currency` | oui | `XAF` ou `XOF` selon le pays du client |
| `customer_email` | oui | email du client |
| `customer_name` | oui | nom affiché (l'email si pas de nom, à vérifier) |
| `customer_phone` | non | téléphone du profil |
| `country` | non | pays du profil (pré-sélection) |
| `return_url` | non | `https://lyonpanel.com/<langue>/recharger/<payment_id>` |
| `metadata` | non | `{ "lyonpanel_payment_id": "<uuid>" }` |
| `fee_charge_mode` | non | **`ADD_ON`** : le client paie les frais en plus (décidé) |
| `expires_at` | non | +30 min (mon choix) |

Réponse : `id` (session), `checkout_url` (on y redirige le client), `status: PENDING`, `transaction` (null au départ).

- **Retour** : SasPay redirige vers `return_url` 3 s après un paiement **réussi** uniquement. En cas d'échec, pas de redirection : notre page de statut doit rester utile si le client revient par lui-même.
- **Frais** : pour que `ADD_ON` s'applique, régler le **mode par défaut sur ADD_ON** dans le tableau de bord SasPay (Paramètres → Frais), ou activer `ALLOW_CLIENT_OVERRIDE`. 🧑 À faire par le propriétaire.
- **Statut d'une session** : `GET /checkout-sessions/{id}/status/` (rattrapage).
- **Vérification** : `GET /payments/{payment_id}/verify/` → ne créditer que si `SUCCESS`.
- **Tarifs** : `GET /pricing/my-rates/` (frais par opérateur) → estimation des frais affichée avant paiement.

Statuts : `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`.

## 3. Webhooks

- Créés **uniquement dans le tableau de bord** SasPay, un par environnement. Événements : `transaction.success`, `transaction.failed`, `transaction.cancelled` (+ `webhook.test`).
- **Secret de signature affiché une seule fois** → le copier tout de suite dans `SASPAY_WEBHOOK_SECRET`.
- En-têtes : `X-Webhook-Signature` (HMAC-SHA256, hexadécimal minuscule), `X-Webhook-Timestamp` (secondes Unix), `X-Webhook-Event`.
- **Vérification** :
  1. refuser si l'horodatage diffère de plus de **300 s** ;
  2. calculer `HMAC_SHA256(secret, timestamp + "." + corps_brut)` en hexadécimal ;
  3. comparer en **temps constant** (`timingSafeEqual`) ;
  4. utiliser le **corps brut**, jamais le JSON reformaté.
- Charge utile : `{ "event": "...", "data": { id, reference, status, amount, fee, charged, net_amount, fee_charge_mode, currency, country, network, msisdn } }`.
  - En `ADD_ON` : le client paie `charged` (montant + frais), on reçoit `net_amount` (= montant).
  - On crédite **`net_amount`**, après avoir vérifié qu'il est égal au montant demandé.
- **Doublons** : dédoublonner sur `data.id` + `event` (signature et horodatage changent à chaque essai).
- **Réponse** : `200` rapide (< 15 s) si valide ; `403` si signature ou horodatage invalide.
- **Renvois** : 5 essais (immédiat, 30 s, 5 min, 30 min, 2 h) puis abandon → notre **rattrapage toutes les 5 min** est indispensable.

## 4. Lien session ↔ transaction (à vérifier)

La doc n'explique pas comment relier le webhook (`data.id`) à la session de checkout. Plan :
1. envoyer `metadata.lyonpanel_payment_id` et vérifier en test s'il revient dans le webhook ;
2. sinon, retrouver la session via `GET /checkout-sessions/{id}/status/` (champ `transaction`) ;
3. en dernier recours, demander au support SasPay.

## 5. Pays, devises, opérateurs

- `GET /countries/` (public) renvoie le référentiel de **tous** les pays du monde : ce n'est pas la liste des pays où le paiement fonctionne.
- `GET /networks/` (avec clé) liste les opérateurs actifs, à filtrer par pays.
- Au lancement, LyonPanel accepte les pays en **XAF** (Cameroun, Congo, Gabon, Tchad, Centrafrique, Guinée équatoriale) et **XOF** (Sénégal, Côte d'Ivoire, Bénin, Burkina Faso, Mali, Niger, Togo, Guinée-Bissau), **seulement là où SasPay a un opérateur actif** (liste construite en Phase 5).
- 1 XOF = 1 XAF pour le solde (même valeur).

## 6. Mode test

- Clé `sk_test_...`. La doc ne décrit ni numéros de test ni résultats simulés (à vérifier en Phase 5).

## 7. À faire par le propriétaire (avant Phase 5)

1. Créer le compte sur app.saspay.me et faire la vérification d'identité (KYC).
2. Récupérer la clé `sk_test_...` (portée PAYIN).
3. Mettre le mode de frais par défaut sur **ADD_ON**.
4. Créer le webhook de test (URL donnée en Phase 5) et copier son secret.
5. Noter les pays et opérateurs activés sur le compte.
