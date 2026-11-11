VERDICT : ACCEPTÉ
Tâche : 8.5 — QA navigateur, 2e passage (espace client, phase 8)
Environnement : local (Supabase 55321), PROVIDER_MODE=mock, SasPay test (faux), Next dev port 3100, Chromium Playwright. Deux comptes de test créés par la QA, anonymisés à la fin (DELETE /api/v1/me = 204). Serveur arrêté, port 3100 libre.
Contextes : téléphone 360x740 (UA Android, 1,6 Mbit/s, 150 ms, CPU x4), tablette 768x1024, ordinateur 1366x768.

Revérification des 9 points du 1er rapport
  1. Tableau de bord avec une commande « En cours de vérification » : 360, 768, 1366 -> 0 débordement (360/768/1366 = largeur de page), nom du service intact (« Abonnés TikTok », « Réf. 9001350 », « #6913 · 100 unités »), message explicatif lisible, boutons « Nouvelle commande » et « Recharger » entièrement visibles -> CORRIGÉ. Captures p2-10-dashboard-tel-fr, p2-11-dashboard-tab-fr, p2-12-dashboard-pc-fr.
  2. Transactions à 768 px : titre + filtre « Tous les types » passent proprement, 0 débordement -> CORRIGÉ. Capture p2-11-transactions-tab-fr.
  3. Favoris : cœur « Favori » sur la page Commander (FR et EN). Clic -> « Enregistrement… » (spinner) puis état actif aria-pressed=true ; re-clic -> retiré (false) ; re-ajout OK. Page Favoris se remplit (« Abonnés TikTok · Réf. 9001350 · 1 155 XAF les 1 000 », boutons Commander / Retirer). Bouton 328x44 px sur téléphone, 0 cible < 44 px. Visiteur non connecté : 0 bouton sur /fr/services, /fr/services/tiktok/followers et la fiche, fond blanc -> CORRIGÉ. Captures p2-02, p2-03, p2-04, p2-05, p2-06, p2-07.
  4. Téléphone : « 12345 » -> message sous le champ « Numéro invalide. Format international, par exemple +237612345678. » (aria-invalid, aria-describedby) ; numéro déjà pris -> « Ce numéro de téléphone est déjà utilisé. » sous le champ, bordure rouge. Changements successifs : la limite (5 par heure, code de PATCH /me) se déclenche, message « Trop de requêtes. Patientez un instant avant de réessayer. » (HTTP 429, affiché dans un bloc d'alerte au-dessus du bouton). Le numéro pris compte dans les 5 : dans mon essai, 4 changements valides sont passés après lui, le 5e valide a été refusé. Les réglages hors numéro (suggestion) ne sont pas bloqués : la requête n'envoie le téléphone que s'il change -> CORRIGÉ. Captures p2-20, p2-21, p2-22-changement-5.
  5. Suppression, mauvais mot de passe : « Mot de passe incorrect. » -> CORRIGÉ. Capture p2-40-suppression-mauvais-mdp-pc-fr.
  6. Carte « Terminées » : « 0 » avec « 0 % terminées » en gris discret, plus de pastille verte -> CORRIGÉ (p2-11, p2-12).
  9. Alignement des titres : à 768 et 1366, le texte du titre commence au même x (280 px) sur Tableau de bord, Transactions, Commandes, Compte ; Compte reste en colonne étroite mais alignée à gauche -> CORRIGÉ (voir problème 1 ci-dessous, détail mineur).
  (Points 7 et 8 : non demandés dans ce passage, inchangés.)

Non-régression
  - Suggestion : « Ne plus afficher » -> disparaît, reste absente après rechargement ; réactivation par l'interrupteur dans Compte + Enregistrer -> la carte revient -> OK. Captures p2-30, p2-31.
  - Commande : lien d'une autre plateforme (EN) -> « This link is not accepted for this service. » ; 2 commandes réelles passées (une « En cours », une « En cours de vérification » via fail-next), 120 XAF chacune, solde 19 760 -> OK.
  - Recharge : montant 100 -> « Le montant minimum est de 500 XAF » -> OK. Transactions (Recharge +20 000, 2 Commandes -120) -> OK. Compte -> OK.
  - EN : tableau de bord, transactions, commandes, compte, favoris : 0 clé brute, 0 débordement -> OK.
  - Accueil FR/EN, catalogue, connexion, inscription : fond blanc (255,255,255), aucune classe .lp-app, 0 débordement -> OK.
  - « Réf. 9001350 » lisible, distinct de « #6913 » -> OK.

Mesures : erreurs console 4, toutes attendues et provoquées (400 téléphone invalide, 409 pris, 429 limite, 401 mauvais mot de passe, 422 lien refusé : en fait 5 réponses 4xx, 0 exception JavaScript) ; requêtes 5xx : 0 ; 4xx inattendus : 0 ; débordement horizontal : non (360, 768, 1366) ; cibles < 44 px sur téléphone : 0 ; images sans alt : 0 ; champs sans libellé : 0.

Problèmes :
  1. [Mineur] Compte (« Mon compte ») : une icône précède le titre, alors que Tableau de bord, Transactions, Commandes n'en ont pas — incohérence de style entre titres — capture : qa/p2-12-compte-pc-fr.png — Responsable : lp-designer
  2. [Mineur] Message de limite de changement de numéro : générique (« Trop de requêtes. Patientez un instant… ») ; il ne dit pas que c'est la limite de 5 changements par heure — capture : qa/p2-22-changement-5-tel-fr.png — Responsable : lp-designer (texte) / lp-coder (message dédié)
  3. [Mineur] Les tentatives refusées pour numéro déjà pris comptent dans la limite des 5 (comportement du code, cohérent avec le commentaire) ; à confirmer avec le propriétaire — Responsable : chef de projet

Aucun problème Bloquant ni Important ouvert.

Non vérifié : temps de chargement en build de production (mode dev seulement).
Captures : docs/reports/phase-8/qa/ (préfixe p2-)
