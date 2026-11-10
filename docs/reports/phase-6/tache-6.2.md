# Tâche 6.2 — Migration : plafond journalier et arrondi
Date : 2026-11-10 · Phase 6 · Statut : rapportée

## En une phrase
Le plafond journalier (100 000 XAF) est un réglage modifiable, et le total d'une commande est arrondi aux 5 XAF supérieurs.

## Ce qui a été fait
- Nouvelle migration `supabase/migrations/20261110110000_order_cap_and_rounding.sql` : réglage `daily_order_cap_xaf` = 100 000, `place_order` le lit et contrôle les commentaires.
- Décision du propriétaire (2026-11-10) : le total est arrondi au multiple de 5 XAF supérieur (minimum 5). `DATA_MODEL.md` §6 et `place_order` sont alignés.
- `supabase/seed.sql` mis à jour. Nouveau calcul `src/server/pricing/compute-discounted-total.ts`.

## Vérifications (résultats réels)
- Tests de base de données : 473 réussis ou plus, 1 échec connu sans lien avec la commande (voir bilan).
- Sécurité : appel anonyme refusé ; 10 commandes simultanées avec un solde pour une seule : une seule passe.

## Corrections demandées puis faites
- Aucune propre à cette tâche dans les comptes-rendus.

## Fichiers modifiés
- `supabase/migrations/20261110110000_order_cap_and_rounding.sql`, `supabase/seed.sql`, `DATA_MODEL.md`, `src/server/pricing/compute-discounted-total.ts`.

## Ce que tu peux tester toi-même
1. Commander plus de 100 000 XAF sur 24 h : le message « plafond atteint » apparaît.

## Ce qui reste / réserves
- Clé de commande (`idem_key`) unique pour toute la base : à passer en unique par client (phase 7).
- La CLI Supabase locale 3.1.0 refuse `supabase/config.toml` (section `[inbucket]`). La CI utilise la 2.75.0. Les tests de base ont tourné contre la base locale déjà lancée.
