VERDICT : ACCEPTÉ

Tâche : 8.5 — Audit sécurité de l'espace client, 2e passage (phase 8)

Surface examinée : routes PATCH /api/v1/me, PUT/DELETE /api/v1/favorites/[service_id], GET /api/v1/orders/suggestion, GET /api/v1/wallet/transactions ; table wallet_transactions (migration 20261111130000) ; secrets (aucun nouveau).

Essais d'attaque (base locale 55321 uniquement ; comptes de test créés puis supprimés ; clés lues sans affichage)
- Plafond téléphone : 8 changements d'affilée avec formats équivalents (+22572…, avec espaces, avec tirets) → attendu 5 x 200 puis 429 / obtenu 200,200,200,200,200,429,429,429 → OK (compteur indexé sur l'id client, pas sur le texte du numéro)
- 6e requête avec phone + language → 429 (le corps mixte compte) → OK
- Corps sans phone : ne consomme pas le plafond (test existant, 7 PATCH language puis 1 phone OK) → OK
- Numéro invalide après plafond → 400 (refus Zod avant le compteur, pas de fuite) → OK
- 12 requêtes en parallèle sur le même client → 0 passe, 12 en 429 (attendu au plus 5 passent) → OK (voir note 1)
- Autre client pendant que le 1er est bloqué → 200 → OK
- 400 INVALID_PHONE et 409 PHONE_TAKEN avec details.fields.phone → OK (tests me-phone-limit)
- Migration colonnes : PostgREST avec session client : select=* → refusé ; ref, note, created_by, payment_id → refusés ; colonnes publiques de ses lignes → lues ; lignes d'un autre client → 0 ligne → OK
- App : liste des transactions (jointure orders(short_id)), solde, commandes : suites wallet-routes, orders-sync, rls, me-routes, favorites-routes, order-suggestion-sellable → 185 tests verts → OK
- Suggestion : ne retient que les services active et available ; renvoie null sinon, au format catalogue public → OK
- Favoris : Origin vérifié (assertSameOrigin) sur PUT/DELETE, id pris de la session, id de service parsé strictement ; test existant IDOR (B ne supprime pas le favori de A) vert → OK
- Fuite coût/marge/fournisseur dans favoris, wallet, suggestion : recherche de motifs, aucune occurrence → OK

Recherche de secrets : recherche de motifs (sk_live_, sk_test_, service_role, Bearer, JWT) dans src, migrations et tests/db ; seules occurrences légitimes (vérification de préfixe dans env.ts, en-tête cron, commentaires, grants service_role). Rien trouvé. gitleaks non utilisé.
npm audit : non relancé (aucune dépendance modifiée depuis le 1er passage : 0 haute, 7 modérées outils de dev).

Points du 1er passage
1. PATCH /me (Moyenne) : CORRIGÉ. Plafond 5 par heure et par client, 429 RATE_LIMITED, non contournable par format, corps mixte ou parallèle. Risque ACCEPTÉ inchangé : numéro marqué confirmé (phone_confirm: true) sans code SMS, reporté en phase 15 ; il ne s'aggrave pas (le plafond réduit l'énumération 409 et le squat).
2. wallet_transactions (Basse) : CORRIGÉ. Colonnes limitées à id, user_id, type, amount_xaf, balance_after_xaf, order_id, created_at ; RLS conservée ; l'app fonctionne.

Failles
Aucune Critique, Haute ni Moyenne.
1. [Information] src/server/auth/rate-limit.ts:createRateLimiter — la consommation enregistre puis compte : des requêtes simultanées se comptent mutuellement (12 en parallèle = 12 refusées, aucune ne passe). C'est un échec « fermé » sans risque ; seul le client concerné est gêné. Aucune action requise. Les échecs 409 comptent aussi dans le plafond (voulu).
