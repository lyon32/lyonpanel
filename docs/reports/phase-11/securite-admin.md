VERDICT : À CORRIGER
Tâche : 11.5-sécurité — Admin 1 (accès, double appareil, clients, bonus de parrainage, pièces jointes)
Branche : feat/phase-11-admin-1, commit 618f1c7 (base origin/main a093598)

Surface examinée
- Routes : /api/v1/admin/{login, mfa/status, mfa/enroll (POST, PUT), mfa/verify, stats, users, users/[id] (GET, PATCH), users/[id]/notes, referrals/[id]/cancel, storage/orphans, storage/orphans/purge}, pages /<ADMIN_PATH>/*, proxy.ts.
- SQL : cancel_referral_bonus, CHECK wallets_balance_xaf_check / wallet_transactions_balance_after_xaf_check (migrations 110000 et 120000), contrainte settings_referral_pct_range, trigger enforce_ticket_message_limit, politique ticket_attachments_insert, credit_payment (effet de bord).
- Tables : profiles, wallets, wallet_transactions, referral_rewards, admin_notes, audit_log, tickets, ticket_messages, ticket_attachments, storage.objects.
- Secrets : ADMIN_PATH, AUTH_HASH_SECRET, clés Supabase, Sentry.

Méthode : copie jetable du commit lancée sur le port 3188 (Next dev) contre le Supabase local (captcha de test Cloudflare actif après le redémarrage fait par une autre session). Sessions obtenues par lien magique GoTrue (le captcha bloquait la connexion avant le redémarrage). Aucune clé affichée, rien contre la production.

Essais d'attaque (résultat réel)
Accès
- /admin, /gestion, /gestion/<secret>, /ZZ-SECRET (casse), /<secret>%2F, /<secret>/../admin, /x aléatoire → attendu 404 identique / obtenu redirection vers /fr/... puis 404 pour tous (seul /<secret> exact et /<secret>/ (308 vers sans slash) donnent la page) → OK
- /api/v1/admin/* sans session (stats, users, users/x, mfa/status, orphans, mfa/verify, enroll, cancel, PATCH) → attendu 404 / obtenu 404 JSON NOT_FOUND → OK
- Même chose avec session client → 404 → OK
- Admin aal1 SANS appareil : stats, users, orphans, verify → 404 ; mfa/status → 200 (prévu) → OK
- Admin aal1 AVEC 1 appareil vérifié : stats, users → 401 MFA_REQUIRED (seul cas prévu) → OK
- Admin aal2 : 200 partout, cache-control private, no-store → OK
- Session admin 12 h : last_sign_in_at reculé de 13 h avec un jeton aal2 valide → 404 ; remis → 200 → OK (timebox GoTrue aussi réglé à 12h0m0s)
- HEAD → 404, OPTIONS → 204, slash final → 308, casse (/API/V1/ADMIN) → redirection puis 404, %2F → 404, en-tête x-middleware-subrequest (essai CVE-2025-29927) sur /<secret>/users et /admin → 404 / sans effet (la garde est dans les routes et pages, pas dans le proxy) → OK
- Pages /<secret>/users, /stats : visiteur 404, client 404, admin aal2 200 ; X-Robots-Tag noindex, nofollow et Cache-Control no-store présents → OK
- CSRF : PATCH, POST (mfa/verify, cancel, notes, purge, login) sans Origin ou Origin étranger → 403 bad_origin → OK
Double appareil
- Enrôlement du 1er appareil avec session aal1 (mot de passe seul), 0 appareil vérifié → 200 (QR + clé), confirmation avec bon code → 200 → comportement Supabase confirmé, voir faille 2
- Mauvais code de confirmation → 401 MFA_REQUIRED, compté comme échec → OK
- 2e appareil avec session aal1 alors qu'un appareil est vérifié → refusé par GoTrue (« AAL2 required to enroll a new factor ») mais la route renvoie 500 INTERNAL_ERROR → sécurité OK, erreur sale (faille 6)
- Code mal formé (5 chiffres, lettres, 7 chiffres, vide, null) → 400 VALIDATION_ERROR → OK
- 30 mauvais codes à la suite sur mfa/verify → attendu blocage / obtenu 30 × 401 sans aucune limite, puis le bon code passe → ÉCHEC (faille 3)
Connexion admin
- Mauvaise adresse secrète dans le corps → 404 avant tout, 0 ligne enregistrée → OK
- Compte client sur la bonne adresse → 401 INVALID_CREDENTIALS identique au mauvais mot de passe, session fermée → OK
- Blocage par identifiant : échecs 1 à 3 en 401, puis 429 AUTH_LOCKED avec Retry-After ; même réponse pour un identifiant inexistant → OK
- Temps de réponse (6 essais, comptes frais) : compte existant 227 à 368 ms, compte inconnu 111 à 217 ms → ÉCHEC (faille 4)
- GET sur la route de connexion → 405 → OK
Argent
- credit_payment pour un client en dette (-1000 XAF, recharge 500) → attendu crédit ou refus propre / obtenu erreur wallets_balance_xaf_check, paiement non crédité → ÉCHEC (faille 1)
- Même chose pour le FILLEUL d'un parrain en dette (parrain -1000, filleul recharge 1000, bonus 50) → erreur de contrainte, la recharge du filleul échoue → ÉCHEC (faille 1)
- set_config('lyonpanel.allow_debt') posé par un client : UPDATE wallets refusé (« permission denied », le rôle authenticated n'a que SELECT) ; PostgREST /rpc/set_config → 404 ; pg_catalog non exposé → OK
- UPDATE wallets balance=-1 sans réglage, avec le réglage à « ON » (majuscules) → les deux refusés par le CHECK → OK
- cancel_referral_bonus appelé par anon et par authenticated (SQL et /rpc) → « permission denied for function » → OK
- 5 annulations du même bonus en parallèle via l'API → 1 × 200, 4 × 409 ALREADY_CANCELLED ; 1 seule ligne wallet_transactions, 1 seule ligne audit_log, solde exact → OK
- Motif vide ou blanc → 400 ; uuid invalide → 404 → OK
- referral_pct à 150, "5", -1, null → refusés par le CHECK ; 12.5 accepté → OK
Clients
- PATCH : is_admin, balance_xaf, email, referred_by, id, wallets, status deleted, blocage sans motif, motif seul, remise 51 ou -1, plafond -5 ou 1.5, corps vide, "5" en texte, JSON cassé → tous 400 (schéma strict) → OK
- PATCH valide (remise 10 %, plafond, blocage, déblocage) → 200 ; bloquer l'administrateur → 403 → OK
- Recherche q : « a,id.neq.0 », « x),or(id.not.is.null », « % », « * », « ( », « ' », « \ », « _ », « a\_b » → 200, 0 ligne, aucune erreur 500, aucun élargissement du filtre → OK
- Curseur : texte libre, base64 invalide, base64 avec injection de filtre dans l'identifiant ou la date → 400 ; limit 0, -1, 1000, 1.5, abc → 400 ; status et country invalides → 400 → OK
- Sorties : liste = id, email, phone, country, status, balance_xaf, created_at ; fiche = profile (14 champs de la liste blanche), wallet, orders, notes, referrals (booléen same_ip seulement), debt_xaf. Aucune occurrence de signup_ip_hash, is_admin ni d'empreinte ; aucun nom ou lien JAP. cost_usd et profit_xaf sont visibles dans la fiche : admin seulement, voulu → OK
- Notes avec <script> : stockée telle quelle (201), rendu par React (aucun dangerouslySetInnerHTML dans le code de la phase) ; vide ou 2001 caractères → 400 ; champ en trop ignoré → OK
- IDOR : id invalide, uuid inconnu, id suivi de « ' or 1=1 » → 404 → OK
- Côté client (PostgREST, jeton d'un client) : autres tickets 0 ligne, profiles 1 ligne (la sienne), wallets 1 ligne, referral_rewards/audit_log/admin_notes/settings 0 ligne, select signup_ip_hash → 42501 ; PATCH wallets → 403 ; anon sur 9 tables → 401 → OK
Tickets et fichiers
- 12 messages client en parallèle sur un ticket → 3 acceptés, 9 × MESSAGE_LIMIT_REACHED (compte final en base : 3) → OK
- Chemin de pièce jointe en direct (PostgREST) : bon chemin → 201 ; .jpgx, Xjpg, dossier d'un autre client, ../, .svg, retour à la ligne, majuscules → 403 → OK
- Purge : sans confirm, confirm "true", confirm 1, confirm false, paths vide, ../x, /../, 201 chemins → 400 ; sans session → 404 (fichier intact) → OK
- Purge : fichier récent, fichier rattaché, fichier absent avec minAgeMinutes 0 envoyé → seuls les fichiers vieux de plus de 60 min et non rattachés sont supprimés ; le champ minAgeMinutes du client est ignoré ; ligne audit_log écrite → OK
- Liste des orphelins : contient les vieux fichiers non rattachés, pas le récent ni le rattaché → OK
- Chemin avec « Xpng » au lieu de « .png » : accepté par le schéma (200, skipped not_found) → faille 5
Secrets
- Recherche de motifs (sk_live_, sk_test_, service_role, Bearer, eyJ…, hex de 40+, password/secret) dans git diff origin/main...HEAD : seulement des mots de passe et valeurs de TEST dans tests/ et docs (Un-bon-mot-de-passe-42, k7q2-test-path-9f3a, test-admin-path-1234, k7q2-9f3a1c5d8e) → aucun vrai secret
- ADMIN_PATH : lu dans proxy.ts (process.env) et env.ts (serveur), absent de next.config.ts, jamais NEXT_PUBLIC_ ; absent de .next/static (build dev) → OK, mais voir faille 7 (Sentry)
- .env.example : ADMIN_PATH= vide → OK

Recherche de secrets : gitleaks absent ; recherche de motifs à la main sur le diff de la branche (résultat ci-dessus), aucun secret réel.
npm audit : `npm audit --audit-level=high` → 0 haute ni critique ; 7 moyennes (chaîne @typescript-eslint, outils de développement) ; aucune dépendance ajoutée par la branche.

Failles
1. [Haute] supabase/migrations/20261116110000_admin_phase11.sql:15 et 20261116120000_admin_phase11_debt_fix.sql:3 (CHECK du solde) avec credit_payment (20261107160000_security_hardening.sql) — Un client en dette (bonus annulé après dépense) qui recharge MOINS que sa dette fait échouer credit_payment : le solde resterait négatif et le CHECK refuse. Même échec pour la recharge d'un FILLEUL dont le parrain est en dette et dont le bonus ne couvre pas la dette. Le paiement SasPay est encaissé mais le statut reste non crédité (webhook en erreur, rejeu en échec identique). C'est le pire échec du projet : un client qui paie et ne reçoit rien, et un tiers innocent touché. — Preuve : transaction SQL locale, solde -1000, credit_payment de 500 → « new row for relation wallets violates check constraint wallets_balance_xaf_check » ; parrain -1000, filleul recharge 1000 (bonus 50) → même erreur. Scénario d'attaque : un parrain dépense son bonus, l'admin annule, puis chacun de ses filleuls qui recharge est bloqué ; ou un client malveillant provoque volontairement la situation avec un compte parrain à lui. — Correction : dans credit_payment (recharge et bonus parrain), poser `lyonpanel.allow_debt` à `on` (local à la transaction) autour des UPDATE wallets et accepter `ref like 'pay:%' or 'ref:%'` dans le CHECK de wallet_transactions ; ou plutôt remplacer ces réglages par un CHECK qui n'interdit que la DIMINUTION sous zéro (déclencheur BEFORE UPDATE : refuser si nouveau solde < 0 ET nouveau solde < ancien solde, sauf cancel_referral_bonus). Ajouter les tests : recharge inférieure à la dette, bonus parrain inférieur à la dette, refund_order et admin_adjust positif sur solde négatif. — Responsable : lp-db
2. [Moyenne] src/server/admin/mfa.ts:92-103 (enrollDevice) + src/server/auth/require-admin.ts:56 — Tant qu'aucun appareil n'est vérifié, une session aal1 (mot de passe seul) peut enregistrer le 1er appareil (prouvé : 200 puis confirmation), ce qui donne aal2 et l'accès admin complet. Le secret ADMIN_PATH ne protège pas ce chemin : la route /api/v1/admin/mfa/enroll est joignable avec une session obtenue par la connexion normale /api/v1/auth/login. Une fois un appareil vérifié, un 2e exige aal2 (GoTrue, confirmé) : le risque ne dure que la fenêtre avant la première configuration. — Scénario d'attaque : mot de passe admin volé avant que le propriétaire n'ait enregistré ses 2 appareils → l'attaquant enregistre le sien. — Correction : procédure de mise en ligne (CI_CD.md) : enrôler les 2 appareils AVANT d'annoncer ou d'utiliser l'adresse, avec mot de passe fort et unique ; vérifier à la mise en ligne que mfa/status renvoie verified: 2. Option code : n'autoriser l'enrôlement du 1er appareil que si une variable ADMIN_ENROLL_OPEN=true est posée (à retirer ensuite). — Responsable : lp-coder (option) / propriétaire (procédure)
3. [Moyenne] src/server/admin/mfa.ts:60-80 (verifyAdminCode, confirmDevice) — Aucun plafond ni verrou sur les essais du code à 6 chiffres : 30 essais de suite acceptés sans ralentissement ; seule une alerte Telegram tous les 5 échecs. Pour un attaquant qui a déjà le mot de passe, le code se force en ligne (environ 1 million de possibilités, 3 codes valides à la fois). — Scénario d'attaque : mot de passe admin volé, boucle sur mfa/verify. — Correction : avant de tenter le code, compter les échecs `admin-mfa:<id>` (déjà enregistrés) et refuser en 429 RATE_LIMITED au-delà de 5 par 15 min (et blocage de plus en plus long comme createLoginLimiter) ; test de verrouillage. — Responsable : lp-coder
4. [Moyenne] src/server/admin/login.ts:15-17 et :64 (DECOY_EMAIL) — Le compte « leurre » n'existe pas dans Supabase : GoTrue répond sans comparer de mot de passe, donc un compte existant met ~100 ms de plus qu'un inconnu (227-368 ms contre 111-217 ms sur 6 essais). Le commentaire promet « même travail ». Permet d'énumérer des comptes, dont l'email de l'administrateur pour qui connaît l'adresse secrète ; même défaut sur la connexion client (phase 3, déjà en place). — Scénario d'attaque : chronométrer N essais pour vérifier qu'un email existe. — Correction : créer un vrai compte leurre jamais utilisable (mot de passe aléatoire non conservé, statut bloqué) et l'utiliser comme DECOY_EMAIL ; ou ajouter un délai de réponse minimal fixe (ex. 400 ms) sur les échecs. — Responsable : lp-coder
5. [Basse] src/server/schemas/storage.ts:5 — `${UUID}\.(jpg|png|webp)` dans une chaîne de gabarit JavaScript : `\.` devient `.`, le point accepte n'importe quel caractère (prouvé : « …Xpng » validé, 200 not_found). Sans impact réel (le fichier doit exister, être orphelin et vieux) mais la règle « chemin strict » n'est pas celle de la base. — Correction : `\\.` dans le gabarit, ou `String.raw`. Test avec « …Xpng » → 400. — Responsable : lp-coder
6. [Basse] src/app/api/v1/admin/mfa/enroll/route.ts / mfa.ts:enrollDevice — Un 2e appareil demandé avec une session aal1 provoque 500 INTERNAL_ERROR (erreur Supabase non traduite) et une alerte Telegram internal_error. Sécurité intacte (GoTrue refuse) mais mauvaise réponse et bruit d'alerte. — Correction : attraper l'erreur « AAL2 required » et répondre 401 MFA_REQUIRED. — Responsable : lp-coder
7. [Moyenne] src/lib/sentry-scrub.ts:74-107 — scrubEvent ne retire pas ADMIN_PATH : request.url, nom de transaction et fils d'Ariane gardent « /<secret>/users/… » (prouvé en appelant scrubEvent : url, transaction et breadcrumb sortent avec le secret). Une erreur sur une page admin envoie donc l'adresse secrète à Sentry, ce que la consigne interdit. — Scénario : toute erreur de page admin en production ; quiconque lit le projet Sentry connaît l'adresse. — Correction : dans scrubEvent, remplacer le premier segment égal à process.env.ADMIN_PATH par « [admin] » dans url, transaction, breadcrumbs, spans (maskDeep) ; test unitaire. — Responsable : lp-coder
8. [Basse] src/server/admin/login.ts:44 et src/server/auth/rate-limit.ts (limiteur par identifiant, blocage jusqu'à 24 h) — Quiconque connaît l'email de l'admin (sans connaître ADMIN_PATH, via la connexion client, ou avec via la connexion admin) peut le verrouiller par 3 échecs, avec pause doublée à chaque échec (jusqu'à 24 h) ; le compteur global d'échecs de /admin/login déclenche une alerte Telegram tous les 5 échecs pour qui connaît l'adresse secrète. Le captcha Turnstile ralentit mais ne bloque pas. — Correction : prévoir une sortie de secours documentée (RUNBOOK : purge des lignes login_attempts de l'admin en base) ; envisager que le blocage de l'admin ne dépasse pas 15 min. — Responsable : lp-coder (docs) / propriétaire
9. [Basse] src/server/http/request.ts:7 et routes admin — assertSameOrigin passe AVANT la garde : PATCH ou POST sans Origin sur une route admin renvoie 403 bad_origin, un visiteur apprend donc que la route existe (404 JSON pour GET, HTML pour une route inexistante, 405 pour une méthode absente). Les chemins /api/v1/admin/* ne sont pas secrets (documentés), donc faible impact ; l'adresse secrète des PAGES reste protégée. — Correction (facultative) : appeler la garde avant assertSameOrigin dans les routes admin. — Responsable : lp-coder
10. [Basse] src/server/tickets/purge-orphans.ts:112 — La ligne d'audit de la purge ne garde que le nombre de fichiers, pas les chemins supprimés (suppression définitive, aucune trace de ce qui est parti). Fenêtre de course minuscule entre la vérification « non rattaché » et la suppression. — Correction : ajouter la liste des chemins dans details ; accepter la course (délai de grâce d'une heure). — Responsable : lp-coder

Notes (hors faille de cette tâche)
- Le limiteur de connexion lit cf-connecting-ip avant x-real-ip (src/server/http/request.ts:16) : un appelant direct de l'origine pourrait l'inventer pour éviter le plafond par IP. À confirmer à la mise en ligne (accès à l'origine restreint à Cloudflare). Déjà en place depuis la phase 3.
- src/components/ui/chart.tsx utilise dangerouslySetInnerHTML (style de graphique shadcn, valeurs de configuration en dur, phase 8). Non touché par la phase 11 ; à garder en tête pour la règle « Jamais ».
- ENV_SETUP.md:103 indique `/<ADMIN_PATH>/login` alors que la page de connexion est à `/<ADMIN_PATH>` (les autres sous-adresses donnent 404).
- Le Supabase local a été arrêté et redémarré par une autre session pendant l'audit (la base partagée voit aussi les tests des autres agents) : quelques compteurs de login_attempts ont donc été remis à zéro entre deux de mes essais ; les verrouillages ont été constatés avant et après.
- Données de test laissées en base locale : comptes sec-*@lyonpanel.test, notes et un ticket « sec-purge ». Le mot de passe du compte admin local a été remis à la valeur de test des fabriques. `supabase db reset` nettoie tout.

Critères pour ACCEPTÉ
- [ ] Essais d'attaque OK : ÉCHEC sur le crédit d'un client en dette (faille 1), le plafond des essais de code (3) et le temps de réponse (4).
- [ ] Aucune faille Critique ou Haute : 1 faille Haute (faille 1).
- [x] Aucun secret trouvé.
- [x] npm audit sans haute.

Après correction de la faille 1 (obligatoire) et des failles 3, 4, 7 (recommandées avant la mise en ligne), relancer l'essai de recharge sous dette (client et filleul) et l'essai des 30 codes.

---

# Nouvel audit — correctifs c286112 (diff 618f1c7..HEAD relu)

VERDICT : ACCEPTÉ (une réserve Basse sur la durée minimale, voir ci-dessous)

Essais rejoués (serveur de test sur la copie de c286112, Supabase local sans reset ni redémarrage)
- Faille 1, recharge 500 sur dette 1000 → attendu crédit, solde -500 / obtenu credited true, solde -500 ; rejeu du même paiement → credited false, solde inchangé → OK
- Faille 1, filleul recharge 1000, parrain en dette 1000 → attendu crédit du filleul / obtenu credited true, bonus 50, solde du parrain -950 → OK
- admin_adjust +300 sur dette → -700 ; admin_adjust -10 sur solde négatif → INSUFFICIENT_BALANCE → OK (refund_order : couvert par le déclencheur, toute hausse est permise ; non rejoué séparément)
- Contournements du déclencheur wallets_no_new_debt : baisse sous zéro sans réglage → refusée ; baisse d'une dette (-1000 → -2000) avec réglage vide → refusée ; réglage « yes » → refusé ; insertion de portefeuille négatif → refusée ; déclencheur actif (tgenabled O) → OK
- Client (rôle authenticated) : set_config puis UPDATE wallets → permission denied ; INSERT wallets → permission denied ; admin_adjust, credit_payment → permission denied ; DISABLE TRIGGER → must be owner ; /rpc/set_config → 404 (déjà vu) → OK
- Faille 3 : 30 mauvais codes → 401 ×5 puis 429 (Retry-After 900) dès le 6e ; la route de confirmation d'appareil est verrouillée aussi (429) ; admin aal1 reste 401 → OK. (Le verrou utilise l'empreinte HMAC de MON serveur de test : il n'a pas touché aux essais des autres sessions.)
- Faille 6 : 2e appareil avec session aal1 → 401 MFA_REQUIRED propre (plus de 500, plus d'alerte internal_error) → OK
- Faille 7 : scrubEvent avec ADMIN_PATH défini → url, transaction, fil d'Ariane et span sortent avec « [admin] » → OK
- Faille 5 : String.raw sur le chemin ; faille 10 : chemins dans l'audit de purge → relus dans le diff, OK
- Faille 2 : ADMIN_ENROLL_OPEN (false = 404 avant tout enrôlement), documenté dans ENV_SETUP.md:40 et :106 (procédure : 2 appareils avant usage, puis fermer) → code relu, OK (non rejoué : demanderait de redémarrer le serveur avec la variable ; couvert par tests/unit/admin/mfa-enroll*.test.ts)
- Faille 8 : sortie de secours documentée (ENV_SETUP.md:110) ; le limiteur passe avant le compteur global, une tentative refusée n'est plus comptée ni alertée (plus de provocation d'alertes en insistant) → OK
- Secrets : aucun ajout dans 618f1c7..HEAD (ADMIN_ENROLL_OPEN= vide dans .env.example) ; aucune dépendance ajoutée → OK

Faille 4 (temps de réponse) : corrigée en grande partie, réserve Basse
- Mesures sur 12 comptes chacun, serveur de développement sous charge : /admin/login compte existant médiane ≈ 333 ms, inconnu ≈ 327 ms (indiscernable) ; /auth/login existant médiane ≈ 385 ms, inconnu ≈ 345 ms (écart d'environ 40 ms, moyenne 437 contre 360 ms avec valeurs extrêmes).
- Cause : le plancher de 300 ms (min-duration.ts) est inférieur au temps réel d'un échec (≈ 330 ms ici, plus sur Supabase hébergé) ; il n'égalise donc rien dès que le chemin réel le dépasse.
- Correction recommandée (Basse, ne bloque pas) : relever MIN_AUTH_DURATION_MS à 1000 ms, ou utiliser un vrai compte leurre. Responsable : lp-coder.
- Failles non reprises, inchangées : 9 (garde avant assertSameOrigin, facultative, Basse).

Résultat : plus aucune faille Critique ni Haute ; faille 1 close avec preuves SQL ; failles 2, 3, 5, 6, 7, 8, 10 closes ; 4 partielle (Basse) ; 9 acceptée.
Effets de bord : aucun fichier du projet modifié hors ce rapport ; serveur de test arrêté ; un 2e appareil TOTP vérifié de l'admin local existe (enrôlé par une autre session), non touché.
