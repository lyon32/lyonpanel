# Plan — Phase 12 : Admin (2) — commandes, services, réglages, tickets

Branche : `feat/phase-12-admin-2` (depuis `main`, f90c0c1). Statut : **faite le 2026-11-17, en attente de validation du propriétaire** (code commité, contrôles passés, bilan : `docs/reports/phase-12/bilan.md`).

## Objectif (ROADMAP.md)
Commandes `to_review` : rembourser (total/partiel), renvoyer, clôturer. Services : activer, renommer, marge par service. Réglages : taux, marges, minimum, seuils. Tickets : répondre, fermer. Journal d'audit.
**Terminé quand** : le propriétaire rembourse une commande en échec et le client voit son solde corrigé.

## Décisions du propriétaire (2026-11-17)
1. **Renvoi** : manuel et confirmé. Le propriétaire vérifie chez le fournisseur, coche « j'ai vérifié, rien n'a été envoyé », un seul renvoi par commande, tracé. Jamais automatique (règle « Jamais » n°3).
1b. **Statuts synchronisés avec le fournisseur** (précisé le 2026-11-17) : l'état affiché au client est le même que chez le fournisseur, via l'API (déjà en partie en place : `sync-order-statuses`). En attente chez le fournisseur = en attente chez le client ; en cours = en cours. **En attente : le client peut annuler** et récupère la somme payée sur son solde (déjà fait en phase 11, à garder). **En cours : le client ne peut plus annuler.** Seul l'admin peut annuler une commande en cours. Quand l'admin annule, l'annulation est aussi envoyée au fournisseur, qui rend le montant à notre solde fournisseur : le remboursement du client ne coûte rien à LyonPanel (vérifier en phase 12 que le solde fournisseur relevé chaque heure le montre).
1c. **Vérification de la synchro (constat du 2026-11-17, `sync-order-statuses.ts` et `cancel-order.ts`)** : (a) le fournisseur `Pending` et `In progress` deviennent tous deux `in_progress` chez nous : le client ne voit donc pas « en attente » ; l'état local `pending` existe dans l'enum mais n'est jamais posé par la synchro ; (b) l'annulation client est autorisée selon « rien livré » (`start_count`/`remains`), pas selon le statut fournisseur ; (c) `Partial`, `Canceled` et statut inconnu partent en `to_review` (c'est voulu, l'admin examine) ; (d) une commande absente de la réponse du fournisseur est ignorée sans alerte ; (e) la réponse est rangée par `provider_order_id`, donc aucun mélange entre clients, à prouver par un test avec plusieurs clients. **Corrections prévues** : `Pending` → état client « en attente » (annulable), `In progress` → « en cours » (non annulable) ; la synchro suit aussi les commandes en attente ; la règle d'annulation client lit le statut fournisseur ; alerte quand une commande n'est plus trouvée chez le fournisseur ; test multi-clients.
1d. **ID fournisseur dans l'admin** : la liste et la fiche d'une commande côté admin affichent le numéro de commande chez le fournisseur (`provider_order_id`), avec un bouton copier, pour la retrouver chez lui. Visible seulement dans l'admin ; jamais côté client.
2. **Remboursement** : uniquement **sur le solde LyonPanel du client** (il peut relancer une autre commande). **Jamais de retour vers Mobile Money, et rien à ce sujet n'est écrit sur le site** (aucun texte « remboursé sur votre Mobile Money »). La demande passe par un **ticket** ; l'admin clique sur un bouton depuis la commande/le ticket. **Montant = ce qui reste non livré** (ex. payé 5 000, 3 000 déjà consommés → 2 000 rendus ; autre exemple : 600 livrés sur 1 000 → on rend la part des 400 restants). Le client ne peut pas demander le remboursement lui-même d'une commande en cours (pas de bouton côté client) ; l'admin arrête la commande puis rembourse la différence. Motif obligatoire, jamais plus que le montant payé, jamais deux fois (somme des remboursements ≤ montant de la commande). Le client voit son solde corrigé et la ligne dans son historique. Passe par `refund_order` (aucun `update` de solde).
3. **Services** : activer/masquer, nom FR/EN, marge par service, ordre d'affichage. Pas de changement de marge en masse. Avant d'enregistrer une marge, l'écran montre l'ancien et le nouveau prix client (ex. 1 000 abonnés : 2 500 → 2 800 XAF) et demande confirmation. Prix toujours recalculés côté serveur. Le nom du fournisseur et les coûts ne s'affichent que dans l'admin.
4. **Reportés de la phase 11, tous retenus** : journal d'audit obligatoire et **atomique** (le changement et sa trace dans une seule fonction SQL), faille basse n°9 (la garde admin passe avant la vérification d'origine), contrainte « un seul admin » en base.

## Mes choix (à corriger si besoin)
- **Clôture** (`to_review` → `completed`, sans remboursement) : motif obligatoire, tracée.
- **Réglages modifiables** : taux de change, marges par défaut, minimum de recharge/commande, seuils (alerte fournisseur, saut de prix), remise automatique et parrainage. Chaque champ borné et validé par Zod ; l'ancienne valeur est gardée dans le journal. Aucun secret dans les réglages.
- **Tickets** : le propriétaire répond (réponse FR ou EN libre), ferme ou rouvre ; la réponse remet à zéro la limite de 3 messages du client (déjà en place, phase 11). Notification au client : la même que celle des phases 9, sans nouveau service externe.
- **Journal d'audit** : écran en lecture seule (qui, quoi, avant/après, quand), filtre par type d'action, paginé. Pas de suppression possible.
- **Paiements admin** (`GET /admin/payments`) : liste en lecture seule, utile pour vérifier une recharge avant un geste. Pas d'action dessus.
- **Ajustement de solde** (`/admin/users/{id}/adjust`) : prévu par `API_SPEC.md §8` mais absent de la roadmap de la phase 12 ; **non inclus** sauf demande, il reste via `admin_adjust` pour plus tard.
- Aucune nouvelle bibliothèque. Migrations annoncées avant d'être écrites.

## Points de vigilance
- Remboursement et renvoi = argent : 100 % de tests, `lp-security` obligatoire, idempotence (double clic, deux onglets, rejeu).
- Une commande `to_review` ne doit jamais être relancée par le code ; seule l'action manuelle confirmée appelle `provider.add`, et seulement avec `PROVIDER_MODE=mock` en local.
- Les routes `/api/v1/admin/*` renvoient 404 aux non-admins, `aal2` exigé.
- Pas de nom de fournisseur côté client : à re-vérifier sur tout texte nouveau (FR/EN).
- Vérifier d'abord ce qui existe déjà (`refund_order`, `audit_log`, `settings`, `services.margin_pct`) avant toute migration ; `DATA_MODEL.md` fait foi.

## Hors périmètre
Accueil et pages publiques (phase 14), mise en ligne (13), vrais paiements et vrai fournisseur (15), thème clair, remboursement vers Mobile Money.

## Tâches (ordre de TEAM.md)
| # | Tâche | Agent | Statut |
|---|---|---|---|
| 12.0 | Plan, décisions, CLAUDE.md et ROADMAP à jour | chef de projet | rapportée |
| 12.1 | Tests d'abord : audit atomique, remboursement (total, partiel, double), renvoi confirmé unique, clôture, services, réglages, tickets, garde 404/origine, un seul admin | lp-tester | rapportée |
| 12.2 | Migration : fonction d'audit atomique, contrainte un seul admin, remboursements partiels cumulés, réglages bornés, journal des services | lp-db | rapportée |
| 12.3 | Serveur : `/admin/orders*`, `/admin/services*`, `/admin/settings`, `/admin/tickets*`, `/admin/audit`, `/admin/payments`, garde avant origine (lots A commandes, B services+réglages, C tickets+audit) | lp-coder ×3 | rapportée |
| 12.4 | Écrans admin : commandes, services, réglages, tickets, journal (mobile d'abord, FR/EN) | lp-coder puis lp-designer | rapportée |
| 12.5 | Contrôles : relecture, QA navigateur, sécurité, design | lp-reviewer ∥ lp-qa ∥ lp-security | rapportée |
| 12.6 | Rapports, bilan, ROADMAP, CHANGELOG, Obsidian | lp-reporter | rapportée |

Les agents `lp-seo` ne servent pas : toutes les pages sont en `noindex`.

## À faire par le propriétaire (🧑)
Tester : commande en échec → remboursement partiel puis total refusé au-delà ; renvoi ; clôture ; marge d'un service avec aperçu du prix ; réponse à un ticket.

Fin de phase : PR vers `main`, CI lue, `lp-security` ACCEPTÉ, rapports à jour, fusion seulement sur « validé » écrit.
