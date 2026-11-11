VERDICT : À CORRIGER
Tâche : 8.5 — QA navigateur, espace client (phase 8)
Environnement : local (Supabase 55321), PROVIDER_MODE=mock, SasPay test (faux), Next dev port 3100, Chromium Playwright. Compte de test créé par la QA (anonymisé à la fin).
Contextes : téléphone 360x740 (UA Android, 1,6 Mbit/s, 150 ms, CPU x4), ordinateur 1366x768, tablette 768x1024 (reduced-motion activé).

Parcours testés :
  - [téléphone] inscription, connexion, recharge (devis 3 000 -> 90 XAF de frais, 3 090 à payer), commande, commandes, transactions, favoris, compte, suppression -> OK
  - [ordinateur] mêmes parcours en FR et EN -> OK
  - [tablette 768] tableau de bord et transactions -> KO (débordement, problèmes 1 et 2)
  - Tableau de bord : "Bonjour, Qa" / "Good morning, Qa", 4 cartes (2x2 sur 360), solde de l'en-tête réel (20 000 puis 19 880...), bouton "Nouvelle commande" sur 1 ligne (360 : pleine largeur ; PC : 44 px de haut) -> OK
  - Suggestion : absente sans commande ; apparaît après 4 commandes ; croix = ferme jusqu'au rechargement (réapparaît) ; "Ne plus afficher" = persistant après rechargement ET sur un autre contexte navigateur ; réactivation par l'interrupteur dans Compte (+ Enregistrer) : la carte revient -> OK
  - Commande depuis la suggestion : /commander?service=9001350&quantity=100, quantité préremplie à 100 -> OK
  - Commande : lien vide, lien d'une autre plateforme ("Ce lien n'est pas accepté pour ce service."), quantité 5 hors limites (message min/max), double clic sur Commander = 1 seule commande, 1 seul débit -> OK
  - Commandes : badges "En cours", "Terminée", "En cours de vérification" (cas partiel) + texte explicatif, progression -> OK
  - Transactions : filtre par type (Commande ; Remboursement -> "Aucun mouvement de ce type."), 20 par page, lien "Page suivante" -> OK
  - Favoris : ajout par PUT, doublon accepté (204), service inconnu 404, retrait avec états "Retrait..." puis "Retiré" -> OK ; AJOUT PAR L'INTERFACE IMPOSSIBLE (problème 3)
  - Compte : devise USD (en-tête, cartes, tableau en $US), langue EN (redirige vers /en/account), téléphone invalide (message générique), déjà pris ("Ce numéro de téléphone est déjà utilisé."), enregistrement : "Enregistrement..." puis "Enregistré" puis retour normal -> OK
  - Suppression : mauvais mot de passe -> message d'erreur, solde identique (19 340) ; bon mot de passe -> déconnexion, profil anonymisé (email/téléphone vides, statut deleted), solde conservé (19 340), tableau de bord ensuite redirige vers /login -> OK
  - Pages protégées sans connexion (/fr/tableau-de-bord, /fr/compte, /en/transactions, /fr/favoris) -> redirigées vers connexion -> OK
  - Accueil FR/EN, catalogue, connexion, inscription : fond blanc, aucune classe .lp-app, inchangés -> OK
  - Recharge : montant 100 -> "Le montant minimum est de 500 XAF" ; Payer -> "Redirection..." (aria-busy) puis redirection vers l'adresse du faux SasPay (injoignable en local, normal) -> OK

Mesures :
  - erreurs console : 4, toutes attendues (réponses 400/401/409/422 provoquées volontairement : téléphone invalide, téléphone pris, lien refusé, mauvais mot de passe) ; 0 exception JavaScript
  - requêtes 5xx : 0 ; 4xx inattendus : 0
  - débordement horizontal 360 px : non (toutes les pages) ; PC : non ; 768 px : OUI sur tableau de bord (776 > 768) et transactions (867 > 768)
  - cibles < 44 px sur téléphone : 0
  - contraste < 4,5:1 en sombre (calcul sur tout le texte, tel/PC/tablette) : 0 élément
  - clés de traduction brutes / mélange FR-EN : aucun ; images sans alt : 0 ; champs sans libellé : 0 ; aucun mot "fournisseur" visible
  - prefers-reduced-motion : transitions à 0 s
  - chargement téléphone lent (mode dev, compilation incluse) : 4 à 10 s ; à refaire sur build de production
  - "Réf. 9001350" lisible et distinct du n° de commande (#5369). 9001350 est l'identifiant du catalogue (docs/01), pas un identifiant fournisseur.

Problèmes :
  1. [Important] Tableau de bord à 768 px — la liste "Dernières commandes" casse quand une commande est "En cours de vérification" (nom du service lettre par lettre en colonne étroite), le bouton "Recharger" est coupé, la page déborde de 8 px — attendu : mise en page propre à 768 px — capture : qa/52-tablette-debordement-tableau-de-bord.png — Responsable : lp-designer
  2. [Important] Transactions à 768 px — titre et sélecteur de filtre dépassent à droite (page de 867 px, "Tous les types" coupé) — attendu : filtre qui passe sous le titre — capture : qa/52-tablette-debordement-transactions.png — Responsable : lp-designer
  3. [Important] Favoris — aucun bouton "ajouter aux favoris" nulle part (catalogue, fiche service, page Commander) : la page Favoris ne peut jamais se remplir pour un vrai client, alors qu'elle dit "Ajoutez un service depuis le catalogue". Le retrait marche ; seule l'API PUT /favorites/{id} permet l'ajout — attendu : un bouton d'ajout (au moins sur la page Commander), ou report explicite par le chef de projet et texte de la page adapté — capture : qa/40-favoris-vide-pc-fr.png — Responsable : lp-designer
  4. [Mineur] Compte, téléphone invalide ("12345") — message générique "Certains champs sont manquants ou invalides..." sans désigner le téléphone — capture : qa/14-compte-tel-invalide-tel-fr.png — Responsable : lp-coder (erreur par champ) puis lp-designer (affichage sous le champ)
  5. [Mineur] Suppression, mauvais mot de passe — "Identifiant ou mot de passe incorrect." ; préférer "Mot de passe incorrect." — capture : qa/72-suppression-mauvais-mdp-pc-en.png — Responsable : lp-designer
  6. [Mineur] Carte "Terminées" : pastille verte "0 %" quand rien n'est terminé ; ressemble à une variation de tendance alors que c'est un taux — capture : qa/10-dashboard-pc-en.png — Responsable : lp-designer
  7. [Mineur] Transactions sur réseau très lent — le filtre (liste native) n'a pas réagi une fois quand il a été changé avant la fin du chargement du script ; non reproduit ensuite. À surveiller en build de production — Responsable : lp-designer
  8. [Mineur] Croix de la suggestion : ferme seulement jusqu'au prochain chargement. À confirmer avec le propriétaire — Responsable : chef de projet
  9. [Mineur] Sur ordinateur, Compte (contenu centré, étroit) et Tableau de bord (pleine largeur) : titres non alignés — capture : qa/13-compte-pc-fr.png — Responsable : lp-designer

Non vérifié :
  - Tableau de bord 1366 px avec une commande "En cours de vérification" (compte de test supprimé avant ; le défaut 1 est probablement limité aux largeurs étroites).
  - Temps de chargement réel (build de production) ; contenu détaillé de la page 2 des transactions (capture 21 non relue).
  - 22 lignes "Ajustement" semées dans le journal du compte QA pour tester la pagination : suppression refusée (journal immuable, voulu). Elles appartiennent au compte QA anonymisé.

Captures : docs/reports/phase-8/qa/ (principales : 10-dashboard-*, 11-commande-via-suggestion, 13-compte-pc-fr, 30-commandes-*, 41-favoris-*, 52-tablette-debordement-*, 71 à 73 suppression)
Serveur de développement arrêté (port 3100 libre). Aucun fichier du projet modifié hors docs/reports/phase-8/qa/.
