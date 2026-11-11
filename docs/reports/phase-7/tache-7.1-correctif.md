# Tâche 7.1 — correctif des tests

- Test « 250 commandes » : compte les commandes in_progress présentes, vérifie lots ≤ 100, total = ce nombre, appels = ceil(total/100), et que les 250 ids sont demandés.
- Non-pollution : `afterEach` passe les commandes pending/in_progress des utilisateurs de test à `canceled` (update direct, aucune suppression), puis supprime les utilisateurs.
- Alertes : assertions par `order_id` (indépendantes des résidus de la base).
- Typage : `FakeProvider.status` est un `vi.fn` (tests/helpers/orders-db.ts) ; plus d'erreur dans orders-sync. mock-provider-progress passe déjà 2 arguments, handler() l'accepte déjà ; rien à contourner.
- Résultat : db orders-sync 15/15 verts, mock-provider-progress 11/11, typecheck : seules restent les 3 erreurs de modules absents (composants/hook de la tâche 7.x suivante).
