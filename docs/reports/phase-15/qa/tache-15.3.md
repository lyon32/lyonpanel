VERDICT : ACCEPTÉ
Tâche : 15 — Accueil (tuiles de preuve, logo sombre, image de partage)
Environnement : local, build de production (next start, port 3217), PROVIDER_MODE=mock, SASPAY_MODE=mock, Chromium Playwright
Parcours testés :
  - [téléphone 360x740, Android, ~1,6 Mbit/s, 150 ms, CPU x4] /fr et /en → OK
  - [ordinateur 1366x768] /fr et /en → OK
Constats :
  - Tuiles « 100+ clients » et « 2000+ commandes » présentes en FR et EN ; aucune pastille « Exemple » (aucun « exemple/example » dans le texte).
  - Grille ordinateur : 3 + 2 (2 tuiles larges égales), aucune orpheline. Téléphone : 2 + 2 + 1, la dernière tuile occupe toute la largeur (pas orpheline).
  - Logo sombre lisible (téléphone et ordinateur).
  - /og/default.png : 200, image/png, 1200x630.
  - og:image, twitter:image (summary_large_image), taille et alt présents sur /fr, /en, /fr/services, /fr/services/instagram, /en/services/tiktok, pointant vers https://lyonpanel.com/og/default.png.
  - Liens de l'accueil : /services, /services/<réseau>, /inscription, /connexion, /blog, /privacy, /terms OK (200). /en/support répond 307 (page protégée, redirection attendue sans connexion).
Mesures : erreurs console 0, requêtes en échec 0, débordement non (360/360), cibles < 44 px 0, images sans alt 0, chargement téléphone lent ~2,4 à 4,3 s
Problèmes :
  1. [Mineur] Accueil téléphone — grille en 2+2+1 plutôt que 3+2 (voulu : 3 colonnes ne tiennent pas à 360 px) — capture : qa/tuiles-fr-tel.png — Responsable : lp-designer (aucune action requise)
Captures : docs/reports/phase-15/qa/ (accueil-{fr,en}-{tel,pc}-{haut,complet}.png, tuiles-fr-*.png, logo-fr-*.png)
