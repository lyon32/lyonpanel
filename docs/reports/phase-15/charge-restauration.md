# 15.4 — Charge 100 clients et restauration (mode faux uniquement)

Statut : **NON EXÉCUTÉ — scripts prêts, aucun résultat chiffré.**
Date : 2026-11-22.

## Pourquoi rien n'a tourné
Docker Desktop est arrêté sur la machine (`failed to connect to the docker API`), donc pas de Supabase local. `psql`, `pg_dump` et `pg_restore` ne sont pas installés non plus. Aucun résultat n'est inventé : les chiffres ci-dessous restent à remplir après exécution.

## Ce qui a été vérifié
- Syntaxe des deux scripts (`node --check`, `bash -n`) : OK.
- Les scripts refusent de partir sans base locale : le script de restauration sort avec le code 2, et celui de charge s'arrête sur « fetch failed ».
- Le script de charge refuse aussi toute URL non locale et tout `PROVIDER_MODE` autre que `mock`.

## Lancer (Docker démarré, `supabase start`, `.env.local` local)
- Charge : `node --env-file=.env.local scripts/load-100-clients.mjs`
- Restauration : `bash scripts/restore-check.sh` (à lancer après la charge, pour avoir des données).

## Ce que le test de charge fait
Pour 100 clients en parallèle :
1. Inscription.
2. Recharge fausse, webhook rejoué 2 fois avec le même identifiant de transaction.
3. 4 appels `place_order` en parallèle : deux avec la même clé d'idempotence, plus deux autres, soit 3 commandes distinctes attendues.

Le faux fournisseur est simulé en passant les commandes `pending` à `in_progress`, puis à `completed`. C'est une simulation, pas un appel réseau.

Contrôles :
- 1 seul crédit par client ;
- nombre de débits égal au nombre de commandes ;
- solde = somme du journal = 20 000 XAF moins les commandes ;
- aucun solde négatif ;
- aucune commande restée `pending` ou `in_progress`.

Sont aussi mesurés : p50, p95 et max des appels, et la durée totale.

## Ce que le test de restauration fait
Dump du schéma `public` de la base locale, restauration dans une base vide, puis comparaison de : nombre de portefeuilles, somme des soldes, journal (nombre et total), commandes (nombre et total), paiements (nombre et total).

## Résultats
| Mesure | Valeur |
|---|---|
| Clients OK / 100 | à remplir |
| Double crédit / double débit | à remplir |
| Soldes négatifs ou incohérents | à remplir |
| Commandes bloquées | à remplir |
| p95 des appels | à remplir (objectif TESTING §6 : < 800 ms) |
| Restauration : soldes et totaux identiques | à remplir |

## Limites connues
- Le test passe par les fonctions SQL (`place_order`, `credit_payment`) et non par les routes HTTP, donc le p95 est celui de la base, pas celui de l'application.
- TESTING §6 prévoit k6 sur Preview : non utilisé, aucune nouvelle bibliothèque.
- La restauration ne couvre que le schéma `public` ; les comptes `auth` sont hors comparaison.
- Les tests sur une sauvegarde Supabase réelle restent à faire à la main (`docs/checklist-lancement.md`).
