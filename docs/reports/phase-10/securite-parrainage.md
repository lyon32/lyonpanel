VERDICT : ACCEPTÉ
Tâche : 10.5 — Sécurité du parrainage (phase 10)
Surface examinée : route GET /api/v1/referral ; fonction SQL credit_payment (bonus, version 20261107160000) ; tables profiles (referred_by), referral_rewards, wallets, payments ; trigger handle_new_user (metadata referral) ; src/server/referral/referral.ts, pricing/*, wallet.ts, page referral, copy-button ; migration 20261116100000_referral_no_self.sql ; secrets : NEXT_PUBLIC_SITE_URL seulement (public par nature).

Essais d'attaque (base locale 55321, sessions authentifiées réelles via lien magique, faux paiements) :
  - Client B modifie son referred_by (changer de parrain) → refus / obtenu 42501 permission denied (seule la colonne language est modifiable) → OK
  - Client C se rattache lui-même à A après coup → refus / obtenu 42501 → OK
  - Boucle : A met referred_by = B (B parraine déjà A) → refus / obtenu 42501 → OK
  - Auto-parrainage par le client service (update referred_by = id) → refus / obtenu violation de profiles_no_self_referral → OK
  - Client modifie custom_discount_pct → refus / obtenu 42501 → OK
  - Parrain A lit les profils de ses filleuls (id, email, téléphone), directement ou filtré par referred_by → 0 ligne / obtenu [] et [] → OK
  - Lecture referral_rewards : anon → 42501 ; connecté non admin → 0 ligne ([]) → OK
  - Insertion directe dans referral_rewards par un client → refus / obtenu 42501 → OK
  - Appel RPC credit_payment par un client connecté → refus / obtenu "permission denied for function" → OK
  - Inscription avec referral = "' or 1=1 --" → pas de parrain / obtenu referred_by null (requête paramétrée) → OK
  - Inscription avec un code inconnu → ignoré / obtenu referred_by null, compte créé → OK
  - Bonus après recharge échouée (status failed) → 0 bonus / obtenu 0 ligne referral_rewards → OK
  - Concurrence : 2 appels credit_payment simultanés sur le même paiement + 1 autre paiement du même filleul → un seul bonus / obtenu [credited true bonus 500, credited false bonus 0, credited true bonus 0], 1 seule ligne referral_rewards (500), solde parrain 500 → OK
  - Double webhook (même paiement rejoué) → pas de second crédit / obtenu credited false → OK
  - Bonus à la 2e recharge → 0 / obtenu 0 (referee_id unique) → OK
  - Tests existants : tests/db/referral-bonus, referral-routes, referral-discount (21 tests) → passent.
  - Fuite via GET /api/v1/referral : lecture du code (non lancé en HTTP) : requireApiUser, filtre sur l'id de session, ne renvoie que code, lien, nombre de filleuls, total gagné, pct ; aucun id/email/téléphone ; cache-control private, no-store → OK
  - Remise recalculée côté serveur : resolveDiscountPct reçoit total_recharged (base) et custom_discount_pct (non modifiable par le client) ; aucun paramètre du navigateur → OK
  - ?ref= : lu côté client, tronqué à 32 caractères, mis dans un champ texte (React échappe), envoyé en métadonnée puis comparé en SQL à referral_code ; pas de dangerouslySetInnerHTML → OK
  - Lien : construit avec NEXT_PUBLIC_SITE_URL (valeur publique, encodeURIComponent sur le code) ; aucune donnée secrète → OK

Recherche de secrets : motifs (sk_live_, sk_test_, service_role, Bearer, JWT eyJ, hex 40+) sur git diff origin/main...HEAD → 0 résultat. gitleaks non utilisé.
npm audit --audit-level=high : 0 haute ; 7 vulnérabilités moyennes (hors périmètre de la tâche).

Failles :
  1. [Basse] src/server/referral/referral.ts:14 — le lien force /fr/inscription quelle que soit la langue du parrain — impact : filleul anglophone arrive sur la page FR (aucun risque d'exploitation) — correction : utiliser la langue du profil — Responsable : lp-coder
  2. [Basse] src/server/referral/referral.ts:~47 — repli silencieux sur http://localhost:3000 si NEXT_PUBLIC_SITE_URL est absent : en production le lien partagé serait faux — correction : refuser/avertir en production (env.ts) — Responsable : lp-coder
  3. [Basse] credit_payment (20261107160000:266-269) — referral_pct lu dans settings sans plafond SQL : une valeur > 100 donnerait un bonus supérieur à la recharge. Réglage réservé à l'admin (aucune route client n'y écrit) — correction : check 0..100 à l'écriture du réglage (phase admin) — Responsable : lp-db
  4. [Basse, économique] Un client peut créer un second compte, le parrainer par son propre code et y faire une recharge minimale : il gagne 5 % de bonus sur de l'argent réellement payé (coût pour le propriétaire = 5 % du montant, couvert par la marge si elle dépasse 5 %). Pas de faille technique ; à surveiller (même IP, même téléphone) — décision propriétaire.

Aucune faille Critique, Haute ou Moyenne. Les points 1 à 3 sont facultatifs avant mise en ligne.
