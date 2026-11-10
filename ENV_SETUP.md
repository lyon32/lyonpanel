# LyonPanel — Mise en place de l'environnement

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Liés : `.env.example`, `CONVENTIONS.md` (versions), `LLD.md` (bibliothèques).

## 0. Décisions du propriétaire

| # | Décision |
|---|---|
| 1 | Poste de travail : **Windows 11** |
| 2 | Docker Desktop **déjà installé** |
| 3 | Éditeur : **VS Code** |
| 4 | Dépôt : **https://github.com/lyon32/lyonpanel.git** |
| 5 | SasPay en **mode test** pendant le développement |
| 6 | **faux fournisseur** (simulation) en local ; vrai fournisseur seulement pour le test final |
| 7 | **Un seul bot Telegram** ; les messages de test portent `[TEST]` et sont supprimés ensuite |

## 1. Outils sur le PC (vérifiés le 2026-11-07)

| Outil | Version installée | Rôle |
|---|---|---|
| Node.js | 24.13.1 | Faire tourner Next.js |
| npm | 11.8.0 | Installer les paquets |
| Git | 2.55.0 | Versions du code |
| Docker Desktop | 29.2.1 | Base Supabase locale |
| Supabase CLI | 2.75.0 | Base locale, migrations |
| VS Code | 1.143.1 | Éditeur |

Extensions VS Code recommandées (`.vscode/extensions.json`) : ESLint, Prettier, Tailwind CSS IntelliSense, Playwright Test, i18n Ally (mon choix), Supabase (mon choix).

## 2. Variables d'environnement

Modèle : [`.env.example`](.env.example). En local : copier en `.env.local` (ignoré par Git). En ligne : variables Vercel (Preview = projet Supabase test, Production = projet prod).
`NEXT_PUBLIC_*` = visible dans le navigateur, **jamais de secret dedans**.

| Variable | Secret ? | Rôle | Où l'obtenir | En local |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | non | Adresse du site (liens, retour SasPay) | — | `http://localhost:3000` |
| `ADMIN_PATH` | **oui** | Segment secret de l'admin | `openssl rand -hex 12` | une valeur au choix |
| `NEXT_PUBLIC_SUPABASE_URL` | non | Adresse Supabase | Supabase → Settings → API | donnée par `supabase start` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | non | Clé publique (protégée par RLS) | idem | donnée par `supabase start` |
| `SUPABASE_SERVICE_ROLE_KEY` | **oui** | Clé serveur (fonctions d'argent, admin) | idem | donnée par `supabase start` |
| `PROVIDER_API_URL` | non | Adresse de l’API du fournisseur | — | valeur du modèle |
| `PROVIDER_API_KEY` | **oui** | Clé fournisseur (**à régénérer** avant usage) | fournisseur → compte → API | vide (mode mock) |
| `PROVIDER_MODE` | non | `mock` = faux fournisseur, `live` = vrai | — | `mock` |
| `SASPAY_API_URL` | non | Adresse API SasPay (même pour test et prod) | `docs/06-saspay.md` | `https://api.saspay.me/api/v1` |
| `SASPAY_API_KEY` | **oui** | Clé marchand, portée PAYIN | SasPay → Développeur | `sk_test_...` |
| `SASPAY_WEBHOOK_SECRET` | **oui** | Vérifier la signature des webhooks | SasPay → Webhooks (affiché **une seule fois**) | secret du webhook de test |
| `SASPAY_MODE` | non | `test` ou `live` ; le serveur refuse de démarrer si le préfixe de la clé (`sk_test_`/`sk_live_`) ne correspond pas | — | `test` |
| `TELEGRAM_BOT_TOKEN` | **oui** | Jeton du bot d'alertes | @BotFather | le même bot |
| `TELEGRAM_CHAT_ID` | non | Ton identifiant de discussion | voir §4 | le même |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | non | Widget anti-bot | Cloudflare → Turnstile | clé de test publique Cloudflare |
| `TURNSTILE_SECRET_KEY` | **oui** | Vérification serveur Turnstile | idem | clé de test publique Cloudflare |
| `CRON_SECRET` | **oui** | Protéger `/api/cron/*` ; même valeur dans Vercel et dans le Worker Cloudflare (`wrangler secret put`) | `openssl rand -hex 32` | une valeur au choix |
| `AUTH_HASH_SECRET` | **oui** | Clé des empreintes (HMAC) des emails/IP dans `login_attempts` ; obligatoire en production (sans elle, les connexions échouent) | `openssl rand -hex 32` | vide (valeur de repli de test) |
| `SUPABASE_AUTH_CAPTCHA_SECRET` | non (Supabase) | Clé secrète Turnstile lue par Supabase Auth, qui vérifie lui-même le captcha à la connexion et au mot de passe oublié | Cloudflare → Turnstile (même widget) ; en local `1x0000000000000000000000000000000AA` | vide |
| `NEXT_PUBLIC_SENTRY_DSN` | non (public par nature) | Adresse d'envoi des erreurs à Sentry | Sentry → projet → Client Keys (DSN) ; **fournie par le propriétaire**, déjà dans `.env.local` | la valeur fournie |
| `SENTRY_AUTH_TOKEN` | **oui** | Envoi des « source maps » (traces lisibles) au build | Sentry → Settings → Auth Tokens | vide en local ; seulement dans Vercel et la CI |
| `SENTRY_ORG`, `SENTRY_PROJECT` | non | Identifiants pour l'envoi des source maps | Sentry → Settings | à remplir en Phase 0 |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | non | Google Analytics | GA4 | vide (désactivé en local) |

Clés de test Turnstile : Cloudflare publie des clés factices qui répondent toujours « réussi » (voir leur documentation « Testing »).

**Règles**
- Le serveur vérifie toutes les variables au démarrage (`src/server/env.ts`, schéma Zod) et refuse de démarrer s'il en manque une.
- `PROVIDER_MODE=live` et `SASPAY_MODE=live` : **interdits** hors Production, sauf le test final avant lancement.
- Hors production, chaque message Telegram commence par `[TEST]`.
- Jamais de secret dans Git, une capture d'écran ou une conversation. Si une clé fuit : la régénérer immédiatement.

## 3. Installation locale (Windows, première fois)

```bash
git clone https://github.com/lyon32/lyonpanel.git
```
```bash
cd lyonpanel
```
```bash
npm ci
```
```bash
copy .env.example .env.local
```
Démarrer **Docker Desktop**, puis :
```bash
npx supabase start
```
Copier dans `.env.local` les valeurs affichées (`API URL`, `anon key`, `service_role key`), puis appliquer migrations et données de départ :
```bash
npx supabase db reset
```
```bash
npm run dev
```
- Site : http://localhost:3000/fr
- Studio Supabase local : http://localhost:54323
- Boîte mail locale (emails de mot de passe oublié) : http://localhost:54324

**Créer ton compte admin en local** : s'inscrire sur le site, puis :
```bash
npm run admin:promote -- ton@email.com
```
Ensuite activer le code à 6 chiffres sur `http://localhost:3000/<ADMIN_PATH>/login`.

## 4. Services externes à préparer

| Service | Étape | Quand |
|---|---|---|
| **Bot Telegram** | @BotFather → `/newbot` → copier le jeton ; envoyer un message au bot ; ouvrir `https://api.telegram.org/bot<JETON>/getUpdates` et noter `chat.id` | Avant l'étape « alertes » |
| **SasPay** | Compte marchand, clés de test, URL de webhook (en local : tunnel `cloudflared tunnel --url http://localhost:3000`) | Avant l'étape « recharge » |
| **Fournisseur** | Peakerr, API v2, `POST https://peakerr.com/api/v2`, actions `services` / `add` / `status` / `refill` / `refill_status` / `cancel` / `balance`, prix et solde en USD, clé dans le champ `key`. Mettre la clé seulement dans Vercel Production | Avant le test final |
| **Supabase** | 2 projets : `lyonpanel-test` et `lyonpanel-prod` ; SMTP Hostinger dans Auth → SMTP | Avant la 1re mise en ligne |
| **Cloudflare** | Acheter `lyonpanel.com`, créer un widget Turnstile | Avant la 1re mise en ligne |
| **Hostinger** | Boîte `support@lyonpanel.com` + enregistrements MX/SPF/DKIM dans Cloudflare | Après l'achat du domaine |
| **Vercel** | Offre gratuite ; importer le dépôt GitHub, renseigner les variables par environnement | Avant la 1re mise en ligne |
| **Cloudflare Worker (crons)** | Créer un jeton API Cloudflare (droit « Workers Scripts : Edit ») pour GitHub Actions | Avant la 1re mise en ligne |
| **GitHub** | Protéger `main`, activer Dependabot, ajouter les secrets CI | Au démarrage |

## 5. Scripts npm

| Script | Rôle |
|---|---|
| `npm run dev` | Site en local |
| `npm run build` / `npm start` | Construire / lancer la version finale |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:db` | Tests de la base (Supabase local lancé) |
| `npm run test:e2e` | Tests Playwright |
| `npm run db:reset` | Réinitialiser la base locale |
| `npm run db:migration -- nom` | Créer une migration |
| `npm run db:types` | Régénérer `src/server/db/types.ts` |
| `npm run admin:promote -- email` | Donner le rôle admin en local |

## 5 bis. Email de réinitialisation du mot de passe (Supabase)

- Supabase → Authentication → Email Templates → « Reset Password » : le lien doit être
  `{{ .SiteURL }}/fr/nouveau-mot-de-passe?token_hash={{ .TokenHash }}&type=recovery` (FR) et `{{ .SiteURL }}/en/reset-password?token_hash={{ .TokenHash }}&type=recovery` (EN).
- Authentication → URL Configuration : « Site URL » = `NEXT_PUBLIC_SITE_URL` ; « Redirect URLs » = les deux pages ci-dessus.
- En local, `supabase/config.toml` et `supabase/templates/recovery.html` règlent cela. Le modèle choisit la langue du lien avec `{{ .Data.language }}` (la langue enregistrée à l'inscription dans les métadonnées de l'utilisateur) ; le mail est bilingue (français puis anglais dans le corps, sujet bilingue, car le sujet ne peut pas dépendre de la langue) ; le lien mène à la page de la bonne langue.
- **Réglages Authentication du tableau de bord Supabase hébergé (Preview et Production)**, identiques à `config.toml` : « Allow new users to sign up » = **désactivé** (les comptes se créent par notre route, via `admin.createUser`), longueur minimale du mot de passe = **8**, « Secure password change » = **activé**.

- **Tests de navigateur (Playwright)** : le port se règle avec `PLAYWRIGHT_PORT` (3000 par défaut), par exemple `PLAYWRIGHT_PORT=3190 npx playwright test` si le port 3000 est pris.
- **CLI Supabase 3** : selon la version, `supabase start` ou `status` refuse `[inbucket]` et veut `[local_smtp]`. Si cela arrive, tester sur une copie temporaire du dossier `supabase` avec cette section renommée ; la version 3.0.0 testée ici accepte encore `[inbucket]`.
- **Captcha vérifié par Supabase** : `[auth.captcha]` de `config.toml` lit `SUPABASE_AUTH_CAPTCHA_SECRET`. Local : `SUPABASE_AUTH_CAPTCHA_SECRET=1x0000000000000000000000000000000AA supabase start` (clé de test publique). Hébergé : Authentication → Attack Protection → **Enable CAPTCHA protection** (Turnstile) avec la clé secrète de production.
- **Réinitialisation sans brûler le lien** : le lien est échangé une seule fois (cookie httpOnly `lp_recovery` + cookies de session limités à 15 min) ; un mot de passe refusé laisse le même lien utilisable pendant 15 min. Aucune migration.
- Le contrôle « même mot de passe que l'actuel » est fait par Supabase (`same_password`), car la connexion par mot de passe exige désormais un jeton captcha.
- Après inscription, la session s'ouvre par un lien magique généré côté serveur (le captcha protège la connexion par mot de passe).

## 6. Dépendances

Versions **exactes** fixées le jour de la création du projet (dernière stable, `save-exact`), puis mises à jour une fois par mois (`CONVENTIONS.md §1`). Majeures visées :

**Production**
| Paquet | Majeure |
|---|---|
| next | 16 (**16.4.5** installé) |
| react, react-dom | 19 (**19.3.1** installé) |
| next-intl | 4 |
| @supabase/supabase-js | 2 |
| @supabase/ssr | dernière |
| @tanstack/react-query | 5 |
| react-hook-form | 7 |
| zod | 4 (**4.6.7** installé) |
| @hookform/resolvers | dernière |
| @marsidev/react-turnstile | dernière |
| gsap | 3 |
| lenis | 1 |
| lucide-react | dernière |
| clsx, tailwind-merge, class-variance-authority | dernières |
| @radix-ui/* (via shadcn/ui) | dernières |
| browser-image-compression | 2 |
| server-only | dernière |

**Développement**
| Paquet | Majeure |
|---|---|
| typescript | 5 |
| tailwindcss, @tailwindcss/postcss | 4 |
| eslint, eslint-config-next, typescript-eslint | dernières compatibles Next 15 |
| prettier, prettier-plugin-tailwindcss | 3 / dernière |
| husky, lint-staged | dernières |
| vitest, @testing-library/react | dernières |
| @playwright/test | 1 |
| supabase (CLI) | 2 |
| tsx (scripts) | 4 |
| @types/node, @types/react | 24 / 19 |

**Numéros exacts installés en Phase 0** (lus dans `package.json` et `package-lock.json`, le 2026-11-07) :

| Paquet | Version installée | Type |
|---|---|---|
| next | 16.4.5 | production |
| react, react-dom | 19.3.1 | production |
| zod | 4.6.7 | production |
| @sentry/nextjs | 11.11.0 | production |
| server-only | 0.0.1 | production |
| typescript | 5.9.3 | développement |
| tailwindcss, @tailwindcss/postcss | 4.3.5 | développement |
| eslint | 9.39.5 (pas la 10 : `eslint-config-next@16.4.5` ne la gère pas encore) | développement |
| eslint-config-next | 16.4.5 | développement |
| prettier / prettier-plugin-tailwindcss | 3.9.10 / 0.8.1 | développement |
| husky / lint-staged | 9.1.7 / 17.6.0 | développement |
| vitest / @vitest/coverage-v8 | 5.1.0 / 5.1.0 | développement |
| @playwright/test | 1.65.0 | développement |
| @types/node | 24.19.2 | développement |
| @types/react / @types/react-dom | 19.3.0 / 19.3.0 | développement |

Node : 24 (`.nvmrc`). Les autres paquets de la liste (next-intl, Supabase, react-query, etc.) seront ajoutés dans leur phase.

## 6 bis. Outils optionnels (plus tard)

- **context-mode** (évaluation fin de Phase 2) : demande **Node ≥ 24.15** et Git for Windows. Avant : `node -v`, puis mise à jour de Node si besoin.

## 7. Problèmes fréquents

| Problème | Solution |
|---|---|
| `supabase start` échoue | Docker Desktop n'est pas lancé |
| Ports 54321/54322 déjà pris | `npx supabase stop` puis relancer |
| Webhook SasPay n'arrive pas en local | Lancer le tunnel `cloudflared` et mettre son URL dans SasPay test |
| « Missing env var » au démarrage | Comparer `.env.local` avec `.env.example` |
| Fins de ligne cassées sous Windows | `git config core.autocrlf input` + `.gitattributes` (`* text=auto eol=lf`) |
