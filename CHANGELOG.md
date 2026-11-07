# Journal des changements LyonPanel

Écrit pour le propriétaire. Une section par phase. Seul le propriétaire valide une phase.

## Phase 1 — Base de données (2026-11-07) — faite, en attente de validation

### Nouveau
- Une base de données complète tourne sur ton ordinateur (Docker + Supabase) : comptes, portefeuilles, paiements, commandes, services, tickets, journaux.
- Cinq fonctions gèrent tout l'argent, et elles seules : créditer un paiement, passer une commande, rembourser, ajuster un solde, effacer un compte.
- Un paiement confirmé deux fois (ou en même temps) crédite le solde une seule fois.
- Deux commandes envoyées en même temps ne peuvent pas dépasser le solde. Le solde ne devient jamais négatif.
- Le prix d'une commande est calculé par la base, arrondi au XAF supérieur. Exemple : 333 XAF pour 1000, avec 10 % de remise, donne 299,7, arrondi à 300 XAF.
- Bonus parrain de 5 %, une seule fois : 3 000 XAF rechargés donnent 150 XAF, 10 000 donnent 500.
- Le journal d'argent et le journal d'audit ne peuvent plus être modifiés ni effacés.
- 20 services fictifs et les réglages par défaut sont prêts pour les tests.
- GitHub lance maintenant les tests de la base à chaque PR (étape à vérifier à l'ouverture de la PR).

### Sécurité
- Un client ne voit que ses propres données. Il ne voit jamais le coût JAP, la marge ni les notes privées.
- L'audit sécurité a trouvé 2 failles moyennes (quantités sans bornes, compte supprimé encore connecté). Elles sont corrigées et ré-attaquées sans succès.
- Un paiement échoué ne peut plus être crédité.

### Chiffres
- 225 tests de la base verts (10 fichiers), 28 tests unitaires verts.

## Phase 0 — Socle du projet (2026-11-07) — validée

- Projet Next.js avec contrôles automatiques (lint, types, tests, build), vérification des variables d'environnement, suivi des erreurs Sentry sans données personnelles, CI GitHub.
