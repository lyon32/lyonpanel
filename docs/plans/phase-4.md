# Plan de la phase 4 — Prix + catalogue

Décisions du propriétaire (2026-11-09) :
- Nouveau fournisseur (API v2, prix et solde en USD) ; son nom n'apparaît jamais côté client.
- Prix client = coût fournisseur en XAF × **multiplicateur** (départ ×3 partout). Taux 1 USD = 600 XAF, réglable (réglage `usd_xaf_rate`).
- Multiplicateur réglable par catégorie (réseau × type), surcharge possible par service. Jamais en dur. Écran admin en phase 12 ; la structure et le calcul sont posés maintenant.
- Arrondi : multiple de 5 XAF supérieur, pour le prix de 1 000 **et** pour le total d'une commande ; minimum 5 XAF.
- **Tous** les services sont vendus et **actifs**, sauf ceux que le fournisseur déclare indisponibles (ou retirés de sa liste).
- Le catalogue de l'ancien fournisseur est remplacé (fichier `data/catalogue-jap-usd-xaf.csv` supprimé).
- Livrable : règles + tableaux lisibles par réseau/type dans `docs/01-catalogue-et-prix.md`, liste complète des 2 188 services en CSV généré dans `data/`.

## Ordre (TEAM.md)

| # | Tâche | Agent | Dépend de |
|---|---|---|---|
| 4.0 | Phase 3 validée + JAP → fournisseur dans les documents | agent général | — |
| 4.1 | Tests : pricing, classement, noms, faux fournisseur, sync, tests SQL | lp-tester | 4.0 |
| 4.2 | Migration : `price_multipliers`, `services.multiplier`, colonnes `jap_*` → `provider_*`, réglages | lp-db | 4.1 |
| 4.3 | `server/pricing`, `server/catalog`, `server/providers` (client + faux), `syncServices` | lp-coder | 4.1, 4.2 |
| 4.4 | Routes API publiques du catalogue (`GET /api/services`, `GET /api/services/[id]`) | lp-coder | 4.3 |
| 4.5 | Génération CSV + `docs/01` réorganisé | lp-coder | 4.3 |
| 4.6 | Pages catalogue (réseaux → types → services) et fiche service, XAF/XOF/USD | lp-coder puis lp-designer ∥ lp-seo | 4.4 |
| 4.7 | Relecture, QA navigateur, sécurité | lp-reviewer ∥ lp-qa ∥ lp-security | 4.6 |
| 4.8 | Rapport, bilan | lp-reporter | 4.7 |

## Règles de calcul

- `multiplicateur` = surcharge du service > règle (réseau, type) > multiplicateur par défaut (réglage, 3).
- `coûtXaf1000 = coûtUsd1000 × taux` ; `prixXaf1000 = ceil5(coûtXaf1000 × multiplicateur)`, minimum 5.
- `totalXaf = max(5, ceil5(prixXaf1000 × quantité ÷ 1000))`. Prix de la commande minimum = total avec la quantité minimale.
- Calculs en entiers (coût en dix-millièmes de dollar) pour éviter les erreurs de virgule flottante.

## Classement (règles sur le nom, pas sur les catégories du fournisseur)

- Réseau : on normalise le nom (accents, lettres stylisées), puis on retient le réseau dont le mot-clé apparaît **en premier** dans le nom ; à défaut, la catégorie du fournisseur ; à défaut, « Autres réseaux ».
- Type : type fournisseur « Custom Comments » → commentaires, « Comment Likes » → likes ; sinon premier mot-clé du nom (commentaires, partages/enregistrements, abonnés, likes, vues) ; sinon « Autres ».
- Nom affiché reconstruit à partir des champs ; jamais de prix, de nom du fournisseur ni d'étiquette `[Max: …]`.

## Terminé quand

Catalogue rangé, prix conformes aux multiplicateurs, aucun nom ne contient le fournisseur ni un prix, lint/types/tests/build/CI verts, rapport dans `docs/reports/phase-4/`.
