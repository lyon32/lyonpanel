# Phase 13 — Mise en ligne de test (rapport en cours)

Statut : en cours. Rapport complet à écrire après la vérification du Preview.

- Base de test `lyonpanel-test` créée et migrée par `migrate-test.yml` (CLI Supabase fixé à 2.75.0).
- Variables Vercel Preview séparées de la production (Supabase test, `PROVIDER_MODE=mock`, SasPay test).
- Workflows ajoutés : `migrate-test.yml`, `migrate-prod.yml` (bouton manuel, non testé), `notify.yml`.
