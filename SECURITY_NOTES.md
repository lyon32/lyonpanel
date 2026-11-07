# LyonPanel — Sécurité et cas limites

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Liés : `API_SPEC.md` (auth, erreurs), `DATA_MODEL.md` (RLS, fonctions SQL), `docs/02-architecture-et-securite.md`, `TESTING.md`, `CI_CD.md`.

## 0. Décisions du propriétaire

| # | Décision |
|---|---|
| 1 | Mot de passe ≥ 8 caractères, mots de passe trop connus refusés ; **haché** en base (bcrypt, géré par Supabase Auth) |
| 2 | Email « nouvelle connexion » : **plus tard** |
| 3 | Plafond de dépense : **500 000 XAF par jour et par client**, modifiable par client dans l'admin |
| 4 | Lien refusé s'il n'est pas de la bonne plateforme |
| 5 | **Aucun pays bloqué** ; Cloudflare bloque les robots |

## 1. Qui peut faire quoi

| Action | Visiteur | Client | Client bloqué | Propriétaire (admin + code 6 chiffres) | Système (cron, webhook) |
|---|---|---|---|---|---|
| Voir accueil, catalogue, FAQ | ✅ | ✅ | ✅ | ✅ | — |
| S'inscrire / se connecter | ✅ | — | ✅ (connexion) | ✅ | — |
| Voir son solde, ses commandes, paiements, tickets | — | ✅ (les siens) | ✅ (les siens) | ✅ (tous) | — |
| Recharger | — | ✅ | ❌ | — | — |
| Commander | — | ✅ | ❌ | — | — |
| Ouvrir un ticket | — | ✅ | ✅ (pour contester) | — | — |
| Supprimer son compte | — | ✅ | ✅ | — | — |
| Voir coût JAP, marge, nom JAP | ❌ | ❌ | ❌ | ✅ | ✅ |
| Rembourser, ajuster un solde, bloquer, remise perso, notes | ❌ | ❌ | ❌ | ✅ | ❌ |
| Modifier taux, marges, services | ❌ | ❌ | ❌ | ✅ | sync catalogue |
| Créditer un solde | ❌ | ❌ | ❌ | via `admin_adjust` | webhook vérifié / rattrapage |

Règles d'application :
- **Toujours côté serveur.** Le navigateur ne décide jamais d'un droit.
- Trois barrières : `requireUser` / `requireAdmin` dans la route → règles **RLS** dans Postgres → fonctions SQL qui revérifient le statut du client.
- Un non-admin qui appelle une route admin reçoit **404** (pas 403).
- Un seul admin : `is_admin = true` ne peut être posé que par migration ou script local, jamais par l'API.
- Admin : mot de passe + **code à 6 chiffres obligatoire** (`aal2`) ; session admin expirée après 12 h (mon choix).
- Toute action admin écrit dans `audit_log`.

## 2. Authentification

| Règle | Détail |
|---|---|
| Mot de passe | 8 à 72 caractères ; refus des 10 000 mots de passe les plus courants (liste dans le dépôt, mon choix) et d'un mot de passe égal à l'email ou au téléphone |
| Stockage | Haché **bcrypt** par Supabase Auth ; jamais lu, jamais journalisé, jamais envoyé par email |
| Session client | Cookies `httpOnly`, `Secure`, `SameSite=Lax` ; 7 jours d'inactivité |
| Échecs de connexion | 5 échecs → blocage 15 min (par identifiant **et** par IP) |
| Anti-bot | Turnstile à l'inscription, à la connexion et au mot de passe oublié |
| Mot de passe oublié | Réponse identique que l'email existe ou non ; lien valable 1 h, usage unique |
| Changement de mot de passe | Déconnecte les autres sessions (mon choix) |
| Connexion par téléphone | Même message d'erreur que le compte existe ou non |

## 3. Validation des entrées

**Principe : tout ce qui entre est vérifié par un schéma Zod côté serveur**, même si le formulaire l'a déjà vérifié.

| Champ | Règle |
|---|---|
| Email | format email, ≤ 254, mis en minuscules, espaces retirés |
| Téléphone | E.164 (`+` puis 8 à 15 chiffres), normalisé avant enregistrement |
| Pays | code ISO à 2 lettres, dans la liste autorisée |
| Montant de recharge | entier XAF, ≥ minimum (`settings`), ≤ 1 000 000 XAF par paiement (mon choix) |
| `service_id` | entier, service actif et disponible |
| Quantité | entier, `min_qty ≤ q ≤ max_qty` du service |
| Lien | ≤ 500 caractères ; `https://` uniquement ; domaine de la plateforme du service (§4) ; pas d'espace ni de caractère de contrôle |
| Commentaires perso | 1 ligne par commentaire, ≤ 300 caractères chacun, nombre = quantité, texte brut |
| `expected_total_xaf` | entier ; comparé au total recalculé |
| Clé d'idempotence | UUID v4 |
| Ticket | sujet ≤ 120, message ≤ 4 000, texte brut |
| Pièce jointe | jpeg/png/webp, ≤ 2 Mo, vérifiée par le **contenu** du fichier (pas seulement l'extension), 3 max par message, renommée avec un UUID |
| Paramètres de liste | `limit` 1–100 ; curseur validé |
| Réglages admin | schéma Zod par clé ; marges 0–500 %, taux > 0 |
| Webhook SasPay | corps brut lu une fois ; `X-Webhook-Timestamp` à ± 300 s ; HMAC-SHA256 de `timestamp.corps` comparé en temps constant **avant** de lire le contenu ; puis Zod ; puis `verifyPayment` auprès de SasPay avant tout crédit |
| Réponses JAP | validées par Zod ; réponse inattendue = `to_review` |

**Affichage** : React échappe le texte ; `dangerouslySetInnerHTML` interdit. Messages de tickets affichés en texte brut.
**SQL** : requêtes paramétrées uniquement (client Supabase, fonctions SQL), jamais de SQL construit à la main.

## 4. Liens autorisés par plateforme

| Plateforme | Domaines acceptés |
|---|---|
| TikTok | `tiktok.com`, `www.tiktok.com`, `vm.tiktok.com`, `vt.tiktok.com` |
| Instagram | `instagram.com`, `www.instagram.com`, `instagr.am` |
| Facebook | `facebook.com`, `www.facebook.com`, `m.facebook.com`, `fb.watch`, `fb.com` |
| YouTube | `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be` |
| Telegram | `t.me`, `telegram.me` |
| X | `x.com`, `twitter.com` |
| Spotify | `open.spotify.com` |
| Autres | liste tenue dans `settings`, modifiable par l'admin |

Pour les services qui attendent un **nom d'utilisateur** (abonnés), on accepte aussi `@nom` et on le transforme en lien complet.

## 5. Plafonds et limites

| Limite | Valeur |
|---|---|
| Dépense en commandes par client | **500 000 XAF / 24 h glissantes**, modifiable par client (`profiles.daily_spend_limit_xaf`) ; dépassement → `422 DAILY_LIMIT_REACHED` + alerte Telegram |
| Recharge par paiement | ≤ 1 000 000 XAF (mon choix) |
| Commandes | 10 / min / client |
| Recharges | 5 / min / client |
| Connexion | 5 échecs / 15 min |
| Appels sortants vers JAP | ≤ 60 / min au total (mon choix) |
| Solde JAP | commande refusée si solde JAP − réservations < coût ; alerte sous 5 $ |

## 6. Cas limites et comportement attendu

### Argent et paiements
| Cas | Comportement |
|---|---|
| SasPay envoie le même webhook plusieurs fois | Un seul crédit (`saspay_transaction_id` unique + statut déjà `succeeded`) ; réponse 200 |
| Webhook avec signature fausse ou trop ancien (> 300 s) | 403, aucun crédit, alerte Telegram |
| Montant ou devise du webhook ≠ paiement créé | Aucun crédit, paiement à examiner, alerte |
| Client paie mais le webhook n'arrive jamais (SasPay abandonne après 5 essais en ~2 h 35) | Rattrapage toutes les 5 min via `GET /checkout-sessions/{id}/status/` |
| Client ferme la page pendant le paiement | La page de retour et l'historique montrent l'état réel |
| Double clic sur « Payer » | Même clé d'idempotence → un seul paiement |
| Client bloqué tente de recharger | 403 `ACCOUNT_BLOCKED` |
| Paiement réussi pour un compte supprimé entre-temps | Crédit sur le compte anonymisé + alerte pour remboursement manuel |

### Commandes
| Cas | Comportement |
|---|---|
| Deux commandes simultanées qui dépassent le solde | Verrou sur le portefeuille : une seule passe, l'autre `INSUFFICIENT_BALANCE` |
| Double clic sur « Commander » | Même clé d'idempotence → une seule commande |
| Prix changé entre le devis et le clic | `422 PRICE_CHANGED`, le client voit le nouveau prix |
| Service désactivé ou retiré pendant la commande | `422 SERVICE_UNAVAILABLE`, aucun débit |
| JAP répond une erreur | Commande `to_review`, alerte, remboursement après examen |
| JAP ne répond pas (délai dépassé) | `to_review` ; **pas de renvoi automatique** (JAP a peut-être créé la commande) ; l'admin vérifie sur JAP avant de renvoyer |
| JAP renvoie `Partial` ou `Canceled` | `to_review` + alerte ; remboursement décidé par l'admin |
| Solde JAP insuffisant | Commande refusée avant débit, « momentanément indisponible », alerte |
| Compte cible privé ou lien supprimé | Échec chez JAP → `to_review` ; message clair au client |
| Même lien + même service commandé deux fois rapidement | Avertissement avant validation (mon choix), autorisé si le client confirme |
| Plafond journalier atteint | `422 DAILY_LIMIT_REACHED` |

### Catalogue et prix
| Cas | Comportement |
|---|---|
| Coût JAP qui augmente fortement (> seuil) | Nouveau prix publié seulement après validation admin ; alerte |
| Prix calculé sous coût + marge minimale | Publication bloquée |
| Taux de change modifié | S'applique aux nouvelles commandes ; les anciennes gardent leur prix |
| Nouveau service JAP | Créé **inactif** |
| JAP indisponible pendant la sync | Aucune modification, nouvel essai à l'heure suivante, alerte après 3 échecs |

### Comptes
| Cas | Comportement |
|---|---|
| Téléphone déjà utilisé | `409 PHONE_TAKEN` |
| Parrainage avec son propre code | Refusé |
| Parrainage de faux comptes | Un téléphone = un compte ; bonus versé seulement après une vraie recharge réussie ; l'admin peut annuler un bonus |
| Suppression de compte avec solde positif | Avertissement : le solde est perdu (mon choix) ; confirmation par mot de passe |
| Admin perd son téléphone (code 6 chiffres) | Supabase ne fournit pas de codes de secours : on enregistre **2 appareils TOTP** (téléphone + un 2e appareil ou gestionnaire de mots de passe) à l'activation ; en dernier recours, réinitialisation du facteur par script local avec la clé `service_role` |

## 7. Secrets et données

- Secrets uniquement dans les variables d'environnement (Vercel, `.env.local`) ; jamais dans Git, les journaux, les captures ou une conversation.
- **La clé JAP montrée en conversation doit être régénérée** avant toute recharge du compte JAP.
- Clé `service_role` Supabase utilisée uniquement dans `server/`.
- **Règle des clés : tout secret reste sur le serveur.**
  - **Côté serveur seulement** (routes API, actions serveur, Worker Cloudflare) : `JAP_API_KEY`, `SASPAY_API_KEY`, `SASPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TURNSTILE_SECRET_KEY`, `CRON_SECRET`, `ADMIN_PATH`, `SENTRY_AUTH_TOKEN`.
  - **Visibles par le navigateur, publiques par conception** (seulement celles qui commencent par `NEXT_PUBLIC_`) : adresse du site, adresse et clé publique Supabase (protégée par la RLS), clé publique Turnstile, DSN Sentry, identifiant Google Analytics. Aucune ne permet de dépenser de l'argent ni de lire les données d'un autre client.
  - Le navigateur ne parle **jamais** directement à JAP, SasPay ou Telegram : il appelle nos routes `/api/v1/*`, et c'est le serveur qui appelle ces services avec les clés.
  - Protections : fichiers `src/server/**` marqués `import "server-only"` (le build échoue si un composant navigateur les importe) ; `src/server/env.ts` sépare variables serveur et publiques ; règle ESLint qui interdit `process.env.<SECRET>` hors de `src/server/` ; contrôle CI `check-client-bundle` (`CI_CD.md §3`) ; scan gitleaks ; audit `lp-security`.
- Journaux : jamais de mot de passe, jeton ou clé ; téléphone et email masqués (`+2376****12`).
- Données personnelles minimales : email, téléphone, pays.
- Pièces jointes dans un bucket **privé**, URL signées 10 min.
- **Sentry** : `sendDefaultPii: false` ; avant envoi (`beforeSend`), retirer email, téléphone, cookies, en-têtes `Authorization` et corps des requêtes de paiement ; pas de Session Replay au lancement (il pourrait filmer des données personnelles).

## 8. En-têtes et protections web

| Protection | Réglage |
|---|---|
| HTTPS | Obligatoire (Cloudflare + Vercel), HSTS 1 an |
| CSP | `default-src 'self'` + exceptions Turnstile, Supabase, Google Analytics, SasPay, Sentry (`*.ingest.us.sentry.io`) (mon choix) |
| Cadres | `X-Frame-Options: DENY` |
| Type | `X-Content-Type-Options: nosniff` |
| Référent | `Referrer-Policy: strict-origin-when-cross-origin` |
| CSRF | `SameSite=Lax` + contrôle de l'en-tête `Origin` sur toute requête qui modifie |
| Admin | `X-Robots-Tag: noindex, nofollow`, absent du sitemap et de `robots.txt` |
| Cloudflare | Protection anti-robots, règles de débit sur `/api/*`, aucun blocage par pays |

## 9. Surveillance et réaction

- Alertes Telegram : erreur 500, webhook invalide, montant incohérent, commande en échec, solde JAP bas, plafond atteint, 5 échecs de connexion admin.
- Revue hebdomadaire de `audit_log` et des commandes `to_review` (mon choix).
- En cas de fuite d'une clé : la régénérer, mettre à jour Vercel, redéployer, noter l'incident.
