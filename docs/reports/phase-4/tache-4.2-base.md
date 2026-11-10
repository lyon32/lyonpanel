# Tâche 4.2 — Base de données
Date : 2026-11-10 · Phase 4 · Statut : rapportée

## Ce qui a été fait
- Une seule migration ajoutée : table des multiplicateurs par catégorie, multiplicateur par service, colonnes du fournisseur renommées, nouveaux réglages (taux, multiplicateur par défaut).
- Aucune migration déjà appliquée n'a été modifiée (vérifié par lp-security).
- La vue publique des services n'expose ni coût, ni multiplicateur, ni fournisseur.

## Résultats réels
- Tests de base : 273 sur 278 verts. Les 5 échecs viennent du stockage de fichiers (conteneur Supabase local arrêté), sans lien avec la tâche.
