# Correctif CI e2e (PR 31)

1. Annulation (order.spec.ts:225) : cause confirmée. `cancel-order` lisait `provider.status()`, et le faux fournisseur avance d'un pas à chaque appel (Pending -> In progress), donc la lecture elle-même empêchait l'annulation.
   Correction : `status(ids, { readOnly: true })` (paramètre optionnel de `ProviderApi`). Le faux fournisseur renvoie l'état courant sans avancer ; le vrai client ignore l'option. Règle métier inchangée (Pending seulement). La synchro garde l'avance d'un pas par appel.
2. Tableau de bord 360 px (client-area.spec.ts:89) : pas de régression (page et bouton inchangés par rapport à main sur ce point). Test fragile : mesure des lignes avant le rendu du texte (0 ligne). Ajout d'une attente `toBeVisible` + `toHaveText(/\S/)` avant la mesure.

Résultats locaux : Playwright order + client-area 16/16 ; vitest unit 1844/1844 ; lint 0 erreur ; tsc 0 ; build OK ; test:db orders-sync 17/17.
