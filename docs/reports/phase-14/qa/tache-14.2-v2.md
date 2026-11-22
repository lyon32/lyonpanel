VERDICT : ACCEPTÉ
Tâche : 14.2 — Accueil, deuxième passage
Environnement : local port 3100, faux JAP, Chrome Playwright (Chromium). Téléphone 360x740 Android, CDP : réseau 200 Ko/s + 150 ms, CPU x4. Ordinateur 1366x768.

Parcours testés (FR et EN) :
- [téléphone] défilement jusqu'à Paiements : 7 logos chargés et visibles (Wave, Orange, MTN, Moov, Airtel, Visa, Mastercard), tous `eager`, 0 tuile vide → OK
- [ordinateur] idem → OK
- [téléphone] focus Tab (menu, boutons, tuiles) : anneau 2 px accent clair sur chaque élément → OK
- [ordinateur] focus Tab (nav, FR/EN, devise, boutons, tuiles) → OK
- [téléphone] menu mobile ouvert, bouton fixe « Créer un compte » → OK
- [téléphone] FAQ ouverture → OK
- [ordinateur] hover tuile → OK

Mesures : erreurs console 0, requêtes en échec 0, débordement non (avant et après interactions), cibles < 44 px : 0, chargement téléphone throttlé ~13 s FR / ~12,6 s EN (événement load, 200 Ko/s, CPU x4) ; ordinateur ~2 s.

Problèmes :
1. [Mineur] Chargement téléphone lent ~13 s en conditions très dégradées (images lourdes de l'accueil, dont la photo du hero). À surveiller (poids des images) par lp-designer / lp-seo ; non bloquant.

Captures : docs/reports/phase-14/qa/tache-14.2-v2-{fr,en}-{360,1366}-{paiements,focus,faq}.png, -menu.png (360), -hover.png (1366).
