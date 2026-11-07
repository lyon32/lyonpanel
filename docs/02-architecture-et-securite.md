# Architecture et sécurité

## 1. Vue d'ensemble

Navigateur (Next.js sur Vercel) → routes serveur Next.js → Supabase (base + auth) ; routes serveur → API JAP ; SasPay → webhook → route serveur. Cloudflare devant le domaine. Les secrets (clé JAP, clé SasPay, clé service Supabase, jeton Telegram) sont des variables d'environnement serveur uniquement.

## 2. Données (Supabase / Postgres) — tables principales

- `profiles` : id, email, téléphone, devise choisie, pays, niveau de remise.
- `wallets` : id utilisateur, solde (en unité minimale, par exemple XAF entier).
- `wallet_transactions` : id, utilisateur, type (recharge, commande, remboursement, ajustement), montant, solde après, référence unique. Le solde est toujours déduit de ce journal.
- `payments` : id, utilisateur, id SasPay, montant, devise, statut (créé, en attente, réussi, échoué), horodatages. **Contrainte d'unicité sur l'id SasPay** (anti-doublon).
- `services` : id JAP, plateforme, type, nom FR, coût USD, prix client, min, max, options, actif, ordre.
- `orders` : id, utilisateur, service, lien, quantité, prix débité, id JAP, statut (en attente, en cours, terminé, partiel, annulé, à examiner), reste, départ.
- `tickets` et `ticket_messages`.
- `settings` : taux de change, paliers de marge, seuils d'alerte (lisibles par l'admin seulement).
- `audit_log` : actions admin et événements sensibles.

Index sur : `orders(user_id, created_at)`, `orders(jap_order_id)`, `payments(provider_id)`, `services(platform, type, active)`, `wallet_transactions(user_id, created_at)`. Pagination partout (commandes, transactions, services).

## 3. Flux de recharge

1. Le client choisit un montant (≥ minimum) → le serveur crée un paiement SasPay et une ligne `payments` « en attente ».
2. Le client paie sur la page hébergée SasPay ou en paiement direct Mobile Money.
3. SasPay appelle le webhook → le serveur **vérifie la signature**, retrouve le paiement, vérifie le montant et la devise, puis crédite le solde **dans une seule transaction SQL** si le statut n'est pas déjà « réussi ».
4. Le client voit l'état du paiement (en attente, réussi, échoué) sur la page « Recharger », avec rafraîchissement automatique.
5. Si le webhook n'arrive pas : tâche de rattrapage qui interroge SasPay pour les paiements en attente de plus de N minutes.

## 4. Flux de commande

1. Le client choisit plateforme → service → lien → quantité.
2. Le serveur **recalcule** le prix (ne fait jamais confiance au prix du navigateur), vérifie min/max, lien, solde client et solde JAP.
3. Transaction : débit du solde + création de la commande « en attente » (clé d'idempotence pour éviter le double envoi).
4. Appel JAP `add`. Succès → enregistre l'id JAP. Échec ou délai dépassé → statut « à examiner », alerte Telegram, **pas de remboursement automatique** (décidé).
5. Tâche de suivi : `multi-status` par lots pour mettre à jour les statuts, le reste à livrer et le départ.
6. Le client suit ses commandes (liste paginée, filtres, statuts clairs).

## 5. Sécurité

- **Anti-contrefaçon** : prix et marges calculés uniquement côté serveur ; règles RLS Supabase : un client ne lit que ses propres lignes ; aucune écriture directe de solde depuis le navigateur.
- **Secrets** : jamais dans le code ni dans le navigateur. La clé JAP actuelle a été montrée en conversation : **à régénérer avant de recharger le compte JAP**.
- **Anti-bot** : Cloudflare Turnstile à l'inscription et à la connexion.
- **Limitation de débit** : sur inscription, connexion, création de commande, recharge, tickets.
- **Doublons** : idempotence sur commandes et paiements, bouton désactivé après clic, contrainte unique en base.
- **Plafonds** : plafond de dépense journalier par client (valeur à définir), plafond d'appels sortants vers JAP.
- **Admin** : accès séparé, authentification renforcée (mot de passe fort + code à 6 chiffres sur 2 appareils, décidé — voir `SECURITY_NOTES.md`), journal d'audit.
- **Données** : politique de confidentialité, minimisation des données personnelles.

## 6. Fiabilité (liste que tu as fournie, rattachée aux composants)

| Exigence | Où |
|---|---|
| Limites et plafonds d'API / de dépense | §5, middleware |
| Gestion des erreurs, états de chargement, états vides | Toutes les pages |
| Échecs de requêtes et délais dépassés (timeouts) | Appels JAP et SasPay : délai court, une reprise limitée |
| Doublons de soumission et de paiement | §5 |
| Requêtes optimisées, index, pagination | §2 |
| Cache des requêtes répétées | Catalogue de services et taux de change |
| Fichiers : compression et taille limitée | Pièces jointes des tickets (par exemple images ≤ 2 Mo) |
| Surveillance de disponibilité et journal d'erreurs | Monitoring externe + journaux Vercel/Supabase + alerte Telegram |
| Test d'utilisateurs simultanés | Avant lancement |
| Test de restauration de sauvegarde | Avant lancement |

## 7. Admin (décidé : oui)

Tableau de bord : ventes du jour, marge, solde JAP, solde SasPay, commandes « à examiner », paiements en attente, tickets ouverts. Gestion : services (masquer, renommer, prix), taux et paliers de marge, remises, clients, remboursements manuels, journal d'audit.

## 8. Support (décidé)

Système de tickets dans le panel (lié à une commande si besoin), plus un lien Telegram. Les alertes internes vont au propriétaire seulement, par Telegram.

## 9. Frais de transaction SasPay (décidé)

Le **client paie les frais** de SasPay. Le propriétaire ne les supporte pas, sa marge reste entière.
- À la recharge, le client voit : montant crédité + frais = total à payer. Exemple : il veut 5 000 XAF sur son solde, les frais sont affichés avant paiement.
- Le solde crédité est le montant **hors frais**. Les frais sont enregistrés à part dans `payments` (colonnes montant crédité, frais, total payé).
- Mode SasPay **`ADD_ON`** : SasPay ajoute ses frais au montant payé ; on crédite `net_amount`. Taux par opérateur via `GET /pricing/my-rates/`. Détails : `docs/06-saspay.md`.
