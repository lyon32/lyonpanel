# Tâche 7.3d : affichage du suivi des commandes

Créés : order-status-badge.tsx, order-progress-bar.tsx, orders-list.tsx (src/components/order/), src/hooks/use-order-polling.ts.
Modifiés : pages orders (liste réelle, état vide, suivi tant qu'une commande n'est pas finale), src/messages/fr.json et en.json (espace `orderTracking`).

Résultats réels :
- vitest components + hooks : 2 fichiers, 39 tests passés
- lint : 0 erreur (8 avertissements existants, max-lines)
- typecheck : OK
- e2e order-tracking.spec.ts : non lancé (demande base + serveur) ; les data-testid/data-status attendus sont en place.

Choix : partial/canceled/to_review affichés « en cours de vérification » ; barre visible seulement pour « en cours » ; l'écran de résultat de commande n'est pas modifié. Aucun commit.
