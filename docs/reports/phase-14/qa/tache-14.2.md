VERDICT : À CORRIGER (1 point Important, 1 Mineur)
Tâche : 14.2 — accueil sombre + pages publiques
Environnement : local (port 3100), Chromium Playwright, 360x740 mobile tactile et 1366x768, reduced-motion émulé, réseau non bridé (chargement mesuré non représentatif)

Mesures (accueil, blog, login, register, forgot-password, 404 ; FR et EN pour l'accueil) :
- débordement horizontal : non (scrollWidth = 360 / 1366) ; erreurs console : 0 (hors 404 attendu) ; 5xx : 0 hors /services
- cibles < 44 px : 0 ; images sans alt : 0 ; clés de traduction brutes : 0
- fond #111111 partout ; aucun bleu #1D4ED8 ni jaune détecté dans les styles calculés ; aucune section épinglée
- liens internes de l'accueil : 18, tous OK sauf /services et /services/* (500 local, base absente : non compté comme défaut)
- /fr/services : 500 local connu ; la page d'erreur s'affiche sur fond BLANC (voir note)

Problèmes :
1. [Important] Accueil, section Paiements — 2 tuiles vides (carrés sans logo) autour du logo central, mobile et ordinateur — attendu : logos de moyens de paiement ou pas de tuile — capture : tache-14.2-desktop_fr.png — Responsable : lp-designer
2. [Mineur] Focus clavier : outline navigateur par défaut (auto 1px) ; visibilité à renforcer sur fond sombre (anneau accent #425EFF 2px) — captures tache-14.2-*-focus.png — Responsable : lp-designer
Note : page 500 de /services en fond blanc (hors palette) ; à revoir quand une error.tsx sombre sera prévue, sans lien avec la base locale.

Non vérifié (honnêteté) : interactions hover, feedback tactile, bouton fixe mobile, menu mobile et FAQ ouverte ne sont pas testés par script ; seuls les captures et le rendu statique l'ont été. Réseau lent et CPU x4 non appliqués.
Captures : docs/reports/phase-14/qa/tache-14.2-*.png
