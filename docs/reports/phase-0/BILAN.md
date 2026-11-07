# Bilan — Phase 0 : Socle du projet
Date : 2026-11-07 · Statut : faite – en attente de validation

## Objectif de la phase (ROADMAP.md)
Un projet Next.js vide mais complet : il démarre, se vérifie tout seul (lint, types, tests, build, CI) et remonte ses erreurs à Sentry, sans aucune logique métier.

## Résultat : ce qui marche maintenant
- `npm run dev` affiche la page provisoire « LyonPanel » sur http://localhost:3000.
- Un commit est vérifié par Prettier et ESLint avant d'être accepté (Husky).
- Le serveur vérifie ses variables d'environnement et refuse les modes « live » hors production.
- Une erreur du site arrive dans Sentry, nettoyée de toute donnée personnelle.
- Le fichier de CI GitHub est écrit : il vérifiera chaque PR et cherchera les secrets.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 0.1 Projet et outils | rapportée | [tâche 0.1](2026-11-07-tache-0.1.md) |
| 0.2 Variables d'environnement | rapportée | [tâche 0.2](2026-11-07-tache-0.2.md) |
| 0.4 CI et secrets | rapportée | [tâche 0.4](2026-11-07-tache-0.4.md) |
| 0.5 Sentry | rapportée | [tâche 0.5](2026-11-07-tache-0.5.md) |
| 0.6 Rapport et documents | rapportée (ce bilan) | — |

Contrôles : relecture `lp-reviewer` ACCEPTÉ. `lp-security` : audit À CORRIGER, puis ré-audit ACCEPTÉ. La phase n'a pas de tâche 0.3.

## Chiffres réels (relancés le 2026-11-07)
- Tests Vitest : 26 écrits, 26 passent, 0 échec (env 9, nettoyage Sentry 12, contrôle du bundle 4, constantes 1).
- Test Playwright : 1 écrit, 1 passe.
- Lint, types, format, build, `check:bundle` : tous sans erreur.
- Couverture globale : 83,16 % des instructions, 81,57 % des branches. `env.ts` 96,15 %, `sentry-scrub.ts` 97,67 %, script `check-client-bundle.mjs` 51,61 %. Aucun module d'argent dans cette phase.
- Durée de la CI : non mesurée (la CI n'a pas encore tourné sur GitHub).

## Problèmes rencontrés et solutions
- **Sentry, 3 essais** : 403 (DSN d'un autre projet) → DSN corrigé ; 400 (le masquage des téléphones abîmait les identifiants) → corrigé dans `bd1a38a` ; 200 au 3e essai.
- **Audit sécurité** : vérification des variables et nettoyage Sentry trop permissifs → durcis dans `518d1b0`, avec tests.
- **Versions** : ESLint 9.39.5 (pas 10, `eslint-config-next@16.4.5`), TypeScript 5.9.3, `@types/node` 24.19.2, `"type": "module"`, `AGENTS.md` généré par Next gardé. Sentry 11.11.0 : `dataCollection` à la place de `sendDefaultPii`, `withSentryConfig` importé de `@sentry/nextjs/config`, `traceLifecycle` sur `'static'`.
- **Incident** : 14 documents à la racine ont été déplacés vers `docs/` par un agent non identifié pendant la phase. Ils ont été restaurés depuis git. À surveiller.

## Points ouverts
- Décision du propriétaire : `SASPAY_MODE=live` hors production (refuser, comme aujourd'hui, ou autre).
- Extras CI non faits : actions GitHub épinglées par SHA, Dependabot pour les actions GitHub, analyse du HTML pré-rendu, valeurs de faux secrets en CI.
- Une date ISO peut être masquée en `[téléphone]` dans Sentry (faux positif sans gravité).
- `NEXT_PUBLIC_VERCEL_ENV` à documenter.
- La CI GitHub n'a jamais tourné : elle sera vérifiée à l'ouverture de la PR.
- Protection de `main` sur GitHub : à faire par le propriétaire.

## À tester par le propriétaire (pas à pas)
1. Sur GitHub, ouvre la PR `feat/phase-0-socle` → `main` : les vérifications (CI) doivent être vertes.
2. En local : `npm ci`, `npm run dev`, puis http://localhost:3000 : tu vois « LyonPanel ».
3. Ouvre https://lyxo.sentry.io/issues/LYONPANEL-1 : l'erreur de test est là, sans email ni téléphone.
4. Protège `main` sur GitHub en suivant `CI_CD.md §4`.

## Carte du code
Carte cliquable générée en local par `graphify update .` : `graphify-out/graph.html` (2461 nœuds, 2902 liens, 225 groupes). Résumé : `graphify-out/GRAPH_REPORT.md`. Le graphe compte aussi les skills et documents du dépôt, pas seulement le code. Ce dossier n'est pas commité (fichier généré).

## Versions installées
Voir `ENV_SETUP.md §6` et `CONVENTIONS.md §1` (mis à jour avec les numéros lus dans `package.json` : Next 16.4.5, React 19.3.1, Zod 4.6.7, TypeScript 5.9.3, Tailwind 4.3.5, Vitest 5.1.0, Playwright 1.65.0, Sentry 11.11.0).

## Ce que le propriétaire doit préparer pour la phase suivante
- Phase 1 (base de données) : rien d'obligatoire (colonne 🧑 de `ROADMAP.md` : « — »).
- Avant tout : protéger `main` (voir ci-dessus).

## Décision attendue : « validé » ou corrections
