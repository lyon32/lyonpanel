# Tâche 7.5 — Correctifs

1. mock-provider.ts : le compteur du faux fournisseur démarre à `Date.now()/1000` (plus de collision avec les anciens provider_order_id). Aucun test ne supposait 10001.
2. cron/orders/route.ts : commentaire corrigé en « toutes les 10 min ».
3. orders-list.tsx : `partial` et `canceled` ajoutés aux états finaux du polling ; tests components/hooks verts.
4. submit-to-provider.ts : non modifié (alerte internal_error déjà présente, pas de relance de add).
5. Vitest ciblé (providers, components, hooks, orders) : 12 fichiers, 200 tests verts.
6. Lint : 0 erreur (8 avertissements existants) ; typecheck : OK. Pas de commit.
