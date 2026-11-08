# Phase 3 — Comptes : plan

Branche : `feat/phase-3-comptes`. Phase 2 validée le 2026-11-08.

## Décisions du propriétaire (2026-11-08)

| # | Question | Réponse | Conséquence |
|---|---|---|---|
| 1 | Code SMS pour la connexion par téléphone ? | **Non, pas pour l'instant** | Le numéro sert d'identifiant avec mot de passe, sans vérification par SMS. Aucun service SMS, aucun coût. Code SMS à reprendre plus tard si besoin. |
| 2 | Confirmation de l'email obligatoire ? | **Non** (conseil donné : oui) | Pas de blocage avant recharge/commande. Risque assumé : faux comptes et email faux = mot de passe oublié inutilisable pour ces comptes. Le message « mot de passe oublié » reste identique que l'email existe ou non. À revoir en phase 15 si des abus apparaissent. |
| 3 | Turnstile | **Vrai widget dès maintenant** | Le propriétaire crée le widget Cloudflare et met les clés dans `.env.local` (jamais dans le dépôt, jamais `NEXT_PUBLIC_` pour la clé secrète). En attendant, les clés de test Cloudflare permettent de développer. |
| 4 | Pays autorisés | **Tous les pays d'Afrique** | Liste ISO des pays d'Afrique dans la config. Certains pays ne pourront pas payer par Mobile Money : message clair à prévoir à la recharge (phase 5). |

## Périmètre

Voir « Tâche de la session » dans `CLAUDE.md` : inscription, connexion email ou téléphone, déconnexion, mot de passe oublié, règles de `SECURITY_NOTES.md §2`, `handler`, `apiError`, messages FR/EN.

## Tâches (ordre de `TEAM.md`)

1. `lp-tester` : tests d'abord (schémas Zod, règles de mot de passe, blocage 5 échecs / 15 min, réponses identiques, e2e inscription → connexion téléphone → mot de passe oublié).
2. `lp-db` : seulement si un changement de schéma est nécessaire (demander d'abord ; migrations existantes intactes).
3. `lp-coder` (jusqu'à 3 en parallèle) : `server/auth`, `handler`/`apiError`, routes API, formulaires.
4. `lp-designer` ∥ `lp-seo` : écrans inscription, connexion, mot de passe oublié (design system phase 2, skill `unslop`) ; pages privées en `noindex`.
5. `lp-reviewer` ∥ `lp-qa` ∥ `lp-security` (obligatoire : comptes).
6. `lp-reporter` : rapport `docs/reports/phase-3/`.

## À vérifier avant de coder

- Le modèle de données (`DATA_MODEL.md`) prévoit-il téléphone + pays + devise + langue dans le profil ? Sinon, demander avant toute migration.
- Connexion par téléphone avec Supabase Auth sans SMS : confirmer que c'est faisable (identifiant interne dérivé du numéro, ou email synthétique) sans alourdir la sécurité.

## Rappels

- Les règles de `docs/05` priment sur les skills ; texte visible FR + EN, aucun texte ni chiffre inventé.
- Aucune clé dans le dépôt ; pas de vraie clé JAP/SasPay avant la phase 15.
