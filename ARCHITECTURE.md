# LyonPanel — Architecture

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Règle pour tout agent IA : **ne pas changer de framework ni ajouter de service** sans validation du propriétaire (voir §4).

## 1. Vue d'ensemble du système

```mermaid
flowchart LR
  C[Client<br/>navigateur mobile] -->|HTTPS| CF[Cloudflare<br/>DNS + protection + Turnstile]
  A[Propriétaire<br/>admin] -->|HTTPS| CF
  CF --> V[Next.js sur Vercel<br/>pages + routes serveur]
  V -->|SQL + Auth| S[(Supabase<br/>Postgres + Auth)]
  V -->|API v2| J[JustAnotherPanel]
  V -->|créer paiement| P[SasPay]
  P -->|webhook signé| V
  V -->|alertes| T[Bot Telegram]
  S -->|emails auth| H[SMTP Hostinger<br/>support@lyonpanel.com]
  CR[Cloudflare Worker<br/>Cron Triggers] -->|tâches planifiées| V
```

Version texte :
```
Client/Admin --HTTPS--> Cloudflare --> Next.js (Vercel) --> Supabase (DB + Auth) --> SMTP Hostinger
                                          |-- JAP API (commandes, services, statuts)
                                          |-- SasPay (paiements) <-- webhook
                                          |-- Telegram (alertes propriétaire)
                                          +-- Cloudflare Worker cron (sync, rattrapage)
```

## 2. Diagramme des utilisateurs (cas d'utilisation)

Deux acteurs humains : le **client** et le **propriétaire** (seul admin, décidé).

```mermaid
flowchart LR
  Client((Client))
  Owner((Propriétaire))
  subgraph LyonPanel
    U1[Créer un compte / se connecter]
    U2[Recharger le solde]
    U3[Parcourir le catalogue]
    U4[Commander un service]
    U5[Suivre commandes et paiements]
    U6[Ouvrir un ticket]
    U7[Choisir sa devise]
    A1[Voir ventes, bénéfice, solde JAP]
    A2[Examiner commandes en échec]
    A3[Rembourser manuellement]
    A4[Répondre aux tickets]
    A5[Régler taux, marges, services]
    A6[Recevoir alertes Telegram]
  end
  Client --> U1 & U2 & U3 & U4 & U5 & U6 & U7
  Owner --> A1 & A2 & A3 & A4 & A5 & A6
```

Acteurs systèmes : SasPay (confirme les paiements), JAP (exécute les commandes), Cloudflare Worker cron (déclenche les tâches).

## 3. Composants et communication

| Composant | Rôle | Parle à |
|---|---|---|
| **Pages publiques** (Next.js, rendu serveur) | Accueil, plateformes, FAQ, légal (SEO) | Supabase (catalogue en lecture, cache) |
| **Espace client** | Tableau de bord, commander, recharger, historique, tickets | Routes serveur |
| **Admin** `/admin` | Tableau de bord du propriétaire | Routes serveur (rôle admin) |
| **Routes serveur** (Route Handlers / Server Actions) | Toute la logique : prix, débit, appels JAP/SasPay | Supabase, JAP, SasPay, Telegram |
| **Webhook SasPay** `/api/webhooks/saspay` | Reçoit les confirmations de paiement | Supabase |
| **Tâches planifiées** `/api/cron/*` | Sync services, statuts, rattrapage paiements, solde JAP | JAP, SasPay, Supabase, Telegram |
| **Supabase Postgres** | Données + fonctions SQL atomiques (débit, crédit) + RLS | — |
| **Supabase Auth** | Comptes, sessions, mot de passe oublié | SMTP Hostinger |

**Pas de file d'attente séparée** (mon choix) : un petit **Cloudflare Worker** (Cron Triggers, gratuit) appelle `/api/cron/*` avec `CRON_SECRET` ; les tables d'état dans Postgres suffisent au départ.

**Pourquoi pas Vercel Cron** : l'offre gratuite de Vercel ne lance les crons qu'une fois par jour, alors qu'il en faut toutes les 5 à 10 min.

```mermaid
flowchart TB
  subgraph Navigateur
    PUB[Pages publiques]
    CLI[Espace client]
    ADM[Admin]
  end
  subgraph Serveur Next.js
    RS[Routes serveur]
    WH[Webhook SasPay]
    CRON[Tâches cron]
    LIB[lib : prix, jap, saspay, telegram]
  end
  subgraph Supabase
    AUTH[Auth]
    DB[(Postgres + RLS + fonctions SQL)]
  end
  PUB --> RS
  CLI --> RS
  ADM --> RS
  RS --> LIB
  WH --> LIB
  CRON --> LIB
  LIB --> DB
  CLI --> AUTH
  LIB --> JAP[JAP API]
  LIB --> SAS[SasPay API]
  LIB --> TG[Telegram]
```

## 4. Choix techniques et pourquoi

| Choix | Pourquoi | Ne pas remplacer par |
|---|---|---|
| **Next.js (App Router) + TypeScript** | SEO (rendu serveur), front + back dans un projet, natif Vercel | Remix, SPA Vite, Express séparé |
| **Tailwind CSS** | Rapide, suit `docs/05-design-system.md` | CSS-in-JS, Bootstrap, kit UI lourd |
| **GSAP + Lenis** | Animations légères demandées | Framer Motion en plus |
| **Supabase** (Postgres, Auth, RLS) | Base + comptes gratuits, sécurité par ligne, fonctions SQL atomiques | Firebase, autre base, NextAuth |
| **Vercel** | Hébergement gratuit, Cron intégré | VPS, Docker |
| **Cloudflare** | DNS, protection, Turnstile gratuit | reCAPTCHA |
| **SasPay** | Mobile Money Afrique de l'Ouest et du Centre | Stripe, PayPal (v1) |
| **JAP API v2** | Fournisseur unique des services | — |
| **Telegram Bot API** | Alertes propriétaire, gratuit | Email, Slack |
| **SMTP Hostinger** | Emails depuis support@lyonpanel.com (décidé) | Resend, SendGrid (v1) |
| **Zod** (mon choix) | Validation des entrées côté serveur | — |
| **Lucide** | Icônes simples | — |

npm, GitHub privé (mon choix, nécessaire au déploiement Vercel).

## 5. Diagrammes de séquence

### 5.1 Inscription
```mermaid
sequenceDiagram
  actor C as Client
  participant N as Next.js
  participant CF as Turnstile
  participant SA as Supabase Auth
  participant DB as Postgres
  C->>N: Formulaire (email, mdp, téléphone, pays, devise)
  N->>CF: Vérifier jeton Turnstile
  CF-->>N: OK
  N->>SA: signUp(email, mdp)
  SA-->>N: utilisateur créé
  N->>DB: créer profil + portefeuille (solde 0)
  N-->>C: Tableau de bord
```

### 5.2 Dépôt (recharge)
```mermaid
sequenceDiagram
  actor C as Client
  participant N as Next.js
  participant DB as Postgres
  participant SP as SasPay
  participant T as Telegram
  C->>N: Recharger 5 000 XAF
  N->>N: Vérifier minimum, calculer frais
  N->>DB: payments (en attente, montant, frais, clé unique)
  N->>SP: Créer paiement
  SP-->>N: lien / référence
  N-->>C: Page de paiement SasPay
  C->>SP: Paie en Mobile Money
  SP->>N: Webhook signé (référence, statut, montant)
  N->>N: Vérifier signature + montant + devise
  N->>DB: credit_wallet() en 1 transaction (si pas déjà réussi)
  N-->>SP: 200 OK
  C->>N: Rafraîchit la page
  N-->>C: Paiement réussi, nouveau solde
  Note over N,T: Montant différent ou signature fausse : aucun crédit + alerte Telegram
```

### 5.3 Rattrapage d'un webhook manqué
```mermaid
sequenceDiagram
  participant CR as Cloudflare Worker cron
  participant N as Next.js
  participant DB as Postgres
  participant SP as SasPay
  CR->>N: /api/cron/payments
  N->>DB: paiements en attente depuis plus de 10 min
  loop chaque paiement
    N->>SP: Statut du paiement ?
    SP-->>N: réussi / échoué
    N->>DB: credit_wallet() ou marquer échoué (idempotent)
  end
```

### 5.4 Commande d'un service
```mermaid
sequenceDiagram
  actor C as Client
  participant N as Next.js
  participant DB as Postgres
  participant J as JAP
  participant T as Telegram
  C->>N: Service, lien, quantité (+ clé d'idempotence)
  N->>DB: Lire service (prix, min, max, actif)
  N->>N: Recalculer total, vérifier min/max et lien
  N->>DB: Vérifier solde JAP disponible (moins réservations)
  N->>DB: place_order() : débit + commande en attente (1 transaction)
  alt solde insuffisant
    DB-->>N: refus
    N-->>C: Solde insuffisant, rechargez X
  end
  N->>J: action=add (service, link, quantity)
  alt succès
    J-->>N: order id
    N->>DB: commande en cours, id JAP
    N-->>C: Commande envoyée
  else erreur ou délai dépassé
    N->>DB: commande à examiner
    N->>T: Alerte commande en échec
    N-->>C: Commande en vérification
  end
```

### 5.5 Suivi des statuts
```mermaid
sequenceDiagram
  participant CR as Cloudflare Worker cron
  participant N as Next.js
  participant DB as Postgres
  participant J as JAP
  participant T as Telegram
  CR->>N: /api/cron/orders
  N->>DB: commandes en cours (lot de 100)
  N->>J: action=status (orders=id1,id2,...)
  J-->>N: statuts, reste, départ
  N->>DB: mettre à jour
  alt partiel ou annulé
    N->>DB: à examiner
    N->>T: Alerte
  end
```

### 5.6 Ticket et remboursement
```mermaid
sequenceDiagram
  actor C as Client
  participant N as Next.js
  participant DB as Postgres
  actor A as Propriétaire
  participant T as Telegram
  C->>N: Ouvre un ticket (commande 123)
  N->>DB: ticket créé
  N->>T: Nouveau ticket
  A->>N: Examine la commande (admin)
  A->>N: Rembourser 1 200 XAF
  N->>DB: refund_order() : crédit + journal + audit (1 transaction)
  N-->>C: Ticket répondu, solde remboursé
```

### 5.7 Synchronisation du catalogue et solde JAP
```mermaid
sequenceDiagram
  participant CR as Cloudflare Worker cron
  participant N as Next.js
  participant J as JAP
  participant DB as Postgres
  participant T as Telegram
  CR->>N: /api/cron/services
  N->>J: action=services
  J-->>N: environ 5 740 services
  N->>DB: nouveaux = inactifs, retirés = indisponibles, recalcul prix
  alt coût changé de plus de X %
    N->>T: Alerte écart de prix
  end
  N->>J: action=balance
  alt solde JAP sous le seuil
    N->>T: Alerte solde bas
  end
```

Fréquences (mon choix) : paiements 5 min, statuts 10 min, services 1 h.

## 6. Cycle de vie d'une commande

```mermaid
stateDiagram-v2
  [*] --> EnAttente: débit du solde
  EnAttente --> EnCours: JAP accepte
  EnAttente --> AExaminer: erreur JAP
  EnCours --> Terminee: JAP Completed
  EnCours --> AExaminer: Partial ou Canceled
  AExaminer --> Remboursee: propriétaire rembourse
  AExaminer --> EnCours: renvoyée
  AExaminer --> Terminee: rien à rembourser
  Terminee --> [*]
  Remboursee --> [*]
```

Paiement : `créé → en attente → réussi | échoué` (jamais de retour en arrière).

## 7. Modèle de données

```mermaid
erDiagram
  PROFILES ||--|| WALLETS : possede
  PROFILES ||--o{ WALLET_TRANSACTIONS : a
  PROFILES ||--o{ PAYMENTS : fait
  PROFILES ||--o{ ORDERS : passe
  PROFILES ||--o{ TICKETS : ouvre
  SERVICES ||--o{ ORDERS : concerne
  ORDERS ||--o{ TICKETS : liee
  TICKETS ||--o{ TICKET_MESSAGES : contient
  PROFILES {
    uuid id
    text email
    text phone
    text country
    text currency
    bool is_admin
  }
  WALLETS {
    uuid user_id
    int balance_xaf
    int total_recharged_xaf
  }
  WALLET_TRANSACTIONS {
    uuid id
    text type
    int amount_xaf
    int balance_after
    text ref_unique
  }
  PAYMENTS {
    uuid id
    text saspay_session_id_unique
    text saspay_transaction_id_unique
    int credited_xaf
    int fee_xaf
    text status
  }
  SERVICES {
    int jap_id
    text platform
    text type
    text name_fr
    numeric cost_usd
    int price_xaf_1000
    int min_qty
    int max_qty
    bool active
  }
  ORDERS {
    uuid id
    int service_id
    text link
    int quantity
    int charged_xaf
    text jap_order_id
    text status
    text idem_key_unique
  }
  TICKETS {
    uuid id
    uuid order_id
    text status
  }
  TICKET_MESSAGES {
    uuid id
    text body
    bool from_admin
  }
```

Plus : `settings` (taux, marges, seuils) et `audit_log`. Détails : `docs/02-architecture-et-securite.md`.

## 8. Déploiement

**Cible : serverless sur Vercel (offre gratuite). Pas de VPS ni Docker** (décidé : offres gratuites).

```mermaid
flowchart LR
  DEV[PC du propriétaire] -->|git push| GH[GitHub privé]
  GH -->|auto| VP[Vercel Preview<br/>chaque branche]
  GH -->|branche main| VPROD[Vercel Production<br/>lyonpanel.com]
  VPROD --> SB[(Supabase prod)]
  VP --> SBT[(Supabase test)]
  CFD[Cloudflare DNS] --> VPROD
```

- Deux projets Supabase : **test** et **production** (mon choix ; l'offre gratuite en permet 2).
- Secrets uniquement dans les variables Vercel : `JAP_API_KEY`, `SASPAY_*`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TURNSTILE_SECRET`, `CRON_SECRET`.
- Migrations SQL versionnées dans `supabase/migrations`.
- **Vercel gratuit (Hobby) pour le moment** (décidé). Conséquences :
  - crons faits par un **Cloudflare Worker** gratuit (`workers/cron/`), pas par Vercel ;
  - fonctions limitées en durée : chaque appel JAP/SasPay a un délai de 10 s, la sync du catalogue se fait par lots ;
  - l'offre Hobby est prévue pour un usage **non commercial** : passer à **Vercel Pro** (≈ 20 $/mois) dès que le site gagne de l'argent régulièrement ou si Vercel le demande. À revoir après le lancement limité.

## 9. Intégrations tierces

| Service | Usage | État |
|---|---|---|
| **SasPay** | Recharges Mobile Money + carte, webhooks | Compte marchand + mode test à obtenir |
| **JAP API v2** | Services, commandes, statuts, solde | Compte existant ; **clé à régénérer** |
| **Supabase Auth** | Comptes email + mot de passe, sessions | Compte existant |
| **SMTP Hostinger** | Emails (mot de passe oublié) depuis support@lyonpanel.com | Boîte à créer après achat du domaine |
| **Cloudflare** | Domaine, DNS, Turnstile | Domaine **à acheter** (conseil : Cloudflare Registrar) |
| **Telegram Bot** | Alertes au propriétaire (seul destinataire) | **À créer** avec @BotFather |
| **Google Analytics** | Statistiques de visite | À créer |
| **GitHub** | Code source, déploiement | À créer si absent |

## 10. Sécurité (résumé)

- Un seul admin : le propriétaire (`is_admin = true`, décidé). `/admin` contrôlé côté serveur + 2e facteur (mon choix).
- Prix, marges, débits, crédits : uniquement côté serveur, par fonctions SQL atomiques.
- RLS : chaque client ne lit que ses lignes ; aucune écriture de solde depuis le navigateur.
- Webhook SasPay : signature vérifiée, référence unique, montant contrôlé.
- Routes cron protégées par `CRON_SECRET`.
- Limitation de débit sur inscription, connexion, commandes, recharges.
