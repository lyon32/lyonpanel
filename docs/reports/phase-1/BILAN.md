# Bilan — Phase 1 : Base de données
Date : 2026-11-07 · Statut : faite – en attente de validation

## Objectif de la phase (ROADMAP.md)
Une base Supabase locale complète (tables, règles d'accès, fonctions SQL d'argent) dont chaque cas d'argent et chaque règle de sécurité est prouvé par un test automatique, rejoué à chaque PR.

## Résultat : ce qui marche maintenant
- La base locale démarre avec Docker (`supabase start`) et se reconstruit sans erreur (`supabase db reset` : 8 migrations, puis le seed).
- Toutes les tables de `DATA_MODEL.md` existent, avec leurs contraintes. Un solde ne peut jamais être négatif ; le journal d'argent et le journal d'audit ne peuvent ni être modifiés ni effacés.
- Les cinq fonctions d'argent existent et sont les seules à toucher au solde : `credit_payment`, `place_order`, `refund_order`, `admin_adjust`, `anonymize_user`. Seul le serveur (`service_role`) peut les appeler.
- Un client ne voit que ses propres données. Il ne voit jamais le coût JAP, la marge, ni les notes privées. Les services sont lus par une vue publique `services_public`.
- Des données de départ (réglages + 20 services fictifs) et les types TypeScript générés sont prêts.
- La CI GitHub a une nouvelle étape qui lance Supabase local et les tests de la base à chaque PR.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 1.1 Outillage de test | rapportée | [tâche 1.1](2026-11-07-tache-1.1.md) |
| 1.2 Schéma, index, contraintes | rapportée | [tâche 1.2](2026-11-07-tache-1.2.md) |
| 1.3 `credit_payment` | rapportée | [tâche 1.3](2026-11-07-tache-1.3.md) |
| 1.4 `place_order` | rapportée | [tâche 1.4](2026-11-07-tache-1.4.md) |
| 1.5 `refund_order`, `admin_adjust`, `anonymize_user` | rapportée | [tâche 1.5](2026-11-07-tache-1.5.md) |
| 1.6 Sécurité des lignes + vue `services_public` | rapportée | [tâche 1.6](2026-11-07-tache-1.6.md) |
| 1.7 Seed, types, CI | rapportée | [tâche 1.7](2026-11-07-tache-1.7.md) |
| Durcissement après l'audit sécurité | rapportée | [durcissement](2026-11-07-durcissement-securite.md) |
| 1.8 Rapport | rapportée (ce bilan) | — |

Contrôles : `lp-reviewer` ACCEPTÉ. `lp-security` : premier audit À CORRIGER (2 failles moyennes : quantités sans bornes, compte supprimé encore connecté), corrigées puis ré-attaquées, verdict final ACCEPTÉ.

## Chiffres réels (relancés après `supabase db reset`)
- Tests de la base : **225 verts sur 10 fichiers** (smoke, schema, credit-payment, place-order, refund-order, admin-adjust, anonymize-user, rls, seed, hardening). 0 échec.
- Tests unitaires du projet : 28 verts. Lint et types : sans erreur.
- Migrations : 8, de `20261107100000` à `20261107170000`.
- Couverture en pourcentage : non applicable. Les tests de la base ne mesurent pas de couverture de lignes SQL ; la preuve est la matrice ci-dessous (un test par cas).
- Durée de la CI : non mesurée. L'étape Supabase vient d'être ajoutée, elle sera vérifiée une fois la PR ouverte.

## Matrice : cas d'argent de `TESTING.md §2` et test qui les prouve
Les numéros de ligne sont ceux des fichiers du dossier `tests/db/` (vérifiés avant écriture). Aucun cas n'est sans test (confirmé par le relecteur).

### `place_order` — `place-order.test.ts` (l.71-204)
| Cas | Test | Ligne |
|---|---|---|
| Solde suffisant : débit exact, transaction, commande `pending` | « débite le solde exact, journalise la transaction et fige la commande pending » | 71 |
| Quantité non ronde (137) | « accepte une quantité non ronde (137) et arrondit… » | 93 |
| Solde insuffisant | « refuse INSUFFICIENT_BALANCE… » | 113 |
| Client bloqué | « refuse ACCOUNT_BLOCKED… » | 123 |
| Service inactif / indisponible | « refuse SERVICE_UNAVAILABLE » (2 tests) | 132, 140 |
| Sous le minimum / au-dessus du maximum | « refuse QUANTITY_OUT_OF_RANGE » (2 tests) + bornes exactes acceptées | 148, 157, 165 |
| Prix changé | « refuse PRICE_CHANGED… sans débit » | 172 |
| Même `idem_key` 2 fois = 1 commande, 1 débit | « même idem_key deux fois… » | 190 |
| 2 commandes en parallèle dépassant le solde = une seule passe | « deux commandes en parallèle dépassant le solde… » | 204 |
| Solde jamais négatif | même test (l.204) et refus l.113 | 113, 204 |
| Plafond 500 000 XAF / 24 h | « refuse DAILY_LIMIT_REACHED… » et « ne compte pas les commandes de plus de 24 h » | 217, 227 |
| Remises jamais cumulées (auto 10 %, perso plus grande / plus petite) | 6 tests de remise | 238-291 |
| Aucun montant fourni par l'appelant utilisé | « ne prend aucun montant de l'appelant… » | 301 |
| Client connecté ne peut pas appeler la fonction | « un client authentifié ne peut pas appeler… » | 313 |
| Quantités extrêmes, bornes NULL | `hardening.test.ts` (« bornes de quantité ») | 50-88 |

### `credit_payment` — `credit-payment.test.ts` (l.65-240)
| Cas | Test | Ligne |
|---|---|---|
| Crédit normal (solde, transaction `recharge`, `pay:<id>`, `total_recharged_xaf`) | « crédite le solde, journalise la recharge… » | 65 |
| Même appel 2 fois = 1 crédit | « un même appel deux fois ne crédite qu'une fois » | 92 |
| 2 appels en parallèle = 1 crédit | « deux appels en parallèle… » | 107 |
| Même identifiant SasPay sur un autre paiement | « refuse un identifiant SasPay déjà utilisé… » | 121 |
| Montant différent | « refuse un montant net différent… (AMOUNT_MISMATCH) » | 136 |
| Paiement inconnu | « refuse un paiement inconnu (PAYMENT_NOT_FOUND) » | 147 |
| Appel par un client connecté | « refuse l'appel par un client connecté » | 160 |
| Bonus parrain 5 % : 3 000 → 150, 10 000 → 500 | `it.each` « parrainage » | 180 |
| Bonus une seule fois | « ne verse le bonus qu'une seule fois » | 209 |
| Pas de parrain, pas de bonus | « ne verse aucun bonus à un client sans parrain » | 230 |
| `total_recharged_xaf` cumulé, seuil 50 000 franchi | « cumule total_recharged_xaf… » | 240 |
| Compte supprimé : crédit + ligne « à rembourser » | « crédite quand même et écrit une ligne audit_log » | 254 |
| Paiement `failed` refusé ; `pending` et autres crédités | `hardening.test.ts` (« statut du paiement ») | 155-200 |
| Remise de 10 % réellement appliquée après 50 000 XAF rechargés | `hardening.test.ts` | 204 |

### `refund_order` — `refund-order.test.ts` (l.59-148)
| Cas | Test | Ligne |
|---|---|---|
| Remboursement total | « rembourse la totalité… » | 59 |
| Remboursement partiel | « rembourse partiellement… » | 80 |
| `audit_log` écrit | « écrit une ligne audit_log » | 88 |
| Double remboursement refusé (après partiel, après total) | « refuse ALREADY_REFUNDED » (2 tests) | 104, 112 |
| Montant supérieur au débit | « refuse AMOUNT_TOO_HIGH » | 120 |
| Non-admin refusé | « refuse NOT_ADMIN » | 129 |
| Commande inexistante | « refuse ORDER_NOT_FOUND » | 141 |
| 2 remboursements en parallèle, client connecté refusé | tests de concurrence et de droits | 148, 161 |

### `admin_adjust` — `admin-adjust.test.ts`
Ajustement positif avec note et journal (l.47), négatif (l.72), retour exact à 0 (l.81), solde négatif refusé (l.98), note vide refusée (l.105), montant 0 refusé (l.114), non-admin refusé (l.122), client connecté refusé (l.129).

### `anonymize_user` — `anonymize-user.test.ts` (l.52-101)
| Cas | Test | Ligne |
|---|---|---|
| Email, téléphone, messages effacés ; `status = deleted` | « efface email, téléphone, messages… » | 52 |
| Pièces jointes et favoris supprimés | « supprime pièces jointes et favoris » | 65 |
| Commandes, paiements et portefeuille gardés | « garde commandes, paiements et portefeuille intacts » | 80 |
| 2e appel sans effet | « un second appel est sans effet » | 90 |
| Email et téléphone libérés ; client connecté refusé | l.101 et l.110 | 101, 110 |
| Plus aucune session ni jeton ; compte supprimé n'écrit plus rien | `hardening.test.ts` | 89-153 |

### Sécurité des lignes (RLS) — `rls.test.ts` (l.120-585)
| Cas | Test | Ligne |
|---|---|---|
| A lit ses données mais pas celles de B (profil, solde, messages, pièces jointes) | 4 tests « A lit … et pas celui de B » | 121-161 |
| Colonnes sensibles illisibles (`orders.cost_usd`, `payments.raw_webhook`, `profiles.is_admin`, etc.) et `select(*)` refusé | `it.each` + test | 171-183 |
| A ne peut rien écrire dans `wallets`, `wallet_transactions`, `payments`, `orders` | 5 tests | 219-271 |
| A change sa langue mais pas `status`, `is_admin`, `custom_discount_pct`, `referred_by` | tests « modification de son profil » | 297-323 |
| Favoris, tickets, messages : seulement les siens, pas de faux message admin | 7 tests | 331-396 |
| `admin_notes`, `settings`, `audit_log`, `referral_rewards`, `service_price_history`, `jap_balance_snapshots`, `login_attempts`, `rate_limits`, `allowed_signups`, `idempotency_keys`, `services` : rien lisible | `it.each` (11 tables) | 405-420 |
| `services_public` sans `jap_name`, `cost_usd_1000`, `margin_pct` ; seulement actifs et disponibles | 2 tests | 424, 435 |
| L'admin lit tout | « lit les données de tous les clients… » | 446 |
| Un client ne peut appeler aucune des 5 fonctions d'argent | « fonctions d'argent » | 461 |
| Le visiteur anonyme ne lit rien | « visiteur anonyme » | 503 |
| Storage : A ne voit que ses fichiers | 6 tests | 541-582 |

### Schéma — `schema.test.ts` (11 groupes)
Solde négatif, montant 0, `ref` en double, téléphone en double, `min_qty > max_qty`, 2e récompense de parrainage, journaux immuables, un seul admin, remise personnelle hors 0–50, création automatique du profil et du portefeuille, code de parrainage à 8 caractères, vidage interdit des journaux.

## Problèmes rencontrés et solutions
- **Audit sécurité, 2 failles moyennes** (commits `679c205` puis `9a3ab5a`) : les quantités n'avaient pas de bornes (une quantité énorme pouvait passer) ; un compte supprimé restait connecté avec son ancien jeton. Tests écrits d'abord pour reproduire, corrections faites, ré-attaque : ACCEPTÉ.
- **Fuite du coût JAP** (`4659d90`) : les colonnes `cost_usd`, `error`, `raw_webhook` étaient lisibles par le client. Elles sont maintenant cachées par droits de colonne.
- **Paiement `failed`** : `credit_payment` le créditait ; il le refuse maintenant (`PAYMENT_NOT_PAYABLE`).
- **Profil d'un compte supprimé** : masqué au client (commit `47a4387`, migration `20261107170000`).
- **Test du seed** dépendait de l'ordre des fichiers : rendu indépendant (`98f998a`).
- **Environnement** : voir le point (f) plus bas.

## Décisions et points pour le propriétaire

**(a) Déjà validé.** Prix arrondi au XAF supérieur (jamais en dessous du coût).

**(b) À valider : documents à compléter.** Je n'ai modifié aucun de ces documents (ils sont validés). Voici ce qui est proposé.
- `DATA_MODEL.md` à compléter avec :
  - `min_qty` et `max_qty` sont `NOT NULL` ;
  - un compte `deleted` ne lit ni n'écrit plus rien ;
  - un remboursement partiel clôt la commande : un seul remboursement par commande ;
  - `credit_payment` refuse un paiement `failed`.
- `API_SPEC.md §3` à compléter avec les codes d'erreur : `INVALID_AMOUNT`, `USER_NOT_FOUND`, `PAYMENT_NOT_PAYABLE`, `NOT_ADMIN`, `ORDER_NOT_FOUND`, `ALREADY_REFUNDED`, `AMOUNT_TOO_HIGH`, `NOTE_REQUIRED`, `QUANTITY_OUT_OF_RANGE`, et les autres codes de la base (`INSUFFICIENT_BALANCE`, `ACCOUNT_BLOCKED`, `SERVICE_UNAVAILABLE`, `PRICE_CHANGED`, `DAILY_LIMIT_REACHED`, `AMOUNT_MISMATCH`, `PAYMENT_NOT_FOUND`).

**(c) Valeurs provisoires du seed à confirmer.** `saspay_fee_pct = 3` et `price_alert_pct = 20`.

**(d) Écart à aligner en phase 4.** Le seed met tous les services fictifs à +60 % et arrondit à la dizaine, alors que `docs/01` demande le multiple de 5. À corriger quand le vrai calcul de prix sera écrit.

**(e) À prévoir dans les phases suivantes.**
- Phase 5 : vérifier la devise annoncée par le webhook SasPay.
- Phases 5-6 : le serveur préfixe `idem_key` avec l'identifiant du client.
- Plus tard, côté serveur : nettoyer les fichiers Storage des pièces jointes lors de l'anonymisation ; vérifier le contenu réel des images (octets magiques).
- Ne jamais lire `orders`, `payments`, `profiles` avec `select('*')` côté client (droits par colonne). Lecture admin via `service_role`.
- Ne pas créer de tables depuis le Dashboard Supabase.
- Épingler les actions GitHub par empreinte de commit (Dependabot).
- Risque faible connu : un compte supprimé garde la lecture de ses commandes et de son portefeuille avec un ancien jeton.

**(f) Environnement.** La CLI Supabase du projet est la 2.75.0 du PATH. Ne pas utiliser `npx supabase` : il télécharge la 3.0.0, dont les fichiers de configuration sont incompatibles. La base locale utilise les ports 55321 à 55324. Docker est obligatoire.

**(g) Projet Supabase en ligne.** Tu l'as déjà créé. Rien n'a été poussé dessus : tout est local.

## Ce que vous devez tester (pas à pas)
1. Sur GitHub, ouvre la PR `feat/phase-1-base-de-donnees` → `main` : la CI doit être verte, avec la nouvelle étape « base de données ». (Cette étape n'a pas encore tourné : à vérifier à l'ouverture de la PR.)
2. Chez toi, Docker lancé : `supabase start`, puis `npm run test:db`. Tu dois voir 225 tests verts. `supabase db reset` doit finir sans erreur.
3. Facultatif : ouvre Supabase Studio local http://127.0.0.1:55323 et regarde les tables.
4. Réponds « validé » pour passer à la phase 2, ou dis ce qui doit changer.

## Carte du code
`graphify update .` lancé le 2026-11-07 : 2735 nœuds, 3312 liens, 245 groupes. Carte cliquable : `graphify-out/graph.html`, résumé : `graphify-out/GRAPH_REPORT.md` (dossier généré, non commité).

## Ce que le propriétaire doit préparer pour la phase suivante
Rien d'obligatoire (colonne 🧑 de `ROADMAP.md` pour la phase 2 : « — »).

## Décision attendue : « validé » ou corrections
