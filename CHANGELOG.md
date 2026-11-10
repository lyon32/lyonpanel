# Journal des changements LyonPanel

Écrit pour le propriétaire. Une section par phase. Seul le propriétaire valide une phase.

## Phase 5 — Recharge SasPay en mode test (2026-11-10) — faite, en attente de validation

### Nouveau
- Recharge du solde de 500 à 500 000 XAF. Les frais sont payés en plus par le client : 3 000 XAF rechargés, 90 XAF de frais, 3 090 XAF payés, 3 000 XAF crédités.
- Page de recharge (FR et EN) avec total affiché avant de payer, et page de retour qui se met à jour toute seule (en attente, crédité, échoué, annulé).
- Confirmation de paiement par message signé de SasPay. Le site vérifie la signature, redemande la transaction à SasPay, puis crédite. Un message renvoyé 3 fois ne crédite qu'une fois.
- Rattrapage automatique des paiements dont le message n'est jamais arrivé. Une recharge non payée expire après 30 minutes.
- Faux SasPay pour tester sans argent réel. Aucun vrai appel SasPay, aucun vrai paiement.

### Sécurité
- Contrôle sécurité accepté au 2e passage. Corrigés : limite de 5 recharges par minute, vérification auprès de SasPay avant tout crédit, faux SasPay refusé en production.

### Chiffres
- 1 124 tests unitaires, 373 tests de base et 10 tests de navigateur verts. Lint sans erreur (8 avertissements de taille), types et build OK. Couverture non mesurée.

### À surveiller
- Non testé : vrai SasPay, vrais paiements, forme réelle du champ `metadata`, réglage `ADD_ON` du compte SasPay (actions du propriétaire avant la phase 15).
- Cinq points à confirmer par le propriétaire : voir `docs/reports/phase-5/bilan.md`.

## Phase 4 — Prix et catalogue (2026-11-10) — faite, en attente de validation

### Nouveau
- Catalogue de 2 188 services rangés par réseau (Instagram, TikTok, YouTube, Facebook, Telegram, X, etc.) et par type (abonnés, likes, vues, commentaires, partages, autres). Données issues d'un faux fournisseur : le vrai n'est pas encore branché.
- Prix calculés côté serveur : coût du fournisseur converti en XAF (1 USD = 600 XAF, réglable) × multiplicateur (×3 au départ, réglable par catégorie et par service), arrondi aux 5 XAF supérieurs, minimum 5 XAF.
- Pages publiques FR et EN : réseaux, types, liste paginée avec recherche (sans accents ni majuscules), fiche de service. Prix en XAF, XOF ou USD.
- Fichier de travail `data/catalogue-services.csv` et règles chiffrées dans `docs/01-catalogue-et-prix.md`.
- Tous les services sont actifs, sauf ceux que le fournisseur retire.

### Sécurité
- Aucun nom de fournisseur, coût ni multiplicateur côté client. Contrôle sécurité accepté ; 2 remarques corrigées (cache de 300 s, plafond de 100 000 USD sur le prix fournisseur).

### Chiffres
- 1 048 tests unitaires verts, 13 tests de navigateur verts sur le catalogue, 273 tests de base sur 278 (5 échecs de stockage de fichiers, conteneur local arrêté). Types sans erreur, build OK, lint sans erreur (8 avertissements de taille).

### À surveiller
- Services à prix extrêmes (le plus cher : 8 709 120 XAF les 1 000), à traiter en phase 12.
- Fiches de service en `noindex` pour l'instant. Mesure des boutons de 44 px non refaite dans un navigateur.

## Phase 3 — Comptes (2026-11-08) — faite, en attente de validation

### Nouveau
- Inscription (email, téléphone, pays d'Afrique, devise, langue) avec vérification anti-robot Turnstile, connexion par email ou par téléphone, déconnexion, mot de passe oublié avec email en français et en anglais.
- Zone privée (tableau de bord) fermée aux visiteurs non connectés.
- Mots de passe : 8 à 72 caractères, refus des mots de passe trop courants. Un nouveau mot de passe coupe les autres sessions.
- Écrans FR et EN sur téléphone et ordinateur.

### Sécurité
- Blocage progressif : 3 essais ratés, puis pause de 15 min, 30 min, 1 h… jusqu'à 24 h. Le seuil par adresse IP est de 30 essais, pour ne pas bloquer des clients qui partagent un réseau mobile.
- Inscription : message « déjà utilisé » conservé, avec 10 inscriptions par heure et par adresse IP au maximum.
- Pas de confirmation d'email ni de code SMS pour l'instant (décision du propriétaire).
- Trois contrôles sécurité : les deux premiers demandaient des corrections, le troisième accepte avec des réserves notées (à traiter en phase 15).
- Documents modifiés avec accord : `SECURITY_NOTES.md §2` (blocage progressif) et `API_SPEC.md §3` (code `FORBIDDEN`).

### Chiffres
- 439 tests unitaires verts (54 fichiers), 18 tests de navigateur verts sur les comptes. Types sans erreur, build OK, lint sans erreur (6 avertissements de taille de fichier, hors phase 3).
- Tests de la base de données : pas relancés dans le dernier état.

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
- Un client ne voit que ses propres données. Il ne voit jamais le coût fournisseur, la marge ni les notes privées.
- L'audit sécurité a trouvé 2 failles moyennes (quantités sans bornes, compte supprimé encore connecté). Elles sont corrigées et ré-attaquées sans succès.
- Un paiement échoué ne peut plus être crédité.

### Chiffres
- 225 tests de la base verts (10 fichiers), 28 tests unitaires verts.

## Phase 0 — Socle du projet (2026-11-07) — validée

- Projet Next.js avec contrôles automatiques (lint, types, tests, build), vérification des variables d'environnement, suivi des erreurs Sentry sans données personnelles, CI GitHub.
