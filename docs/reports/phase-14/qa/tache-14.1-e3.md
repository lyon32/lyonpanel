VERDICT : À CORRIGER (1 Important, 3 Mineurs)
Tâche : 14.1 quater — Prototype E v3 de l'accueil (/fr/prototypes/e, /en/prototypes/e)
Environnement : local (localhost:3100, serveur de dev), Chromium Playwright, 360x740 / 320x640 (tactile) et 1366x768, FR et EN.

Parcours testés
- [360, 320, 1366 FR/EN] défilement réel à la molette, captures pleine page et par section (héros, services, paiements, étapes, FAQ, appel final) -> OK sauf défaut 1
- Photos du héros : 360 et 320 px = femme-tresses-4x5 (cadre 4:5, 307x384), 1366 px = femme-16x9 (w=1920, cadre pleine largeur). Une seule image chargée à chaque fois, naturalWidth > 0 -> OK
- Titre sur la photo (1366) : contraste mesuré 12,1:1 (texte #D7D7DA, pire pixel de fond 26,26,27 ; dégradé de masque). Sur mobile le titre est sous la photo, 13,1:1 -> OK
- Logos de réseaux : 10 logos SVG gris visibles et lisibles (Instagram, TikTok, YouTube, Facebook, Telegram, X, WhatsApp, Spotify, Twitch, LinkedIn) + « + » ; aucune initiale à la place d'un logo -> OK
- Tuiles : 11 (10 réseaux + « Et plus encore : Kick, Pinterest, Threads »). Nombres affichés = somme par réseau de data/catalogue-resume.json : Instagram 822, TikTok 547, YouTube 261, Facebook 308, Telegram 144, X 57, WhatsApp 3, Spotify 3, Twitch 6, LinkedIn 4 -> corrects (Instagram 215+184+269+64+64+26 = 822 ; total catalogue 2 188 ; Kick/Pinterest/Threads non comptés, cohérent)
- Liens des tuiles : /fr/services/<id> et /en/services/<id> (instagram, tiktok, youtube, facebook, telegram, x, whatsapp, spotify, twitch, linkedin) + /services pour « plus » -> slugs corrects (pages non testées : 500 local connu)
- Paiements : 7 logos affichés (pas 8 : le code définit 7 moyens, PAYMENTS dans copy.ts : Wave, Orange Money, MTN MoMo, Moov Money, Airtel Money, Visa, Mastercard). Moov Money et Mastercard APPARAISSENT bien, en vrai logo (pas de repli texte). 7 images chargées, 0 faux logo, pastilles toutes 84x84 (mobile) / 96x96 (bureau), fond blanc homogène, object-contain : aucun logo déformé (Mastercard 96x58 d'origine, bien centré). Le dossier contient en plus airtel-money-transparent.png, non utilisé (c'est peut-être l'origine du « 8 » attendu ; à confirmer avec le propriétaire) -> OK
- Effets souris (1366) : survol d'une tuile = bordure bleue + lueur OK, mais PAS de soulèvement (défaut 1)
- Effet au toucher (émulation tactile, touchstart maintenu) : transform et lueur inchangés sur les tuiles (défaut 1). Boutons .e-press : règle :active présente.
- Aucune section épinglée, aucun scroll-snap (scroll-snap-type none), 6 pas de molette de 200 px = 6 déplacements de 200 px exacts : pas de défilement forcé. Seuls éléments fixes : en-tête sticky et bouton fixe mobile -> OK
- reduced-motion (360 et 1366) : scroll-behavior auto, 0 élément à opacité < 1, 0 animation flottante -> OK
- Menu mobile : ouverture (aria-expanded=true, focus sur le bouton), Tab -> « Services », Échap -> menu fermé, aria-expanded=false -> OK
- FAQ (5 questions, accordéon exclusif, ouverture au toucher), hauteurs des questions 56-72 px -> OK
- Bouton fixe mobile : inert et hors écran sur le héros, visible et actif à la FAQ, 48 px de haut -> OK

Mesures
- Erreurs console : 0 (12 combinaisons + interactions). Requêtes en échec 4xx/5xx : 0. Débordement horizontal : non (360=360, 320=320, 1366=1366). Images cassées 0, sans alt 0.
- Cibles < 44 px : 0 sur 360, 320 et 1366 (liens, boutons, summary).
- Chargement : sans limitation 0,55-0,95 s (événement load). Mobile lent émulé (1,6 Mbit/s, 150 ms, CPU x4, serveur de dev non minifié) : load ~9-10 s (surtout JS de dev), LCP ~2,1-2,2 s. À refaire sur le build de production.
- Poids servi : photo héros mobile 27,9 Ko (w=640). Aucune image servie > 200 Ko mesurée (optimiseur Next).
- Fichiers sources > 200 Ko : public/images/home/femme-tresses-4x5.webp 372 Ko, homme-selfie-4x5.webp 353 Ko, fond-points-16x9.webp 200,3 Ko (limite). femme-16x9.webp 164 Ko. Passent par next/image donc servis allégés ; à surveiller seulement si un jour utilisés en <img> direct.

Problèmes
1. [Important] src/components/prototypes/e/use-motion.ts (l.62-79, révélation des groupes et des blocs) + src/components/prototypes/e/styles.tsx (l.14-15, `.e-tile` et `.e-press` avec `transition: transform`) — après l'animation d'apparition, les 11 tuiles de services et 6 autres cartes (DIV.e-card e-press) restent figées avec un style en ligne `transform: translate(0px, 28px)` (opacité 1). Conséquences mesurées : (a) les tuiles sont décalées de 28 px vers le bas en permanence : le bouton « Voir tous les services » n'est qu'à 4 px sous la dernière rangée (attendu 32 px, mt-8), vu sur 1366 px ; (b) le style en ligne l'emporte sur le CSS, donc le soulèvement au survol (translateY(-4px)) et le retour d'appui au toucher (scale .97) ne s'appliquent jamais. Cause probable : la transition CSS sur transform entre en conflit avec le tween GSAP `from`. Correction : dans les `gsap.from` des groupes et blocs, ajouter `clearProps: 'transform'` (ou `onComplete: () => gsap.set(el, { clearProps: 'transform' })`) et/ou retirer `transform` des transitions `.e-tile` / `.e-press` pendant l'apparition ; puis revérifier computed transform = none après défilement. Captures : e3-fr-1366-services-bas.png, e3-fr-1366-hover.png, e3-fr-360-touch-active.png — Responsable : lp-coder
2. [Mineur] src/components/prototypes/e/copy.ts l.24-32 — 7 moyens de paiement et non 8 ; airtel-money-transparent.png est présent mais inutilisé. Correction : confirmer le nombre voulu ; sinon supprimer le fichier inutilisé du dossier — lp-coder / propriétaire
3. [Mineur] public/images/home/*.webp — trois sources > 200 Ko (372, 353, 200 Ko). Aucun impact tant que next/image sert la version optimisée. Correction : recompresser (qualité 75-80) avant mise en ligne — lp-designer
4. [Mineur] Pastilles de paiement (payments.tsx) — logos de réseaux gris (monochromes) alors que les logos de paiement sont en couleur sur fond blanc : choix à valider visuellement avec le propriétaire, pas un défaut technique — lp-designer
Note : bouton fixe mobile et badge « N » du serveur de dev se superposent (dev seulement, ignoré). /services 500 en local (variable manquante), connu.

Captures : docs/reports/phase-14/qa/ — e3-{fr,en}-{360,320,1366}-{hero,services,paiements,etapes,faq,appel-final,full}.png, e3-fr-1366-services-bas.png, e3-fr-360-services-bas.png, e3-fr-1366-hover.png, e3-fr-360-touch-active.png, e3-fr-360-menu.png, e3-fr-360-faq-open.png, e3-fr-{360,1366}-reduced.png
