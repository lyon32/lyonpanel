# Référencement Afrique et design

## 1. Positionnement

Message central : **« Le 1er panel SMM d'Afrique »** (formulation à valider juridiquement : « premier » est une affirmation à pouvoir justifier ; alternative : « le panel SMM pensé pour l'Afrique »). Cible d'abord francophone (Cameroun, Côte d'Ivoire, Sénégal, etc. : pays exacts à confirmer), puis anglophone.

## 2. Pages publiques

- Accueil (promesse, 3 étapes, plateformes, FAQ courte, appel à l'action).
- Liste des services avec filtres.
- Une page par plateforme (Instagram, TikTok, Facebook d'abord) : « Acheter des abonnés Instagram au Cameroun », etc.
- Une page par pays francophone ciblé (contenu réel, pas de texte copié-collé).
- FAQ, blog, contact/support, politique de confidentialité, conditions.
- Page de remerciement après inscription ou recharge.
- Page 404 personnalisée.

## 3. Liste SEO (tes points, rattachés à une action)

| Point | Action |
|---|---|
| Page unique + liens internes | Maillage accueil ↔ plateformes ↔ pays ↔ blog |
| Robots.txt, sitemap | Générés par Next.js, tableau de bord privé exclu |
| Meta descriptions, titres | Uniques par page, en français **et** en anglais (voir §3 ter) |
| Fil d'Ariane | Composant + balisage structuré |
| Balises alt | Sur toutes les images |
| Images de partage réseaux sociaux | Image Open Graph par page |
| FAQ + schéma | Balisage `FAQPage`, `Organization`, `BreadcrumbList` |
| Appel à l'action fixe sur mobile | Bouton collant « Créer un compte » |
| Google Analytics | Avec bandeau de consentement |
| Google Business | Fiche si une adresse ou présence locale existe ; sinon à reporter (à décider) |
| Politique de confidentialité | Page dédiée |

Remarque ton choix : pour les pages par pays, le contenu doit apporter une vraie valeur (moyens de paiement locaux, prix dans la monnaie du pays), sinon Google les juge faibles.

## 3 bis. Technique SEO

Rendu serveur Next.js, images optimisées, polices légères, bon temps de chargement sur réseau mobile africain (budget de poids de page à fixer), données structurées, `hreflang` fr/en dès le lancement.

## 3 ter. Indexation et métadonnées (règles obligatoires)

**Pages indexées par Google** (dans le sitemap, `index, follow`) — en `/fr/` et `/en/` :
accueil, une page par plateforme, liste des services, pages pays (quand elles existent), FAQ, blog, confidentialité, conditions, contact.

**Pages jamais indexées** (`noindex, nofollow` + absentes du sitemap) :
- espace client : tableau de bord, commander, commandes, recharger, transactions, favoris, support, parrainage, compte ;
- connexion, inscription, mot de passe oublié/réinitialisation, page de remerciement ;
- **admin** (adresse secrète, en plus : en-tête `X-Robots-Tag`, jamais citée dans `robots.txt`) ;
- routes `/api/*`, versions Preview Vercel (en-tête `noindex` sur tout domaine autre que `lyonpanel.com`).

**Chaque page indexée a obligatoirement** (via `generateMetadata` de Next.js) :
| Élément | Règle |
|---|---|
| `<title>` | unique, ≤ 60 caractères, mot-clé + « LyonPanel » (ex. « Acheter des abonnés TikTok au Cameroun – LyonPanel ») |
| meta description | unique, 140–160 caractères, en FR et EN, sans promesse fausse |
| canonical | URL absolue de la page dans sa langue (`https://lyonpanel.com/fr/...`), sans paramètres |
| `hreflang` | `fr`, `en` et `x-default` (→ fr) sur chaque page |
| Open Graph | `og:title`, `og:description`, `og:url`, `og:image` (1200×630, par plateforme), `og:locale` (`fr_FR` / `en_US`), `og:site_name` |
| Twitter | `summary_large_image` |
| Données structurées (JSON-LD) | `Organization` + `WebSite` sur l'accueil ; `BreadcrumbList` partout ; `FAQPage` sur la FAQ ; `Service` + `Offer` (prix en XAF) sur les pages plateformes ; jamais de faux avis (`Review` / `AggregateRating` interdits sans vrais avis) |
| `<html lang>` | `fr` ou `en` selon la page |
| Favicon / icônes | `favicon.ico`, `apple-touch-icon`, `manifest` (fichiers de `brand/lyonpanel-v2/png/`) |
| Images | `alt` descriptif, dimensions fixées, format WebP/AVIF |

**robots.txt** : autorise tout le site public, interdit `/api/`, `/fr/tableau-de-bord`, `/en/dashboard` et autres pages client ; indique le sitemap. Ne mentionne **jamais** l'adresse admin.
**sitemap.xml** : généré par Next.js, uniquement les pages indexables, les deux langues avec leurs liens `hreflang`, date de mise à jour.

**Mise en ligne et suivi de l'indexation** (Phase 14) :
1. Google Search Console : valider le domaine (DNS Cloudflare), envoyer le sitemap, suivre les pages indexées et les erreurs.
2. Bing Webmaster Tools : même chose (Bing alimente aussi d'autres moteurs) + IndexNow pour signaler les nouvelles pages.
3. Vérifier chaque page indexable avec l'outil d'inspection d'URL et le test des résultats enrichis de Google.
4. Contrôle automatique en CI (mon choix) : test qui vérifie que chaque page publique a titre, description, canonical, hreflang, og:image, et que chaque page privée a `noindex`.

**Skills à utiliser** : `fixing-metadata` (contrôle des balises), `seo-technical`, `seo-schema`, `seo-sitemap`, `seo-hreflang`.

## 4. Design

Références : les deux images fournies (tableau de bord « SMMSpot » et page d'accueil). Éléments à retenir : barre latérale claire, cartes de solde et commandes, formulaire de commande à gauche et fiche du service à droite, onglets Nouvelle commande / Recherche / Commande groupée, accueil avec 3 étapes.

Directions de ton choix (à valider) :
- Fond clair, un seul bleu d'accentuation, beaucoup d'espace, typographie nette.
- Couleurs et détails qui rappellent l'Afrique de façon sobre (touche chaude ponctuelle), sans clichés.
- Animations **GSAP** discrètes (entrées, compteurs), défilement **Lenis** modéré, désactivé si l'utilisateur préfère moins de mouvement.
- Mobile d'abord : une grande partie des clients seront sur téléphone.

Compétences de design à utiliser au moment de construire (demandées) : emilkowalski-motion, impeccable, taste, ui-ux-pro-max.

## 5. À éviter pour ne pas avoir un look « généré par IA »

- Dégradés violets / bleu-violet par défaut.
- Icônes génériques d'IA et illustrations générées ; préférer un seul jeu d'icônes cohérent (ou dessinées).
- Bordures et coins inégaux, ombres lourdes, cartes toutes identiques.
- **Faux avis, faux chiffres, faux logos de clients** : interdits. Les compteurs et témoignages doivent être réels ou absents (c'est aussi un risque légal).
- Textes creux (« révolutionnaire », « propulsé par l'IA ») ; écrire concret : prix en XAF, délais, garanties réelles.
- Photos de banque d'images évidentes ; préférer des visuels propres au produit (captures du panel).

## 6. Textes

Français simple, ton direct. Garanties affichées seulement si fournisseur les propose réellement pour le service (refill 30 jours, etc.).
