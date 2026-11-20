# Relecture phase 12 (lp-reviewer), 2026-11-17

VERDICT : À CORRIGER (1 bloquant test, 2 importants mineurs)

Vérifications relancées :
- lint : 0 erreur, 17 avertissements (max-lines sur gros fichiers existants, `_args` inutilisés dans 2 tests)
- typecheck (tsc --noEmit) : OK
- vitest unit : 147 fichiers, 1842/1842 verts
- test:db (variables lues via `supabase status -o env`) : 1332/1333, 1 échec
- build, couverture : non relancés

Problèmes
1. [Bloquant] tests/db/favorites-routes.test.ts:166 — la liste des clés de la forme Service ne contient pas `description`, ajouté par present-catalog.ts:21 — Correction : ajouter `'description'` à la liste attendue (changement voulu de la phase, décision du chef de projet requise pour toucher ce test) — Responsable : lp-tester
2. [Important] src/app/gestion/[adminPath]/(panel)/services/[id]/page.tsx:59-66 — conversion plateforme vers Network dupliquée, déjà écrite `toNetwork` dans services/(list)/page.tsx:21 — Correction : un seul helper partagé (ex. dans src/lib/admin-format.ts ou catalog/labels) — Responsable : lp-coder / lp-designer
3. [Important] src/components/admin/service-edit-form.tsx — 311 lignes (> 300) — Correction : extraire les champs de texte personnalisé en sous-composant — Responsable : lp-designer

Points vérifiés OK
- refund_order : verrou de commande, plafond = part non livrée, cumul des remboursements <= plafond, clé d'idempotence rejouable sans second crédit, statut `refunded` au plafond, trace dans la même transaction, droits service_role seulement.
- Renvoi : `resent_at` posé avant `provider.add`, une seule fois, refus si déjà remboursé même en partie, pas de reprise automatique après échec.
- Annulation : réservation de 2 min contre le double clic, aucun remboursement automatique (passage en `to_review`).
- update_service : prix recalculé en SQL, historique de prix, trace. update_setting : bornes et tout-ou-rien.
- Aucun `any`, `@ts-ignore`, `dangerouslySetInnerHTML`, `console.log`, ni `useEffect` dans admin/gestion (`step="any"` HTML seulement). Aucun nom de fournisseur dans les composants et messages client.
- Descriptions de services générées par nous, aucune phrase fournisseur recopiée.

Suggestions
- Avertissements `_args` / `_deps` inutilisés dans tests/unit/admin/service-forms.test.tsx et tests/unit/catalog/cron-services-route.test.ts.
- Relancer `npm run build` et la couverture (argent) avant la PR.
- Des modifications non commitées existent dans services/(list), services/[id] (labels réseau) : à commiter ou écarter, et à relire.
