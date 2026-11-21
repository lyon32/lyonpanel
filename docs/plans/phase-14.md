# Phase 14 — Page d'accueil soignée + SEO (plan de cadrage)

Statut : **plan validé par le propriétaire le 2026-11-21** (« validé »). Reste à trancher au démarrage de l'exécution : l'étendue de la palette sombre (voir « À confirmer »). Réponses du propriétaire ci-dessous ; les tâches détaillées seront découpées par le chef de projet après validation.

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

- La palette sombre s'applique-t-elle aussi au catalogue public et à la connexion, ou seulement à l'accueil et aux nouvelles pages ? (Conseil : tout le site public, pour rester cohérent.)
- Prototype et titre de héros : choisis après présentation.
- Immatriculation de l'activité et textes légaux : à décider avant la phase 16.

## Rappel

La phase 13 (mise en ligne de test) reste ouverte : points restants dans `docs/reports/phase-13/README.md` (PR 36).
