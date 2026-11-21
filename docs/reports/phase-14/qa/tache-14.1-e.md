VERDICT : À CORRIGER (2 points Importants, 2 Mineurs)
Tâche : 14.1 ter — Prototype E de l'accueil (/fr/prototypes/e, /en/prototypes/e)
Environnement : local (localhost:3100, serveur de dev), Chromium Playwright, 360x740 (mobile tactile) et 1366x768. Pas de limitation réseau/CPU appliquée (chargement indicatif).

Parcours testés
- [téléphone FR/EN] menu hamburger (ouverture, libellé, Tab, Échap), ancre depuis le menu (ferme le menu, section à 88 px sous le haut), FAQ (accordéon exclusif OK), bouton fixe, bas de page, défilement réel → OK sauf point 1
- [ordinateur FR/EN] bascule de langue (FR→EN OK, retour arrière OK), ancres de la barre (OK, 88-96 px), Tab (contour 2 px visible partout), survol de carte (lueur + bordure), liens → OK sauf point 2
- Bouton fixe mobile : caché sur le héros, visible dès ~1200 px, caché à partir de ~4800 px (appel final), `inert` bien posé quand caché. Il recouvre brièvement le contenu pendant le défilement (normal), le pied de page a un retrait de 7 rem. OK.
- Compteurs : se déclenchent à l'entrée dans l'écran (le compteur du héros reste à +0 sur mobile tant que la carte n'est pas visible, normal). Étapes : invisibles à l'arrivée puis révélées une à une au défilement réel. OK.
- prefers-reduced-motion (émulé, 360 et 1366) : animations flottantes coupées, tout visible (opacité 1), compteurs à leur valeur finale, scroll-behavior auto. OK.

Mesures : erreurs console 0 (4 contextes + interactions), requêtes en échec sur la page 0, débordement horizontal non (360=360, 1366=1366, aussi après défilement), cibles < 44 px : 2 (lien « LyonPanel » 78x24, bouton de langue 36x36), chargement ~0,6-1,0 s sans limitation, long tasks : 1 à 3 par chargement (52 à 169 ms, démarrage/hydratation), aucune pendant le défilement relevée, contraste : 0 texte sous 4,5:1 (3:1 pour les gros) sur les 4 pages.
Contenu : aucun jaune, aucun emoji/✨, aucune image sans alt, aucun avis client (le mot « reviews » dans la FAQ EN = « The team reviews every request », sans objet), aucun nom de fournisseur.

Liens
- /fr/inscription, /fr/connexion, /fr/confidentialite, /fr/conditions, /en/register, /en/login, /en/privacy, /en/terms : 200
- /fr/services et /en/services : 500. Cause : variable d'environnement manquante NEXT_PUBLIC_SUPABASE_URL dans cet environnement de test (la page lit le catalogue en base). Pas un défaut du prototype, mais le lien « Services » (barre, tuiles, appel final, pied) est mort tant que l'env n'est pas là.

Problèmes
1. [Important] src/components/prototypes/e/proto-e.tsx (menu, ~l.304-314 et 405-411) — Échap ferme le menu mais le focus tombe sur <body> (menu `inert` alors que le focus est dedans) ; l'utilisateur clavier perd sa position. Attendu : rendre le focus au bouton hamburger à la fermeture (ref sur le bouton, `.focus()` dans le gestionnaire Échap et à la fermeture par clic sur lien). Même risque quand on ferme via le bouton. Capture : e2-fr-360-menu.png — Responsable : lp-coder
2. [Important] mêmes fichiers, chiffres d'exemple — les valeurs en dur « +8 400 », « +52 000 », « +310 » (cartes du héros) n'ont aucune étiquette « Exemple » visible ; seule la carte « +1 240 » en porte une (l'attribut data-exemple est vide, invisible). Attendu : étiquette sur chacune, ou une seule mention clairement attachée au groupe, avant mise en ligne. Les chiffres « 2 188 / 822 / 547 services » ne sont pas marqués (supposés réels : à confirmer avec le catalogue). Capture : e2-fr-1366-top.png — Responsable : lp-designer (texte) + lp-coder
3. [Mineur] proto-e.tsx l.363-368 — lien logo « LyonPanel » : zone 78x24 px (< 44 px) sur téléphone. Correction : ajouter `inline-flex min-h-11 items-center` — lp-coder
4. [Mineur] proto-e.tsx l.382-395 — sélecteur de langue : bouton « EN/FR » 36x36 px. Correction : min-h-11 min-w-11 (ou marge de zone tactile) — lp-coder
Note (hors prototype) : sur téléphone le bouton fixe se superpose au badge « N » du serveur de dev (dev seulement, ignoré).

Captures : docs/reports/phase-14/qa/ — e2-{fr,en}-{360,1366}-top.png, e2-{fr,en}-{360,1366}-full.png, e2-{fr,en}-360-menu/anchor/faq/bar/bottom.png, e2-fr-360-steps.png, e2-fr-1366-focus.png, e2-fr-1366-hover.png, e2-fr-{360,1366}-reduced.png

## Recontrôle (2026-11-21)
VERDICT : ACCEPTÉ
Contextes : Chromium Playwright, 320, 360 (tactile) et 1366 px, FR et EN, localhost:3100.
- Défaut 1 (focus menu) : corrigé. Après Échap, après le bouton et après clic sur un lien, le focus est sur le bouton hamburger (« Ouvrir le menu » / « Open menu »), menu fermé (aria-expanded=false). FR et EN.
- Défaut 2 (étiquettes) : corrigé. Les 4 cartes du héros (+1 240, +8 400, +52 000, +310) affichent une pastille visible « Exemple » / « Example », sur 320, 360 et 1366 px.
- Cartes du héros : 0 chevauchement mesuré (rectangles) à 320, 360 et 1366 px ; captures vérifiées à l'œil (décalage en escalier, rien de masqué).
- Défauts 3 et 4 (cibles) : corrigés. 0 lien ou bouton < 44 px sur 360 et 320 px (lien LyonPanel, boutons de langue inclus).
- Mesures : 0 débordement horizontal, 0 erreur console, 0 réponse 4xx/5xx sur la page, dans les 12 combinaisons.
- Menu, ancre depuis le menu, bascule de langue : OK, pas de régression. Le détail FAQ, bouton fixe, animations, reduced-motion n'a pas été rejoué en entier : seul un défilement complet (compteurs, cartes) a été refait, sans anomalie.
- Découpage en fichiers (copy.ts, hero-visual.tsx, sections.tsx) : rendu identique.
- Rappel (hors prototype) : /fr/services et /en/services renvoyaient 500 faute de variable d'environnement dans l'environnement de test.
Captures : e3-{fr,en}-{360,320,1366}-cards.png, e3-{fr,en}-{360,1366}-top/full.png, e3-{fr,en}-360-afterlink.png.
