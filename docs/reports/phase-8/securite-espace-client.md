VERDICT : ACCEPTÉ (avec 2 points à corriger, gravité Moyenne et Basse, non bloquants)

Tâche : 8.5 — Audit sécurité de l'espace client (phase 8)

Surface examinée
- Routes : GET/PATCH/DELETE /api/v1/me, GET /api/v1/favorites, PUT/DELETE /api/v1/favorites/[service_id], GET /api/v1/wallet, GET /api/v1/wallet/transactions, GET /api/v1/orders/suggestion.
- Code : src/server/{accounts,favorites,wallet,orders/suggest-order}, src/server/schemas/account.ts.
- SQL : migrations 20261111100000 (suggestions_enabled) et 20261111120000 (verify_user_password), plus anonymize_user (20261107160000) et les droits/RLS de profiles, favorites, wallet_transactions.
- Secrets : clé service (serveur uniquement), AUTH_HASH_SECRET.

Essais d'attaque (base locale 55321, serveur Next local sur 3100, 2 comptes de test créés puis supprimés ; aucune clé affichée)
- Toutes les routes sans session → attendu 401 / obtenu 401 → OK
- PATCH/PUT/DELETE avec Origin étranger ou sans Origin → 403 / 403 → OK
- Mass assignment PATCH /me (balance_xaf, custom_discount_pct, email, status, role, user_id) → champs ignorés ; seule `language` modifiée / obtenu idem ; corps avec seulement des champs interdits → 400 EMPTY_BODY → OK
- suggestions_enabled = "false" (texte) → refus 400 ; booléen false → accepté → OK
- Téléphone invalide → 400 ; téléphone déjà pris → 409 PHONE_TAKEN → OK (voir faille 1)
- JSON cassé / absent → 400 propre → OK
- Client authentifié via PostgREST direct : lire le profil d'un autre → 0 ligne ; lire suggestions_enabled ou custom_discount_pct → 403 ; modifier suggestions_enabled ou status → 403 ; modifier le profil d'un autre → 403 ; insérer un favori pour un autre → 403 (RLS) → OK
- verify_user_password et anonymize_user appelés avec anon ou la session d'un client → 401 / 403 (permission denied) → OK
- Favoris : id 0, abc, 99999999999, 1e3, -1, 01 → 404 ; ajout deux fois → 204 (idempotent) ; le client B ne voit pas les favoris de A (liste vide) ; B supprime le favori de A → 204 sans effet (A le garde) → OK
- Transactions : limit -1, 1000, 1.5, abc ; type inconnu ; curseur truqué (injection de filtre dans le curseur) → 400 / 400 → OK
- Suppression de compte : mauvais mot de passe → 401 ; mot de passe d'un autre compte → 401 ; après 5 essais dans 15 min → 429, même avec le bon mot de passe → OK
- Suppression correcte : 204 ; profil email/téléphone = null, statut deleted ; solde et total rechargé strictement inchangés ; GET /me ensuite → 401 ; ancien jeton refusé par Supabase (403, session supprimée) ; mot de passe effacé (encrypted_password = null dans anonymize_user) → OK
- En-têtes : toutes les réponses de données portent `cache-control: private, no-store` → OK
- Réponses : favoris et suggestion = format catalogue public (nom, prix de vente, quantités) ; aucun coût, marge, multiplicateur ni nom de fournisseur. GET /me ne renvoie ni statut ni rôle ni remise brute → OK
- Journaux : seul `console.error('internal_error', safe)` dans handler.ts ; aucun mot de passe journalisé (la vérification est dans la base, sans session) → OK

Lecture du code (points conformes)
- verify_user_password : security definer, search_path = '', retourne uniquement un booléen (pas de hash), `revoke ... from public, anon, authenticated`, `grant ... to service_role` seul. Compare via crypt() ; mot de passe vide ou compte supprimé = false.
- RLS profiles : grant update limité à `language` ; suggestions_enabled n'a aucun droit client (ni lecture ni écriture) ; PATCH /me passe par le client service après filtre Zod à 4 champs.
- Lectures du client : favoris et transactions via client de session (RLS + filtre user_id) ; suggestion filtre sur l'id authentifié ; identifiant d'utilisateur toujours pris de la session, jamais du navigateur.
- Note d'information : le « # » dans le nom de service (ex. « Abonnés TikTok #9474676 ») est un choix explicite du propriétaire, non signalé comme faille.

Recherche de secrets : motifs (sk_live_, sk_test_, jetons JWT eyJ…) dans src, supabase/migrations et le plan de phase → seule occurrence : la vérification de préfixe dans src/server/env.ts (légitime). Rien trouvé. gitleaks non utilisé.

npm audit --audit-level=high : 0 vulnérabilité haute ou critique ; 7 modérées (chaîne @typescript-eslint, outils de développement uniquement, hors production).

Failles
1. [Moyenne] src/server/accounts/profile.ts (updateMe, champ phone) + src/app/api/v1/me/route.ts:19 — Le téléphone est enregistré avec `phone_confirm: true` sans aucune vérification par code (OTP), et PATCH /me n'a aucun plafond de requêtes. Scénario d'attaque : un client connecté essaie des numéros en boucle ; 409 PHONE_TAKEN révèle quels numéros ont un compte (énumération), et un numéro libre peut être « squatté » : le vrai propriétaire ne pourra plus l'utiliser à l'inscription, et la connexion par téléphone (findEmailByPhone) pointe vers le compte de l'attaquant. Aucun vol d'argent ni de compte. Correction : (a) ajouter un plafond via createRateLimiter (ex. 5 changements de téléphone par heure et par client) ; (b) idéalement ne pas marquer le numéro « confirmé » sans code, ou documenter l'accepté pour la phase 15 ; (c) garder le message PHONE_TAKEN mais seulement après le plafond. — Responsable : lp-coder
2. [Basse] supabase/migrations/20261107140000_rls.sql:28-34 (droit hérité de la phase 1) — wallet_transactions est lisible en table entière par le client via PostgREST direct (essai `select=*` accepté). Il peut donc lire ses propres colonnes `ref`, `note`, `created_by`, `payment_id`, alors que le code de list-transactions.ts affirme « jamais ref, note, created_by ». Scénario d'attaque : un client lit la note interne d'un ajustement admin (ex. motif ou commentaire). Seulement ses lignes (RLS), pas celles des autres. Correction : même méthode que pour orders et payments (20261107150000) : `revoke select on wallet_transactions from authenticated` puis `grant select (id, user_id, type, amount_xaf, balance_after_xaf, order_id, created_at)`. Vérifier que la jointure `orders(short_id)` et les tests existants passent. Migration nouvelle, jamais modifier une migration appliquée. — Responsable : lp-db
3. [Information] src/app/api/v1/me/route.ts:30-40 — Le plafond de suppression compte aussi les essais réussis et les requêtes à corps invalide ; un attaquant qui détient déjà la session peut au plus empêcher temporairement la suppression (15 min). Aucune action requise.
4. [Information] Le service « supprimé » n'annule pas les commandes ou recharges en cours : hors périmètre de cette tâche, à garder pour la revue de phase 12.

Aucune faille Critique ni Haute. Critères d'acceptation : essais d'attaque OK, aucun secret, npm audit sans haute. Les failles 1 et 2 sont à planifier avant la phase 15 (vrai argent) mais ne bloquent pas la phase 8.

Nettoyage : 2 comptes de test supprimés (ligne de profil vérifiée absente), serveur local arrêté, aucun fichier du projet modifié hors ce rapport. Aucun accès à « pubeka » (54321) ni db reset.
