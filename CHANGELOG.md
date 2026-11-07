# Journal des changements LyonPanel

Écrit pour le propriétaire. Une section par phase. Seul le propriétaire valide une phase.

## Phase 2 — Design system et mise en page (2026-11-07) — faite, en attente de validation

### Nouveau
- Le site s'ouvre en français et en anglais, avec des adresses traduites (`/fr/commander`, `/en/order`). La langue et la devise (XAF, XOF, USD) sont retenues. Le taux de change est fictif jusqu'à la phase 4.
- Couleurs, trois polices lisibles sur téléphone (Public Sans, Atkinson Hyperlegible, IBM Plex Mono), logo et icône d'onglet.
- Six composants de base : bouton, champ, carte, badge, tableau, dialogue.
- Navigation complète : en-tête (compact avec menu sur téléphone), pied de page, barre latérale sur ordinateur, menu du bas sur téléphone.
- Pages « Bientôt disponible » pour ce qui n'est pas encore fait, et une vraie page 404.
- Mouvement : léger sur téléphone, plus riche sur ordinateur, aucun mouvement si le système demande de réduire les animations, jamais sur un prix ou un solde.
- Page de démonstration `/fr/demo` et `/en/demo`, cachée de Google. Elle sera supprimée avant la mise en ligne.

### Vitesse
- Sur la démo, téléphone lent : le plus gros élément s'affiche en 2,37 s au lieu de 5,85 s (médiane).
- Point ouvert : les longues tâches et le temps de blocage ne sont pas améliorés.

### Chiffres
- 247 tests unitaires verts, 23 tests de navigateur verts (build de production). Lint sans erreur, types et build OK.
- Les contrôles ont demandé des corrections deux fois (relecture et test navigateur), faites et revérifiées.

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
