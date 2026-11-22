# Phase 13 — Mise en ligne de test (rapport)

Statut : **laissée de côté par le propriétaire le 2026-11-21, non validée.** Les points restants sont listés plus bas, à reprendre avant la phase 15.

## Fait
- Plan : `docs/plans/phase-13.md`. `CI_CD.md`, `ENV_SETUP.md` et `ROADMAP.md` alignés sur la réalité (tâches planifiées par GitHub Actions, notifications par `notify.yml`, pas de Worker Cloudflare).
- Base de test `lyonpanel-test` créée par le propriétaire et **migrée** par `migrate-test.yml` (CLI Supabase fixé à 2.75.0 : le CLI « latest » refuse `[inbucket]` dans `supabase/config.toml`). PR 34 et 35 fusionnées.
- Jeton Supabase : les jetons à droits limités ont échoué ; un jeton legacy (droits complets du compte) est utilisé, uniquement dans les secrets GitHub.
- Workflows ajoutés : `migrate-test.yml`, `migrate-prod.yml`, `notify.yml`.
- Variables Vercel Preview séparées de la production (Supabase test, `PROVIDER_MODE=mock`, clés Turnstile de test Cloudflare, faux SasPay en supprimant `SASPAY_API_KEY` en Preview).
- En-têtes de sécurité vérifiés en ligne (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).

## Pas terminé
- **Preview** : le site se construit et s'affiche, l'anti-robot passe, mais la création de compte échoue (`login_attempts: Invalid API key`, clé `service_role` Supabase refusée). Cause à trouver : mauvais projet dans l'adresse (`bfvbsctnzdyoajswxjjv` à comparer au Reference ID de `lyonpanel-test`), ou clés legacy désactivées (utiliser alors les clés `sb_publishable_` / `sb_secret_`, après vérification du code).
- `migrate-prod.yml` non essayé (il migrerait la production : migrations 9 à 12 à appliquer en phase 15).
- `notify.yml` : message Telegram jamais vu en conditions réelles.
- Réglages Auth du projet de test (inscription publique, mot de passe 8 caractères, CAPTCHA) non confirmés.
- Domaine `lyonpanel.com` et e-mail `support@` reportés.
- Secrets vus en conversation à régénérer par le propriétaire : mot de passe admin, clé SasPay live, jeton Telegram, clé fournisseur, ancienne adresse admin (`ADMIN_PATH` de production, à remplacer).
