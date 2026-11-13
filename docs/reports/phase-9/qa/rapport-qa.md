VERDICT : À CORRIGER
Tâche : 9.5 — QA navigateur, Support (phase 9)
Environnement : local (Supabase 55321), PROVIDER_MODE=mock, SASPAY_MODE=test, Next dev port 3100, Chromium Playwright. Telegram : appel sortant intercepté (aucun message réel). Comptes de test créés par la QA. Aucun .env.local écrit.

Parcours testés (téléphone 360x740, UA Android, 1,6 Mbit/s, 150 ms, CPU x4 ; ordinateur 1366x768) :
  - [tél FR] FAQ (5), "sous 24 h", pas de lien Telegram/WhatsApp, envoi vide, sujet Commande sans commande, GIF refusé, photo 12 Mpx de 2,1 Mo compressée puis envoyée (~10 s), 4e capture refusée, retrait/ajout d'une capture, double clic sur Envoyer (1 seul ticket), fil, réponse équipe, réponse client, fermeture, réécriture (réouverture), 3 tickets ouverts puis 4e refusé, limite horaire, ticket d'un autre, anonyme -> OK, avec les défauts 1 à 6
  - [PC FR] mêmes parcours + hors ligne ("Connexion impossible. Réessayez.") -> OK, mêmes défauts
  - [tél EN] et [PC EN] : FAQ, "We reply within 24 h", erreurs, captures, fil, fermeture, réouverture -> OK (textes complets, aucune clé brute, aucun mélange)
  - Statuts en base vérifiés : open -> answered (message équipe) -> open (réponse client) -> closed -> open (réécriture).
  - Droits : ticket d'un autre -> API 404 (lecture, fermeture, message) ; page "Page introuvable" ; anonyme -> /connexion ; message de 4 001 caractères -> 400.
  - Limite horaire : 10 envois par heure, puis 429 "Trop de requêtes..." (retry 3600 s), affiché dans le formulaire et le fil.
  - Alerte Telegram (mode test) : appel fait pour chaque ticket et chaque message client, ex. "[TEST] [LyonPanel] new_ticket {"ticket":"0FDB8901","subject":"order"}" (+ "reply":true pour un message). Aucun texte, email ni téléphone du client.
  - Thème sombre : cohérent partout (FAQ, formulaire, bulles, badges "Ouvert", erreurs), lisible.

Mesures : erreurs console : violations de politique de sécurité (problèmes 1 et 2) + 4xx/429 provoqués ; exceptions JS 0 ; requêtes 5xx 0 ; débordement horizontal 360 px : non ; cibles < 44 px : 0 réelle (seul le champ fichier caché, doublé d'un libellé de 44 px) ; images sans alt 0 ; champs sans libellé 0 ; mot "fournisseur" 0 ; chargement téléphone lent (dev, compilation incluse) : 12 à 17 s, à refaire en build.

Problèmes :
  1. [Bloquant] Fil du ticket — les captures jointes ne s'affichent pas (icône cassée + texte "Capture jointe"). img-src de src/lib/security-headers.ts ('self' data: blob:) refuse les URL signées du stockage Supabase (console : "Loading the image ... violates ... Content Security Policy"). Vrai aussi en production. Attendu : miniature visible. Captures : qa/07-fil-tel-fr.png, qa/08-fil-reponse-equipe-pc-fr.png — Responsable : lp-coder
  2. [Important] Envoi de captures — la compression lance un Web Worker depuis une URL blob: refusée par la même politique (pas de worker-src) : erreur console à chaque envoi, repli sur le fil principal (fige l'écran sur téléphone lent). Cas extrême non compressible (PNG de bruit 4 Mo) : 45 s sur PC, plus de 120 s sur téléphone sans retour visible. Attendu : worker-src 'self' blob:, indicateur de compression — Responsable : lp-coder
  3. [Important] 4e ticket non fermé — message "Trop de requêtes. Patientez un instant avant de réessayer." (le code reason=open_tickets est renvoyé mais ignoré) : trompeur. Attendu : "Vous avez déjà 3 tickets ouverts. Fermez-en un pour en ouvrir un nouveau." (FR/EN). Capture : qa/12-4e-ticket-refuse-tel-fr.png — Responsable : lp-coder
  4. [Mineur] Ticket d'un autre / identifiant invalide — page "Page introuvable" correcte mais statut HTTP 200 (esquisse de chargement envoyée avant le notFound). tests/e2e/support.spec.ts attend 404 : ce test risque d'échouer. Aucun contenu divulgué. Captures : qa/14-ticket-autre-404-tel-fr.png, qa/14b-ticket-autre-final-pc-fr.png — Responsable : lp-coder
  5. [Mineur] Formulaire envoyé avant l'hydratation (téléphone lent) — l'envoi natif recharge /fr/support sans créer de ticket (le texte peut passer dans l'adresse). Même schéma que les autres formulaires du site. Attendu : method="post" ou bouton inactif tant que la page n'est pas prête — Responsable : lp-coder
  6. [Mineur] Formulaire — après choix de la commande, l'erreur "Choisissez la commande concernée." reste affichée. Capture : qa/06-captures-4e-refusee-tel-fr.png — Responsable : lp-coder
  7. [Mineur] Réponse dans le fil limitée à 2 000 caractères (plan : 4 000) — Responsable : lp-coder
  8. [Mineur] Détail d'erreur de validation en anglais brut ("Too big: ...") ; message principal en français, non visible du client — Responsable : lp-coder
  9. [Mineur] Une alerte Telegram par message client (jusqu'à 10 par heure et par client) : bruit possible — Responsable : chef de projet

Non vérifié : build de production (temps réel), expiration des URL signées (10 min), état "erreur de chargement" de la liste, pagination (> 20 tickets), alerte Telegram réelle.

Captures : docs/reports/phase-9/qa/ (01 à 15, suffixes tel/pc et fr/en). Serveur arrêté (port 3100 libre).
