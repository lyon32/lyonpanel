# Contrôle de sécurité — Phase 12 (Admin 2)
Date : 2026-11-17 · Auditeur : lp-security · Verdict : **ACCEPTÉ** (aucune faille Critique ni Haute)

## En une phrase
L'admin (2) ne laisse passer ni double remboursement, ni double crédit, ni fuite du coût fournisseur ; 3 remarques restent à connaître (1 Basse, 1 Basse à confirmer, 1 Moyenne hors phase).

## Ce qui a été vérifié (résultats)
- 14 fonctions SQL de l'admin sont refusées à un visiteur non connecté (erreur 42501).
- Le journal d'audit (`audit_log`) ne peut être ni modifié ni effacé.
- La vue publique des services (`services_public`) ne montre ni `jap_name`, ni le coût, ni le multiplicateur, ni `provider_order_id`.
- 10 remboursements lancés en même temps sur une commande : le total remboursé ne dépasse jamais la somme payée.
- Rejeu d'une même demande, avec ou sans `Idempotency-Key` : un seul crédit.
- Double clic sur annuler, renvoyer ou clôturer : une seule action.
- La garde admin (page introuvable si pas admin) passe avant la vérification de l'origine, partout.
- Toutes les entrées admin sont validées par Zod en mode strict.
- Le texte de recherche `q` des services est nettoyé avant d'être utilisé dans `.or()`.
- Pas de faille XSS (injection de script) trouvée.
- Aucune clé en clair dans le dépôt ni dans l'historique.
- 308 tests de base de sécurité : tous verts.

## Remarques
1. **Basse.** Entre `claim_order_resend` et `resend_order`, un remboursement fait depuis un 2e onglet admin est accepté. Corrigeable avec un état « renvoi en cours ». Le propriétaire est alerté avec le numéro fournisseur.
2. **Basse (à confirmer).** Répondre à un ticket fermé le rouvre. À confirmer par le propriétaire que c'est voulu.
3. **Moyenne, hors phase.** `npm audit` signale `picomatch` via la chaîne de build Sentry/rollup. Aucune dépendance n'a été changée par cette branche.

## Décision
ACCEPTÉ. Les remarques 1 et 2 sont reprises dans « Reste à faire » du bilan.
