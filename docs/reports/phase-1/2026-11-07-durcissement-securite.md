# Durcissement après l'audit sécurité
Date : 2026-11-07 · Phase 1 · Statut : rapportée

## En une phrase
Le premier audit sécurité a trouvé 2 failles moyennes ; elles sont corrigées et l'auditeur a ré-attaqué sans les retrouver.

## Ce qui a été fait
- Faille 1 : les quantités de commande n'avaient pas de bornes (une quantité énorme pouvait passer). Maintenant `min_qty` et `max_qty` sont obligatoires, et `QUANTITY_OUT_OF_RANGE` est renvoyé avant toute erreur de contrainte.
- Faille 2 : un compte supprimé restait connecté avec son ancien jeton. L'anonymisation supprime maintenant sessions, jetons, facteurs MFA et mot de passe ; un compte `deleted` ne peut plus créer ticket, message ni favori ; l'objet des tickets est masqué.
- Autre correction : `credit_payment` refuse un paiement `failed` (`PAYMENT_NOT_PAYABLE`).
- Méthode : les tests qui reproduisent chaque faille ont été écrits d'abord (`679c205`), puis la correction (`9a3ab5a`).

## Vérifications (résultats réels)
- Tests : `hardening.test.ts`, compté dans les 225 tests de la base, tous verts après `db reset`.
- Contrôles : `lp-security` premier audit À CORRIGER, ré-audit ACCEPTÉ ; `lp-reviewer` ACCEPTÉ.

## Corrections demandées puis faites
- Quantités sans bornes → bornes obligatoires.
- Compte supprimé encore connecté → sessions et jetons supprimés, écritures refusées.
- Paiement `failed` crédité → refusé.

## Fichiers modifiés
- `supabase/migrations/20261107160000_security_hardening.sql`
- `tests/db/hardening.test.ts`
- Commits : `679c205`, `9a3ab5a`

## Ce que tu peux tester toi-même
1. `npm run test:db` : les tests « bornes de quantité », « sessions et accès », « statut du paiement » sont verts.

## Ce qui reste / réserves
- Risque faible connu : un compte supprimé garde la lecture de ses commandes et de son portefeuille avec un ancien jeton.
- Nettoyage des fichiers Storage des pièces jointes à faire côté serveur ; vérification du contenu réel des images (octets magiques) côté serveur.
