VERDICT : ACCEPTÉ (réserve : rendu catalogue complet non vérifié, voir plus bas)
Tâche : 14.3 / 14.4 — FAQ, contact, pages services / réseaux
Environnement : local, port 3100, sans base (catalogue indisponible), Chromium Playwright 360 px (mobile tactile) et 1366 px.

Parcours testés
- [téléphone + ordinateur] /fr/faq, /en/faq : OK (12 questions, ouverture/fermeture Entrée, Espace, toucher ; focus visible 2 px ; aucun saut de scroll ; summary 56 px de haut)
- [téléphone + ordinateur] /fr/contact, /en/contact : OK (liens /xx/support et /xx/connexion valides, 200 ; e-mail absent car variable vide)
- [téléphone + ordinateur] /fr/services, /fr/services/instagram, /en/services/tiktok sans base : OK (role=alert sombre « Catalogue indisponible », statut 200, aucune trace technique)
- [téléphone + ordinateur] /fr/services/inconnu : 404 propre, sombre, bouton retour accueil : OK
- prefers-reduced-motion : 1 élément garde une transition (négligeable, à confirmer côté coder)

Mesures : erreurs console 0 (hors 404 voulu), requêtes 5xx 0, débordement non, cibles < 44 px 0, fond rgb(17,17,17) partout, aucun jaune/#1D4ED8 vu, FR/EN sans clé brute. Chargement mode dev 2,5 à 6 s (dev non optimisé, sans throttling réseau strict).

Non vérifié : « dès X XAF / 1 000 », « Autres réseaux » (aucun lien vers 404) et cartes services : il faut un catalogue, je n'ai pas monté de mock (aucun fichier modifié). Le code (splitNetworks) sépare bien réseaux riches / autres ; à revérifier avec base locale.

Problèmes
1. [Mineur] Toutes pages — pastille « N » (indicateur Next dev) chevauche « Confidentialité » du pied de page en 360 px : visible seulement en dev, sans effet en production.
2. [Mineur] Page 404 : body transparent (mesure), rendu sombre correct visuellement.

Captures : docs/reports/phase-14/qa/tache-14.3-4-*.png
