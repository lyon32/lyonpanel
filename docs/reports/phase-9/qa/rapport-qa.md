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

==================================================================
2e PASSAGE (14 nov. 2026)
==================================================================
VERDICT : À CORRIGER (1 défaut Important restant, 2 Mineurs)
Environnement : build de production (`next build` puis `next start`, port 3100), faux fournisseur (PROVIDER_MODE=mock), SasPay test, Supabase local, Chromium Playwright. Code testé : commit 44fa20b (vouvoiement, stockage durci), construit dans une copie temporaire hors dépôt (un autre processus reconstruisait `.next` du worktree en même temps). Telegram intercepté. `.env.local` de test supprimé. Serveur arrêté (port 3100 libre). Captures : préfixe `p2-` (01 à 22).

Re-vérification des défauts du 1er passage :
  1. Captures visibles dans le fil -> CORRIGÉ. Vraie photo : miniature 1140x1520 affichée (p2-22-photo-fil-pc-fr.png, -tel-fr, -tel-en), plus aucune violation CSP en console.
  2a. Erreur worker blob: -> CORRIGÉE (console vide à l'envoi, PC et téléphone).
  2b. Compression bornée à 20 s -> NON CORRIGÉ pour une image non compressible. L'indicateur "Réduction de l'image…" s'affiche (p2-17-compression-indicateur-*.png), mais PNG de bruit de 4,9 Mo : PC = page gelée 37 s (résultat à 39 s, sans message), téléphone lent = aucun résultat en 330 s, onglet gelé. Le délai de 20 s ne peut pas se déclencher car le fil principal est bloqué. Photo 12 Mpx de 2,1 Mo : 3 à 8 s (OK).
  3. "3 tickets ouverts" au 4e ticket -> CORRIGÉ FR et EN ("Vous avez déjà 3 tickets ouverts. Fermez-en un pour en ouvrir un nouveau." / "You already have 3 open tickets. Close one to open a new one."), 3 tickets en base (p2-12-*, p2-20-*).
  4. Limite d'envoi -> CORRIGÉ, message dédié FR/EN ("Trop de messages envoyés. Réessayez dans une heure." / "Too many messages sent. Try again in an hour.") dans le fil (p2-13-*, p2-21-*). Le 429 console reste, provoqué.
  5. Erreur "Choisissez la commande" -> CORRIGÉ (disparaît au choix, 4 parcours).
  6. Bouton avant hydratation (téléphone 360 px, réseau lent) -> CORRIGÉ : bouton désactivé tant que la page n'est pas hydratée, clic précoce sans effet, 0 ticket créé, actif ensuite (FR et EN, p2-16-hydratation-*).
  7. Réponse jusqu'à 4 000 caractères -> CORRIGÉ (champ limité à 4 000, 4 000 enregistrés ; 4 001 par l'API = 400).
  8. Ticket d'autrui -> OK : page "Page introuvable" / "Page not found" FR/EN, aucun contenu du ticket, API 404 (lecture, fermeture, message), identifiant invalide idem. Le statut HTTP de la page reste 200 (esquisse envoyée avant notFound) ; le test e2e accepte déjà ce cas.

Parcours complet refait (téléphone 360x740 UA Android 1,6 Mbit/s 150 ms CPU x4 ; ordinateur 1366x768), FR et EN : FAQ (5), "sous 24 h" / "within 24 h", pas de lien Telegram/WhatsApp, envois vides, sujet Commande sans commande, GIF refusé, photo compressée et envoyée, 3 captures max, retrait/ajout, double clic (1 seul ticket), fil, réponse équipe (open -> answered), réponse client (-> open), réponse de 4 000 caractères, fermeture, réécriture (réouverture), 3 tickets puis 4e refusé, limite horaire, anonyme -> connexion, hors ligne ("Connexion impossible. Réessayez." / "Connection failed. Try again."). 4 parcours -> OK. Textes FR/EN complets, vouvoiement uniforme, aucune clé brute.
Alerte Telegram (mode test) : un appel par ticket et par message client, sans texte ni coordonnées du client.

Mesures (build de production) : exceptions JS 0 ; requêtes 5xx 0 ; erreurs console hors 4xx provoqués : 0 (hors ligne simulé : "ERR_INTERNET_DISCONNECTED", attendu) ; débordement 360 px : non ; cibles < 44 px : 0 réelle (champ fichier caché doublé d'un libellé de 44 px) ; images sans alt 0 ; champs sans libellé 0 ; mot "fournisseur" 0 ; chargement page Support téléphone lent : 8,5 à 9 s (PC 2,2 s) ; dev du 1er passage : 12 à 17 s.

Nouvelle vérification (non faite au 1er passage) :
  - Build de production : OK (build, démarrage, parcours complets).
  - Pagination (26 tickets) : la liste affiche 20 tickets, sans bouton "voir plus" ni pagination ; les 6 plus anciens sont inaccessibles (p2-19-liste-26-tickets-tel-fr.png). Voir défaut B.
  - Erreur de chargement de la liste : NON VÉRIFIÉ. La liste est rendue côté serveur ; la provoquer demandait d'arrêter le conteneur Supabase partagé avec d'autres sessions de test (non fait).
  - Expiration des URL signées (10 min) et vraie alerte Telegram : non vérifiés.

Problèmes ouverts :
  A. [Important] Envoi de captures — image impossible à réduire (PNG de bruit 4,9 Mo) : page gelée 37 s sur PC, plus de 5 min sur téléphone lent, sans message ; le plafond de 20 s ne se déclenche pas car la réduction bloque le fil principal (le worker n'est apparemment pas utilisé). Attendu : abandon à 20 s avec "Cette image est trop lourde à réduire…", page toujours utilisable (par ex. refuser avant réduction les fichiers très lourds/de très grande dimension, ou vérifier le worker). Capture : p2-17-compression-indicateur-tel-fr.png. Cas extrême (une capture d'écran ou photo normale passe) — Responsable : lp-coder.
  B. [Mineur] Liste "Mes tickets" limitée à 20 sans accès aux suivants — Responsable : lp-coder / chef de projet (décision de périmètre).
  C. [Mineur] Page "introuvable" d'un ticket d'autrui en HTTP 200 au lieu de 404 (aucune fuite) — Responsable : lp-coder.
  D. [Mineur, repris] Détail d'erreur de validation en anglais brut ("Too big: ...") dans la réponse API ; invisible pour le client. Une alerte Telegram par message client (jusqu'à 10 par heure) : à décider par le chef de projet.

Critères : parcours OK, erreurs claires sans débit, 0 console/5xx, 0 débordement, FR/EN complets : remplis. Aucun Bloquant. Reste A (Important) -> À CORRIGER.

==================================================================
3e PASSAGE (14 nov. 2026) — ciblé : défauts A (captures) et B (pagination)
==================================================================
VERDICT : À CORRIGER (défaut A toujours Important ; B corrigé)
Environnement : build de production du commit 14c6295 dans une copie temporaire hors dépôt (build en mode webpack : Turbopack ne retrouvait pas node_modules via la jonction), `next start` port 3100, faux fournisseur (PROVIDER_MODE=mock), SasPay test, Supabase local, Chromium Playwright, Telegram intercepté. Téléphone 360x740 UA Android 1,6 Mbit/s 150 ms CPU x4 ; ordinateur 1366x768. `.env.local` bidon supprimé, serveur arrêté (port 3100 libre), tickets de test (26) supprimés. Captures : préfixe `p3-`.

A. Envoi de captures
  - PNG de bruit 4,9 Mo (1400x1400) : NON CORRIGÉ. PC : fil principal bloqué 29,2 s (FR) et 28,2 s (EN) ; l'image finit par passer, sans message, interface inutilisable pendant ce temps (longtask 29,2 s, ping de l'interface 29 s). Téléphone lent (FR) : bloqué 337 s (5 min 37) sans aucun résultat visible, interface gelée. Cause probable : l'image fait 1400 px (< 1600 px), donc la réduction native (`downscale`) renvoie le fichier tel quel (ratio = 1) et c'est `browser-image-compression` (fil principal) qui boucle sur un PNG incompressible. Le plafond de 20 s ne peut pas agir : le fil principal est bloqué.
  - Fichier > 8 Mo (9 Mo) : OK. Refus immédiat (14 à 57 ms) avec "Cette image est trop lourde (8 Mo maximum). Choisissez une capture plus légère." / "This image is too heavy (8 MB maximum). Choose a lighter screenshot." (p3-02-*). La page reste utilisable.
  - Vraie photo 12 Mpx (2,1 Mo) : OK. PC 0,4 à 0,6 s ; téléphone lent 5,2 s (blocage max 3,3 s). Affichée dans le fil (miniature 1028x1371).
  - Capture d'écran PNG 1080x2400 : OK. PC 0,4 s ; téléphone 2,1 s. Affichée dans le fil (720x1600).
  - Envoi du ticket avec 3 pièces jointes puis affichage dans le fil : OK (PC FR/EN, téléphone FR), images chargées (p3-04-*). Console vide, 0 exception, 0 5xx.
  - Téléphone EN : non rejoué (le résultat du bruit est identique par construction, même code).
  Limite proposée (le plus simple) : ne plus laisser `imageCompression` toucher une image sans réduction préalable. Toujours passer par le canvas natif (asynchrone) pour réencoder en JPEG, même quand le côté est déjà <= 1600 px, en baissant la qualité (0,8 puis 0,6 puis 0,4) jusqu'à <= 1 Mo, puis abandonner avec le message "trop lourde à réduire". Si on préfère une règle de taille : refuser les PNG de plus de 3 Mo (une capture d'écran réelle fait bien moins ; le PNG de bruit de 4,9 Mo est le seul cas qui fige). Éviter de limiter les JPEG à 3 Mo : une photo téléphone de 12 Mpx fait souvent 3 à 6 Mo.

B. Pagination "Mes tickets" (compte de 26 tickets fermés)
  - CORRIGÉ. Page 1 : 20 lignes + "Voir plus" / "See more". "Voir plus" -> page 2 : 6 lignes, "Retour au début" / "Back to the start", plus de "Voir plus". "Retour au début" -> /fr/support (ou /en/support), 20 lignes, même premier ticket. Premier ticket de la page 2 différent de celui de la page 1.
  - Curseur invalide (abc, %E0%A4%A, e30, not-base64!!, MTIz, 500 caractères, curseur doublé) : HTTP 200, première page (20 lignes), aucune erreur 500, aucun message d'erreur.
  - 360 px : débordement 0 ; FR et EN, PC et téléphone : tous OK ; console vide, 0 exception, 0 5xx. Captures p3-10 à p3-12.

Problème ouvert :
  A. [Important] Image de 1400 px incompressible (PNG de bruit 4,9 Mo) : PC 29 s de gel, téléphone lent plus de 5 min, sans message — capture : p3-01-bruit-tel-fr.png — Responsable : lp-coder.
Verdict : À CORRIGER (A). B accepté.
