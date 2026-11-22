VERDICT : ACCEPTÉ (sous réserve des 2 points Moyens à traiter avant 15.6, et des essais base de données à rejouer quand Docker tourne)
Tâche : 15.5 — Audit sécurité final (mode faux, lecture seule)

Surface examinée : routes /api/webhooks/saspay, /api/v1/auth/register, /api/v1/admin/*, cancel commande ; fonctions SQL place_order, credit_payment ; env.ts, providers/index.ts, test/provider/guard.ts, security-headers.ts, proxy.ts ; secrets (motifs seulement, aucun .env* lu).

Limites : Docker arrêté, donc pas de base locale ni de Supabase. Aucun essai base (double commande simultanée, double crédit réel, RLS avec clé anon) n'a pu être rejoué : vérifié par lecture du SQL et des tests existants. Un serveur local répondait sur le port 3100 : seules des requêtes GET/POST sans identifiant ont été envoyées.

Essais d'attaque (résultat réel)
- GET /admin → attendu 404 / obtenu 307 vers /fr/admin puis 404 → OK
- GET /api/v1/admin/stats sans session → attendu 401/404 / obtenu 404 → OK
- GET /api/v1/me sans session → attendu 401 / obtenu 401 → OK
- Webhook sans signature → attendu 403 / obtenu 403 → OK
- Webhook mauvaise signature + horodatage 1 → attendu 403 / obtenu 403 → OK
- En-têtes (CSP, nosniff, X-Frame DENY, Referrer-Policy, Permissions-Policy, HSTS) présents sur pages, API et 404 → OK
- Horodatage 10 min, rejeu, doublon : lecture du code seulement : ±300 s, HMAC sur "timestamp.corps_brut", timingSafeEqual avec contrôle de longueur/hex, secret absent = refus, dédoublonnage via credit_payment (verrou for update, statut succeeded = aucun nouveau crédit, contrainte unique sur saspay_transaction_id), verifyPayment auprès de SasPay avant crédit, montant comparé (AMOUNT_MISMATCH) → OK (non rejoué)
- place_order : verrou du portefeuille for update en premier, idempotence (idem_key + user_id) avant tout débit, statut, prix attendu, security definer + search_path vide + revoke → OK (non rejoué en concurrence)
- 2 commandes simultanées > solde : sérialisées par le verrou portefeuille (lecture) → non rejoué

Contrôles demandés
- Jamais de relance auto de provider.add : submitToProvider = une seule tentative, échec = to_review + alerte ; recover-stuck-orders ne rappelle pas add ; renvoi admin = réservation claim_order_resend avant add, sans reprise → OK
- Remboursement auto : aucun remboursement après échec fournisseur. Exception à confirmer : l'annulation par le client (cancel-order.ts) rembourse tout de suite, mais seulement si le fournisseur confirme l'annulation et que rien n'a démarré. Fonction validée en phase 12 ; à signaler au propriétaire car CLAUDE.md « Jamais 4 » dit « toujours après examen ».
- Secrets : recherche de motifs (sk_live/sk_test, JWT, hex 40+, AKIA, jeton Telegram) dans les fichiers suivis : seul résultat = une fausse clé de test dans tests/unit/payments/saspay-client.test.ts. Seul .env.example est suivi par git. gitleaks non installé (CI le lance). Historique : mentions « sk_live_ » uniquement dans des docs/code de contrôle. → OK
- NEXT_PUBLIC_ : seulement URL du site, e-mail de support, URL et clé anon Supabase, clé site Turnstile, DSN Sentry, id GA ; loadServerEnv refuse tout NEXT_PUBLIC_ au nom secret → OK
- Nom du fournisseur côté client : aucune occurrence (jap, justanotherpanel) dans src ; les listes de commandes excluent cost_usd, error, provider_order_id, idem_key ; le mot « fournisseur » n'apparaît que dans les textes admin → OK
- RLS/admin : ADMIN_PATH (8–64 car.) via proxy ; sans ADMIN_PATH tout est refusé ; /admin = 404 ; login admin vérifie le segment ; X-Robots-Tag noindex + no-store ; routes de test refusées si mode ≠ mock ou production, secret en temps constant → OK (RLS non rejouée, Docker arrêté)
- Garde-fous mode réel : PROVIDER_MODE obligatoire en production ; live refusé hors VERCEL_ENV=production ; SASPAY_MODE=live idem ; clé sk_test_/sk_live_ doit correspondre au mode → OK, avec la réserve n°1
- npm audit --audit-level=high : 0 haute, 7 modérées (outils de développement, @typescript-eslint) → OK

Failles
1. [Moyenne] src/server/env.ts:56-94 — rien n'interdit PROVIDER_MODE=mock avec SASPAY_MODE=live — scénario : réglage Vercel oublié au passage au réel, les clients paient en vrai et leurs commandes partent vers le faux fournisseur : « paie et ne reçoit rien » — correction : ajouter une règle superRefine (SASPAY_MODE=live exige PROVIDER_MODE=live, sauf choix explicite) + test ; déjà inscrit dans ROADMAP.md ligne 95 « à vérifier au plus tard en phase 15 » — Responsable : lp-coder
2. [Moyenne] Fermeture de l'inscription (à documenter pour 15.9) — aucun interrupteur dans le code : l'inscription passe par admin.auth.admin.createUser (supabase-deps.ts:67) avec la clé service, donc le réglage Supabase « Allow new users to sign up » ne la bloquerait PAS. La table allowed_signups existe (DATA_MODEL.md) mais n'est pas utilisée. Moyens actuels : retirer la clé Turnstile côté serveur (l'inscription échoue en TURNSTILE_FAILED), ou redéployer sans la route. À proposer au propriétaire (changement à valider, rien codé) : réglage « inscriptions ouvertes/fermées » dans la table settings, lu par registerUser, modifiable depuis l'admin. — Responsable : lp-coder + lp-db, après accord
3. [Basse] src/components/ui/chart.tsx:88 — dangerouslySetInnerHTML (composant shadcn, CSS générée depuis la configuration, pas depuis une saisie) — interdit par CLAUDE.md « Jamais 7 » ; vérifier si le composant est utilisé, sinon le supprimer ; sinon documenter l'exception — Responsable : lp-coder
4. [Basse] src/lib/security-headers.ts — CSP avec script-src 'unsafe-inline' (affaiblit la protection XSS) ; acceptable tant que Next injecte des scripts en ligne ; à durcir plus tard avec des nonces.
5. [Basse] Remboursement à l'annulation client (voir plus haut) : faire confirmer par le propriétaire que ce cas, confirmé par le fournisseur, est conforme à « jamais de remboursement auto ».

Avant 15.6 (obligatoire) : corriger n°1, rejouer avec Docker démarré : npm run test:db (RLS, 2 commandes simultanées, webhook rejoué 2 fois = 1 crédit, 429), régénérer la clé fournisseur, lancer gitleaks en CI sur la PR.
