VERDICT : ACCEPTÉ
Tâche : 14.1 quinquies — Prototype E v3, recontrôle après corrections (/fr/prototypes/e, /en/prototypes/e)
Environnement : local (localhost:3100, serveur de dev), Chromium Playwright, 1366x768, 360x740 et 320x640 (tactile), FR et EN.

Parcours testés (défilement réel à la molette avant chaque mesure)
- Transform calculé = none sur les 11 tuiles et toutes les cartes (.e-tile, .e-card, .e-press, [data-reveal]) après défilement : 0 élément en défaut, opacité 1 partout, à 1366, 360 et 320, FR et EN -> OK
- Bouton « Voir tous les services » / « See all services » : 32 px sous la dernière rangée de tuiles (1366, 360, FR et EN) -> OK
- Survol souris réel (1366) : tuile = translateY(-4px) mesuré (dy -4) + bordure/lueur ; pastille de paiement = translateY(-3px) scale(1,05), bordure à la couleur du logo (Wave 38,191,239), halo 0,3 -> 0,85 -> OK. Les cartes non cliquables (div) ne se soulèvent pas (bordure et ombre seulement) : choix de CSS, pas un défaut.
- Appui tactile : l'émulation tactile Playwright ne pose pas :active ; vérifié avec :active forcé (CDP) à 360 px : tuile scale(.97), pastille scale(.97) + bordure jaune MTN + halo 0,85 -> OK
- Section paiements : 7 logos chargés (Wave, Orange Money, MTN, Moov Money, Airtel, Visa, Mastercard), naturalWidth > 0, object-fit contain, aucun repli texte, aucune déformation visible. Seul fond clair : la pastille de Visa (215,215,218). Pastilles sombres (#1d1d1f), plus de fond blanc parasite -> OK. Halos de couleur visibles et discrets (opacité 0,3) sur la capture -> OK
- Orbite : 0 pastille hors écran à 320, 360 et 1366 ; pas de chevauchement visible (à 320 px les pastilles sont serrées mais séparées) -> OK
- reduced-motion (1366 et 360) : 0 animation flottante/halo, 0 élément à opacité < 1, 0 transform résiduel -> OK
- Régressions : menu mobile (aria-expanded true puis false à Échap) OK ; focus clavier visible (outline 2 px solide sur « Services ») OK ; FAQ accordéon exclusif (ouvre la 2e, ferme la 1re) OK ; bouton fixe mobile masqué/inert en haut, visible (73 px avec marge) à la FAQ OK ; photos du héros : 320/360 = femme-tresses-4x5 (w=640), 1366 = femme-16x9 (w=1920) OK ; FR et EN complets, aucun texte mélangé vu.

Mesures : erreurs console 0, requêtes en échec 0 (6 combinaisons largeur/langue), débordement horizontal non (320=320, 360=360, 1366=1366), cibles < 44 px : 0 (360 et 320), images cassées 0.
Chargement : non remesuré (serveur de dev, ~9-10 s en mobile lent selon le rapport précédent) ; à refaire sur le build de production.

Problèmes
1. [Mineur] Carte du haut du 360/320 : à la capture « paiements » à 320 px, l'en-tête sticky recouvre le haut de l'orbite après scrollIntoView ; effet de la capture seulement, pas un défaut de mise en page.
2. [Mineur, reporté] public/images/home/*.webp : 3 sources > 200 Ko (servies allégées par next/image), à recompresser avant mise en ligne — lp-designer.
3. [Mineur, reporté] airtel-money-transparent.png (et les anciens fichiers non « -clean ») restent dans public/brand/payments/ sans être utilisés — nettoyage à confirmer avec le propriétaire.

Les défauts du rapport précédent (transform figé, bouton à 4 px, absence de soulèvement) sont corrigés.

Captures : docs/reports/phase-14/qa/ — e4-{fr,en}-{1366,360,320}-{paiements,services}.png, e4-fr-1366-hover-tuile.png, e4-fr-1366-hover-carte.png, e4-fr-1366-hover-paiement.png, e4-fr-360-touch-tuile.png, e4-fr-360-touch-paiement.png, e4-fr-360-actif-{tile,pay,card}.png, e4-fr-{1366,360}-reduced-paiements.png, e4-fr-360-menu.png, e4-fr-360-faq.png, e4-en-1366-focus.png
