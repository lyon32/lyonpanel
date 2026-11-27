# 15.4 — Charge 100 clients et restauration (mode faux uniquement)

Statut : **EXÉCUTÉ le 2026-11-27 sur Supabase local (`lyonpanel`), `PROVIDER_MODE=mock`. Cohérence OK ; objectif de vitesse p95 < 800 ms NON atteint.**
Date : 2026-11-22.

## Conditions réelles
- Docker démarré, pile locale `lyonpanel` (la base `pubeka` n'a pas été touchée). URL vérifiée en 127.0.0.1.
- Le `.env.local` du dépôt principal ne contient aucune variable Supabase (et contient des clés réelles de fournisseur et de Telegram) : il n'a pas été utilisé. Un fichier d'environnement temporaire hors dépôt, avec les seules clés locales de `supabase status` et `PROVIDER_MODE=mock`, a servi, puis il a été supprimé.
- Corrections de `restore-check.sh` : choix du conteneur `supabase_db_lyonpanel` (le premier trouvé était `pubeka`) et chemins `/tmp` protégés de la conversion de Git Bash. Le script de charge n'a pas eu besoin de correction.

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

## Résultats réels
| Mesure | Valeur |
|---|---|
| `npm run test:db` (RLS, commandes simultanées, webhook rejoué, 429…) | 65 fichiers, 1333 tests passés sur 1333 (428 s) |
| Clients OK / 100 | 100 / 100, 0 erreur de parcours |
| Commandes créées | 300 sur 300 attendues (4 appels par client dont un doublon de clé : doublon absorbé) |
| Double crédit / double débit | 0 / 0 (webhook rejoué 2 fois par client) |
| Soldes négatifs / incohérents | 0 / 0 |
| Commandes bloquées | 0 |
| Appels mesurés (inscription, crédit, commande) | 700 : p50 100 ms, **p95 1956 ms**, max 2296 ms, 3,1 s au total |
| Restauration : soldes et totaux identiques | OUI. Source et copie : 3373 portefeuilles, solde total 69 281 337 XAF, 2926 lignes de journal (total 1 383 722), 5583 commandes (7 060 290), 1675 paiements (14 459 505) |

Lecture honnête :
- Argent : aucun défaut constaté.
- Vitesse : p95 à 1956 ms, au-dessus de l'objectif de 800 ms de TESTING §6. Les 100 clients démarrent d'un coup (pic, pas de montée progressive) sur un poste local, et les appels mesurés incluent la création de compte auth. Ce n'est pas une mesure de production (pas de routes HTTP, pas de Vercel). À refaire sur Preview avec montée progressive avant d'en tirer une conclusion.
- Restauration : `pg_restore` signale des erreurs attendues (le schéma `public` existe déjà, et la clé étrangère vers `auth.users` et les politiques RLS qui utilisent `auth.uid()` n'ont pas pu être recréées car le schéma `auth` n'est pas dans la base vide). Les données sont identiques, mais la restauration des politiques RLS n'est pas prouvée par ce test. Une restauration complète d'une vraie sauvegarde Supabase reste à faire à la main.

## Limites connues
- Le test passe par les fonctions SQL (`place_order`, `credit_payment`) et non par les routes HTTP, donc le p95 est celui de la base, pas celui de l'application.
- TESTING §6 prévoit k6 sur Preview : non utilisé, aucune nouvelle bibliothèque.
- La restauration ne couvre que le schéma `public` ; les comptes `auth` sont hors comparaison.
- Les tests sur une sauvegarde Supabase réelle restent à faire à la main (`docs/checklist-lancement.md`).
