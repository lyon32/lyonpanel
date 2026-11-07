# LyonPanel — Conventions

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Liés : `LLD.md` (arborescence, noms), `ARCHITECTURE.md` (choix techniques).
**Tout agent IA doit lire ce fichier avant d'écrire du code.**

## 0. Décisions du propriétaire

| # | Décision |
|---|---|
| 1 | Versions **bloquées**, mises à jour à la main une fois par mois |
| 2 | Dependabot activé pour les failles de sécurité |
| 3 | Vérification automatique avant chaque commit |
| 4 | Tests obligatoires sur GitHub avant toute mise en ligne |
| 5 | Messages de commit **en français** |
| 6 | Commentaires du code **en français** (les noms restent en anglais, cf. LLD) |
| 7 | Fichier ≤ **300 lignes** environ, sinon découper |
| 8 | Branche `main` protégée : tout passe par une demande de modification (PR) validée par le propriétaire |

## 1. Versions bloquées

- Versions **exactes** dans `package.json` (pas de `^` ni `~`) : fichier `.npmrc` avec `save-exact=true`.
- `package-lock.json` toujours commité ; installation en CI par `npm ci`.
- Node fixé par `.nvmrc` et `"engines"` dans `package.json`.

| Outil | Version majeure visée (mon choix) |
|---|---|
| Node.js | 24 LTS (installé : 24.13.1) |
| npm | 11 |
| TypeScript | 5.x (mode `strict`) |
| Next.js | 15.x (App Router) |
| React | 19.x |
| Tailwind CSS | 4.x |
| next-intl | 4.x |
| @supabase/supabase-js | 2.x |
| @tanstack/react-query | 5.x |
| zod | 3.x |
| react-hook-form | 7.x |
| gsap / lenis | 3.x / 1.x |
| vitest / playwright | dernières stables |
| Supabase CLI / Postgres | dernière stable / 15+ |

Le numéro exact (ex. `15.1.6`) est celui de la dernière version stable le jour de l'initialisation, puis ne bouge qu'à la mise à jour mensuelle. Changer de **version majeure** = accord du propriétaire.

**Mise à jour mensuelle** : `npm outdated`, un paquet à la fois sur une branche `chore/deps-AAAA-MM`, tests complets, PR.
**Dependabot** (`.github/dependabot.yml`) : PR de sécurité uniquement, jamais fusionnées sans tests verts.

## 2. Mise en forme et vérification

| Outil | Règle |
|---|---|
| **Prettier** | `printWidth: 100`, `singleQuote: true`, `semi: true`, `trailingComma: 'all'`, plugin `prettier-plugin-tailwindcss` |
| **ESLint** | `next/core-web-vitals` + `@typescript-eslint/strict` + `import/order` |
| **TypeScript** | `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true` |

Règles ESLint imposées :
- `no-explicit-any` : erreur. Utiliser `unknown` puis valider avec Zod.
- `no-console` : erreur (sauf `console.error` dans `server/`). Utiliser le logger.
- `no-floating-promises` : erreur.
- `max-lines` : avertissement à 300 lignes (hors tests et fichiers générés).
- `no-restricted-imports` : interdit d'importer `@/server/*` depuis `components/`, `hooks/` ou un fichier `"use client"`.
- Appels vers JAP, SasPay, Telegram : uniquement dans `server/providers`.
- Chemins absolus `@/…` (pas de `../../..`).

**Avant chaque commit** (Husky + lint-staged) : Prettier + ESLint sur les fichiers modifiés, `tsc --noEmit`. Commit refusé en cas d'erreur.

**Sur GitHub (CI, chaque PR)** : `npm ci` → lint → `tsc` → tests unitaires → tests base de données (Supabase local) → `next build` → Playwright. Une étape rouge = fusion bloquée = pas de mise en ligne.

## 3. Messages de commit

Format **Conventional Commits**, écrit **en français** :

```
<type>(<module>): <description courte à l'infinitif, sans point>

<corps facultatif : pourquoi, pas comment>
```

| Type | Usage |
|---|---|
| `feat` | nouvelle fonction |
| `fix` | correction de bug |
| `refactor` | réorganisation sans changement de comportement |
| `test` | tests |
| `docs` | documentation |
| `chore` | outils, dépendances, configuration |
| `style` | mise en forme seulement |
| `perf` | performance |

Modules : `auth`, `pricing`, `catalog`, `orders`, `payments`, `referral`, `tickets`, `admin`, `ui`, `db`, `i18n`, `seo`, `deps`.

Exemples :
- `feat(payments): ajouter le webhook SasPay avec vérification de signature`
- `fix(orders): empêcher la double commande sur double clic`
- `chore(deps): mettre à jour next en 15.1.7`

Un commit = une seule idée. Ligne 1 ≤ 72 caractères.

## 4. Branches et demandes de modification

- `main` = version en ligne, **protégée** : pas de push direct (même pour une IA), PR obligatoire, CI verte obligatoire, **validation du propriétaire** obligatoire.
- Branches : `type/sujet-court` → `feat/recharge-saspay`, `fix/polling-commandes`.
- Chaque PR : titre au format commit, description en français (quoi, pourquoi, comment tester), captures si l'interface change.
- Migrations SQL : toujours dans une PR à part.

## 5. Noms de fichiers

Rappel de `LLD.md §7`, plus :

| Type | Modèle | Exemple |
|---|---|---|
| Composant | `kebab-case.tsx`, un composant exporté par fichier | `service-card.tsx` → `ServiceCard` |
| Page / layout / route Next | noms imposés par Next | `page.tsx`, `layout.tsx`, `route.ts` |
| Logique serveur | `verbe-objet.ts` | `place-order.ts` |
| Hook | `use-xxx.ts` | `use-order-status.ts` |
| Schéma Zod | `lib/schemas/<domaine>.ts` | `order.ts` |
| Test unitaire | `<fichier>.test.ts` dans `tests/unit/` | `compute-price.test.ts` |
| Test bout en bout | `<parcours>.spec.ts` dans `tests/e2e/` | `add-funds.spec.ts` |
| Migration | `AAAAMMJJHHMMSS_verbe_objet.sql` | `20261107120000_create_orders.sql` |
| Traductions | `messages/<langue>.json` | `fr.json` |

## 6. Modèles à suivre

1. **Couches** : page / route API → `server/<module>` (logique) → `server/providers` ou fonction SQL. Une route : valider (Zod) → appeler un service → répondre.
2. **Accès aux données par module** (forme simple du « repository ») : chaque module de `server/` est le seul à lire/écrire ses tables.
3. **Argent = fonctions SQL** : tout crédit ou débit passe par `place_order`, `credit_payment`, `refund_order`, `admin_adjust`.
4. **Calcul pur testé** : le prix est fait de fonctions pures, sans base ni réseau.
5. **Valider à la frontière** : formulaire, API, webhook, réponses JAP/SasPay passent par Zod.
6. **Erreurs** : `apiError('CODE')` ; seule l'enveloppe `handler` produit la réponse JSON (`API_SPEC.md §3`).
7. **Composants serveur par défaut** ; `"use client"` seulement pour l'interactivité.
8. **Hooks** : un hook React Query par ressource ; clés de requête dans `lib/query-keys.ts`.
9. **Textes** : toujours via `next-intl`.
10. **Montants** : entiers XAF, nom suffixé (`amountXaf`), affichage via `formatMoney`.
11. **Idempotence** sur toute action qui coûte de l'argent.
12. **Journal** : logger structuré, jamais de secret ni de mot de passe dans les journaux.

## 7. Modèles interdits

| Interdit | À la place |
|---|---|
| Faire confiance à un prix venant du navigateur | Le serveur recalcule toujours |
| Modifier un solde hors fonction SQL | Fonctions SQL atomiques |
| Secret dans le code ou dans une variable `NEXT_PUBLIC_` | Variables d'environnement serveur |
| `any`, `@ts-ignore` | `unknown` + Zod ; `@ts-expect-error` commenté si inévitable |
| Reprise automatique de `jap.add` | Passer en `to_review` |
| Magasin global (Redux, Zustand, Context géant) | React Query + cookies |
| `useEffect` pour charger des données | React Query ou composant serveur |
| Texte affiché en dur | Fichiers `messages/` |
| Nombres décimaux pour l'argent | Entiers XAF |
| Nouvelle bibliothèque sans accord | Liste `LLD.md §1` |
| Nom ou prix JAP côté client | Nom reconstruit, vue `services_public` |
| Commentaire qui répète le code | Commenter le **pourquoi** |
| Code mort, `console.log`, fichier > 300 lignes | Supprimer, logger, découper |
| Désactiver ESLint pour tout un fichier | Corriger le code |
| Push direct sur `main`, `--no-verify` | PR + vérifications |

## 8. Commentaires

- En **français**, courts, sur le **pourquoi** : `// On arrondit au-dessus pour ne jamais vendre sous le coût JAP.`
- Bloc `/** … */` en français sur chaque fonction exportée de `server/`.
- Aucun `TODO` dans le code de l'argent au lancement.
