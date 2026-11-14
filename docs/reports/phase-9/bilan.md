# Bilan — Phase 9 : Support
Date : 2026-11-14 · Statut : faite – en attente de validation du propriétaire · Branche `feat/phase-9-support` (pas encore de PR, rien de commité dans ce lot)

## Objectif de la phase (ROADMAP.md)
Tickets, messages, captures compressées (≤ 2 Mo, bucket privé), alerte « nouveau ticket ». Terminé quand : tu ouvres un ticket avec une capture et l'alerte arrive. Tout avec le faux fournisseur et le faux SasPay.

## Décisions du propriétaire (2026-11-12)
- 4 sujets fixes : Commande, Recharge, Compte, Autre. « Commande » oblige à choisir une commande.
- 3 captures par message, JPEG/PNG/WebP, réduites dans le navigateur, 2 Mo chacune, bucket privé, adresses signées 10 min.
- Le client et le propriétaire peuvent fermer. Un message du client rouvre un ticket fermé.
- Alerte Telegram seulement : numéro court et sujet, jamais le texte, l'email ou le téléphone. Pas d'email.
- Rien côté admin (phases 11-12). FAQ fixe, « Nous répondons sous 24 h ». Aucun lien Telegram pour le client.
- Limites : 10 envois par heure, 3 tickets ouverts, sujet 120 et message 4 000 caractères.

## Résultat : ce qui marche maintenant
- `/support` : FAQ de 5 questions, délai de 24 h, liste « Mes tickets » (20 par page, « Voir plus »), nouveau ticket.
- `/support/[id]` : fil de discussion, réponse, captures visibles, fermer. Un message dans un ticket fermé le rouvre.
- Statut automatique : ouvert, répondu (message de l'équipe), fermé.
- Captures : refus au-delà de 8 Mo, réduction en JPEG dans le navigateur, résultat sous 2 Mo. Sur un téléphone lent, une image de bruit de 4,9 Mo est traitée en 3 s (avant correction : plus de 5 minutes de gel).
- Alerte Telegram à chaque nouveau ticket et chaque message du client.
- FR et EN, thème sombre, 360 px sans débordement.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 9.0 Plan, CLAUDE.md | rapportée | `2026-11-14-tache-9.0.md` |
| 9.1 Tests d'abord | rapportée | `2026-11-14-tache-9.1.md` |
| 9.2 Migrations (3) | rapportée | `2026-11-14-tache-9.2.md` |
| 9.3a Serveur | rapportée | `2026-11-14-tache-9.3a.md` |
| 9.3b Écrans | rapportée | `2026-11-14-tache-9.3b.md` |
| 9.4 Design | rapportée | `2026-11-14-tache-9.4.md` |
| 9.5 Contrôles | rapportée | `2026-11-14-tache-9.5.md`, `securite-support.md`, `qa/rapport-qa.md` |
| 9.6 Rapports, bilan, suivi | rapportée | ce fichier |

## Chiffres réels
Relancés aujourd'hui sur la branche :
- Tests unitaires : 1 517 sur 1 517 verts (108 fichiers, 61 s). Phase 8 : 1 334. Environ 183 tests ajoutés.
- Types : aucune erreur. Format (Prettier) : tout est conforme.
- Lint : 0 erreur, 11 avertissements (fichiers trop longs, déjà connus).
- Build de production : réussi.

Non relancés (cités des rapports) :
- Tests de base : lancés un fichier à la fois par les agents, essais en direct conformes (`securite-support.md`). Pas de total global.
- Test de navigateur `support.spec.ts` : non relancé pour ce bilan.
- Un test unitaire instable a échoué une fois (1 496 sur 1 497), non reproduit.

Contrôles :
- Relecture : ACCEPTÉ (commit e6a09e9).
- QA navigateur : 4 passages. 1er À CORRIGER (1 bloquant, 4 importants), 2e et 3e À CORRIGER (captures lourdes), 4e ACCEPTÉ.
- Sécurité : 3 passages. ACCEPTÉ au 3e (aucune faille critique, haute ni moyenne ; 1 basse résiduelle, D). **Le correctif 9.3i (côté navigateur seulement : réencodage des captures) n'a pas relancé la sécurité.**
- Couverture : non relancée. Aucune fonction d'argent modifiée.

## Problèmes rencontrés et solutions
- Captures invisibles dans le fil : la politique de sécurité bloquait les adresses du stockage. Autorisé pour l'origine exacte du projet Supabase seulement.
- Téléphone gelé sur une image lourde : refus au-delà de 8 Mo, puis réencodage par le canvas natif (3 essais de correction).
- Faille moyenne : un client pouvait déposer des fichiers directement dans le stockage sans passer par le serveur. Dépôt direct retiré (migration).
- Messages illimités en accès direct : limite de 4 000 caractères en base.
- Ticket vide si l'écriture échouait : annulation complète.
- Message « Trop de requêtes » trompeur au 4e ticket : messages dédiés.

## Ce qui n'a PAS été vérifié
- Expiration des adresses signées (10 min).
- Vraie alerte Telegram (seul un appel intercepté en mode test a été vu).
- État d'erreur de chargement de la liste des tickets.
- Repli de la bibliothèque de compression sans `createImageBitmap`.
- Message « image trop lourde pour être réduite » à l'écran (inatteignable en pratique : la source est limitée à 8 Mo et 1 600 px).
- Rejouer les migrations depuis zéro (`db reset`).
- CI GitHub : pas de PR, donc pas lue.
- Obsidian, tableau de bord et carte graphify : non mis à jour (serveur Obsidian indisponible).

## Points reportés (certains demandent ton accord)
- **Défaut D (mineur)** : la règle `ticket_attachments_insert` accepte des chemins étranges en accès direct. Non exploitable. Migration optionnelle.
- **Fichiers orphelins** (déposés, jamais rattachés) : nettoyage reporté (purge planifiée, ton accord requis). Volume borné : 20 dépôts par heure et par compte.
- **Réouverture par message** : contourne la limite de 3 tickets. Accepté par toi (F), bornée à 10 par heure.
- **HTTP 200 au lieu de 404** sur le ticket d'un autre : la page « Introuvable » s'affiche, aucune fuite (à cause de `(app)/loading.tsx`).
- Détail de validation en anglais dans l'API brute (invisible pour le client).
- Une alerte Telegram par message du client (jusqu'à 10 par heure) : bruit possible.
- Clé `support.errors.openLimit` gardée pour un test. `MAX_BODY_LENGTH` écrit côté navigateur et côté serveur.
- **Documents validés à modifier, accord requis (non touchés)** :
  - `DATA_MODEL.md` : contrainte `ticket_messages_body_len`, policy de dépôt direct retirée, index unique `ticket_attachments_storage_path_key`.
  - `PRD.md` : dit encore « tickets + lien Telegram » alors que tu as décidé aucun lien.
- Migrations `20261112100000`, `20261113100000`, `20261114100000` : appliquées en local seulement. À appliquer en production en phase 15.
- Comptes et tickets de test restent dans la base locale.

## À tester par le propriétaire (pas à pas)
1. Lance le site en local avec le faux fournisseur et Telegram configuré pour tes essais. Connecte-toi avec un compte de test.
2. Ouvre `http://localhost:3000/fr/support` : FAQ de 5 questions, « Nous répondons sous 24 h », aucun lien Telegram.
3. Clique « Nouveau ticket », choisis « Commande » sans choisir de commande : message d'erreur. Choisis une commande : l'erreur disparaît.
4. Écris un message, ajoute une capture d'écran (JPEG, PNG ou WebP), puis envoie. Essaie un GIF : refusé. Essaie une 4e capture : refusée.
5. Vérifie l'alerte Telegram : tu reçois le numéro court et le sujet, jamais le texte ni ton email.
6. Ouvre le ticket : le message et la capture s'affichent. Ajoute une réponse : une nouvelle alerte arrive.
7. Ferme le ticket. Réécris un message : il repasse à « Ouvert ».
8. Crée 3 tickets ouverts, puis un 4e : message « Vous avez déjà 3 tickets ouverts. Fermez-en un pour en ouvrir un nouveau. »
9. Réduis la fenêtre à 360 px : aucun défilement horizontal, boutons faciles à toucher.
10. Refais les points 2 à 7 en anglais : `http://localhost:3000/en/support`.
11. Réponse de l'équipe : aucun écran admin en phase 9. Passe par la route de test protégée ou la base locale, puis vérifie que le statut devient « Répondu ».
12. Regarde les captures : `docs/reports/phase-9/qa/` (préfixe `p4-` pour le dernier passage).

## Ce que le propriétaire doit préparer pour la phase suivante
- Phase 10 (parrainage et remises) : à ouvrir en **nouvelle session**, avec la discussion habituelle avant de créer le plan. Rien à préparer à ce stade.
- À décider quand tu veux : mise à jour de `DATA_MODEL.md` et `PRD.md`, purge des fichiers orphelins, migration optionnelle du défaut D, une alerte Telegram par message ou regroupée.

## Décision attendue
« validé » ou corrections. La phase n'est pas validée tant que tu ne l'as pas écrit.
