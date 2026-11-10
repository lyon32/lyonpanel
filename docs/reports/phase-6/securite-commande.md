VERDICT : ACCEPTÉ
Tâche : 6.5 — Audit sécurité de la commande (place_order, routes /api/v1/orders, route de test fail-next)
Surface : routes orders (POST/GET), orders/[id], orders/quote, test/provider/fail-next ; fonction SQL place_order (migration 20261110110000) ; tables orders, wallets, wallet_transactions, settings ; secrets : SASPAY_WEBHOOK_SECRET (route de test).

Essais d'attaque (base locale 55321) :
- anon appelle place_order -> refus -> 42501 permission denied -> OK
- anon lit orders / wallets -> refus -> 42501 -> OK
- 10 place_order simultanés, solde 1000, prix 720 -> 1 seul passe -> 1 débit -> OK
- 10 appels simultanés même idem_key -> 1 commande, 1 débit, même ligne renvoyée -> OK
- quantité négative, 0, 2147483647 -> QUANTITY_OUT_OF_RANGE -> OK
- plafond 24 h (100 000) : 72 000 puis nouvelle commande -> DAILY_LIMIT_REACHED ; 4 appels parallèles de 50 000 -> tous refusés -> OK (verrou wallet)
- Lecture du code (pas de site lancé, essais HTTP non faits) : requireApiUser + assertSameOrigin sur POST, limite 10/min avant la base, Zod, IDOR bloqué (eq user_id + RLS, 404 identique), colonnes publiques en liste blanche (aucun cost_usd/error/provider_order_id), lien http(s) avec domaine exact (javascript:, userinfo, sous-domaines piégés refusés), aucune requête serveur vers le lien (pas de SSRF), lien jamais utilisé en href côté UI.
- Curseur list-orders.ts : date ISO stricte + UUID validés par regex avant insertion dans le filtre .or() -> aucune injection PostgREST possible -> OK
- Route fail-next : 404 si PROVIDER_MODE != mock, NODE_ENV=production ou VERCEL_ENV=production ; puis secret en temps constant -> OK
Recherche de secrets : motifs (sk_live_, sk_test_, service_role, Bearer, hex longs) sur les fichiers modifiés/nouveaux : seul "service_role" dans le GRANT SQL (légitime). Aucun secret.
npm audit : lancé, non terminé dans le délai ; à relancer par le chef de projet (aucune dépendance ajoutée dans cette tâche).

Failles (aucune Critique ni Haute) :
1. [Basse] src/server/schemas/order.ts:13 — comments sans limite de nombre ni de longueur par ligne (seulement min 1) — un client peut envoyer un gros corps stocké et transmis au fournisseur — correction : .max(1000) lignes et .max(500) caractères par ligne — Responsable : lp-coder
2. [Basse] supabase/migrations schema idem_key unique global + place_order — un client réutilisant la clé d'un autre client provoque une violation d'unicité (500 INTERNAL_ERROR, aucun débit) — clés UUID non devinables, impact nul d'argent — correction : unique (user_id, idem_key) ou préfixer la clé par l'utilisateur — Responsable : lp-db
3. [Basse] src/app/api/v1/orders/quote/route.ts — pas de limite de débit sur le devis — scraping de prix par un compte connecté — correction : limiter à ~60/min — Responsable : lp-coder
4. [Basse] src/server/env.ts:19 — PROVIDER_MODE vaut 'mock' par défaut : oubli de variable en production = faux fournisseur silencieux (la route de test reste 404 en production) — correction : exiger PROVIDER_MODE explicite quand VERCEL_ENV=production — Responsable : lp-coder
5. [Basse] src/server/orders/place-order.ts — marqueur error='submitting' : si le processus meurt entre la réservation et l'envoi, la commande reste pending sans alerte — correction : le cron de rattrapage doit traiter les pending > N min — Responsable : lp-coder

---
# 2e passage
VERDICT : ACCEPTÉ
Vérifié (lecture du code) :
- Faille 1 (comments) : corrigée, max 1000 lignes, 500 caractères par ligne (schemas/order.ts) -> OK
- Faille 3 (devis) : corrigée, 60/min par client avant le calcul (orders/quote/route.ts) -> OK
- Faille 4 (PROVIDER_MODE) : corrigée, env.ts refuse un démarrage en production sans valeur explicite ; live reste interdit hors production -> OK
- Faux fournisseur ids >= 900000 : n'existe que dans createMockProvider, appelé uniquement si PROVIDER_MODE=mock (providers/index.ts). Impossible à activer en production sans écrire explicitement PROVIDER_MODE=mock (alors c'est un choix volontaire). Il ne masque pas un vrai échec : le vrai client ne passe jamais par ce code, et fail-next / quantités hors limites échouent toujours. Basse (config) : prévoir en phase 15 une vérification de démarrage "mock interdit si SASPAY_MODE=live".
- use-order-submit.ts : clé d'idempotence liée à la signature du contenu (réessai sûr, nouvelle clé si contenu change), devis frais avant débit, total toujours recalculé serveur. OK
- Message d'erreur brut : jamais côté client. Le client n'affiche que error.message de l'API (format unifié FR/EN) ; erreurs inconnues -> INTERNAL_ERROR générique (handler) ; orders.error (raison technique, 300 car.) n'est ni dans list-orders (liste blanche) ni dans la réponse de POST ; les messages "liste des commandes: ..." restent dans les journaux serveur. OK
Restent ouverts, jugés ACCEPTABLES pour la phase 6 :
- idem_key unique global : 500 sans aucun débit en cas de collision UUID (probabilité négligeable, clés aléatoires non devinables). Corriger en unique (user_id, idem_key) à la prochaine migration autorisée.
- Commande pending avec error='submitting' après crash : argent débité, pas perdu, pas de double envoi (provider.add jamais relancé automatiquement, conforme à CLAUDE.md). Rattrapage et alerte = phase 7 (obligatoire, à tracer dans le plan phase 7).
npm audit --audit-level=high : terminé, code de sortie 0, 7 vulnérabilités modérées (chaîne eslint / typescript-eslint, outils de développement), aucune haute ni critique -> OK
Secrets : aucun nouveau motif dans les fichiers modifiés (seed.sql, env.ts, mock-provider.ts, use-order-submit.ts).
Essais d'attaque : ceux du 1er passage restent valables (SQL inchangé hors seed) ; pas de nouvelle faille Critique/Haute/Moyenne.
