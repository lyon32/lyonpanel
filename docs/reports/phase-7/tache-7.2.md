# Tâche 7.2 — Migration suivi des commandes

STATUT : TERMINÉ

## Fichiers
- supabase/migrations/20261110120000_order_tracking.sql (nouvelle)
- src/server/db/types.ts (champ alerted_at ajouté à la main dans orders : Row, Insert, Update ; le CLI supabase local ne tourne pas)

## Ce que fait la migration
- Retire l'unicité globale de orders.idem_key, ajoute unique (user_id, idem_key).
- Ajoute orders.alerted_at (timestamptz, vide par défaut).
- place_order cherche déjà la commande par idem_key ET user_id : aucune fonction modifiée, aucune logique d'argent touchée. (L'unicité de payments.idem_key reste globale, inchangée.)

## Résultats réels (base locale port 55321, migration appliquée via docker exec psql)
- tests/db/orders-idem-key.test.ts : 3 tests passés.
- Suite npm run test:db entière : 478 tests passés, 22 fichiers sur 23 verts. Le seed "aucun faux client" passe aussi.
- Seul fichier en échec : tests/db/orders-sync.test.ts, car il importe @/server/orders/recover-stuck-orders qui n'existe pas encore (code de la tâche suivante, pas de la base).
- Les clés locales ont été fabriquées depuis le secret JWT du conteneur local ; .env.local du dépôt principal a des valeurs vides.
- Pas de commit. node_modules installé avec npm ci dans le worktree.
