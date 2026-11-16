# Bilan — Phase 10 : Parrainage + remises
Date : 2026-11-16 · Statut : faite – en attente de validation du propriétaire · Branche `feat/phase-10-parrainage` (rien de commité dans ce lot de rapports)

## Objectif de la phase (ROADMAP.md)
Code et lien de parrainage, page parrainage ; bonus 5 % à la 1re recharge ; remise 10 % dès 50 000 XAF. Terminé quand : un filleul recharge, le parrain reçoit 5 % une seule fois, et la remise s'applique au bon seuil.

## Décisions du propriétaire (2026-11-16)
- Page `/parrainage`, lien d'invitation, barre « encore X XAF pour la remise 10 % ». Aucune nouvelle règle de prix. Pas de liste de filleuls.
- La page montre : code de 8 caractères avec bouton copier, lien `?ref=CODE`, nombre de filleuls, total gagné, explication du 5 % (10 000 XAF rechargés par le filleul = 500 XAF, une seule fois, sur le solde non retirable). Aucune information sur les filleuls.
- Anti-fraude : règles actuelles gardées (refus du propre code, un bonus par filleul, bonus seulement après recharge réussie). Pas de minimum de recharge.
- Documents : `DATA_MODEL.md` et `PRD.md` mis à jour pour les écarts de la phase 9.

## Résultat : ce qui marche maintenant
- `/parrainage` (FR et EN, thème sombre, 360 px) : code, lien, boutons copier, nombre de filleuls, total gagné, barre vers la remise de 10 %.
- Un filleul qui recharge rapporte 5 % au parrain, une seule fois (arrondi vers le bas).
- La remise de 10 % s'applique au seuil exact de 50 000 XAF (49 999 : non, 50 000 : oui). Remise automatique et remise personnalisée ne se cumulent jamais.
- Un compte ne peut plus être son propre parrain (contrainte en base).
- Le lien suit la langue du parrain. Le widget anti-robot s'affiche aussi avec `?ref`.

## Tâches
| Tâche | Statut | Rapport |
|---|---|---|
| 10.0 Plan, décisions, documents | rapportée | `2026-11-16-tache-10.0.md` |
| 10.1 Tests d'abord | rapportée | `2026-11-16-tache-10.1.md` |
| 10.2 Migration | rapportée | `2026-11-16-tache-10.2.md` |
| 10.3 Serveur et écran | rapportée | `2026-11-16-tache-10.3.md` |
| 10.4 Design | rapportée | `2026-11-16-tache-10.4.md` |
| 10.5 Contrôles | rapportée | `2026-11-16-tache-10.5.md`, `securite-parrainage.md`, captures `qa/` |
| 10.6 Rapports, bilan, suivi | rapportée | ce fichier |

## Chiffres réels
- Tests unitaires : 1 545 verts (phase 9 : 1 517, soit 28 de plus).
- Tests de base du parrainage : 27 verts.
- Tests navigateur : 5 verts, avec les clés Turnstile de test.
- Lint : 0 erreur, 11 avertissements (déjà connus). Types : aucune erreur.
- Contrôles : sécurité ACCEPTÉ. Relecture : À CORRIGER puis corrigée. QA : À CORRIGER puis corrigée.
- Couverture et durée de la CI : non relancées / non lues.
- Build de production : non cité dans les comptes-rendus reçus pour cette phase.

## Problèmes rencontrés et solutions
- Le lien de parrainage était toujours en français → il suit la langue du parrain.
- Adresse du site absente : le lien aurait pointé vers localhost en production → adresse obligatoire en production.
- Widget anti-robot absent sur la page d'inscription avec `?ref` → corrigé.
- Boutons copier à 36 px → 44 px.
- Auto-parrainage possible en base → contrainte `profiles_no_self_referral`.
- `DATA_MODEL.md` n'avait pas la contrainte → ajoutée.

## Ce qui n'a PAS été vérifié
- **Les corrections de la relecture et de la QA n'ont pas été re-contrôlées par les agents**, seulement par les tests.
- CI GitHub : à lire sur la PR.
- Vraie expérience Turnstile en production (seules les clés de test ont servi).
- Rejeu complet des migrations (`db reset`) : impossible, la clé `[inbucket]` de `supabase/config.toml` est obsolète (problème existant).
- Obsidian indisponible (serveur `mcp-tools-istefox` : connexion refusée) : aucune note écrite. Carte graphify non relancée.

## Points reportés ou à décider
- **Décision du propriétaire** : un client peut créer un second compte, le parrainer et y recharger : il gagne 5 % sur son propre argent. Pas de faille technique, à surveiller (même IP, même téléphone).
- Plafond de `referral_pct` (0 à 100) à ajouter en base en phase admin (11-12).
- Suggestion non traitée : « 10 % » écrit en dur dans les textes.
- Reportés depuis la phase 9 : défaut D (mineur), fichiers orphelins, une alerte Telegram par message (phases 11-12 / 15).
- **Documents validés modifiés, à valider par toi** : `DATA_MODEL.md` (contrainte `profiles_no_self_referral` et écarts de la phase 9), `PRD.md` (écarts de la phase 9).
- Migration `20261116100000_referral_no_self.sql` : appliquée en **local seulement**. À appliquer en production en phase 15. Les migrations de la phase 9 sont dans le même cas.

## À tester par le propriétaire (pas à pas)
1. Lance le site en local (faux fournisseur, faux SasPay). Connecte-toi avec un compte de test.
2. Ouvre `http://localhost:3000/fr/parrainage` : tu vois ton code de 8 caractères, ton lien, 0 filleul, 0 XAF gagné, la barre vers 50 000 XAF.
3. Clique sur « copier » (code, puis lien) : le texte est copié. Les boutons sont faciles à toucher.
4. Ouvre le lien dans une fenêtre privée : la page d'inscription s'ouvre avec ton code déjà rempli et le widget anti-robot est visible.
5. Crée un compte filleul avec ce lien. Sur ta page : 1 filleul, 0 XAF gagné (pas de bonus sans recharge).
6. Fais recharger 10 000 XAF au filleul (faux SasPay) : ton total gagné passe à 500 XAF.
7. Refais une recharge avec le filleul : pas de second bonus.
8. Rejoue le même paiement : aucun crédit en plus.
9. Recharge à 49 999 XAF cumulés : la barre dit « encore 1 XAF ». À 50 000 : la remise de 10 % est atteinte et la barre l'indique.
10. Essaie d'utiliser ton propre code à l'inscription : refusé.
11. Réduis la fenêtre à 360 px : pas de défilement horizontal.
12. Refais les points 2 et 3 en anglais : `http://localhost:3000/en/referral`. Le lien partagé suit la langue.
13. Regarde les captures : `docs/reports/phase-10/qa/`.

## Ce que le propriétaire doit préparer pour la phase suivante
- Phase 11 (admin 1) : installer une appli d'authentification (Google Authenticator ou autre).
- Ouvrir la phase 11 en **nouvelle session**, avec la discussion habituelle avant de créer le plan.

## Décision attendue
« validé » ou corrections. La phase n'est pas validée tant que tu ne l'as pas écrit. Fusion de la PR seulement après ton « validé » et la lecture de la CI.
