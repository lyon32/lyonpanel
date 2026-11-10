# Tâche 6.4 — Écran de commande
Date : 2026-11-10 · Phase 6 · Statut : rapportée

## En une phrase
Le client choisit un service, colle son lien, voit le prix en direct, commande, et son solde baisse.

## Ce qui a été fait
- Page `/fr/commander` et `/en/order` : service, lien, quantité, commentaires (seulement si le service en accepte).
- Devis en direct (attente de 300 ms), progression par étapes (envoi, débit, transmission).
- Solde insuffisant : « Il vous manque X XAF » et bouton vers la recharge.
- État « en cours de vérification » si le fournisseur échoue. Textes FR et EN.
- Une clé d'idempotence liée au contenu : un double clic donne une seule commande.

## Vérifications (résultats réels)
- Playwright `order.spec.ts` : 6 sur 6 verts. Types et build verts.
- Exemple vérifié par la QA : solde 5 000, commande à 1 155 XAF, solde 3 845 (affiché et en base).

## Corrections demandées puis faites
- Aucune propre à l'écran dans les comptes-rendus.

## Fichiers modifiés
- `src/app/[locale]/(app)/order/page.tsx`, `src/components/order/*` (formulaire, carte de service, progression, résultat, client, hook d'envoi), `src/messages/fr.json`, `src/messages/en.json`.

## Ce que tu peux tester toi-même
1. Lancer le site en local avec le faux fournisseur et te connecter avec un solde de 5 000 XAF.
2. Ouvrir `http://localhost:3000/fr/commander`, choisir un service d'abonnés, coller un lien de la bonne plateforme, mettre 1 000 : le devis s'affiche.
3. Commander : le solde baisse du montant du devis. Un double clic ne crée qu'une commande.

## Ce qui reste / réserves
- Suivi des statuts et espace client : phases 7 et 8.
