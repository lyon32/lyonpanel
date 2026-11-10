# LyonPanel — Contexte pour l'IA

À lire **en entier** au début de chaque session. Court par choix : les détails sont dans les documents listés ci-dessous.

## Le projet en 5 lignes

- **LyonPanel** (lyonpanel.com) : panel SMM pour l'Afrique (abonnés, likes, vues), « 1er panel SMM d'Afrique ».
- Revend les services d'**un fournisseur (API v2)** avec une marge.
- Le client **recharge son solde** par **SasPay** (Mobile Money), puis chaque commande est débitée du solde.
- Clients : créateurs TikTok et commerçants Instagram. Pire échec : **un client qui paie et ne reçoit rien**.
- Stack : Next.js + TypeScript, Tailwind, shadcn/ui, GSAP, Lenis, Supabase, Vercel, Cloudflare. Site **en français et en anglais**.

## Où trouver quoi

| Besoin | Document |
|---|---|
| Pourquoi, pour qui, réussite | `PROJECT_BRIEF.md` |
| Fonctions, parcours, cas limites | `PRD.md` |
| Composants, diagrammes, choix techniques | `ARCHITECTURE.md` |
| Tables, RLS, fonctions SQL d'argent | `DATA_MODEL.md` |
| Endpoints, erreurs, codes HTTP | `API_SPEC.md`, `openapi.yaml` |
| Arborescence, modules, signatures, noms | `LLD.md` |
| Versions, lint, commits, à faire / à éviter | `CONVENTIONS.md` |
| Variables d'env, installation locale | `ENV_SETUP.md`, `.env.example` |
| Tests, couverture, données de test | `TESTING.md` |
| Droits, validation, cas limites, secrets | `SECURITY_NOTES.md` |
| Vérification et mise en ligne | `CI_CD.md` |
| Phases de réalisation | `ROADMAP.md` |
| Couleurs, polices, composants, **références visuelles** (§9) | `docs/05-design-system.md`, images dans `reference-design system/` |
| Marges, catalogue, prix | `docs/01-catalogue-et-prix.md` |
| Paiements SasPay (API, webhooks, frais) | `docs/06-saspay.md` |
| SEO, règles anti « look IA » | `docs/03-seo-et-design.md` |

En cas de contradiction entre deux documents : **s'arrêter et demander** au propriétaire.

## Équipe (sous-agents)

La session principale est le **chef de projet**. Elle ne code pas elle-même : elle découpe la phase (`docs/plans/phase-<N>.md`) et confie chaque tâche aux sous-agents de `.claude/agents/` dans l'ordre de `TEAM.md` :
`lp-tester` → `lp-db` (si base) → `lp-coder` (jusqu'à 3 en parallèle sur des tâches indépendantes) → `lp-designer` ∥ `lp-seo` (si écran / page publique) → `lp-reviewer` ∥ `lp-qa` (si écran) ∥ `lp-security` (si argent, comptes, admin) → `lp-reporter`.
Un agent ne démarre jamais avant ce dont il dépend ; ce qui est indépendant tourne en parallèle ; deux agents ne touchent jamais le même fichier en même temps. Règlement complet : `TEAM.md`. Fiches détaillées : `.claude/agents/*.md` (9 agents, Sonnet, effort faible).

## Skills à utiliser

**Déjà installés (plugins)**
- **superpowers** : `brainstorming` avant toute nouveauté, `writing-plans` puis `executing-plans` / `subagent-driven-development` pour chaque phase, `test-driven-development`, `systematic-debugging` pour un bug, `verification-before-completion` avant de dire « fini ».
- **ecc** : `ecc:code-review`, `ecc:security-review`, `ecc:tdd-workflow`, `ecc:frontend-patterns`, `ecc:postgres-patterns`, agents `ecc:database-reviewer`, `ecc:security-reviewer`, `ecc:typescript-reviewer`, `ecc:react-reviewer`.

**Installés dans le projet (`.claude/skills/`)**
- **anti-slop** (prioritaire pour retirer tout aspect « IA ») : `antislop` (point d'entrée), `antislop-ui`, `antislop-layoutmobile`, `antislop-copywriting`, `antislop-human`, `antislop-code`.
- **ui-skills** (ibelick) : `baseline-ui`, `improve-ui`, `fixing-accessibility`, `fixing-metadata`, `fixing-motion-performance`, `create-design-md`.
- **apple-design-hig** (dickwu) : principes de clarté, hiérarchie, espacement, accessibilité.
- **ponytail** (DietrichGebert) : `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help` — la solution la plus simple qui marche, pas de sur-ingénierie.
- **firecrawl** (officiel) : `firecrawl`, `firecrawl-scrape`, `firecrawl-search`, `firecrawl-crawl`, `firecrawl-map`, `firecrawl-seo-audit`, `firecrawl-competitive-intel`, `firecrawl-qa`. Nécessite une clé `FIRECRAWL_API_KEY` (compte firecrawl.dev) dans l'environnement local, jamais dans le dépôt.
- **awesome-claude-skills** (ComposioHQ, sélection) : `webapp-testing` (Playwright), `content-research-writer`, `competitive-ads-extractor`, `changelog-generator`.
- **ui-ux-pro-max** (nextlevelbuilder) : déjà installé en plugin (`ui-ux-pro-max:*`), pas de copie dans le projet.

**Quand les utiliser**
- Toute interface (page, composant, texte affiché) : `baseline-ui` pendant, puis **`antislop-ui` + `antislop-layoutmobile`** à la fin de la phase.
- Tout texte visible (accueil, FAQ, boutons, emails) : **`antislop-copywriting`**.
- Avant chaque PR de code : `antislop-code` + `ecc:code-review` ; si argent ou auth : `ecc:security-review`.
- Phase 14 (accueil + SEO) : `antislop`, `improve-ui`, `fixing-metadata`, `fixing-motion-performance`, `fixing-accessibility`.
- Avant d'écrire du code : `ponytail` (faire simple) ; avant chaque PR : `ponytail-review`.
- Vérifier une page dans un vrai navigateur : `webapp-testing` (Playwright) ou le navigateur intégré.
- Concurrents, SEO, contenu de blog (Phase 14 et après) : `firecrawl-seo-audit`, `firecrawl-competitive-intel`, `competitive-ads-extractor`, `content-research-writer`.
- Notes de version après chaque phase : `changelog-generator`.
- Les règles du design system (`docs/05`) priment sur celles des skills en cas de conflit (ex. police Public Sans, pas de mode sombre).
- Ne jamais lancer les commandes de mise à jour proposées dans les skills (`npx antislop-ai`, `npx ui-skills`, `npx @google/design.md`, `npm install -g firecrawl-cli`, `npm install -g @anthropic-ai/claude-code`) sans accord du propriétaire.

## Rappels pour plus tard

- **Fin de la phase 14 (accueil terminé)** : rappeler au propriétaire de proposer 2 à 3 prototypes d'accueil très différents (couleurs du design system gardées), inspirés des références, avec tous les skills de design dont `unslop`. Détail dans `ROADMAP.md`, phase 14.
- Skill de design du propriétaire à toujours utiliser pour tout ce qui est visuel : `unslop` (`.claude/skills/unslop/`), avec `antislop-*`. Les règles de `docs/05` priment en cas de conflit.

## Serveurs MCP

- `mcp-tools-istefox` : serveur local (`127.0.0.1:27200`), configuré dans la config **locale** de Claude Code (hors dépôt). Son jeton ne doit jamais être écrit dans un fichier du projet.

## Toujours

1. Lire la **tâche de la session** (plus bas) et ne travailler **que** sur elle.
2. Suivre l'arborescence et les noms de `LLD.md` ; code en **anglais**, commentaires et commits en **français**.
3. Calculer tout prix **côté serveur** ; ne jamais faire confiance à un montant venant du navigateur.
4. Faire bouger l'argent **uniquement** via les fonctions SQL (`place_order`, `credit_payment`, `refund_order`, `admin_adjust`).
5. Montants en **entiers XAF**, noms suffixés (`amountXaf`).
6. Valider toute entrée avec **Zod** ; erreurs au format unique (`API_SPEC.md §3`), messages FR/EN.
7. Écrire les **tests en même temps que le code** ; 100 % sur l'argent ; un bug corrigé = un test.
8. Utiliser le **faux fournisseur** (`PROVIDER_MODE=mock`) et **SasPay test** en local.
9. Respecter le design system : blanc, bleu `#1D4ED8`, jaune en accent, Public Sans, aucun look IA.
10. Lancer lint, types et tests **avant** de dire qu'une tâche est finie, et montrer le résultat.
11. **Demander avant d'agir** sur : prix et marges, sécurité, nouvelle bibliothèque, changement de schéma non prévu, tout ce qui coûte de l'argent réel.

## Jamais

1. Écrire un secret (clé fournisseur, SasPay, Supabase, Telegram) dans le code, un commit, un journal ou une variable `NEXT_PUBLIC_`. **La clé fournisseur vue en conversation doit être régénérée.**
2. Montrer au client le coût fournisseur, la marge, le multiplicateur ou le nom du fournisseur.
3. Relancer automatiquement `provider.add` (risque de double commande).
4. Rembourser automatiquement : toujours après examen par le propriétaire.
5. Modifier un solde avec un simple `update`.
6. Ajouter une bibliothèque hors de `LLD.md §1`, changer de framework, ajouter un service externe.
7. Utiliser `any`, `@ts-ignore`, `dangerouslySetInnerHTML`, `useEffect` pour charger des données, un magasin global.
8. Pousser sur `main`, utiliser `--no-verify`, modifier une migration déjà appliquée.
9. Toucher à un module hors de la tâche de la session, même pour « améliorer ».
10. Utiliser le vrai fournisseur ou un vrai paiement hors de la phase 15.
11. Dire « c'est fait » sans avoir lancé les vérifications.
12. Faire apparaître le nom du fournisseur côté client (site, noms et descriptions de services, erreurs, URL publiques).

## Le propriétaire

- Écrit en français, souvent rapidement. Lui répondre **en français simple**, sans jargon technique.
- Préfère les **listes claires** aux tableaux compliqués ; montrer des chiffres concrets (ex. « 10 000 XAF → 500 XAF »).
- Aime qu'on lui pose les questions **avant** de créer, avec un conseil proposé pour chacune.
- Valide chaque phase en disant « validé ». Rien n'avance sans ce mot.
- Seul administrateur du site.

## Tâche de la session

> À mettre à jour au début de chaque phase (`ROADMAP.md`).

**Phase en cours : Phase 4 — Prix + catalogue** (Phases 0 et 1 validées le 2026-11-07, phase 2 le 2026-11-08, phase 3 le 2026-11-09, phase 4 le 2026-11-10)

**Périmètre (seulement ceci)**
- (a) Prix = coût fournisseur en XAF × multiplicateur (départ ×3 partout). Multiplicateur réglable par catégorie (réseau × type), avec surcharge par service, jamais en dur ; structure et calcul en base maintenant (écran admin en phase 12). Taux 1 USD = 600 XAF réglable (réglage, pas en dur). Arrondi au multiple de 5 XAF supérieur (prix pour 1000 ET total de commande, minimum 5 XAF). Calculs côté serveur uniquement.
- (b) Faux fournisseur (`PROVIDER_MODE=mock`) et client du vrai fournisseur (vrai appel seulement en phase 15).
- (c) Catalogue de 2 188 services classés par règles sur le nom : d'abord le réseau (Instagram, TikTok, Facebook, YouTube, Telegram, Twitter/X, Kick, Threads, etc.), puis le type (abonnés, likes, vues, commentaires, partages, autres). TOUS les services sont vendus et actifs, sauf ceux que le fournisseur déclare indisponibles. Noms reconstruits (jamais le nom ni le prix du fournisseur).
- (d) Pages catalogue et fiche service, prix en XAF/XOF/USD, prix de la commande minimum affiché.

**Hors périmètre (ne pas toucher)**
- Paiement, commande, admin (phases 11 et 12), écrans de compte, page d'accueil et SEO.
- Migrations déjà appliquées (changement de schéma non prévu : demander d'abord) ; toute bibliothèque hors `LLD.md §1`.

**Terminé quand (définition de « fini »)**
- [ ] Catalogue rangé (réseau puis type), tous les services actifs sauf indisponibles.
- [ ] Les prix respectent les multiplicateurs ; aucun nom ne contient le fournisseur ni son prix.
- [ ] Lint, types, tests, build verts ; CI GitHub verte sur la PR ; `lp-security` si pertinent.
- [ ] Rapport dans `docs/reports/phase-4/` et résumé au propriétaire en français simple, avec ce qu'il doit tester.

## État des documents

**Tous les documents sont validés par le propriétaire le 2026-11-07** (brief, PRD, architecture, modèle de données, API, LLD, conventions, environnement, tests, sécurité, CI/CD, roadmap, équipe, design system). Toute modification future d'un de ces documents demande son accord. Le site est **FR + EN** (corrigé dans le brief, le PRD et `docs/00`).

## Outils de mémoire et de vue d'ensemble

- **graphify** (installé, skill `/graphify`, voir section en bas) : graphe de connaissance du projet (`graphify-out/`), consulté avant toute recherche dans le code et mis à jour après chaque modification. Règle à copier dans le message de chaque sous-agent qui explore le code.
- **Obsidian** (serveur MCP `mcp-tools-istefox`) : mémoire du projet pour le propriétaire (rapports, suivi, vues graphiques), tenue par `lp-reporter`.
- **CodeRabbit** : relecture automatique des PR (`.coderabbit.yaml`, génération de tests unitaires désactivée : c'est le rôle de `lp-tester`).
- **context-mode** : **pas installé**, à évaluer fin de Phase 2 (`ROADMAP.md`, section « Outil à évaluer plus tard »). Ne pas l'installer sans accord.
- **Sentry** : suivi des erreurs en production (skill `sentry-instrument`, `docs/` + `ENV_SETUP.md`).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
