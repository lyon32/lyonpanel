# LyonPanel — Document de conception

Statut : **brouillon à valider** (rien n'est construit tant que ce document n'est pas approuvé).
Mention « ton choix » = décision prise par Claude, à vérifier. Mention « décidé » = dit par le propriétaire.

## 1. Intention

LyonPanel est un panel SMM (vente de followers, likes, vues, etc.) pensé pour l'Afrique, avec un positionnement de référencement « 1er panel SMM d'Afrique ». Il revend les services du fournisseur un fournisseur (API v2) via son API, avec une marge, des prix affichés dans la monnaie locale du client et des paiements locaux (Mobile Money). Le but : un panel autonome, plus simple et plus fiable que les panels existants, que les Africains francophones puis anglophones utilisent sans passer par des paiements en dollars.

## 2. Objectifs

- Reprendre les ~5 740 services fournisseur, mieux classés (par plateforme puis par type) et mieux nommés (noms simples, en français).
- Afficher un seul prix final par service, en XAF, XOF ou USD au choix du client. Jamais le prix fournisseur ni la marge.
- Recharge du solde par SasPay, commandes payées par débit du solde interne.
- Suivi clair des commandes et des paiements, « comme fournisseur mais en mieux ».
- Admin pour le propriétaire (ventes, marge, solde fournisseur, clients, tickets).
- Référencement fort (pages publiques par plateforme, FAQ, blog) pour viser « SMM panel Afrique ».
- Design propre, sans aspect « généré par IA » (voir `03-seo-et-design.md`).

## 3. Hors périmètre (pour l'instant)

- Pays anglophones : pas du fournisseur de paiement trouvé, à chercher plus tard (décidé).
- Crypto : pas au lancement (ton choix, options évoquées : NOWPayments / Cryptomus).
- API pour revendeurs : marquée « indisponible pour le moment » (décidé).
- Confirmation d'email : non (décidé).

## 4. Anti-objectifs (ce qui serait un échec même si ça marche)

- Un client qui voit le prix fournisseur ou sa propre marge.
- Un client qui obtient un service sans avoir payé, ou un paiement compté deux fois.
- Une commande acceptée alors que le solde fournisseur est vide.
- Un site qui ressemble à un modèle IA (dégradés violets, faux avis, icônes génériques).

## 5. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Paiement | SasPay (docs.saspay.me) : Mobile Money + carte, Afrique de l'Ouest et du Centre |
| Modèle | Le client **recharge** son solde, chaque commande est débitée du solde. Pas de commande sans solde suffisant |
| Recharge minimale | « Plus de 5 $ » pour toutes les monnaies africaines (montant exact dans sa monnaie : ton choix, voir §8) |
| Prix | Table USD → XAF d'abord, marge ensuite. Marge visible par le propriétaire seulement |
| Affichage prix | Choix de la devise par le client |
| Pays | « Tous » ; dans les faits, ceux que SasPay couvre au lancement, les autres dès qu'un fournisseur de paiement est trouvé |
| Langue | Français et anglais |
| Services | On garde tout, on réorganise ; noms réécrits plus simplement |
| Synchronisation | Automatique avec fournisseur |
| Inscription | Email + mot de passe + numéro de téléphone, sans vérification email, anti-bot |
| Échec de commande | On enquête avant tout remboursement ; système de tickets |
| Support | Tickets + Telegram |
| Alertes | Le propriétaire seulement, par Telegram |
| Remises | 10 % pour gros clients (seuil : voir §8 quater) |
| Plateformes en avant | Facebook, TikTok, Instagram |
| Comptes existants | Supabase, Vercel, Cloudflare |
| Nom | LyonPanel |
| Budget de départ | 20 $ de solde fournisseur |
| Pile technique | Next.js, Tailwind, GSAP, Lenis, Supabase, Vercel, Cloudflare |

## 6. Pile technique et hébergement (décidé, avec précisions de mon côté)

- **Next.js** (App Router) sur Vercel, pour le référencement et les pages rapides.
- **Tailwind** pour le style, **GSAP** et **Lenis** pour animations et défilement (ton choix : animations discrètes, pas de scroll lourd sur mobile bas de gamme).
- **Supabase** : base Postgres, authentification, règles d'accès (RLS).
- **Cloudflare** : DNS, protection, **Turnstile** comme anti-bot (ton choix à la place de reCAPTCHA, car déjà sur Cloudflare).
- La clé fournisseur et la clé SasPay restent **uniquement côté serveur**, jamais dans le navigateur.

## 7. Règles métier clés

1. **Le prix client** = prix fournisseur converti × (1 + marge). La marge est stockée côté serveur, jamais envoyée au navigateur.
2. **Cohérence des prix** : la marge est réglée par paliers pour que les prix restent plausibles face à la concurrence. Détail dans `01-catalogue-et-prix.md`.
3. **Commande** : (a) le client choisit service, lien, quantité ; (b) le serveur recalcule le prix, vérifie le solde ; (c) débit atomique du solde ; (d) envoi à fournisseur ; (e) enregistrement de l'ID fournisseur ; (f) suivi du statut par synchronisation.
4. **Échec chez le fournisseur** : la commande passe en « à examiner » ; le propriétaire est alerté sur Telegram ; remboursement à la main après examen (décidé). Le client peut ouvrir un ticket.
5. **Paiement** : le solde n'est crédité qu'à la réception d'un webhook SasPay signé et vérifié, une seule fois par paiement (clé unique anti-doublon).
6. **Solde fournisseur bas** : alerte Telegram, et blocage des commandes si le solde fournisseur est insuffisant (ton choix, pour ne jamais encaisser sans pouvoir livrer).

## 8. Points laissés au constructeur ou à ton choix

- Montant minimal de recharge par devise : ton choix, équivalent d'environ 5 USD arrondi (par exemple 3 000 XAF), à ajuster.
- Taux USD→XAF : provisoire 600 dans la table, modifiable à la main par le propriétaire (décidé : « je peux changer »). La mise à jour automatique reste possible plus tard.
- Remises : 10 % décidé, seuil 50 000 XAF = mon choix (§8 quater).
- Fournisseur de paiement pour pays anglophones : à chercher.
- Détails SasPay (frais, opérateurs, signature des webhooks) : à lire dans `docs.saspay.me/api-reference/*` pendant l'implémentation.

## 8 bis. Précisions issues de la relecture (mes choix, à vérifier)

- **Recharge** : modèle confirmé. Un client qui veut une commande plus petite que le minimum recharge quand même le minimum, le reste demeure sur son solde.
- **Solde multi-devises** : le solde est **toujours stocké en XAF (entier)**. USD et autres devises ne servent qu'à l'affichage, convertis au taux du jour. Les commandes et recharges déjà enregistrées gardent le taux utilisé à ce moment, un changement de taux ne modifie pas les soldes existants.
- **Solde fournisseur** : le serveur réserve le coût fournisseur de chaque commande en attente d'envoi ; une commande est refusée si le solde fournisseur moins les réservations est insuffisant. Alerte Telegram quand le solde fournisseur descend sous un seuil (par défaut 5 $, ajustable).
- **Services extrêmes ou mal classés** : l'import les crée **inactifs par défaut** (prix supérieur à un plafond, catégorie « Autres », « Trafic web / SEO ») ; le propriétaire les active après relecture, avant le lancement.
- **Contrôle de cohérence des prix** : il bloque la publication d'un prix inférieur au coût fournisseur plus la marge minimale ; pour le reste, simple alerte.

## 8 ter. Questions encore ouvertes (réservées au propriétaire)

1. Pays : **« tous »** (décidé). Reste à confirmer quels pays et opérateurs SasPay couvre réellement ; les autres attendent un fournisseur de paiement.
2. Commandes partielles ou annulées par fournisseur : **remboursement après examen** (décidé).
3. Marges : **TikTok +120 %, Instagram +75 %, Facebook +75 %** ; autres plateformes **60 % à 70 %** selon le prix fournisseur (décidé). Remise gros clients : **10 %** (décidé) ; seuil d'activation = mon choix, voir §8 quater.
4. Entité : **Lyon**, Makepe (Douala, Cameroun : à confirmer), contact **support@lyonpanel.com**, domaine **lyonpanel.com** (décidé). Reste à décider qui écrit les pages légales et si une immatriculation est nécessaire.

## 8 quater. Remise gros clients (mon choix pour les détails)

- Remise de **10 %** sur le prix des commandes (décidé).
- Elle s'active quand le total rechargé par le client atteint un seuil (par défaut 50 000 XAF cumulés, mon choix, ajustable dans l'admin).
- Elle s'applique sur le prix client avec marge. Avec 60 % de marge minimum, le prix reste toujours au-dessus du coût fournisseur.

## 9. Documents liés

- `01-catalogue-et-prix.md` : classement du catalogue, table de prix, méthode de marge.
- `02-architecture-et-securite.md` : données, flux de paiement et de commande, sécurité, fiabilité.
- `03-seo-et-design.md` : référencement Afrique, pages, design et règles anti-« look IA ».
- `04-roadmap.md` : renvoie vers `../ROADMAP.md`.
- `05-design-system.md` : couleurs, polices, composants.
- `../data/catalogue-services.csv` : les 2 188 services classés, avec prix du fournisseur et prix de vente (généré par `npm run catalogue:build`).
