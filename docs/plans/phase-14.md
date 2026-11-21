# Phase 14 — Page d'accueil soignée + SEO (plan de cadrage)

Statut : **plan validé par le propriétaire le 2026-11-21** (« validé »). Palette sombre confirmée sur **tout le site public** (accueil, catalogue, connexion, nouvelles pages), le 2026-11-21. Réponses du propriétaire ci-dessous ; les tâches détaillées seront découpées par le chef de projet après validation.

## Décisions du propriétaire (2026-11-21)

1. **Prototypes** : 3 versions d'accueil très différentes, faites avec `unslop` + `antislop-*`. Le propriétaire en choisit une, puis on la finit.
2. **Palette : celle de l'espace client** (sombre : accent `#425EFF`, gris `#D7D7DA`, fond `#111111`), et non plus blanc / bleu `#1D4ED8` / jaune. ⚠️ Cela modifie `docs/05` (accueil) et la règle « accueil, catalogue et connexion inchangés » de la phase 8 : **modification de document à confirmer par le propriétaire en validant ce plan**.
3. **Héros** : 3 titres FR + EN proposés par l'équipe, basés sur ce que les clients cherchent (TikTok, Instagram, Mobile Money, pays). Titre ≤ 60 caractères. Le propriétaire choisit.
4. **Aperçu du tableau de bord** : **aucun** sur l'accueil (retiré).
5. **Pages publiques** : une page par plateforme (prix en XAF, FAQ courte), FAQ, contact, pages par pays.
6. **Hors phase** : confidentialité et conditions (reportées), Google Analytics (après le lancement, donc pas de bandeau de consentement ici).
7. **Domaine** : tout est écrit au nom de `https://lyonpanel.com` (canonical, hreflang, Open Graph, sitemap) via une variable d'environnement. Tant que `lyonpanel.com` n'est pas branché, le site reste en `noindex`. Envoi à Google Search Console, Bing et IndexNow : phase 16.

## Périmètre

- Accueil final (3 prototypes → 1 version finie), animations GSAP/Lenis légères, bouton d'action fixe sur mobile.
- Pages plateformes, FAQ (JSON-LD `FAQPage`), contact, pages par pays (contenu utile : moyens de paiement locaux, prix en XAF ; sinon reportées), 404.
- SEO selon `docs/03 §3 ter` : titre, description, canonical, hreflang fr/en/x-default, Open Graph 1200×630, Twitter, JSON-LD (`Organization`, `WebSite`, `BreadcrumbList`, `Service` + `Offer`), `sitemap.ts`, `robots.ts`, `noindex` sur toutes les pages privées et l'admin.
- Test automatique en CI : chaque page publique a ses balises, chaque page privée a `noindex`.
- Skills : `unslop`, `antislop`, `antislop-ui`, `antislop-layoutmobile`, `antislop-copywriting`, `improve-ui`, `fixing-metadata`, `fixing-motion-performance`, `fixing-accessibility`, `seo-schema`, `seo-hreflang`.

## Hors périmètre

Confidentialité, conditions, Google Analytics, bandeau de consentement, achat du domaine, envoi à Google/Bing, blog, vrai fournisseur et vrais paiements (phase 15).

## Terminé quand

- Bon score mobile Lighthouse ; accueil et pages lisibles à 360 px, FR et EN.
- Chaque page publique : titre, description, canonical, hreflang, Open Graph, JSON-LD valides ; pages privées et admin en `noindex`.
- Lint, types, tests, build et CI verts (CI lue sur la PR) ; rapport dans `docs/reports/phase-14/`.
- Le propriétaire dit « validé ».

## À confirmer par le propriétaire

- ~~Étendue de la palette sombre~~ : tranchée le 2026-11-21, tout le site public (modifie `docs/05` et la règle phase 8 « accueil, catalogue et connexion inchangés »).
- Prototype et titre de héros : choisis après présentation.
- Immatriculation de l'activité et textes légaux : à décider avant la phase 16.

## Tâches (découpage du chef de projet, 2026-11-21)

Ordre : 14.1 (prototypes) → **arrêt, choix du propriétaire** → 14.2 → 14.3 ∥ 14.4 → 14.5 → 14.6 → 14.7.

### Tâche 14.1 — Trois prototypes d'accueil (sombres, très différents)
- Objectif : le propriétaire ouvre 3 pages `/fr/prototypes/a|b|c` (et `/en/…`), compare, choisit un prototype et un titre.
- Documents à lire : `docs/05` §11-12, §9 ; skills `unslop`, `antislop-*`, `baseline-ui`, `apple-design-hig`.
- Dépend de : rien.
- Agents : 3 × `lp-designer` en parallèle (un par prototype, dossiers distincts) → `lp-qa` (captures 360 px et ordinateur). Pas de `lp-tester` : prototypes jetables (écart assumé à `TEAM.md`, les tests viennent avec l'accueil final 14.2).
- Fichiers : A `src/app/[locale]/prototypes/a/**` + `src/components/prototypes/a/**` ; B idem `b` ; C idem `c`. Aucun fichier partagé modifié. Textes FR/EN dans les composants (pas de `messages`). Pages en `noindex`.
- Directions : A éditorial/typographique (grande typo, filets, tableau de prix réels) ; B parcours en 3 étapes mobile d'abord, bouton fixe, mouvement GSAP léger ; C grille de plateformes façon « atelier » (tuiles TikTok/Instagram/YouTube… avec « dès X XAF » réels).
- Titres de héros proposés (≤ 60 car.) : 1 « Plus d'abonnés TikTok, payés en Mobile Money » / « More TikTok followers, paid with Mobile Money » ; 2 « Ton Instagram grandit. Tu paies en XAF. » / « Your Instagram grows. You pay in XAF. » ; 3 « Le panel SMM pensé pour l'Afrique » / « The SMM panel built for Africa ».
- Hors périmètre : aperçu du tableau de bord, faux chiffres/avis/logos, jaune, bibliothèque nouvelle.
- Fini quand : 3 pages s'affichent sans erreur console, lisibles à 360 px, FR et EN, lint et types verts.
- Statut : **terminée le 2026-11-21**

**Prototype choisi : E (validé le 2026-11-21).** Rejetés (A, B, C, D, F) : dossiers à supprimer dans 14.2. Base : `src/components/prototypes/e/**` (déplacée vers `src/components/home/**`), photos `public/images/home/`, logos `public/brand/networks/` et `public/brand/payments/`.

Pages publiques existantes (`src/app/[locale]/(public)/`) : accueil, `services` (+ `[network]`, `[type]`, `[id]`), `blog`, `demo`, `privacy`, `terms` ; `(auth)` : login, register, mot de passe ; `[...rest]` (404) ; `sitemap.ts` et `robots.ts` existent déjà (à compléter, pas à recréer).

### Tâche 14.2 — Accueil final (prototype E) + palette sombre sur tout le site public
- Objectif : `/fr` et `/en` affichent l'accueil E, textes dans `messages` (FR/EN), palette `.lp-app` sur accueil, Services, Blog, connexion/inscription, 404.
- Documents : `docs/05` §11-12, `docs/03`, `docs/01` (chiffres), `CONVENTIONS.md`. Skills : `unslop`, `antislop-*`, `baseline-ui`, `fixing-accessibility`, `fixing-motion-performance`.
- Dépend de : rien (choix fait).
- Agents, dans l'ordre : `lp-tester` (tests de rendu et d'accessibilité : un seul h1, liens, `PLACEHOLDER_STATS` isolé avec pastille « Exemple », aucun nom de fournisseur, aucun « n°1 ») → `lp-coder` (déplace E vers `src/components/home/`, branche `messages`, supprime les prototypes A–D et F, garde `/prototypes/e` en `noindex` jusqu'à fin de phase) → `lp-designer` (palette sur Services, Blog, auth, 404 ; recompresse les 3 images > 200 Ko ; animations légères) → `lp-reviewer` ∥ `lp-qa` (360 px et ordinateur, FR/EN).
- Fichiers : `src/components/home/**`, `src/app/[locale]/(public)/page.tsx`, layouts `(public)` et `(auth)`, `messages/fr.json`, `messages/en.json`, styles de Services/Blog. Pas de SEO ici (14.5).
- Hors périmètre : espace client (déjà sombre), admin, nouvelles pages.
- Fini quand : lint, types, tests verts ; aucune erreur console ; pas de débordement à 360 px ; QA ACCEPTÉ.
- Statut : **terminée le 2026-11-21** (lp-reviewer et lp-qa ACCEPTÉS au 2e passage ; rapports `docs/reports/phase-14/qa/tache-14.2*.md`). Reste pour 14.7 : chargement à ~13 s en réseau très dégradé (200 Ko/s, CPU ×4) à alléger ; `/services` en 500 local sans base (message d'erreur propre à faire en 14.3) ; logo bleu/jaune (identité de marque) à trancher par le propriétaire.

### Tâche 14.3 — Pages plateformes, liste des services, 404
- Objectif : une page par réseau (Instagram, TikTok, YouTube, Facebook, Telegram, X…) avec prix réels en XAF, FAQ courte, JSON-LD `Service` + `Offer` ; 404 soignée en sombre.
- Dépend de : 14.2 (palette et composants). Fichiers : `src/app/[locale]/(public)/services/[network]/**`, `src/components/platform/**`, `messages`. Ne touche pas aux fichiers de 14.4.
- Agents : `lp-tester` → `lp-coder` → `lp-designer` ∥ `lp-seo` → `lp-reviewer` ∥ `lp-qa`.
- Règles : prix calculés côté serveur depuis le catalogue ; jamais le coût fournisseur ni son nom ; réseaux à très peu de services (WhatsApp 3, Spotify 3, Twitch 6, LinkedIn 4) : pas de page propre tant que le contenu est mince (regroupés dans « Autres réseaux »).
- Statut : **terminée le 2026-11-21**

### Tâche 14.4 — FAQ, contact, pages par pays
- Objectif : page FAQ (`FAQPage`), page contact (canal de support existant, aucun nouveau service), pages par pays seulement si contenu utile (moyens de paiement locaux, prix XAF) — sinon reportées et notées au rapport.
- Dépend de : 14.2. Parallèle à 14.3 (fichiers distincts : `src/app/[locale]/(public)/{faq,contact,countries}/**`, `src/components/faq/**`).
- Agents : `lp-tester` → `lp-coder` → `lp-designer` ∥ `lp-seo` → `lp-reviewer` ∥ `lp-qa`.
- Règle : aucune promesse de délai ou de résultat non vérifiée ; formulaire de contact seulement s'il réutilise un mécanisme existant, sinon simple lien.
- Statut : **terminée le 2026-11-21**

### Tâche 14.5 — SEO technique
- Objectif : `NEXT_PUBLIC_SITE_URL` (défaut `https://lyonpanel.com`), metadata par page (titre, description, canonical, hreflang fr/en/x-default, Open Graph 1200×630, Twitter), JSON-LD `Organization`/`WebSite`/`BreadcrumbList`, compléter `sitemap.ts` et `robots.ts`, `noindex` global tant que `SITE_INDEXABLE` n'est pas `true`, `noindex` permanent sur pages privées et admin. Mots-clés : `docs/plans/phase-14-seo-mots-cles-et-prompts-images.md`.
- Dépend de : 14.3 et 14.4. Agents : `lp-tester` → `lp-seo` → `lp-reviewer`.
- Fichiers : `src/lib/seo/**`, `src/app/sitemap.ts`, `src/app/robots.ts`, `generateMetadata` des pages publiques, `.env.example`, `ENV_SETUP.md`.
- Statut : **terminée le 2026-11-21**

### Tâche 14.6 — Test CI des balises
- Objectif : un test qui parcourt les pages publiques (titre, description, canonical, hreflang, OG, JSON-LD valide) et les pages privées/admin (`noindex`), lancé par la CI.
- Dépend de : 14.5. Agents : `lp-tester` → `lp-reviewer`. Fichiers : `tests/unit/seo/**` ou `tests/e2e/seo/**` ; workflow CI modifié seulement s'il ne lance pas déjà ces dossiers.
- Statut : **terminée le 2026-11-21**

### Tâche 14.7 — Lighthouse, rapport, PR
- Objectif : Lighthouse mobile sur la version de production (accueil, une page plateforme, FAQ) ; contrôle du poids des images ; rapport `docs/reports/phase-14/README.md` (`lp-reporter`) ; branche + PR (jamais sur `main`) ; CI lue sur la PR ; attendre « validé ».
- Dépend de : 14.2 à 14.6.
- À clore avant les phases 15/16 (notés au rapport) : remplacer `PLACEHOLDER_STATS` par les vrais chiffres ; nettoyer les logos de paiement inutilisés ; images Magnific (si générées) ; volumes de mots-clés quand un outil est disponible ; passer le site en indexable à la mise en ligne.
- Statut : **en attente de validation du propriétaire** (2026-11-21 ; rapport `docs/reports/phase-14/README.md`)

Ordre d'exécution : 14.2 → (14.3 ∥ 14.4) → 14.5 → 14.6 → 14.7. Deux agents ne touchent jamais le même fichier en même temps (`TEAM.md` §5).

## Rappel

La phase 13 (mise en ligne de test) reste ouverte : points restants dans `docs/reports/phase-13/README.md` (PR 36).
