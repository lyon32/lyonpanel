# Plan — Phase 9 : Support

Branche : `feat/phase-9-support` (depuis `main`, merge dd6d9a2). Statut : **plan à valider par le propriétaire**.

## Objectif (ROADMAP.md)
Tickets, messages, captures compressées (≤ 2 Mo, bucket privé), alerte « nouveau ticket ».
**Terminé quand** : le propriétaire ouvre un ticket avec une capture et l'alerte Telegram arrive.

## Décisions du propriétaire (2026-11-12)
1. **Sujets** : 4 sujets fixes — Commande, Recharge, Compte, Autre. « Commande » oblige à choisir une de ses commandes. Le sujet est enregistré comme code dans `tickets.subject` (pas de colonne en plus).
2. **Captures** : oui, **3 images max par message**, JPEG/PNG/WebP, compressées dans le navigateur avant envoi, ≤ 2 Mo chacune, bucket privé `ticket-attachments`, URL signées 10 min. Installe `browser-image-compression` (déjà listée dans `LLD.md §1`, version exacte).
3. **Fermeture** : le client **et** le propriétaire peuvent fermer. Un message du client dans un ticket fermé le remet à « ouvert ». Statuts : `open`, `answered`, `closed` (déjà en base).
4. **Alerte** : **Telegram seulement**, au nouveau ticket **et** à chaque nouveau message du client. Contenu : n° court du ticket et sujet ; jamais le texte, ni l'email, ni le téléphone du client. Pas d'email en phase 9.
5. **Admin** : rien côté admin en phase 9. Les réponses « propriétaire » des tests passent par une route de test protégée (`TEST_ROUTE_SECRET`, désactivée en production) ou directement en base dans les tests. Écran et API admin : phases 11-12.
6. **FAQ** : 5-6 questions fixes en haut de `/support` (délai de livraison, commande partielle, remboursement sur le solde, recharge non reçue, lien privé/compte privé), FR + EN, dans les fichiers de traduction.
7. **Délai affiché** : « Nous répondons sous 24 h » (page Support et après l'envoi).
8. **Anti-abus** : 10 tickets ou messages par heure par client ; **3 tickets non fermés à la fois** max ; sujet ≤ 120, message ≤ 4 000 caractères, texte brut ; 3 images ≤ 2 Mo.
9. **Lien Telegram client** : **aucun** (écart avec PRD « tickets + lien Telegram » : décision du propriétaire, à reporter dans le PRD avec son accord).
10. **Migration** : autorisée **si nécessaire** (fermer/rouvrir, compter les tickets ouverts), toujours une **nouvelle** migration, contenu annoncé au propriétaire avant de la lancer. Aucune fonction d'argent touchée.

## Hors périmètre
Remboursement depuis un ticket (phase 12, toujours manuel), écran et API admin (11-12), parrainage/remises (10), pages publiques (14), email.

## Déjà en place (phase 1)
Tables `tickets`, `ticket_messages`, `ticket_attachments`, type `ticket_status`, RLS (lecture/insertion de ses lignes), bucket privé `ticket-attachments` (2 Mo, jpeg/png/webp, chemin `<user_id>/…`), `telegram.ts`, page provisoire `src/app/[locale]/(app)/tickets/page.tsx`.

## Tâches (ordre de TEAM.md)
| # | Tâche | Agent | Fichiers principaux |
|---|---|---|---|
| 9.0 | Plan, CLAUDE.md (tâche de la session) | chef de projet | ce fichier, `CLAUDE.md` |
| 9.1 | Tests d'abord : schémas Zod, service tickets, routes, RLS/Storage, limites, alerte, e2e « ticket + capture » | lp-tester | `tests/unit/tickets/*`, `tests/db/tickets*.test.ts`, `tests/e2e/support.spec.ts` |
| 9.2 | Migration (si nécessaire) : fermer/rouvrir par le client, limite de 3 tickets non fermés, passage à `answered` sur message admin | lp-db | nouvelle migration `supabase/migrations/20261112…_tickets_support.sql` |
| 9.3a | Serveur : `src/server/schemas/ticket.ts`, `src/server/tickets/tickets.ts`, `attachments.ts`, routes `GET/POST /tickets`, `GET /tickets/{id}`, `POST /tickets/{id}/messages`, `POST /tickets/attachments`, `PATCH /tickets/{id}` (fermer), alerte `new_ticket` | lp-coder | `src/server/tickets/*`, routes API tickets |
| 9.3b | Écrans : `/support` (FAQ, liste, nouveau ticket), `/support/[id]` (fil, réponse, captures, fermer), compression navigateur | lp-coder | `src/app/[locale]/(app)/tickets/**`, `src/components/tickets/*`, `src/messages/*.json` |
| 9.4 | Design sombre `.lp-app`, 360 px, textes (antislop-copywriting) | lp-designer | écrans 9.3b |
| 9.5 | Contrôles : relecture ∥ QA navigateur ∥ sécurité (droits, fichiers, URL signées, limites, fuites) | lp-reviewer ∥ lp-qa ∥ lp-security | lecture seule |
| 9.6 | Rapports, bilan, ROADMAP, CHANGELOG, CLAUDE.md | lp-reporter | `docs/reports/phase-9/*` |

9.3a et 9.3b en parallèle seulement si les types partagés sont figés en 9.1 ; sinon 9.3b après 9.3a.

## Fin de phase
PR vers `main`, CI réelle lue (job `ci`), lp-security ACCEPTÉ, rapports et suivi mis à jour **avant** la fusion. Fusion seulement après « validé » écrit par le propriétaire.
