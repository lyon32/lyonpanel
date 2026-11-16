# Plan — Phase 10 : Parrainage + remises

Branche : `feat/phase-10-parrainage` (depuis `main`, merge d52ff3f). Statut : **décisions validées le 2026-11-16, plan en cours d'exécution**.

## Objectif (ROADMAP.md)
Code et lien de parrainage, page parrainage ; bonus 5 % à la 1re recharge ; remise 10 % dès 50 000 XAF.
**Terminé quand** : un filleul recharge → le parrain reçoit 5 % une seule fois ; la remise s'applique au bon seuil.

## Décisions du propriétaire (2026-11-16)
1. **Périmètre** : page `/parrainage` + lien d'invitation + barre « encore X XAF pour la remise 10 % » + vérification complète du calcul par des tests. Aucune nouvelle règle de prix. Pas de liste de filleuls.
2. **Contenu de la page** : code (8 caractères) avec bouton copier, lien `…?ref=CODE`, nombre de filleuls, total gagné, explication du 5 % (ex. 10 000 XAF rechargés par le filleul → 500 XAF, une seule fois, sur le solde non retirable). Aucune information sur les filleuls.
3. **Anti-fraude** : règles actuelles gardées (refus du propre code, un bonus par filleul, bonus seulement après recharge réussie, annulable par le propriétaire en phases 11-12). Pas de minimum de recharge pour le bonus.
4. **Documents** : `DATA_MODEL.md` et `PRD.md` mis à jour (écarts de la phase 9), commit à part. Reportés : défaut D (mineur), fichiers orphelins, une alerte Telegram par message → phases 11-12 / 15.

## Déjà en place (phases 1, 3, 6)
Colonnes `profiles.referral_code` / `referred_by`, rattachement à l'inscription (trigger), `credit_payment` qui verse le bonus (`referral_rewards`, `wallet_transactions.referral_bonus`), champ code dans le formulaire d'inscription et lecture de `?ref=`, remise auto + personnalisée dans `place_order` et `quote`, page provisoire `referral/page.tsx`, `src/server/referral/` vide.

## À faire
- `GET /referral` : `{code, link, referred_count, total_earned_xaf, pct}` (API_SPEC §6.9), lecture seule, droits du client.
- Prochain palier de remise dans `/wallet` (`next_discount_threshold_xaf`), calculé côté serveur à partir du réglage `auto_discount`.
- Écran `/parrainage` (FR/EN, sombre `.lp-app`, 360 px), copier le code/lien, barre de progression vers 50 000 XAF.
- Tests : bonus une seule fois, arrondi (floor 5 %), pas de bonus sans recharge réussie, auto-parrainage refusé, code inconnu ignoré, double webhook = un seul bonus, remise au seuil exact (49 999 / 50 000), auto contre personnalisée (jamais cumulées), même total `computeOrderTotalXaf` / `place_order`.
- Migration : **seulement si un test révèle un manque** (annoncée avant).

## Hors périmètre
Admin (annulation de bonus, remise perso : 11-12), retrait du solde, pages publiques, vrais paiements (15).

## Tâches (ordre de TEAM.md)
| # | Tâche | Agent |
|---|---|---|
| 10.0 | Plan, documents, CLAUDE.md | chef de projet |
| 10.1 | Tests d'abord (unit, base, e2e) | lp-tester |
| 10.2 | Migration si nécessaire | lp-db |
| 10.3 | Serveur : `referral.ts`, route `/referral`, palier dans `/wallet` ; écran `/parrainage` | lp-coder |
| 10.4 | Design FR/EN, sombre, 360 px | lp-designer |
| 10.5 | Contrôles : relecture ∥ QA navigateur ∥ sécurité (argent) | lp-reviewer ∥ lp-qa ∥ lp-security |
| 10.6 | Rapports, bilan, ROADMAP, CHANGELOG | lp-reporter |

Fin de phase : PR vers `main`, CI lue, `lp-security` ACCEPTÉ, fusion seulement sur « validé » écrit du propriétaire.
