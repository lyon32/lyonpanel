# LyonPanel — Spécification de l'API

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Fichier technique équivalent : [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1).
Liés : `ARCHITECTURE.md` (flux), `DATA_MODEL.md` (tables).

## 0. Décisions prises en compte

| # | Décision |
|---|---|
| 1 | Messages d'erreur en **français et anglais** |
| 2 | Document lisible **et** fichier OpenAPI |
| 3 | API revendeurs : **plus tard** (esquisse §9, non construite) |
| 4 | Session client : **7 jours** |
| 5 + 9 | Admin : page de connexion **séparée, à adresse secrète**, non indexée ; `/admin` renvoie 404 |
| 6 | Admin : code à 6 chiffres (application d'authentification) en plus du mot de passe |
| 7 | Limite de commandes : **10 par minute** par client |
| 8 | L'API renvoie **toujours des XAF** ; le site convertit pour l'affichage avec le taux de `/settings/public` |
| 10 | Site entier en **français et anglais** |
| 11 | Connexion par **email ou téléphone**, au choix |
| 12 | 5 essais ratés → blocage **15 minutes** |
| 13 | Le statut des commandes se rafraîchit **toutes les 30 s** |

## 1. Généralités

- Base : `https://lyonpanel.com/api/v1` (routes Next.js sur Vercel). Préfixe `v1` pour changer l'API sans casser les anciens clients.
- Format : JSON, UTF-8. Dates en ISO 8601 UTC (`2026-11-07T14:03:00Z`).
- **Langue** : en-tête `Accept-Language: fr` ou `en` (sinon langue du profil, sinon `fr`). Le **code** d'erreur ne change jamais ; seul le message est traduit.
- **Argent** : entiers en XAF, champs suffixés `_xaf` (`charged_xaf: 1155`). Jamais de décimales, jamais de prix JAP ni de marge côté client.
- **Idempotence** : en-tête `Idempotency-Key` (UUID généré par le navigateur) **obligatoire** sur `POST /orders` et `POST /payments`. Même clé = même réponse, aucun double débit.
- **Pagination** : par curseur. Requête `?limit=20&cursor=…` (limit max 100). Réponse `{ "data": [...], "next_cursor": "…" | null }`.
- **Identifiant de requête** : chaque réponse a l'en-tête `X-Request-Id`, repris dans les erreurs (pour le support).

## 2. Authentification

| Qui | Mécanisme |
|---|---|
| Client | Session **Supabase Auth** en cookies `httpOnly`, `Secure`, `SameSite=Lax`, gérée par `@supabase/ssr`. Durée **7 jours** d'inactivité, renouvelée automatiquement |
| Admin | Même session + `profiles.is_admin = true` + **MFA TOTP** Supabase (niveau `aal2`) exigé sur toutes les routes `/admin/*` |
| Webhook SasPay | `X-Webhook-Signature` = HMAC-SHA256 hex de `timestamp + "." + corps brut`, `X-Webhook-Timestamp` à ± 300 s (détails : `docs/06-saspay.md §3`) |
| Tâches cron | En-tête `Authorization: Bearer <CRON_SECRET>` |
| Public | Aucune (catalogue, réglages publics) |

- **Anti-bot** : jeton Cloudflare Turnstile (`turnstile_token`) obligatoire pour inscription, connexion, mot de passe oublié.
- **Connexion par téléphone** : le serveur retrouve l'email lié au numéro puis ouvre la session ; il répond la même erreur que le compte existe ou non (pas de fuite d'information).
- **Blocage** : 5 échecs pour un même identifiant ou une même adresse IP → `429 AUTH_LOCKED` pendant 15 min.
- **Admin caché** : la page de connexion admin vit à une adresse définie par la variable secrète `ADMIN_PATH` (ex. `/k7q2-…`), avec `noindex, nofollow`, absente du sitemap et de `robots.txt`. `/admin` et toute autre adresse renvoient 404. Les routes API admin renvoient **404** (et non 403) à toute personne non admin (mon choix, pour ne pas révéler leur existence).
- **CSRF** : cookies `SameSite=Lax` + vérification de l'en-tête `Origin` sur toutes les requêtes qui modifient des données (mon choix).

## 3. Format d'erreur (unique, obligatoire partout)

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Solde insuffisant. Il vous manque 1 200 XAF.",
    "details": { "missing_xaf": 1200 },
    "request_id": "req_8f3a2c"
  }
}
```

- `code` : constante en MAJUSCULES, stable, utilisée par le site pour réagir.
- `message` : phrase claire pour l'utilisateur, dans sa langue.
- `details` : facultatif, données utiles (champ fautif, montant manquant…). Pour les erreurs de formulaire : `{ "fields": { "phone": "PHONE_TAKEN" } }`.
- `request_id` : à donner au support.
- Jamais de trace technique, de requête SQL ou de message JAP/SasPay brut dans la réponse.

### Codes d'erreur

| Code | HTTP | Sens |
|---|---|---|
| VALIDATION_ERROR | 400 | Champ manquant ou invalide (`details.fields`) |
| TURNSTILE_FAILED | 400 | Vérification anti-bot échouée |
| UNAUTHENTICATED | 401 | Pas connecté ou session expirée |
| INVALID_CREDENTIALS | 401 | Identifiant ou mot de passe incorrect |
| MFA_REQUIRED | 401 | Code à 6 chiffres requis (admin) |
| ACCOUNT_BLOCKED | 403 | Compte bloqué par le propriétaire |
| NOT_ADMIN | 403 | Fonction SQL réservée au propriétaire |
| NOT_FOUND | 404 | Ressource absente (ou route admin pour un non-admin) |
| ORDER_NOT_FOUND / PAYMENT_NOT_FOUND / USER_NOT_FOUND | 404 | Commande, paiement ou client introuvable (fonctions SQL) |
| EMAIL_TAKEN / PHONE_TAKEN | 409 | Déjà utilisé |
| IDEMPOTENCY_CONFLICT | 409 | Même clé réutilisée avec un contenu différent |
| ALREADY_REFUNDED | 409 | Commande déjà remboursée (un seul remboursement par commande) |
| PAYMENT_NOT_PAYABLE | 409 | Paiement `failed` : crédit refusé |
| INSUFFICIENT_BALANCE | 422 | Solde client trop bas (`details.missing_xaf`) |
| QUANTITY_OUT_OF_RANGE | 422 | Hors min/max (`details.min`, `details.max`) |
| INVALID_LINK | 422 | Lien non accepté pour ce service |
| SERVICE_UNAVAILABLE | 422 | Service inactif, retiré, ou solde JAP insuffisant |
| PRICE_CHANGED | 422 | Prix modifié depuis le devis (`details.new_total_xaf`) |
| DAILY_LIMIT_REACHED | 422 | Plafond de dépense sur 24 h atteint (`details.limit_xaf`) |
| AMOUNT_BELOW_MINIMUM | 422 | Recharge sous le minimum (`details.min_xaf`) |
| AMOUNT_MISMATCH | 422 | Montant reçu différent du montant demandé (paiement non crédité) |
| AMOUNT_TOO_HIGH | 422 | Remboursement supérieur au montant débité |
| INVALID_AMOUNT | 422 | Montant nul, négatif ou incohérent |
| NOTE_REQUIRED | 422 | Note obligatoire pour un ajustement manuel |
| FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED | 422 | Pièce jointe refusée |
| RATE_LIMITED | 429 | Trop de requêtes (en-tête `Retry-After`) |
| AUTH_LOCKED | 429 | 5 échecs de connexion, attendre 15 min |
| PROVIDER_ERROR | 502 | SasPay ou JAP a répondu une erreur |
| PROVIDER_TIMEOUT | 504 | SasPay ou JAP n'a pas répondu à temps |
| INTERNAL_ERROR | 500 | Erreur inattendue (alerte Telegram envoyée) |

## 4. Codes HTTP utilisés

| Code | Quand |
|---|---|
| 200 OK | Lecture ou modification réussie |
| 201 Created | Création (compte, commande, paiement, ticket) |
| 202 Accepted | Commande enregistrée mais envoi JAP en vérification (`to_review`) |
| 204 No Content | Suppression, déconnexion |
| 400, 401, 403, 404, 409, 422, 429 | Erreurs client (voir §3) |
| 500, 502, 504 | Erreurs serveur ou fournisseur |

## 5. Limites de débit

| Route | Limite |
|---|---|
| `POST /auth/login` | 5 échecs / 15 min par identifiant et par IP |
| `POST /auth/register`, `/auth/password/forgot` | 5 / heure par IP |
| `POST /orders` | **10 / minute** par client |
| `POST /payments` | 5 / minute par client |
| `POST /tickets`, messages | 10 / heure par client |
| Lectures (`GET`) | 120 / minute par client |

Stockage des compteurs : table Postgres dédiée ou Cloudflare (mon choix : règles de débit Cloudflare gratuites pour l'IP + compteur Postgres par client).

## 6. Endpoints client

### 6.1 Authentification
| Méthode | Chemin | Corps → Réponse |
|---|---|---|
| POST | `/auth/register` | `{email, password, phone, country, display_currency, language, referral_code?, turnstile_token}` → **201** `{user}` + cookie de session |
| POST | `/auth/login` | `{identifier, password, turnstile_token}` (identifier = email **ou** téléphone) → **200** `{user}` |
| POST | `/auth/logout` | — → **204** |
| POST | `/auth/password/forgot` | `{email, turnstile_token}` → **200** toujours (même si l'email n'existe pas) ; email envoyé par SMTP Hostinger |
| POST | `/auth/password/reset` | `{token, new_password}` → **200** |

Mot de passe : 8 caractères minimum (mon choix). Téléphone : format international E.164.

### 6.2 Profil
| Méthode | Chemin | Détail |
|---|---|---|
| GET | `/me` | `{id, email, phone, country, display_currency, language, referral_code, discount_pct, created_at}` |
| PATCH | `/me` | `{display_currency?, language?, phone?}` → 200 `{user}` |
| DELETE | `/me` | `{password}` → **204** ; anonymise le compte (DATA_MODEL §6) |

### 6.3 Solde et transactions
| GET | `/wallet` | `{balance_xaf, total_recharged_xaf, discount_pct, next_discount_threshold_xaf}` |
|---|---|---|
| GET | `/wallet/transactions` | liste paginée `{id, type, amount_xaf, balance_after_xaf, order_short_id?, created_at}` |

### 6.4 Catalogue (public, mis en cache 5 min)
| GET | `/platforms` | `[{slug, name, service_count}]` |
|---|---|---|
| GET | `/services?platform=tiktok&category=followers&q=` | liste paginée de `Service` |
| GET | `/services/{id}` | `Service` |
| GET | `/settings/public` | `{usd_xaf_rate, xof_xaf_rate: 1, min_recharge_xaf, currencies}` |

`Service` = `{id, platform, category, name, description, price_xaf_1000, min_qty, max_qty, refill, cancel, guarantee_days?, avg_start?, type}`.
Le client ne reçoit **jamais** `cost_usd`, `margin_pct` ni le nom JAP.

### 6.5 Commandes
| Méthode | Chemin | Détail |
|---|---|---|
| POST | `/orders/quote` | `{service_id, quantity}` → `{price_xaf_1000, discount_pct, total_xaf, balance_after_xaf}` (aucun débit) |
| POST | `/orders` | en-tête `Idempotency-Key` ; `{service_id, link, quantity, comments?: string[], expected_total_xaf}` → **201** `Order` (`in_progress`) ou **202** `Order` (`to_review`) |
| GET | `/orders?status=` | liste paginée de `Order` |
| GET | `/orders/{id}` | `Order` — le site le rappelle **toutes les 30 s** tant que le statut n'est pas final |

`Order` = `{id, short_id, service: {id, name, platform}, link, quantity, charged_xaf, status, start_count, remains, created_at, updated_at}`.
Si `expected_total_xaf` ≠ total recalculé → `422 PRICE_CHANGED` (le client revoit le prix avant débit).
`comments` : obligatoire pour les services « commentaires personnalisés », une ligne par commentaire, nombre = quantité.

### 6.6 Recharges
| Méthode | Chemin | Détail |
|---|---|---|
| POST | `/payments/quote` | `{amount_xaf}` → `{amount_xaf, fee_xaf, total_to_pay}` |
| POST | `/payments` | en-tête `Idempotency-Key` ; `{amount_xaf}` → **201** `{id, status: "pending", checkout_url}` ; `checkout_url` = page hébergée SasPay (`POST /checkout-sessions/`, frais `ADD_ON`) |
| GET | `/payments` | liste paginée `{id, amount_xaf, fee_xaf, status, created_at}` |
| GET | `/payments/{id}` | même forme ; le site le rappelle toutes les 5 s sur la page de retour (mon choix) |


Correspondance avec la base : `amount_xaf` (API) = `payments.credited_xaf` ; `fee_xaf` = `payments.fee_xaf` ; `total_to_pay` = `payments.total_paid`.
### 6.7 Favoris
| GET | `/favorites` | `[Service]` |
|---|---|---|
| PUT | `/favorites/{service_id}` | **204** |
| DELETE | `/favorites/{service_id}` | **204** |

### 6.8 Tickets
| Méthode | Chemin | Détail |
|---|---|---|
| GET | `/tickets` | liste paginée `{id, subject, status, order_short_id?, updated_at}` |
| POST | `/tickets` | `{subject, order_id?, body, attachment_ids?}` → **201** |
| GET | `/tickets/{id}` | `{ticket, messages: [{id, from_admin, body, attachments: [{id, url}], created_at}]}` (URL signées, 10 min) |
| POST | `/tickets/{id}/messages` | `{body, attachment_ids?}` → **201** |
| POST | `/tickets/attachments` | `multipart/form-data`, image jpeg/png/webp ≤ 2 Mo → **201** `{id}` |

### 6.9 Parrainage
| GET | `/referral` | `{code, link, referred_count, total_earned_xaf, pct: 5}` |
|---|---|---|

## 7. Endpoints système

| Méthode | Chemin | Auth | Rôle |
|---|---|---|---|
| POST | `/api/webhooks/saspay` | signature SasPay | Confirme un paiement. Répond **200** même pour un doublon déjà traité ; **403** si signature ou horodatage invalide (comme l'attend SasPay) |
| GET | `/api/cron/payments` | `CRON_SECRET` | Rattrapage des paiements en attente (5 min) |
| GET | `/api/cron/orders` | `CRON_SECRET` | Statuts JAP par lots de 100 (10 min) |
| GET | `/api/cron/services` | `CRON_SECRET` | Sync catalogue + solde JAP (1 h) |

## 8. Endpoints admin (`/api/v1/admin/*`)

Accès : admin + MFA (`aal2`). Toute personne non admin reçoit **404**. Chaque modification est écrite dans `audit_log`.

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/admin/mfa/verify` | `{code}` 6 chiffres → session `aal2` |
| GET | `/admin/stats?from=&to=` | ventes, bénéfice, nb commandes, recharges, nouveaux clients, **répartition par pays**, solde JAP, réservations |
| GET | `/admin/users?q=&country=&status=` | liste paginée |
| GET | `/admin/users/{id}` | profil, solde, total rechargé, commandes, notes, filleuls |
| PATCH | `/admin/users/{id}` | `{status?, blocked_reason?, custom_discount_pct?}` |
| POST | `/admin/users/{id}/notes` | `{body}` → 201 |
| POST | `/admin/users/{id}/adjust` | `{amount_xaf, note}` → ajustement manuel du solde |
| GET | `/admin/orders?status=to_review` | liste paginée (avec coût JAP et bénéfice) |
| POST | `/admin/orders/{id}/refund` | `{amount_xaf}` → remboursement total ou partiel |
| POST | `/admin/orders/{id}/resend` | renvoie la commande à JAP |
| POST | `/admin/orders/{id}/close` | `to_review` → `completed` sans remboursement |
| GET | `/admin/payments?status=` | liste paginée |
| GET | `/admin/services?platform=&active=` | catalogue complet (coût, marge, nom JAP) |
| PATCH | `/admin/services/{id}` | `{active?, name_fr?, margin_pct?, sort_order?}` |
| GET / PATCH | `/admin/settings` | taux, marges, minimum, remise auto, parrainage, seuils |
| GET | `/admin/tickets?status=` | liste paginée |
| POST | `/admin/tickets/{id}/messages` | réponse du propriétaire |
| PATCH | `/admin/tickets/{id}` | `{status}` |
| GET | `/admin/audit?limit=` | journal |

## 9. API revendeurs (plus tard, non construite)

Esquisse pour garder la place : `POST /api/reseller/v2` au **format JAP** (`key`, `action` = services, add, status, balance, refill, cancel) pour que les revendeurs branchent LyonPanel comme n'importe quel panel. Clé API par client, stockée hachée. Tant qu'elle n'est pas ouverte : **503** `{ "error": "Indisponible pour le moment / Unavailable for now" }`.

## 10. Règles pour qui construit l'API

1. Toute route valide son entrée avec **Zod** et renvoie `VALIDATION_ERROR` au format §3.
2. Une seule fonction `apiError(code, details?)` produit les erreurs ; les messages FR/EN viennent d'un seul fichier `messages/errors.{fr,en}.json`.
3. L'argent ne bouge que par les fonctions SQL de `DATA_MODEL.md §6`.
4. Ne jamais renvoyer de champ JAP (`cost_usd`, `jap_name`, `margin_pct`) hors `/admin`.
5. Appels JAP et SasPay : délai max 10 s, une seule reprise pour les lectures, **aucune** reprise automatique pour `add` (risque de double commande).
