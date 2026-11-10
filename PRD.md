# LyonPanel — PRD (Product Requirements)

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Voir aussi : `PROJECT_BRIEF.md`, `docs/00` à `docs/05`.

## 1. Fonctions, par priorité

### MVP — obligatoire au lancement (« tout doit marcher »)
**Priorité absolue (décidé)**
1. **Création de compte** : email + mot de passe + téléphone, anti-bot Cloudflare Turnstile, sans confirmation d'email. Connexion, mot de passe oublié.
2. **Dépôt** : recharge du solde par SasPay (Mobile Money + carte), frais payés par le client, minimum ≈ 5 $ (3 000 XAF), crédit automatique après webhook signé.
3. **Paiement des services** : commande débitée du solde, prix recalculé côté serveur, envoi à fournisseur.

**Aussi au lancement (décidé : « tout doit marcher »)**
4. Catalogue rangé : plateforme → type → qualité, noms simples en français, TikTok / Instagram / Facebook en avant.
5. Choix de la devise d'affichage (XAF, XOF, USD).
6. Suivi des commandes (statuts, reste à livrer) et historique des transactions.
7. Statut des paiements (en attente, réussi, échoué).
8. Tickets de support + lien Telegram.
9. Remise 10 % automatique dès 50 000 XAF rechargés.
10. Admin : ventes, bénéfice, solde fournisseur, commandes « à examiner », remboursements manuels, tickets, réglages (taux, marges, services).
11. Alertes Telegram au propriétaire (commande en échec, solde fournisseur bas, gros écart de prix).
12. Synchronisation automatique avec fournisseur (services, prix, statuts).
13. Pages publiques SEO : accueil, pages par plateforme, FAQ, confidentialité, conditions, 404.

### Bien à avoir (après le lancement, mon choix)
- Pages par pays (« panel SMM Cameroun », « Sénégal »…) et blog.
- Commandes en lot (plusieurs liens d'un coup).
- Commandes « drip-feed » et abonnements automatiques.
- Notifications au client (email/WhatsApp) quand une commande est terminée.
- Demande de recharge « refill » en un clic pour les services garantis.

### Futur (décidé hors périmètre v1)
- Paiement pour pays anglophones, crypto, API revendeurs, mise à jour automatique du taux, application mobile. Autres idées : « on verra » (décidé).

### Espace client : bonjour et suggestion de commande (ajout du 2026-11-09)
- Bonjour selon l'heure du navigateur (Bonjour / Bon après-midi / Bonsoir) sur le tableau de bord (phase 3).
- Suggestion de commande (phase 8) : une carte discrète calculée par le serveur depuis les commandes du client, avec bouton « Commander » (formulaire pré-rempli) et croix pour fermer ; désactivable ; jamais du fournisseur ni de marge.

## 2. User stories

**Créateur TikTok (Persona 1)**
- En tant que créateur, je veux créer un compte en moins d'une minute avec mon numéro, pour commander vite.
- Je veux recharger 3 000 XAF avec Mobile Money, pour ne pas avoir besoin de carte bancaire.
- Je veux voir le prix exact avant de commander, dans ma monnaie.
- Je veux suivre ma commande de vues et savoir quand elle est terminée.
- Si je ne reçois rien, je veux ouvrir un ticket et être remboursé sur mon solde.

**Commerçant Instagram (Persona 2)**
- Je veux choisir des abonnés « garantis » pour que mon compte ne perde pas d'abonnés.
- Je veux une remise quand je recharge beaucoup.
- Je veux voir toutes mes recharges et dépenses pour suivre mon budget.

**Propriétaire**
- Je veux voir chaque jour mes ventes, mon bénéfice et mon solde fournisseur.
- Je veux être alerté sur Telegram quand une commande échoue ou que le solde fournisseur est bas.
- Je veux changer le taux de change, les marges et masquer un service sans toucher au code.
- Je veux examiner une commande en échec et rembourser à la main.

## 3. Parcours clés

### A. Inscription
Chemin normal : Accueil → « Créer un compte » → email, mot de passe, téléphone, pays, devise → Turnstile → tableau de bord.
Cas limites :
- Email ou téléphone déjà utilisé → message clair, lien « se connecter ».
- Turnstile échoue → réessayer, aucun compte créé.
- Trop d'essais depuis la même adresse → blocage temporaire.

### B. Dépôt
Chemin normal : « Recharger » → montant → affichage montant + frais = total → paiement SasPay → webhook vérifié → solde crédité → écran « Paiement réussi ».
Cas limites :
- Montant sous le minimum → refusé avant paiement.
- Client paie mais webhook en retard → statut « en attente », tâche de rattrapage interroge SasPay ; jamais de double crédit (ID SasPay unique).
- Paiement échoué ou annulé → statut « échoué », solde inchangé.
- Double clic sur « Payer » → un seul paiement créé.
- Montant reçu différent du montant demandé → pas de crédit, alerte propriétaire.

### C. Commande (paiement d'un service)
Chemin normal : plateforme → service → lien → quantité → total en direct → « Commander » → débit atomique → envoi fournisseur → statut « en cours » → « terminé ».
Cas limites :
- Solde insuffisant → bouton « Recharger » avec le montant manquant.
- Quantité hors min/max → refusée (navigateur + serveur).
- Lien invalide ou compte privé → avertissement avant commande.
- Solde fournisseur insuffisant → commande refusée, message « service momentanément indisponible », alerte propriétaire.
- fournisseur renvoie une erreur ou ne répond pas → commande « à examiner », alerte Telegram, pas de remboursement automatique.
- Commande partielle ou annulée par fournisseur → « à examiner », remboursement après examen.
- Service retiré ou prix changé par fournisseur pendant la commande → prix recalculé, client prévenu avant débit.
- Double clic → une seule commande (clé d'idempotence).

### D. Support
Client ouvre un ticket (lié à une commande) → propriétaire répond depuis l'admin → remboursement sur le solde si justifié → ticket fermé.

## 4. Contraintes

| Sujet | Contrainte |
|---|---|
| Pile technique | Next.js, Tailwind, GSAP, Lenis, Supabase, Vercel, Cloudflare (décidé) |
| Paiement | SasPay uniquement au lancement (décidé) |
| Fournisseur | API fournisseur v2 ; clé fournisseur à régénérer, jamais dans le navigateur |
| Budget | Offres gratuites Vercel / Supabase / Cloudflare ; 20 $ de solde fournisseur au départ (décidé) |
| Délai | Pas de date : on lance quand tout fonctionne (décidé) |
| Langue | Français et anglais (adresses traduites `/fr/…`, `/en/…`) |
| Design | Blanc + bleu, jaune en accent, Public Sans, aucun look IA (`docs/05-design-system.md`) |
| Mobile | Doit marcher sur téléphones Android d'entrée de gamme et connexions lentes (mon choix) |
| Sécurité | Prix et marges calculés côté serveur, RLS Supabase, aucun double paiement |
