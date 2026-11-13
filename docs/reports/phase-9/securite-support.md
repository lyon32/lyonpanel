VERDICT (1er passage) : ACCEPTÉ (avec 1 faille Moyenne et 3 Basses à traiter avant la phase 15)
Tâche : 9 — Support (tickets, pièces jointes)
Méthode du 1er passage : lecture du code et des politiques RLS. Aucun essai en direct. npm audit et gitleaks non lancés.

Surface : routes /api/v1/tickets, [id], [id]/messages, attachments ; tables tickets, ticket_messages, ticket_attachments ; bucket privé ticket-attachments ; trigger enforce_ticket_limit ; alerte Telegram.

Contrôles OK (lecture) :
- Toutes les routes : requireApiUser, Origin exigé sur POST/PATCH, Zod, user_id pris de la session.
- IDOR : loadOwnTicket filtre id + user_id (UUID validé) ; 404 identique si ticket d'autrui. RLS en double sur les 3 tables.
- Fermeture via client admin : update filtré .eq('user_id') après vérification de propriété. Statut limité à 'closed' par Zod.
- Pièces jointes : type réel par octets (JPEG/PNG/WebP) ET égal au type annoncé, 2 Mo, chemin <userId>/<uuid>.<ext> sans nom client, SVG/HTML refusés, contentType imposé par le serveur, bucket privé, URL signées 600 s, storage_path jamais renvoyé.
- XSS : texte brut, aucun dangerouslySetInnerHTML ni href construit dans src/components/tickets.
- Limite 3 tickets : trigger avec verrou advisory par utilisateur. 10 actions/h par compteur partagé.
- Telegram : seulement id court, sujet (énumération) et indicateur reply ; erreurs avalées.

Failles du 1er passage :
1. [Moyenne] pas de limite d'envoi de fichiers. 2. [Basse] rattachement sans unicité. 3. [Basse] ticket vide si échec d'insertion. 4. [Basse] réouverture contourne la limite de 3. 5. [Basse] formData lu avant contrôle de taille.

==========================================================================
2e PASSAGE (final) — essais en direct + vérification des corrections
==========================================================================
VERDICT : À CORRIGER (aucune faille Critique ni Haute ; 1 Moyenne et 3 Basses à traiter, voir plus bas)
Base : Supabase locale (127.0.0.1:55321). Migrations 20261112100000 et 20261113100000 appliquées (trigger, index unique présents). Clés lues dans le conteneur, gardées en variables de session, jamais écrites dans un fichier. Les jetons « client » ont été signés localement avec le secret JWT local (la connexion par mot de passe est bloquée par le captcha local). 2 comptes jetables sectest-p9-*, supprimés ensuite avec leurs tickets, messages et fichiers (vérifié : 0 compte, 0 objet restant). Script d'essai : scratchpad (hors projet). Aucune requête large, aucune écriture sur le dépôt.

Vérification des corrections du 1er rapport :
1. Limite d'envois : CORRIGÉE côté route (upload-limit.ts, 20/h, scope ticket_uploads, avant lecture du corps) MAIS contournable en direct, voir faille A.
2. Unicité du rattachement : CORRIGÉE. Index unique ticket_attachments_storage_path_key ; 5 rattachements parallèles de la même image : 1 x 201 et 4 x 409 ; le code convertit 23505 en NOT_FOUND.
3. Ticket vide : CORRIGÉE. Nettoyage (messages puis ticket, filtré user_id) dans le catch de createTicket ; erreur de nettoyage journalisée sans donnée sensible.
4. Réouverture : NON modifiée, comportement documenté, reste à confirmer avec le propriétaire (Basse, inchangée).
5. content-length : CORRIGÉE (refus au-delà de 2 Mo + 64 Ko avant formData()).

Essais d'attaque (résultat réel) :
- Lire tickets / ticket_messages / ticket_attachments d'un autre client (liste et par id) → attendu 0 ligne / obtenu 0 ligne (3 tables) → OK
- Lire un ticket avec la clé anon seule → attendu refus / obtenu 401 → OK
- Écrire un message dans le ticket d'autrui → attendu refus / obtenu 403 → OK
- Créer un ticket avec user_id d'autrui → 403 → OK
- Fermer le ticket d'autrui en PATCH direct → 403 → OK
- Changer son propre statut en direct, supprimer son ticket, modifier un message → 403 / 403 / 403 → OK
- Message avec from_admin=true (faux admin) → 403 → OK
- Rattacher le fichier d'autrui à son message → 403 → OK
- Rattacher son fichier au message d'autrui → 403 → OK
- Même chemin rattaché 2 fois → 409 → OK
- Télécharger l'image d'autrui avec son jeton / sans jeton / URL publique → 400 / 400 / 400 → OK
- Déposer dans le dossier d'autrui → 400 → OK
- Déposer SVG et HTML directement dans le bucket → 400 (liste blanche de types du bucket) → OK
- Signer l'URL du fichier d'autrui avec son jeton → 400 → OK
- URL signée valide → 200 (lien porteur 10 min, voulu) ; jeton altéré → 400 ; chemin détourné → 400 → OK
- 8 créations de ticket en parallèle → attendu max 3 ouverts / obtenu 3 ouverts (2 x 201 sur la 2e série, 3 au total) → OK
- Appel de enforce_ticket_limit (anon) et sync_ticket_on_message (client) en RPC → 404 / 404 → OK
- Chemin de stockage avec « ../ » rattaché en direct → attendu refus / obtenu 201 (accepté par la RLS) → ÉCHEC, mais non exploitable ici : createSignedUrls (appel groupé du serveur) renvoie « object does not exist » pour ce chemin (testé), donc aucune lecture croisée. Voir faille D.
- 25 envois d'images directs au stockage (limite serveur 20/h) → attendu refus au-delà de 20 / obtenu 25 acceptés → ÉCHEC (faille A)
- HTML déguisé en image/png déposé directement → attendu refus / obtenu 200 → ÉCHEC (faille B) ; l'URL signée renvoie content-type image/png, sans nosniff.
- Message de 2 Mo inséré en direct (limite Zod de 4000 caractères et limite 10/h) → attendu refus / obtenu 201 → ÉCHEC (faille C)
Non exécutés : routes HTTP Next (aucun serveur lancé) ; essais 429 de connexion hors périmètre ; les contrôles de routes (Origin, Zod, 401) sont couverts par tests/db/tickets-routes.test.ts, non rejoués (suite complète interdite).

Cause commune des 3 échecs : la clé publique + le jeton du client permettent d'écrire directement dans Storage et dans ticket_messages (PostgREST) en passant sous toutes les validations serveur.

Secrets : gitleaks absent de la machine (non lancé). Recherche de motifs (sk_live_, sk_test_, service_role, eyJ…, longues chaînes hexa) dans le diff dd6d9a2..HEAD hors graphify et lockfile : seul résultat, une lecture process.env.SUPABASE_SERVICE_ROLE_KEY dans un test (aucune valeur). Aucune clé écrite. OK.
npm audit --omit=dev : 0 vulnérabilité. (npm audit complet : 7 modérées, uniquement des outils de développement, hors production.)
browser-image-compression 2.0.2 : seule dépendance uzip 0.20201231.0 ; aucune vulnérabilité connue signalée par npm audit. Point d'attention : en mode worker, la bibliothèque charge son propre code depuis https://cdn.jsdelivr.net/... (importScripts). Le CSP ne liste pas cette origine, donc le chargement est bloqué en production et la bibliothèque retombe sur le fil principal : rien d'externe n'est exécuté, mais l'option useWebWorker: true est inutile et repose sur ce blocage (faille E).
CSP : img-src = 'self' data: blob: + origine exacte du projet Supabase (originOf(), jamais https: ni joker) ; connect-src idem ; worker-src 'self' blob: ; object-src 'none' ; frame-ancestors 'none'. Aucun https: nu. OK.

Failles restantes :
A. [Moyenne] supabase/migrations/20261107140000_rls.sql:133 (policy ticket_attachments_upload sur storage.objects) — tout client connecté peut déposer des fichiers dans son dossier directement avec la clé publique, sans passer par /attachments : la limite 20/h, le contrôle des octets et le contrôle serveur sont ignorés. Taille plafonnée à 2 Mo par le bucket, types limités par l'en-tête seulement. Scénario : boucle de milliers d'envois de 2 Mo = remplissage du stockage (coût), jamais nettoyé. Correction : retirer la policy d'insertion client (seul le serveur, avec la clé service, dépose) ; ajouter un nettoyage des fichiers non rattachés depuis plus de 24 h. Responsable : lp-db (migration nouvelle, jamais en modifiant l'ancienne) + lp-coder (nettoyage).
B. [Basse] même cause — un fichier non-image (HTML) peut être déposé avec l'en-tête image/png puis rattaché. Impact réduit : seul le client lui-même ou l'admin voit l'URL, content-type image/png, éléments affichés en <img>. Corrigé par A. Si le dépôt direct reste permis : ajouter X-Content-Type-Options côté stockage n'est pas possible, donc retirer le dépôt direct est la bonne correction. Responsable : lp-db.
C. [Basse] table ticket_messages (grant insert client + policy) — la limite de 4000 caractères et le plafond 10 actions/h ne valent que par l'API ; en PostgREST direct, messages illimités et de taille illimitée (2 Mo accepté). Pas d'alerte Telegram, donc pas de spam vers le propriétaire, mais gonflement de la base et affichage lourd dans l'admin. Correction : contrainte check (char_length(body) <= 4000) par nouvelle migration ; idéalement retirer le grant insert client et passer uniquement par le serveur. Responsable : lp-db.
D. [Basse] supabase/migrations/20261107160000_security_hardening.sql:185-190 — la policy ticket_attachments_insert utilise like uid/% : un chemin « uid/../autre-uid/x.png » est accepté. Non exploitable aujourd'hui (le stockage refuse le chemin en appel groupé) mais fragile. Correction : ajouter « and storage_path !~ '\.\.' » ou l'égalité avec le motif ^uid/[0-9a-f-]{36}\.(jpg|png|webp)$ (nouvelle migration). Responsable : lp-db.
E. [Basse] src/components/tickets/attachment-upload.tsx:59 — useWebWorker: true charge du code depuis jsdelivr si le CSP est relâché un jour. Correction : useWebWorker: false (ou libURL auto-hébergée) et retirer blob: de worker-src. Responsable : lp-coder.
F. [Basse, inchangée] réouverture d'un ticket fermé par message : contourne la limite de 3 (bornée à 10/h par l'API ; non bornée en direct, voir C). À confirmer avec le propriétaire.

Verdict : À CORRIGER. Aucune faille Critique ou Haute, mais A (Moyenne) doit être fermée avant la phase 15 ; B à F sont Basses. Aucun secret, 0 vulnérabilité en production, CSP restreint à l'origine Supabase du projet, aucun IDOR, aucune lecture croisée, limite de 3 tickets sûre en parallèle, unicité de rattachement sûre en parallèle.
