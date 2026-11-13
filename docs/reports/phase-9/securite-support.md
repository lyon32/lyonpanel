VERDICT : ACCEPTÉ (avec 1 faille Moyenne et 3 Basses à traiter avant la phase 15)
Tâche : 9 — Support (tickets, pièces jointes)
Méthode : lecture du code et des politiques RLS. Aucun essai en direct n'a été lancé (conclusions tirées du code seulement). npm audit et gitleaks non lancés.

Surface : routes /api/v1/tickets, [id], [id]/messages, attachments ; tables tickets, ticket_messages, ticket_attachments ; bucket privé ticket-attachments ; trigger enforce_ticket_limit ; alerte Telegram.

Contrôles OK (lecture) :
- Toutes les routes : requireApiUser, Origin exigé sur POST/PATCH, Zod, user_id pris de la session.
- IDOR : loadOwnTicket filtre id + user_id (UUID validé) ; 404 identique si ticket d'autrui. RLS en double sur les 3 tables.
- Fermeture via client admin : update filtré .eq('user_id') après vérification de propriété. Statut limité à 'closed' par Zod.
- Pièces jointes : type réel par octets (JPEG/PNG/WebP) ET égal au type annoncé, 2 Mo, chemin <userId>/<uuid>.<ext> sans nom client, SVG/HTML refusés, contentType imposé par le serveur, bucket privé, URL signées 600 s, storage_path jamais renvoyé. Rattachement : listing limité au dossier du client + RLS insert (storage_path like uid/%) + refus si déjà rattachée.
- XSS : texte brut, aucun dangerouslySetInnerHTML ni href construit dans src/components/tickets.
- Limite 3 tickets : trigger avec verrou advisory par utilisateur, donc sûr en parallèle. 10 actions/h par compteur partagé.
- Telegram : seulement id court, sujet (énumération) et indicateur reply ; erreurs avalées, jeton jamais journalisé.
- Aucun secret trouvé dans le diff lu.

Failles :
1. [Moyenne] src/server/tickets/attachments.ts:50 / src/app/api/v1/tickets/attachments/route.ts — l'envoi de fichier n'a aucune limite de fréquence ni de quota : un client connecté peut déposer des fichiers de 2 Mo en boucle (coût stockage, orphelins jamais nettoyés). Correction : compter les envois dans le même limiteur (ex. scope 'ticket_uploads', 20/h) et prévoir un nettoyage des orphelins. Responsable : lp-coder.
2. [Basse] src/server/tickets/tickets.ts:73-126 — rattachement en deux temps (vérifier « non utilisée » puis insérer) sans contrainte unique sur storage_path : deux requêtes parallèles peuvent rattacher la même image à deux messages du même client. Impact faible (son propre fichier). Correction : index unique sur ticket_attachments(storage_path) (nouvelle migration). Responsable : lp-db.
3. [Basse] src/server/tickets/tickets.ts:155 — ticket créé puis message inséré séparément : si l'insertion échoue, ticket vide qui occupe un des 3 emplacements. Correction : rollback (fermer/supprimer) en cas d'échec ou fonction SQL unique. Responsable : lp-coder.
4. [Basse] src/server/tickets/tickets.ts:275 / migration — fermer un ticket puis le rouvrir par un message contourne la limite de 3 (bornée par 10 actions/h). Documenté dans le code ; à confirmer avec le propriétaire. Responsable : lp-coder.
5. [Basse] src/app/api/v1/tickets/attachments/route.ts:15 — req.formData() lit tout le corps avant le contrôle de taille (plafonné par Vercel à ~4,5 Mo). Correction : vérifier content-length avant lecture. Responsable : lp-coder.

Essais d'attaque en direct : NON EXÉCUTÉS (à refaire en local : IDOR GET/PATCH/POST avec session d'un autre client, SVG renommé en .png, upload d'un fichier d'autrui par id, 2 créations en parallèle à 2 tickets ouverts).
