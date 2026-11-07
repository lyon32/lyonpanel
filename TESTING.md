# LyonPanel — Stratégie de tests

Statut : **validé par le propriétaire le 2026-11-07**. « (mon choix) » = décidé par Claude, à vérifier.
Liés : `LLD.md §8`, `CONVENTIONS.md §2` (CI), `PRD.md §3` (cas limites), `ENV_SETUP.md`.

## 0. Décisions du propriétaire

| # | Décision |
|---|---|
| 1 | Couverture : **100 %** pour l'argent, **80 %** pour le reste de la logique serveur, pas de chiffre imposé pour l'affichage |
| 2 | Tests de bout en bout sur **petit téléphone Android** (connexion lente simulée) + ordinateur |
| 3 | **Faux clients uniquement** dans les tests, jamais de vraies données |
| 4 | **Test final réel** avant lancement : 2–3 petites commandes avec le vrai JAP (≈ 0,50 $) |
| 5 | **Test de charge : 100 clients** simultanés avant lancement |
| 6 | **Chaque bug corrigé = un test** qui le reproduit |

## 1. Les niveaux de tests

| Niveau | Outil | Ce qui est testé | Où | Durée visée |
|---|---|---|---|---|
| **Unitaire** | Vitest | Fonctions pures, sans base ni réseau | `tests/unit/` | < 10 s |
| **Intégration** | Vitest + Supabase local (Docker) | Fonctions SQL, RLS, services `server/*`, routes API avec faux JAP/SasPay | `tests/db/`, `tests/integration/` | < 2 min |
| **Bout en bout (E2E)** | Playwright | Parcours complets dans un vrai navigateur | `tests/e2e/` | < 5 min |
| **Charge** | k6, lancé via Docker (mon choix) | 100 clients simultanés | `tests/load/` | avant lancement |
| **Réel** | À la main, checklist | Vrai JAP + vrai SasPay | `docs/checklist-lancement.md` | une fois avant lancement |

## 2. Quoi tester à quel niveau

### Unitaire (obligatoire)
| Module | Cas à couvrir |
|---|---|
| `pricing/compute-price` | marge TikTok 120 %, Instagram/Facebook 75 %, paliers 70/65/60 %, override service, arrondi au multiple de 5 supérieur, minimum 5 XAF |
| `pricing/discount` | sous le seuil = 0 ; seuil atteint = 10 % ; remise perso plus grande / plus petite ; jamais cumulées |
| Total commande | quantité min, max, non ronde (ex. 137) ; jamais sous coût JAP + marge minimale |
| `pricing/fees` | frais SasPay, arrondis |
| Parrainage | 5 % arrondi à l'inférieur ; 3 000 → 150 ; 10 000 → 500 |
| `catalog/classify` | chaque plateforme ; catégorie inconnue → `other` |
| `catalog/build-name` | jamais de prix ni d'étiquette JAP ; min/max = champs API ; FR et EN |
| `orders/validate-link` | liens valides et invalides par plateforme |
| `lib/money` | affichage XAF, XOF, USD au taux donné |
| `lib/schemas/*` | entrées valides et refusées |
| `http/api-error` | format d'erreur de l'API, traduction FR/EN |

### Intégration (obligatoire)
| Sujet | Cas à couvrir |
|---|---|
| `place_order` | solde suffisant ; insuffisant ; client bloqué ; hors min/max ; même clé d'idempotence 2 fois = 1 commande ; 2 commandes en parallèle qui dépassent le solde = une seule passe ; solde jamais négatif |
| `credit_payment` | crédit normal ; webhook reçu 2 fois = 1 crédit ; montant différent = refus ; 1re recharge d'un filleul = bonus parrain une seule fois ; `total_recharged_xaf` mis à jour ; seuil de remise franchi |
| `refund_order` | total, partiel, double remboursement refusé, `audit_log` écrit |
| `anonymize_user` | email/téléphone/messages effacés ; commandes et paiements gardés |
| **RLS** | client A ne lit ni les commandes, ni le solde, ni les tickets de B ; client ne lit jamais `admin_notes`, `settings`, coûts JAP ; aucune écriture directe sur `wallets` |
| Webhook SasPay | signature fausse = 400 ; doublon = 200 sans crédit |
| Envoi JAP (faux JAP) | succès → `in_progress` ; erreur ou délai → `to_review` + alerte ; aucune 2e tentative |
| Sync statuts | `Completed`, `Partial`, `Canceled` bien traduits |
| Sync catalogue | nouveau service inactif ; retiré → indisponible ; historique de prix écrit ; alerte écart |
| Routes API | format d'erreur unique, codes HTTP, limite 10 commandes/min, admin = 404 pour un client |
| Secrets | après `next build`, aucun secret (valeurs ni noms) dans `.next/static/**` ; un composant navigateur qui importe `src/server/**` fait échouer le build |
| Même calcul | total TypeScript (`computeOrderTotalXaf`) = total SQL (`place_order`) sur 200 cas générés |

### Bout en bout (obligatoire)
| Parcours | Vérifie |
|---|---|
| Inscription | email + téléphone, téléphone déjà pris, connexion par téléphone |
| Recharge | montant sous le minimum, paiement test réussi, paiement échoué, solde mis à jour |
| Commande | choix du service, total en direct, solde insuffisant → lien recharger, commande réussie, statut qui change (polling 30 s) |
| Ticket | ouverture avec capture d'écran, réponse admin visible |
| Admin | adresse secrète + code 6 chiffres, `/admin` = 404, remboursement d'une commande |
| Langues | `/fr/commander` et `/en/order` ; langue et devise mémorisées |
| Mot de passe oublié | email reçu dans la boîte locale |

Appareils (Playwright `projects`) :
- **Petit Android** : 360 × 740, User-Agent Android, réseau limité (≈ 1,6 Mbit/s, 150 ms, mon choix), processeur ralenti ×4.
- **Ordinateur** : Chrome 1366 × 768.

### Ce qu'on ne teste pas automatiquement
- Le style pur (couleurs, marges) : revue visuelle en PR avec captures.
- Les animations GSAP / Lenis.
- Les vraies API JAP et SasPay (seulement au test réel §6).

## 3. Couverture

| Zone | Seuil (lignes + branches) | Bloque la CI |
|---|---|---|
| `src/server/pricing/**` | **100 %** | oui |
| Fonctions SQL d'argent | **100 %** des cas listés §2 | oui |
| `src/server/payments/**`, `src/server/orders/**` | **100 %** | oui |
| Reste de `src/server/**` et `src/lib/**` | **80 %** | oui |
| `src/components/**`, `src/app/**` | aucun chiffre | non |

Mesure : `vitest --coverage` (v8), seuils dans `vitest.config.ts`. Seuil non atteint = CI rouge = pas de mise en ligne.

## 4. Données de test et fixtures

**Règle : jamais de vraies données de clients**, ni de vraies clés, ni le vrai catalogue avec prix JAP dans le dépôt.

| Élément | Approche |
|---|---|
| Fabriques | `tests/factories/` : `makeUser()`, `makeService()`, `makeOrder()`, `makePayment()`, valeurs par défaut modifiables |
| Faux clients | emails `client-<n>@lyonpanel.test`, téléphones `+237600000<nnn>` (plage fictive, mon choix) |
| Base locale | chaque test tourne dans une **transaction annulée à la fin** ; `db reset` avant la suite complète |
| Données de départ | `supabase/seed.sql` : réglages par défaut + ~20 services fictifs (TikTok, Instagram, Facebook), prix inventés |
| Faux JAP | `src/server/providers/jap-mock.ts` (si `JAP_MODE=mock`) : répond comme l'API v2 ; scénarios pilotés par le lien (`…/fail` → erreur, `…/slow` → délai dépassé, `…/partial` → Partial) |
| Faux SasPay | mode test SasPay pour l'E2E ; en intégration, webhooks signés générés par `tests/helpers/saspay-webhook.ts` |
| Turnstile | clés de test Cloudflare (toujours « réussi ») |
| Telegram | en test : messages capturés en mémoire, rien n'est envoyé |
| Horloge | `vi.useFakeTimers()` pour délais, polling et dates |
| Comptes E2E | créés par le test au début (email unique horodaté) |

## 5. Bug corrigé = test ajouté

1. Écrire d'abord un test qui **échoue** en reproduisant le bug.
2. Corriger ; le test passe.
3. Nommer le test d'après le bug : `it('ne crédite pas deux fois si SasPay renvoie le webhook (bug #12)')`.
4. PR de correction refusée sans ce test.

## 6. Avant le lancement

**Test de charge** (k6, 100 clients virtuels, 10 min, environnement Preview avec faux JAP)
- Parcours simulé : accueil → catalogue → connexion → devis → commande.
- Objectifs (mon choix) : 95 % des réponses < 800 ms, 0 erreur 5xx, aucun solde négatif ni double débit en base après le test.

**Test réel** (à la main, `docs/checklist-lancement.md`)
1. Régénérer la clé JAP, la mettre dans Vercel Production.
2. Recharger 3 000 XAF par un vrai Mobile Money → solde crédité une fois.
3. Passer 2–3 commandes minimales (vues TikTok, likes Instagram, likes Facebook), ≈ 0,50 $ JAP.
4. Vérifier : statuts mis à jour, bénéfice juste dans l'admin, alertes Telegram reçues.
5. Rembourser une commande depuis l'admin → solde client correct.
6. **Test de restauration** : restaurer une sauvegarde Supabase dans le projet test et vérifier les données.

## 7. Quand les tests tournent

| Moment | Tests |
|---|---|
| Avant chaque commit (Husky) | lint + types + tests unitaires liés aux fichiers modifiés |
| Chaque PR (GitHub Actions) | unitaires + intégration + E2E (Android + ordinateur) + couverture |
| Avant mise en ligne | CI verte obligatoire |
| Avant le lancement | charge + test réel + restauration |
| Une fois par mois | suite complète après mise à jour des dépendances |
