VERDICT : ACCEPTÉ
Tâche : 14.7 — Contrôle final accueil (GSAP différé, héros sans cascade)
Environnement : local (next dev, port 3917), sans base, Chromium Playwright

Parcours testés (FR + EN) :
- [téléphone 360 tactile] héros (photo, titre, 2 boutons), défilement complet, étapes + trait, 11 tuiles réseaux avec logos, paiements (7 logos + logo LyonPanel, aucune tuile vide), chiffres avec pastille « Exemple » (3 sur 4), FAQ, appel final, bouton fixe « Créer un compte », menu burger (ouvre/ferme) → OK
- [ordinateur 1366] mêmes sections, survol → OK
- [reduced-motion, 2 tailles, 2 langues] tout visible, pas de mouvement (plus de float) → OK
- FAQ, contact, services (« Catalogue indisponible » propre sans base), connexion, 404 : OK, FR et EN, 2 tailles

Mesures : erreurs console 0 (2 avertissements dev seulement, voir 1), requêtes en échec 0 (hors 404 voulu), débordement non, cibles < 44 px 0, 12 images toutes chargées, chargement téléphone ~1 s en local (réseau non bridé), états finaux : aucun contenu masqué ; seuls restent des décors volontaires (halos, flottement léger ±6 px, voile).

Problèmes :
1. [Mineur] Accueil — avertissement Next : qualité d'image 80 non déclarée dans `images.qualities` (femme-16x9, femme-tresses-4x5) — ajouter 80 à la config ou passer à 75 — Responsable : lp-coder
2. [Mineur] Pastille « N » de Next recouvre « Confidentialité » en bas à gauche : visible en dev uniquement, absente en production.

Captures : docs/reports/phase-14/qa/tache-14.7-*.png
