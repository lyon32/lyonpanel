# LyonPanel — Design system

Objectif : un site **simple, clair, humain**. Fond blanc, bleu comme couleur principale, jaune pour les accents. Rien qui fasse « généré par IA ».

## 1. Couleurs

### Principales
| Rôle | Nom | Code | Usage |
|---|---|---|---|
| Fond | Blanc | `#FFFFFF` | Fond de toutes les pages |
| Principal | Bleu Lyon | `#1D4ED8` | Boutons principaux, liens, logo, éléments actifs |
| Accent | Jaune Lyon | `#D9A23B` | Petits accents : badge « Populaire », flèche du logo, soulignés |

### Nuances du bleu
| Nom | Code | Usage |
|---|---|---|
| Bleu 50 | `#EFF4FF` | Fond de section légère, ligne survolée |
| Bleu 100 | `#DBE6FE` | Fond de badge, encadré d'info |
| Bleu 600 | `#1D4ED8` | Couleur principale |
| Bleu 700 | `#1A3FB0` | Bouton survolé |
| Bleu 900 | `#14286B` | Bouton appuyé |

### Nuances du jaune
| Nom | Code | Usage |
|---|---|---|
| Jaune 50 | `#FDF7EA` | Fond d'encadré « remise » ou « astuce » |
| Jaune 500 | `#D9A23B` | Accent |
| Jaune 700 | `#A87A22` | Texte jaune sur fond blanc (lisible) |

### Neutres
| Nom | Code | Usage |
|---|---|---|
| Encre | `#0E1726` | Titres et texte principal |
| Gris 600 | `#475467` | Texte secondaire |
| Gris 400 | `#98A2B3` | Texte d'aide |
| Gris 200 | `#E4E7EC` | Bordures, séparateurs |
| Gris 50 | `#F8FAFC` | Fond de carte, en-tête de tableau |

### Statuts (commandes, paiements)
| État | Texte | Fond |
|---|---|---|
| Terminé / Réussi | `#067647` | `#ECFDF3` |
| En attente / En cours | `#A87A22` | `#FDF7EA` |
| Échec / Annulé | `#B42318` | `#FEF3F2` |
| Info | `#1D4ED8` | `#EFF4FF` |

**Règles**
- Blanc ≈ 70 % de l'écran, bleu ≈ 20 %, jaune 5 % maximum.
- Jamais de texte Jaune 500 sur blanc : utiliser Jaune 700.
- **Interdits** : dégradés violets/roses, arc-en-ciel, néons, fonds noirs « tech ».

## 2. Polices

Simples, lisibles, gratuites (Google Fonts), rapides sur mobile.

| Rôle | Police | Graisses |
|---|---|---|
| Titres et texte | **Public Sans** | 400, 600, 700 |
| Prix, soldes, quantités | Public Sans, chiffres alignés (`tabular-nums`) | 600 |
| Secours | `system-ui, "Segoe UI", Arial, sans-serif` | — |

Pourquoi : neutre et sérieuse, pas « à la mode IA » (on évite Inter, Space Grotesk, Poppins partout). Montserrat reste **uniquement dans le logo**.

| Élément | Mobile | Ordinateur | Graisse |
|---|---|---|---|
| Titre de page (H1) | 28 px | 40 px | 700 |
| Titre de section (H2) | 22 px | 28 px | 700 |
| Sous-titre (H3) | 18 px | 20 px | 600 |
| Texte | 16 px | 16 px | 400 |
| Petit texte | 14 px | 14 px | 400 |
| Badge | 12 px | 12 px | 600 |

Interligne 1,5 (texte), 1,2 (titres). Pas de majuscules sauf les petits badges.

## 3. Espacements et formes

- Espacements : 4, 8, 12, 16, 24, 32, 48, 64 px.
- Contenu max 1200 px ; marges mobiles 16 px.
- Arrondis : 8 px (boutons, champs), 12 px (cartes), pilule (badges).
- Bordure : 1 px Gris 200. Une seule ombre légère : `0 1px 3px rgba(14,23,38,.08)`.

## 4. Composants

**Boutons**
| Type | Fond | Texte | Usage |
|---|---|---|---|
| Principal | Bleu 600 | Blanc | « Commander », « Recharger » (un seul par écran) |
| Secondaire | Blanc + bordure Gris 200 | Encre | Actions secondaires |
| Discret | Transparent | Bleu 600 | Liens, « Voir le détail » |
| Danger | `#B42318` | Blanc | Annuler |

Hauteur min 44 px. Après clic : désactivé + « Chargement… » (anti-double paiement).

**Champs** : fond blanc, bordure Gris 200, focus bordure Bleu 600 + halo Bleu 100. Libellé toujours au-dessus. Erreur en rouge, phrase claire, sous le champ.

**Carte service** : blanc, bordure Gris 200, arrondi 12 px. Logo officiel de la plateforme, nom simple, prix pour 1 000 en gras, min/max, badges (Garanti, Rapide). « Populaire » en jaune.

**Badges de statut** : pilule aux couleurs du tableau Statuts.

**Tableaux** : en-tête Gris 50, chiffres alignés à droite ; sur mobile, chaque ligne devient une carte.

## 5. Icônes et images

- Icônes **Lucide** (trait fin), 20 px. Réseaux sociaux : logos officiels.
- Photos réelles de personnes et contextes africains (téléphone, boutique, créateur).
- **Interdits** : robots, cerveaux, étincelles ✨, objets 3D, personnages IA, faux avis, faux compteurs.

## 6. Mouvement

- Animations 150–250 ms, `ease-out`. Apparition douce des sections (fondu + 8 px), une fois.
- Lenis coupé sur petits téléphones et si `prefers-reduced-motion`.
- Jamais d'animation sur les prix et le solde.

## 6 bis. Mouvement et retour visuel (ajout du 2026-11-09, accord du propriétaire)

- Toute action qui prend plus d'environ 300 ms montre un état de chargement **sur le bouton** : petit rond qui tourne, `aria-busy`, bouton désactivé, libellé en « …ant » (ex. « Connexion… »).
- Puis un bref état de succès (coche, 600 ms au plus) avant la redirection.
- Paiement (recharge SasPay) et commande : une progression visible, jamais un écran figé.
- `prefers-reduced-motion` est toujours respecté : plus de glissement ni de rotation, un simple changement d'état.
- Composant : `src/components/ui/button.tsx` (états `loading` et `success`).

## 7. Accessibilité

- Contraste texte ≥ 4,5:1 (Bleu 600 sur blanc : OK ; Jaune 500 sur blanc : non → Jaune 700).
- Focus clavier visible (halo bleu). Texte alternatif sur toutes les images.

## 8. Variables CSS

```css
:root {
  --blanc:#FFFFFF;
  --bleu-50:#EFF4FF; --bleu-100:#DBE6FE; --bleu-600:#1D4ED8; --bleu-700:#1A3FB0; --bleu-900:#14286B;
  --jaune-50:#FDF7EA; --jaune-500:#D9A23B; --jaune-700:#A87A22;
  --encre:#0E1726; --gris-600:#475467; --gris-400:#98A2B3; --gris-200:#E4E7EC; --gris-50:#F8FAFC;
  --succes:#067647; --erreur:#B42318;
  --rayon:8px; --rayon-carte:12px;
  --police:"Public Sans", system-ui, "Segoe UI", Arial, sans-serif;
}
```

## 9. Références visuelles

Dossier : `reference-design system/` (7 images fournies par le propriétaire le 2026-11-07).
**On reprend la structure et la clarté, jamais les couleurs ni les éléments « IA ».** Nos couleurs restent blanc, bleu `#1D4ED8`, jaune `#D9A23B`.

### Ce qu'on reprend, image par image

| Image | Écran LyonPanel | À reprendre |
|---|---|---|
| `Lumen_ A Clean and Modern SMM Panel Dashboard.jpg` | **Page « Commander » + espace client** (modèle principal) | Barre latérale à gauche (Nouvelle commande en bouton bleu plein, puis Commandes, Services, Recharger, Parrainage, Support, Compte) ; solde visible en haut à droite ; 4 cartes de chiffres (Solde, Commandes, Total dépensé, Terminées) avec un lien d'action en bas de chaque carte ; formulaire à gauche (Catégorie → Service → Lien → Quantité « Min 10 – Max 300 » → sous-total + bouton Commander) et **fiche du service à droite** (délai de départ, garantie, nombre de commandes réussies, « Comment commander » en 3 points) ; onglets « Nouvelle commande / Recherche / En lot » |
| `Lumen PerfectPanel_ SMMspot's Template Mastery.jpg` | **Page d'accueil** | En-tête simple (Accueil, Services, Blog, Connexion, Inscription) ; titre centré en 2 lignes avec un mot en bleu ; un seul bouton principal ; rangée de logos des plateformes ; section « 3 étapes » (Créer un compte → Recharger → Commander) ; maquette du formulaire d'inscription à côté du texte ; petites cartes flottantes montrant de **vrais** écrans du panel |
| `Iko Setiawan.jpg` (DealDeck) | **Admin : ventes** | Grandes cartes de chiffres avec pastille de variation verte/rouge (+12 %, −2 %), dont une carte mise en avant en bleu plein ; graphique en barres par mois avec sélecteur de période ; menu latéral groupé par sections (Menu / Finances / Outils) |
| `48695239716042903.jpg` (Finexy) | **Admin : tableau de bord** et **historique client** | Message d'accueil « Bonjour, <prénom> » ; carte solde avec boutons d'action ; jauge horizontale (plafond journalier de dépense) ; tableau « Activité récente » (n°, type, montant, statut en pastille, date) avec recherche et filtre |
| `Sociafy - Social Media Marketing Analytics SaaS Dashboard Design.jpg` | **Admin : statistiques** | Tableau par plateforme avec étiquettes de couleur ; grille d'heures (heatmap) pour voir les heures de commandes ; sélecteurs de période compacts ; bouton « Exporter CSV » |
| `Sales Analytics Dashboard.jpg` | **Admin : clients par pays** | Carte du monde/Afrique des clients actifs ; liste « moyens de paiement » avec part de chacun |
| `téléchargement (3).jpg` (quso.ai) | **Accueil : composition** | Héros très aéré, fond clair avec motif de points discret, aperçus de l'interface disposés autour du titre, icônes des réseaux en petites tuiles |

### Ce qu'on refuse (anti « look IA », voir `antislop`)

- **Couleurs** : l'orange de Finexy/Sociafy, le violet de quso.ai, les dégradés colorés de Sociafy → remplacés par bleu + jaune.
- **Étincelles ✨ et mots « IA »** (« AI-powered », « Co-Pilot ») de SMMspot et quso.ai : interdits.
- **Faux chiffres et faux avis** : « 4.8/5 sur 500 avis », « 4M+ utilisateurs », « $550,000 », fausses notifications « Vous avez un nouvel abonné », photos de faux clients → interdits tant qu'ils ne sont pas réels.
- **Encarts « Passer Premium / Upgrade Pro »** des barres latérales : pas d'abonnement chez nous → à la place, carte « Parrainez un ami : 5 % » ou « Besoin d'aide ? Support ».
- **Mode sombre** (bouton lune de Finexy/Lumen) : pas de mode sombre (décidé).
- **Effets de verre / flou, grands cercles décoratifs en fond** : à éviter (lents sur téléphone d'entrée de gamme).

### Règles de mise en page tirées des références

1. **Cartes blanches** arrondies 12 px sur fond gris très clair (`--gris-50`), bordure fine, une seule ombre légère.
2. **Chiffres en grand** (Public Sans 700, chiffres alignés), libellé petit au-dessus, variation en pastille dessous.
3. **Une seule carte « mise en avant » par écran**, en bleu plein texte blanc.
4. **Statuts en pastilles** (couleurs §1 « Statuts »), jamais en texte seul.
5. **Sur téléphone** : la barre latérale devient un menu du bas (Commander, Commandes, Recharger, Compte), les 4 cartes de chiffres passent en 2 × 2, la fiche du service passe **sous** le formulaire.
6. **Formulaire de commande** : une colonne, libellés au-dessus des champs, min/max affichés dans le champ quantité, total en direct à côté du bouton.

## 11. Espace client sombre (ajout du 2026-11-11, décision explicite du propriétaire)

Exception à « blanc, bleu, jaune » et à « pas de mode sombre » **pour l'espace client seulement** (tableau de bord, commandes, recharge, transactions, favoris, compte). Accueil, catalogue et pages de connexion restent inchangés. Pas de bouton clair/sombre.

- **Palette** : générée avec Radix Colors (outil de palette personnalisée) : accent `#425EFF`, gris `#D7D7DA`, fond `#111111`. Les 12 nuances sont des variables CSS sous la classe `.lp-app` (`src/styles/globals.css`). **Aucune bibliothèque ajoutée** (ni Radix Colors, ni HeroUI) ; composants = shadcn/ui.
- Les rôles de §1 se transposent : fond de page = fond `#111111`, cartes = nuances 2-3 du gris, texte = nuances 11-12, bouton principal = accent, statuts (terminé, en cours, échec) gardent leur sens avec des teintes lisibles sur fond sombre.
- Contrastes ≥ 4,5:1 (texte), ≥ 3:1 (bordures d'éléments actifs). Public Sans, §2 à §7 inchangés ; interdits de §1 (néons, arc-en-ciel) restent valables.
- **Valeurs** (calculées, voir note ; variables `--lp-gray-N`, `--lp-accent-N`, rôles `--lp-app-*`) :

| N | Gris | Accent |
|---|---|---|
| 1 | `#111111` | `#111113` |
| 2 | `#191919` | `#121319` |
| 3 | `#222223` | `#141520` |
| 4 | `#2A2A2C` | `#151828` |
| 5 | `#323234` | `#171A30` |
| 6 | `#3B3B3E` | `#191E3A` |
| 7 | `#4A4A4E` | `#1C2247` |
| 8 | `#636368` | `#20285A` |
| 9 | `#727278` | `#425EFF` |
| 10 | `#808086` | `#5B73FF` |
| 11 | `#A9A9B0` | `#9DB0FF` |
| 12 | `#D7D7DA` | `#D6DDFF` |

- **Rôles** : fond `gray-1`, carte `gray-2`, carte relevée `gray-3`, bordure `gray-6`, bordure active `gray-9`, texte `gray-12`, texte secondaire `gray-11`, bouton `accent-9` (survol `#3A55F2`, texte blanc), lien `accent-11`. Statuts : terminé `#4ADE80`, en cours `#7DA2FF`, échec `#FF7A7A`, à vérifier `#F5C451`.
- **Contrastes mesurés** (WCAG) : texte `gray-12` 13,15:1 sur fond, 12,24:1 sur carte ; `gray-11` 8,08:1 / 7,53:1 ; `accent-11` 9,07:1 / 8,45:1 ; statuts 7,48 à 11,6:1 sur fond (6,96 à 10,8:1 sur carte) ; blanc sur bouton `accent-9` 4,91:1, au survol 5,58:1. Bordure active `gray-9` 3,95:1 sur fond, 3,67:1 sur carte ; anneau de focus `accent-9` 3,85:1 / 3,58:1. La bordure simple `gray-6` (1,69:1) est décorative, pas un élément actif.
- *Note* : les valeurs n'ont pas pu être lues sur l'outil Radix (navigateur indisponible dans la tâche). Elles sont calculées : accent-9 = `#425EFF`, gray-12 = `#D7D7DA`, gray-1 = `#111111` imposés ; les autres nuances sont interpolées à la main, pas par l'algorithme exact de Radix. À remplacer par les valeurs de l'outil si le propriétaire le souhaite.

## 10. Pages de compte (ajout du 2026-11-09, décision explicite du propriétaire)

Exception à « blanc, bleu, jaune » **pour les pages de compte seulement** (inscription, connexion, mot de passe oublié, nouveau mot de passe).

**Fond** : dégradé doux relevé sur la référence `9.jpg`, 5 `radial-gradient` superposés (classe `.lp-auth-bg` dans `src/styles/globals.css`). Six couleurs :
- bleu vif `#5597F7` (haut gauche)
- bleu ciel `#78C3FD` (gauche)
- bleu-violet `#6D7AFD` (bas gauche)
- lavande `#B5ACFD` (bas)
- cyan pâle `#CCE6F5` (droite)
- cadre `#EDF4FE` (couleur de fond)

**Panneau en verre** : bleu 600 à 82 % (`rgb(29 78 216 / 0.82)`) avec `backdrop-filter` (classe `.lp-auth-glass`). L'opacité garde un texte blanc à 4,5:1 sur tout le dégradé.

**Deux écrans** :
- Ordinateur : deux panneaux (verre bleu et feuille blanche) qui glissent l'un vers l'autre quand on passe de connexion à inscription.
- Téléphone : bande bleue en haut et feuille blanche en dessous.
- Inscription en 2 étapes (identité, puis pays, devise et mot de passe).

