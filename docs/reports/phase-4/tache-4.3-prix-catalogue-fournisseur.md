# Tâche 4.3 et 4.4 — Prix, catalogue, fournisseur, routes
Date : 2026-11-10 · Phase 4 · Statut : rapportée

## Ce qui a été fait
- Calcul des prix en entiers côté serveur : multiplicateur du service, sinon de la catégorie, sinon par défaut ; arrondi aux 5 XAF supérieurs ; minimum 5 XAF.
- Classement par réseau et type d'après le nom ; noms reconstruits sans prix ni nom de fournisseur.
- Client du fournisseur et faux fournisseur (mode mock par défaut ; mode réel refusé hors production).
- Synchronisation : liste vide refusée, aucune suppression, historique des prix.
- Routes publiques : `/api/v1/services` et `/api/v1/services/[id]`.

## Corrections demandées puis faites
- Sécurité : cache de 300 s sur le catalogue ; plafond de 100 000 USD sur le prix fournisseur.
