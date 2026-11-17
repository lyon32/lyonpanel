# Bilan — Phase 12 : Admin (2) : commandes, services, réglages, journal
Date : 2026-11-17 · Statut : faite – en attente de validation

## Objectif de la phase (ROADMAP.md)
Donner au propriétaire les outils pour gérer les commandes en échec (remboursement, annulation, renvoi, clôture), le catalogue et ses marges, les réglages, les tickets, le journal et les paiements.

## Résultat : ce qui marche maintenant
- **Statuts synchronisés avec le fournisseur** : « en attente » chez lui = « en attente » chez le client (annulable) ; « en cours » = « en cours » (non annulable). Alerte quand une commande n'est plus trouvée chez le fournisseur.
- **Commandes** : remboursement total ou partiel (cumul jamais supérieur au montant payé), annulation par l'admin (envoyée au fournisseur), renvoi confirmé une seule fois, clôture sans remboursement. Recherche par numéro de commande LyonPanel ou du fournisseur.
- **Services** : activation, marge avec aperçu de l'ancien et du nouveau prix avant confirmation, textes personnalisés (400 caractères max, vide = texte généré).
- **Noms et descriptions générés par nous** : le client ne voit plus ceux du fournisseur.
- **Réglages** bornés (taux, marges, minimum, remise auto, parrainage, seuils).
- **Tickets, journal et paiements** : écrans admin.
- **ID fournisseur** visible dans l'admin seulement.
- **Faille n°9 et audit atomique** : l'audit et l'action s'écrivent en une seule opération.

## Choix du propriétaire
Décisions du 2026-11-17 (voir `docs/plans/phase-12.md`) : statuts synchronisés, annulation client seulement en attente, annulation admin envoyée au fournisseur, borne haute des intervalles de vitesse acceptée.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 12.0 Plan et décisions | rapportée | `docs/plans/phase-12.md` |
| 12.1 Tests d'abord | rapportée | commit 25af458 |
| 12.2 Migration | rapportée | commit 75eda46 |
| 12.3 Serveur | rapportée | commits 52077e3, 8725c7c |
| 12.4 Écrans admin | rapportée | commit 8725c7c |
| 12.5 Contrôles | rapportée | `2026-11-17-relecture-phase-12.md`, `2026-11-17-qa-phase-12.md`, `2026-11-17-securite-phase-12.md` |
| 12.6 Rapports | rapportée | ce bilan |

## Contrôles
- **Relecture (lp-reviewer)** : À CORRIGER puis corrigé (3 points : test du champ description, helper réseau partagé, formulaire découpé).
- **QA navigateur (lp-qa)** : À CORRIGER, aucun point bloquant. Correctifs faits : hydratation admin non prouvée, nom personnalisé dans l'historique, zones tactiles, badges des tickets, liste des services.
- **Sécurité (lp-security)** : ACCEPTÉ, aucune faille Critique ou Haute, 3 remarques. Détail : `2026-11-17-securite-phase-12.md`.
- Les correctifs de relecture et de QA n'ont pas fait l'objet d'un nouveau passage des agents (non vérifié).

## Chiffres réels
- Lint : 0 erreur. Types (tsc) : OK. Build : OK.
- Tests unitaires : 1 843 passent (phase 11 : 1 670).
- Tests de base de sécurité : 308 verts.
- Playwright, accès admin : 25 sur 25 (port 3200).
- CI GitHub : pas encore lue (PR non ouverte).

## Problèmes rencontrés et solutions
- Relecture et QA ont demandé des corrections, faites dans les commits 1d9e73f et 112dd86.
- `supabase db reset` impossible à cause de `config.toml` (voir « Reste à faire »).

## À tester par le propriétaire (pas à pas)
1. Ouvre l'adresse secrète de l'admin et connecte-toi (mot de passe puis code).
2. Commandes : cherche une commande par son numéro (LyonPanel ou fournisseur). Sur une commande en échec, fais un remboursement partiel, puis un remboursement total : au-delà du montant payé, il doit être refusé.
3. Renvoie une commande : elle ne part qu'une fois, même avec un double clic. Clôture une autre commande sans remboursement.
4. Services : change la marge d'un service, vérifie l'aperçu de l'ancien et du nouveau prix, puis confirme. Écris un texte personnalisé, vérifie-le côté client, puis vide le champ pour revenir au texte généré.
5. Réglages : essaie une valeur hors limites, elle doit être refusée.
6. Tickets : réponds à un ticket. Consulte le journal et les paiements.
7. Sur téléphone (360 px), vérifie que les boutons se touchent bien.

## Ce que le propriétaire doit préparer pour la phase suivante
Voir 🧑 de `ROADMAP.md`, phase 13 (mise en ligne de test).

## Reste à faire
- Décision : libellé « Réf. » de l'historique (proposition : « Service n° »).
- Décision : les URL publiques `/services/[network]/[type]/[id]` contiennent l'id du service (en attente).
- Décision : répondre à un ticket fermé le rouvre, est-ce voulu ?
- Remarque sécurité Basse : état « renvoi en cours » pour bloquer un remboursement entre `claim_order_resend` et `resend_order`.
- Avertissement d'hydratation admin à re-mesurer dans un navigateur.
- Admin en français seulement.
- Champ tactile de moins de 44 px de la fiche commande à re-mesurer.
- Migrations 9 à 12 à appliquer en production en phase 15.
- `supabase db reset` impossible à cause de `config.toml` (inbucket → local_smtp), à corriger avec ton accord.
- `db:types` non régénéré.
- Clé du fournisseur vue en conversation : à régénérer chez le fournisseur (aucune clé dans le dépôt).
- Temps moyen non disponible (le fournisseur ne l'envoie pas).
- Notification au client après réponse à un ticket : pas faite, il faut un service e-mail (ton accord).
- Vérifier la lecture horaire du solde fournisseur après une annulation admin.
- `npm audit` : `picomatch` via la chaîne de build Sentry/rollup (hors phase).
- `API_SPEC.md` §8 et `openapi.yaml` : paramètre `q` ajouté, à valider par le propriétaire.
- Borne haute des intervalles de vitesse : acceptée par le propriétaire.
- Carte du code (graphify) non relancée.

## Décision attendue : « validé » ou corrections
La phase n'est pas validée. Seul le propriétaire peut le dire.
