# Plan — Phase 15 : vrai fournisseur, tests finaux, lancement limité

Statut : **VALIDÉ par le propriétaire le 2026-11-22** (exécution dans une nouvelle session).
Rien n'est lancé. Aucun vrai fournisseur ni vrai paiement avant les étapes 15.7 et 15.8, chacune avec son « validé » écrit.

## Décisions du propriétaire (discussion du 2026-11-22)
1. **Statistiques** : vrais chiffres, « 100 clients » et « 2000 commandes », à la place de `PLACEHOLDER_STATS` (sans la pastille « Exemple »). Affichage prévu : « 100+ clients », « 2000+ commandes » (à confirmer).
2. **Logo** : aligné sur la palette sombre (accent `#425EFF`, gris `#D7D7DA`, fond `#111111`).
3. **Image de partage** : `public/og/default.png` 1200×630, fond `#111111`, logo + « 1er panel SMM d'Afrique », faite sans Magnific.
4. **Logos de paiement inutilisés** : **on ne touche à rien** (refus du propriétaire).
5. **Performance** : mesurer d'abord sur le vrai site avec Lighthouse officiel (installation de l'outil de mesure acceptée) ; ne refaire du code (composants serveur) que si le résultat est mauvais.
6. **Clé fournisseur** : régénérée par le propriétaire chez le fournisseur et placée directement dans Vercel Production. Jamais donnée à l'IA, jamais écrite dans le projet. L'ancienne clé est révoquée tout de suite.
7. **Conditions de passage au réel** : voir 15.6.
8. **Ouverture limitée** (choix B) : pas de liste d'emails gérée par l'IA. Le lien n'est partagé qu'avec les personnes invitées ; le site reste en `noindex`. Détail en 15.9.

## Tâches (ordre TEAM.md)

### 15.1 Chiffres de l'accueil
Remplacer `PLACEHOLDER_STATS` par les vrais chiffres (FR/EN), retirer la pastille « Exemple ». Agents : `lp-tester` → `lp-coder` → `lp-designer` → `lp-reviewer` ∥ `lp-qa`. Skills : `antislop-copywriting`.

### 15.2 Logo et image de partage
Logo en palette sombre ; création de `public/og/default.png` ; vérifier les balises Open Graph/Twitter. Agents : `lp-designer` ∥ `lp-seo`, puis `lp-reviewer`.

### 15.3 Mesure de performance
Installer Lighthouse (outil de mesure seulement), mesurer l'accueil en ligne puis sur un vrai Android ; consigner dans `docs/reports/phase-15/perf/`. Si le TBT dépasse l'objectif, proposer au propriétaire le passage en composants serveur (nouvelle décision, pas faite d'office).

### 15.4 Test de charge et restauration
Test de charge 100 clients et test de restauration de sauvegarde (`TESTING.md §6`), **uniquement en mode faux** (`PROVIDER_MODE=mock`, SasPay test). Agents : `lp-tester`, `lp-qa`.

### 15.5 Audit sécurité final
`lp-security` : webhooks, secrets, double crédit/débit, en-têtes, absence de nom de fournisseur côté client, rien en `NEXT_PUBLIC_`. Doit être ACCEPTÉ avant tout passage au réel.

### 15.6 Conditions de passage au réel (toutes obligatoires)
- Tests, charge 100 clients et restauration verts ; CI lue sur la PR.
- Audit sécurité ACCEPTÉ.
- Clé fournisseur régénérée (🧑), ancienne révoquée ; alerte solde fournisseur à 5 $ active.
- « Validé » écrit du propriétaire pour chaque étape réelle (15.7, puis 15.8).
- Plafonds du test : 0,50 $ de commandes, solde fournisseur limité à 20 $ au départ.
- Aucun remboursement automatique : le remboursement du test est fait après examen par le propriétaire.

### 15.7 Bascule fournisseur réel (sur « validé »)
🧑 Le propriétaire place la nouvelle clé dans Vercel Production et recharge le solde fournisseur (20 $). `PROVIDER_MODE=live`. Test réel : 2 à 3 commandes (≈ 0,50 $ au total), vérifier statut, débit, solde fournisseur. Jamais de relance automatique de `provider.add`.

### 15.8 SasPay production (sur un second « validé »)
🧑 Le propriétaire passe SasPay en production (clé `sk_live_...` dans Vercel, jamais dans le dépôt). Test réel : 1 recharge Mobile Money, puis 1 remboursement après examen. Vérifier frais, webhook, crédit unique.

### 15.9 Ouverture limitée (1 à 2 semaines)
- Pas de liste d'emails dans le projet. Le lien n'est donné qu'aux invités (10 à 20 personnes conseillé).
- Le site reste en `noindex` (`SITE_INDEXABLE` inchangé).
- **À vérifier avant** : existe-t-il un moyen de fermer l'inscription en cas de problème ? Sinon, proposer au propriétaire un réglage « inscriptions ouvertes/fermées » (changement à valider, pas fait d'office).
- Surveillance : alertes Telegram, solde fournisseur, commandes bloquées, tickets.

### 15.10 Rapport et clôture
`lp-reporter` : rapport dans `docs/reports/phase-15/`, mise à jour de `ROADMAP.md` et `CHANGELOG`. La phase n'est « validée » que par le mot du propriétaire.

## Hors périmètre
Ouverture publique, bascule d'indexation (phase 16) ; pages par pays, blog, confidentialité, conditions, Google Analytics ; nettoyage des logos de paiement (refusé).

## Terminé quand
Test réel réussi (1 recharge, 2–3 commandes, 1 remboursement) et aucun bug bloquant pendant la période limitée ; lint, types, tests, build et CI verts ; `lp-security` accepté ; rapport écrit.

## Risques à surveiller
Client qui paie sans recevoir (réconciliation recharge/crédit) ; double commande fournisseur ; fuite de clé ; frais SasPay mal calculés.
