# Plan — Phase 13 : Mise en ligne de test

Date : 2026-11-21. Décisions du propriétaire (cadrage du 2026-11-21) :
1. **Tâches planifiées** : on garde GitHub Actions (`cron.yml`, toutes les 5 min). Pas de Worker Cloudflare. `CI_CD.md` et `ENV_SETUP.md` corrigés.
2. **Base de test** : le propriétaire crée le 2e projet Supabase `lyonpanel-test`.
3. **Domaine** : on reste sur `lyonpanel.vercel.app` pour cette phase. `lyonpanel.com` et `support@` sont reportés (aucune action requise ici).
4. **Notifications** : Telegram depuis GitHub Actions seulement, pas de webhook Vercel.

## État réel au départ
- Production en ligne : Vercel + un seul projet Supabase (prod), SasPay live testé, admin caché.
- Migrations appliquées à la main (`supabase db push --linked`).
- En-têtes de sécurité déjà dans `next.config.ts` (`src/lib/security-headers.ts`), vérifiés en ligne le 2026-11-21 : CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy présents. Pas de `vercel.json` nécessaire.

## Ce que fait Claude
| # | Tâche | Résultat |
|---|---|---|
| 13.1 | Corriger `CI_CD.md`, `ENV_SETUP.md`, `ROADMAP.md` (crons GitHub, domaine reporté) | docs à jour |
| 13.2 | `migrate-test.yml` : migrations auto sur Supabase test après fusion dans `main` | workflow |
| 13.3 | `migrate-prod.yml` : bouton « Run workflow », environnement `production` avec approbation, sauvegarde `db dump` gardée 30 jours, `db push`, Telegram | workflow |
| 13.4 | `notify.yml` : Telegram à chaque déploiement Production (réussi / raté) et CI rouge sur `main` | workflow |
| 13.5 | Contrôle des en-têtes de sécurité sur le site en ligne | fait |
| 13.6 | Tableau « variables par environnement » (Preview = test, Production = prod) | `ENV_SETUP.md` |
| 13.7 | Rapport de phase | `docs/reports/phase-13/` |

Aucun secret dans le dépôt : tout passe par les secrets GitHub / Vercel.

## Ce que fait le propriétaire (pas à pas, donné au moment voulu)
1. Créer le projet Supabase `lyonpanel-test`, noter la référence du projet et le mot de passe base.
2. Créer un jeton d'accès Supabase (compte → Access Tokens).
3. Secrets GitHub : `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD_TEST`, `SUPABASE_PROJECT_REF_TEST`, `SUPABASE_DB_PASSWORD_PROD`, `SUPABASE_PROJECT_REF_PROD` (ceux de prod dans l'environnement `production`), `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
4. GitHub → Settings → Environments → `production` : ajouter le propriétaire en validateur obligatoire.
5. Vercel : variables **Preview** pointant vers le projet Supabase test (`PROVIDER_MODE=mock`, SasPay test).
6. Régénérer les secrets vus en conversation (mot de passe admin, clé SasPay live, jeton Telegram, clé fournisseur).

## Terminé quand
Chaque PR a un lien Preview qui marche (sur la base test) ; la migration prod se lance par le bouton ; Telegram prévient d'un déploiement ; en-têtes de sécurité vérifiés ; CI verte lue sur la PR ; rapport écrit.

## Hors périmètre
Accueil et SEO (phase 14), vrais paiements et vrai fournisseur (phase 15), achat du domaine.
