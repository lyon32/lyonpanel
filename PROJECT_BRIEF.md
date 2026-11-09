# LyonPanel — Project Brief
Statut : **validé par le propriétaire** (2026-11-07).

## 1. Problème (quelle douleur, pour qui)

En Afrique, les créateurs et les commerçants veulent faire grandir leurs comptes (abonnés, likes, vues), mais **les panels SMM existants ne leur permettent pas de payer facilement** : carte bancaire internationale, PayPal ou crypto, prix en dollars. La plupart n'ont que le **Mobile Money** (hypothèse à vérifier).
Quand ils arrivent à payer, ils risquent un **service qui ne livre pas**, sans suivi clair ni personne à qui parler.

## 2. Clients cibles

**Persona 1 : le créateur TikTok qui veut percer**
- Jeune, publie régulièrement, veut plus de vues, d'abonnés et de likes pour être repéré par l'algorithme.
- Paie avec Mobile Money, petits montants, achète souvent.
- Plateforme principale : TikTok (puis Instagram, Facebook).

**Persona 2 : le commerçant qui vend sur Instagram**
- Vend des produits (mode, beauté, téléphones…) par Instagram et WhatsApp.
- Veut un compte qui inspire confiance (abonnés, likes) pour vendre plus.
- Paie avec Mobile Money, attend un service sérieux et un support réactif.

Pas la cible au lancement : les revendeurs (API revendeurs « indisponible pour le moment »).

## 3. Critères de réussite (à quoi ressemble « c'est fini »)

**Réussite principale : les clients restent.** Ils reviennent, rechargent et commandent encore.

Concrètement, la première version est « finie » quand :
1. Un client s'inscrit, recharge son solde en **Mobile Money (SasPay)** et voit son solde crédité automatiquement.
2. Il commande un service TikTok, Instagram ou Facebook, avec un prix clair dans sa monnaie (XAF/XOF/USD).
3. La commande part chez le fournisseur, et le client **suit son statut** (en attente, en cours, terminé, partiel, annulé).
4. Si un service ne livre pas, la commande passe « à examiner », le propriétaire est alerté sur Telegram, le client peut ouvrir un ticket et être remboursé après examen.
5. Aucun paiement compté deux fois, aucune commande sans paiement, aucune commande acceptée si le solde fournisseur est vide.
6. Le propriétaire voit dans l'admin : ventes, bénéfice, solde fournisseur, commandes à examiner, tickets.

Mesures à suivre après lancement (mon choix) : part des clients qui rechargent une 2e fois, taux de commandes livrées, nombre de tickets « pas reçu ».

**Le plus grand échec : un client qui paie et ne reçoit rien.**

## 4. Non-objectifs (ce qu'on ne construit PAS en version 1)

- **Aucune référence ou apparence « IA »** : pas de dégradés violets, robots, étincelles, illustrations 3D, faux avis ni faux compteurs (décidé).
- Pas d'API pour revendeurs.
- Pas de paiement crypto.
- Pas de paiement pour les pays anglophones (en attente d'un fournisseur).
- Pas de confirmation d'email.
- Pas d'application mobile : site web uniquement (mon choix).
- Pas de comparaison de prix avec d'autres panels.

Note (2026-11-07) : le site est en **français et en anglais** (décision prise après la validation de ce brief, lors de l'API_SPEC).
- Pas de remboursement automatique : toujours après examen.

## 5. Documents liés

`docs/00-conception-lyonpanel.md` (conception), `docs/01` à `04` (catalogue, architecture, SEO, roadmap), `docs/05-design-system.md` (couleurs, polices).
