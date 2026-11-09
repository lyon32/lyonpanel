# LyonPanel — Conception détaillée (LLD)

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Liés : `ARCHITECTURE.md`, `DATA_MODEL.md`, `API_SPEC.md`, `openapi.yaml`, `docs/05-design-system.md`.

**Règle pour tout agent IA : cette arborescence et ces noms sont imposés. Ne pas en inventer d'autres, ne pas ajouter de bibliothèque hors de la liste §1.**

## 0. Décisions prises en compte

| # | Décision |
|---|---|
| 1 | Un seul fichier LLD |
| 2 | Code en **anglais** ; textes affichés en français et anglais |
| 3 | Adresses traduites : `/fr/commander`, `/en/order` |
| 4 | Tests automatiques **obligatoires** pour tout ce qui touche à l'argent |
| 5 | Composants **shadcn/ui** aux couleurs LyonPanel |
| 6 | **Pas de mode sombre** |
| 7 | Devise mémorisée aussi pour les visiteurs (cookie) |
| 8 | Langue = langue du téléphone si fr ou en, sinon français |

## 1. Bibliothèques autorisées

| Usage | Paquet |
|---|---|
| Framework | `next` (App Router), `react`, `typescript` |
| Style | `tailwindcss`, `shadcn/ui` (Radix), `lucide-react`, `clsx`, `tailwind-merge` |
| Mouvement | `gsap`, `lenis`, `animejs` (4.5.0 exact) |
| Langues | `next-intl` (adresses traduites incluses) |
| Données serveur | `@supabase/supabase-js`, `@supabase/ssr` |
| Données navigateur | `@tanstack/react-query` |
| Formulaires | `react-hook-form`, `zod`, `@hookform/resolvers` |
| Anti-bot | `@marsidev/react-turnstile` |
| Images (pièces jointes) | `browser-image-compression` |
| Tests | `vitest`, `@testing-library/react`, `playwright` |
| Tâches planifiées | `wrangler` (dev, pour le Worker Cloudflare) |
| Suivi des erreurs | `@sentry/nextjs` (erreurs + traces, configuré selon le skill `sentry-instrument`) |
| Qualité | `eslint`, `prettier` |

`animejs` (ajout du 2026-11-09, autorisé par le propriétaire) : uniquement pour les transitions de mise en page et de panneaux des pages de compte, chargé en import dynamique. GSAP reste pour le défilement et la page d'accueil.

Tout autre paquet = validation du propriétaire.

## 2. Arborescence

```
lyonpanel/
├─ src/
│  ├─ app/
│  │  ├─ [locale]/                         # fr | en
│  │  │  ├─ layout.tsx                     # polices, Lenis, fournisseurs
│  │  │  ├─ page.tsx                       # accueil
│  │  │  ├─ (public)/
│  │  │  │  ├─ [platform]/page.tsx         # /fr/tiktok, /fr/instagram…
│  │  │  │  ├─ faq/page.tsx
│  │  │  │  ├─ privacy/page.tsx            # /fr/confidentialite
│  │  │  │  └─ terms/page.tsx              # /fr/conditions
│  │  │  ├─ (auth)/
│  │  │  │  ├─ login/page.tsx              # /fr/connexion
│  │  │  │  ├─ register/page.tsx           # /fr/inscription
│  │  │  │  ├─ forgot-password/page.tsx    # /fr/mot-de-passe-oublie
│  │  │  │  └─ reset-password/page.tsx
│  │  │  └─ (app)/                         # espace client, connecté
│  │  │     ├─ layout.tsx                  # barre latérale, solde
│  │  │     ├─ dashboard/page.tsx          # /fr/tableau-de-bord
│  │  │     ├─ order/page.tsx              # /fr/commander
│  │  │     ├─ orders/page.tsx             # /fr/commandes
│  │  │     ├─ orders/[id]/page.tsx
│  │  │     ├─ add-funds/page.tsx          # /fr/recharger
│  │  │     ├─ add-funds/[id]/page.tsx     # retour SasPay, statut
│  │  │     ├─ transactions/page.tsx
│  │  │     ├─ favorites/page.tsx          # /fr/favoris
│  │  │     ├─ tickets/page.tsx            # /fr/support
│  │  │     ├─ tickets/[id]/page.tsx
│  │  │     ├─ referral/page.tsx           # /fr/parrainage
│  │  │     └─ account/page.tsx            # /fr/compte
│  │  ├─ [adminPath]/                      # adresse secrète (env ADMIN_PATH), noindex
│  │  │  ├─ layout.tsx                     # 404 si non admin ou si segment ≠ ADMIN_PATH
│  │  │  ├─ login/page.tsx                 # mot de passe + code 6 chiffres
│  │  │  ├─ page.tsx                       # tableau de bord
│  │  │  └─ users/ orders/ payments/ services/ tickets/ settings/ audit/
│  │  ├─ api/
│  │  │  ├─ v1/…                           # une route par endpoint d'API_SPEC.md
│  │  │  ├─ v1/admin/…
│  │  │  ├─ webhooks/saspay/route.ts
│  │  │  └─ cron/{payments,orders,services}/route.ts
│  │  ├─ robots.ts  sitemap.ts  not-found.tsx
│  ├─ components/
│  │  ├─ ui/                               # shadcn/ui (button avec états loading / success, input, dialog…)
│  │  ├─ auth/                             # auth-shell, auth-card, auth-language-switcher, formulaires de compte
│  │  ├─ layout/                           # header, footer, sidebar, mobile-cta
│  │  ├─ catalog/                          # platform-tabs, service-card, service-picker
│  │  ├─ order/                            # order-form, quantity-input, comments-input, order-status-badge
│  │  ├─ wallet/                           # balance-chip, add-funds-form, payment-status
│  │  ├─ tickets/                          # ticket-thread, attachment-upload
│  │  ├─ admin/                            # stats-cards, data-table, refund-dialog
│  │  └─ shared/                           # money, currency-switcher, locale-switcher, empty-state, error-state, greeting (bonjour selon l'heure)
│  ├─ server/                              # code serveur uniquement (import "server-only")
│  │  ├─ auth/          session.ts  require-user.ts  require-admin.ts  rate-limit.ts  turnstile.ts
│  │  ├─ pricing/       compute-price.ts  discount.ts  margins.ts  fees.ts
│  │  ├─ catalog/       sync-services.ts  build-name.ts  classify.ts
│  │  ├─ orders/        place-order.ts  submit-to-jap.ts  sync-statuses.ts  validate-link.ts
│  │  ├─ payments/      create-payment.ts  handle-webhook.ts  reconcile.ts
│  │  ├─ referral/      referral.ts
│  │  ├─ tickets/       tickets.ts  attachments.ts
│  │  ├─ admin/         stats.ts  users.ts  refunds.ts  settings.ts
│  │  ├─ providers/     jap-client.ts  saspay-client.ts  telegram.ts
│  │  ├─ db/            supabase-server.ts  supabase-admin.ts  types.ts (généré)
│  │  └─ http/          api-error.ts  handler.ts  idempotency.ts
│  ├─ lib/                                 # partagé navigateur + serveur, sans secret
│  │  ├─ money.ts  constants.ts  utils.ts
│  │  └─ schemas/       auth.ts  order.ts  payment.ts  ticket.ts  admin.ts   # Zod
│  ├─ hooks/            use-order-status.ts  use-payment-status.ts  use-wallet.ts  use-currency.ts
│  ├─ i18n/             routing.ts  request.ts
│  ├─ messages/         fr.json  en.json  errors.fr.json  errors.en.json
│  ├─ styles/           globals.css   # variables du design system
│  └─ middleware.ts                    # langue, session Supabase
├─ supabase/
│  ├─ migrations/       20261107000000_init.sql …
│  └─ seed.sql
├─ tests/
│  ├─ unit/             pricing.test.ts  discount.test.ts  fees.test.ts  referral.test.ts  build-name.test.ts
│  ├─ db/               place-order.test.ts  credit-payment.test.ts  refund.test.ts  rls.test.ts
│  └─ e2e/              register.spec.ts  add-funds.spec.ts  order.spec.ts
├─ public/              logo, favicon, og-images
├─ workers/cron/        # Cloudflare Worker : wrangler.toml + index.ts (appelle /api/cron/* avec CRON_SECRET)
├─ vercel.json          # en-têtes de sécurité
├─ .env.example         # noms des variables, jamais de valeur
└─ package.json
```

## 3. Responsabilités des modules

**app/[locale]** — Pages et mise en page. **Aucune** logique métier : lit les données via `server/*` (composants serveur) ou via l'API (React Query). Gère le SEO (métadonnées, données structurées) et les traductions.

**app/[adminPath]** — Interface du propriétaire. Le layout vérifie que le segment est égal à `ADMIN_PATH`, que l'utilisateur est admin et en MFA `aal2`, sinon `notFound()`. En-tête `X-Robots-Tag: noindex, nofollow`.

**app/api** — Couche mince : valide l'entrée (Zod), appelle un service de `server/`, renvoie JSON ou `apiError`. Jamais d'accès direct à la base dans une route.

**server/auth** — Session, contrôles d'accès (`requireUser`, `requireAdmin`), Turnstile, limites de débit. Seul module qui lit les cookies de session.

**server/pricing** — Calcul **pur** (sans base ni réseau) du prix client, de la remise, des frais et du bonus de parrainage. Source unique de vérité pour les montants ; la fonction SQL `place_order` reproduit le même calcul et un test vérifie que les deux donnent le même résultat. 100 % testé.

**server/catalog** — Synchronisation JAP → table `services` : classement par plateforme et type, nom reconstruit (jamais de prix dans le nom), nouveaux services inactifs, historique des prix, alertes d'écart.

**server/orders** — Création de commande (fonction SQL `place_order`), envoi à JAP, suivi des statuts par lots, passage en `to_review` + alerte. Ne rembourse jamais tout seul.

**server/payments** — Création du paiement SasPay, webhook (signature, montant, unicité), rattrapage des paiements en attente. Le crédit passe uniquement par `credit_payment`.

**server/referral** — Code de parrainage et rattachement à l'inscription. Le bonus de 5 % est versé dans `credit_payment` (SQL) ; ce module ne fait que lire et rattacher.

**server/tickets** — Tickets, messages, pièces jointes (Storage privé, URL signées 10 min).

**server/admin** — Statistiques (ventes, bénéfice, par pays), gestion des clients, remboursements, réglages. Écrit `audit_log` à chaque action.

**server/providers** — **Seuls** clients autorisés à parler à JAP, SasPay et Telegram. Délai 10 s, journaux sans secret.

**server/http** — `apiError`, enveloppe commune des routes (`handler`), clés d'idempotence.

**lib** — Code partagé sans secret : formatage des montants, schémas Zod (communs au formulaire et au serveur), constantes.

**hooks** — Accès aux données côté navigateur (React Query), polling des statuts.

**supabase** — Schéma, RLS, fonctions SQL atomiques (DATA_MODEL §6). Seul endroit où l'argent change réellement.

## 4. Fonctions clés (signatures)

### 4.1 Prix — `server/pricing`
```ts
type Platform = 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'telegram' | 'x' | 'spotify' | 'other';

interface MarginRules {
  byPlatform: Partial<Record<Platform, number>>;      // { tiktok: 120, instagram: 75, facebook: 75 }
  tiers: { maxUsd: number | null; pct: number }[];   // [{maxUsd:1,pct:70},{maxUsd:5,pct:65},{maxUsd:null,pct:60}]
}

/** Marge : override du service > plateforme > palier selon le coût USD. */
export function resolveMarginPct(platform: Platform, costUsdPer1000: number, rules: MarginRules, override?: number | null): number;

/** Prix client pour 1 000 en XAF, arrondi au multiple de 5 supérieur, minimum 5. */
export function computePricePer1000Xaf(costUsdPer1000: number, marginPct: number, usdXafRate: number): number;

/** Remise : la plus grande entre auto (si totalRecharged ≥ seuil) et personnalisée. Jamais cumulées. */
export function resolveDiscountPct(totalRechargedXaf: number, auto: { thresholdXaf: number; pct: number }, customPct: number | null): number;

/** Total : ceil5(prix × qté / 1000 × (1 − remise)), jamais sous coût JAP × (1 + marge minimale). */
export function computeOrderTotalXaf(input: {
  pricePer1000Xaf: number; quantity: number; discountPct: number;
  costUsdPer1000: number; usdXafRate: number; minMarginPct: number;
}): number;

/** Frais SasPay payés par le client. */
export function computeTopUpFees(amountXaf: number, feePct: number): { amountXaf: number; feeXaf: number; totalToPay: number };

/** Bonus de parrainage : floor(pct % du premier crédit). */
export function computeReferralBonusXaf(creditedXaf: number, pct: number): number;
```

### 4.2 Catalogue — `server/catalog`
```ts
export function classifyPlatform(japCategory: string): Platform;
export function classifyCategory(japName: string, japCategory: string): 'followers' | 'likes' | 'views' | 'comments' | 'shares' | 'live' | 'other';
/** Nom reconstruit depuis les champs API ; jamais de prix ni d'étiquettes JAP. */
export function buildServiceName(s: JapService, locale: 'fr' | 'en'): string;
export async function syncServices(): Promise<{ added: number; removed: number; repriced: number; alerts: number }>;
```

### 4.3 Commandes — `server/orders`
```ts
export async function placeOrder(userId: string, input: CreateOrderInput, idempotencyKey: string): Promise<Order>;
// 1) lit service + réglages  2) computeOrderTotalXaf  3) ≠ expected_total_xaf → PRICE_CHANGED
// 4) solde JAP disponible ?  5) rpc('place_order')  6) submitToJap  7) renvoie la commande

export async function submitToJap(order: Order): Promise<'in_progress' | 'to_review'>;  // aucune reprise automatique
export async function syncOrderStatuses(batchSize?: number): Promise<{ updated: number; toReview: number }>;
export function validateLink(platform: Platform, link: string): { ok: true } | { ok: false; reason: 'INVALID_LINK' };
```

### 4.4 Paiements — `server/payments`
```ts
export async function createPayment(userId: string, amountXaf: number, idempotencyKey: string): Promise<{ id: string; checkoutUrl: string }>;
export async function handleSaspayWebhook(rawBody: string, headers: Headers): Promise<'credited' | 'duplicate' | 'failed' | 'rejected'>;
export async function reconcilePendingPayments(olderThanMinutes?: number): Promise<{ credited: number; failed: number }>;
```

### 4.5 Fournisseurs — `server/providers`
```ts
export const jap: {
  services(): Promise<JapService[]>;
  balance(): Promise<{ balance: number; currency: 'USD' }>;
  add(p: { service: number; link: string; quantity: number; comments?: string }): Promise<{ order: number }>;
  status(ids: number[]): Promise<Record<number, JapStatus>>;
};
export const saspay: {
  createCheckoutSession(p: { amount: string; currency: 'XAF' | 'XOF'; customerEmail: string; customerName: string; customerPhone?: string; country?: string; returnUrl: string; metadata: { lyonpanel_payment_id: string }; feeChargeMode: 'ADD_ON'; expiresAt: string }): Promise<{ sessionId: string; checkoutUrl: string }>;
  getCheckoutSessionStatus(sessionId: string): Promise<{ status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'; transactionId: string | null }>;
  verifyPayment(transactionId: string): Promise<{ status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'; netAmount: string; fee: string; charged: string; currency: string }>;
  getMyRates(): Promise<{ network: string; feePct: number }[]>;
  verifyWebhook(rawBody: string, signature: string, timestamp: string): boolean; // HMAC-SHA256(timestamp + '.' + body), ± 300 s
};
export async function notifyOwner(
  event: 'order_failed' | 'low_jap_balance' | 'price_jump' | 'payment_mismatch' | 'new_ticket' | 'internal_error',
  data: Record<string, unknown>,
): Promise<void>;
```
Formes basées sur `docs/06-saspay.md` ; points « à vérifier » confirmés en Phase 5.

### 4.6 HTTP — `server/http`
```ts
export class ApiError extends Error {
  constructor(public code: ErrorCode, public status: number, public details?: Record<string, unknown>) { super(code); }
}
export function apiError(code: ErrorCode, details?: Record<string, unknown>): never;
/** Enveloppe toutes les routes : request_id, langue, Zod, ApiError → JSON ; erreur inconnue → INTERNAL_ERROR + Telegram. */
export function handler<T>(fn: (req: NextRequest, ctx: Ctx) => Promise<T>): (req: NextRequest) => Promise<Response>;
export async function withIdempotency<T>(key: string, userId: string, fn: () => Promise<T>): Promise<T>;
```

### 4.7 Fonctions SQL
Voir `DATA_MODEL.md §6` : `place_order`, `credit_payment`, `refund_order`, `admin_adjust`, `anonymize_user`. Appelées uniquement depuis `server/` avec le client `supabase-admin` (clé de service).

## 5. Gestion d'état (navigateur)

| Type d'état | Outil | Exemples |
|---|---|---|
| Données serveur | **React Query** | solde, commandes, services, tickets |
| Données initiales des pages | Composants serveur Next.js | catalogue, pages SEO |
| Formulaires | **react-hook-form + Zod** (mêmes schémas que le serveur) | commande, recharge, inscription |
| Préférences | Cookies `NEXT_LOCALE`, `lp_currency` (1 an) + profil si connecté | langue, devise |
| UI locale | `useState` | onglet ouvert, boîte de dialogue |

- **Pas de magasin global** (ni Redux ni Zustand) : React Query + cookies suffisent (mon choix).
- Polling : `useOrderStatus` toutes les **30 s** tant que le statut n'est pas final ; `usePaymentStatus` toutes les 5 s, arrêt après 10 min.
- Après une commande ou une recharge réussie : invalider `['wallet']`, `['orders']`, `['transactions']`.
- Aucun prix « officiel » calculé dans le navigateur : l'affichage en direct appelle `POST /orders/quote` (anti-rebond 300 ms) ; le serveur recalcule au moment du débit.
- Devise : conversion pour l'affichage seulement, `formatMoney(xaf, currency, rate)` dans `lib/money.ts`.

## 6. Langues et adresses

`next-intl`, `localePrefix: 'always'` : `/fr/…` et `/en/…`. Adresses traduites dans `i18n/routing.ts` :

| Interne | fr | en |
|---|---|---|
| `/order` | `/commander` | `/order` |
| `/orders` | `/commandes` | `/orders` |
| `/add-funds` | `/recharger` | `/add-funds` |
| `/dashboard` | `/tableau-de-bord` | `/dashboard` |
| `/transactions` | `/transactions` | `/transactions` |
| `/favorites` | `/favoris` | `/favorites` |
| `/login` | `/connexion` | `/login` |
| `/register` | `/inscription` | `/register` |
| `/forgot-password` | `/mot-de-passe-oublie` | `/forgot-password` |
| `/tickets` | `/support` | `/support` |
| `/referral` | `/parrainage` | `/referral` |
| `/account` | `/compte` | `/account` |
| `/privacy` | `/confidentialite` | `/privacy` |
| `/terms` | `/conditions` | `/terms` |

- Première visite : `Accept-Language` → `fr` ou `en` ; toute autre langue → `fr`. Choix gardé dans `NEXT_LOCALE`.
- Balises `hreflang` fr/en + `x-default` → fr.
- Tout texte affiché vient de `messages/*.json` ; aucune phrase en dur dans les composants.

## 7. Conventions de nommage

| Élément | Convention | Exemple |
|---|---|---|
| Fichiers et dossiers | kebab-case | `order-form.tsx`, `compute-price.ts` |
| Composants React | PascalCase | `OrderForm`, `ServiceCard` |
| Fonctions, variables | camelCase, verbe d'action | `placeOrder`, `computePricePer1000Xaf` |
| Hooks | `use` + PascalCase | `useOrderStatus` |
| Types | PascalCase, sans préfixe `I` | `Order`, `MarginRules` |
| Constantes | SCREAMING_SNAKE_CASE | `MIN_RECHARGE_XAF` |
| Schémas Zod | camelCase + `Schema` | `createOrderSchema` |
| Tables, colonnes SQL | snake_case, tables au pluriel | `wallet_transactions.amount_xaf` |
| Fonctions SQL | snake_case, verbe | `place_order` |
| Montants | suffixe d'unité obligatoire | `amountXaf`, `costUsdPer1000` |
| Codes d'erreur | SCREAMING_SNAKE_CASE | `INSUFFICIENT_BALANCE` |
| Clés de traduction | par écran, séparées par des points | `order.form.quantity.label` |
| Variables d'env | SCREAMING_SNAKE_CASE ; `NEXT_PUBLIC_` seulement sans secret | `JAP_API_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| Branches Git | `type/sujet` | `feat/add-funds` |
| Commits | Conventional Commits, en français (voir `CONVENTIONS.md`) | `feat(orders): ajouter la clé d'idempotence` |

## 8. Tests (obligatoires pour l'argent)

| Niveau | Outil | Couvre | Exigence |
|---|---|---|---|
| Unitaires | Vitest | `server/pricing/*`, `buildServiceName`, `classify*`, `validateLink` | 100 % des branches de `pricing` |
| Base de données | Vitest + Supabase local | `place_order`, `credit_payment` (doublon, bonus parrain), `refund_order`, RLS | Tous les cas limites du PRD §3 |
| Bout en bout | Playwright | inscription, recharge (SasPay test), commande, ticket | Avant chaque mise en production |

Cas obligatoires : double webhook = un seul crédit ; double clic = une seule commande ; solde insuffisant ; quantité hors limites ; prix changé ; remise auto contre personnalisée ; bonus parrain une seule fois ; client bloqué ; solde jamais négatif ; même total entre `computeOrderTotalXaf` et `place_order`.
