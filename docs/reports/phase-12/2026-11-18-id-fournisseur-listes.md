# N° fournisseur dans les listes admin (2026-11-18)

- Test ajouté : tests/unit/orders/submit-to-provider-parallel.test.ts (10 commandes, 2 clients, délais aléatoires) : chaque commande garde le numéro de sa réponse, aucun doublon. Le code existant le garantissait déjà (mise à jour par `id` de commande), aucun changement dans submit-to-provider.ts.
- Liste des commandes admin : N° LyonPanel, N° fournisseur + Copier (ou « Pas encore envoyée »), client (lien vers sa fiche), statut. Cartes mobiles.
- Fiche client : N° fournisseur + Copier dans les cartes mobiles et le tableau (`getUserDetail` renvoie `provider_order_id`).
- Textes FR/EN : admin.*.json (`orders.lyonId`, `orders.customer`). Admin seulement.
- Vérifications : vitest unit 149 fichiers / 1844 tests verts, tsc 0 erreur, lint 0 erreur (13 avertissements existants), build réussi (relancé par le chef de projet avant le commit).
