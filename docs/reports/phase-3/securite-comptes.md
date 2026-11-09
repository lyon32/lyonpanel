VERDICT : À CORRIGER (2e passe, audit de code ; le serveur 3190 sert des pages d'erreur sans CSP, donc non fiable pour les essais)

Tâche : 3 — Comptes

| # | Faille | Corrigée ? | Remarque |
|---|---|---|---|
| 1 | API Supabase publique (inscription, longueur, changement de mot de passe) | Partiellement | enable_signup=false, longueur 8, secure_password_change=true : OK. RESTE : `/auth/v1/token?grant_type=password` reste ouvert avec la clé anon publique : le blocage progressif est contournable en frappant Supabase directement (seule limite : 30 / 5 min / IP). Captcha Supabase commenté. Moyenne-Haute |
| 2 | IP falsifiable | Partiellement | x-forwarded-for ignoré, mais `cf-connecting-ip` est lu en premier : sur l'adresse *.vercel.app (hors Cloudflare) un attaquant l'écrit lui-même et change d'IP à chaque requête. Moyenne |
| 3 | Non-atomicité du blocage | Oui (en grande partie) | Enregistrement avant comptage. Résidu : `discard` des refus fait baisser le compte vu par les requêtes parallèles suivantes, donc une rafale peut laisser passer plus de 3 essais. Basse |
| 4 | Confirmation email/téléphone | Assumé (décision propriétaire) | |
| 5 | Énumération à l'inscription | Assumé + plafond 10/h/IP | Plafond sauté si IP = unknown. Basse |
| 6 | Plafond forgot + temps | Oui | 5/h/IP et 5/h/email, envoi non attendu (after). Note : un tiers peut épuiser le quota d'un email (déni de réinitialisation), Basse |
| 7 | NOT_ADMIN -> FORBIDDEN | Hors périmètre phase 3 (pas de route admin) | À revérifier phase 10 |
| 8 | Hash salé / HMAC | Oui | HMAC-SHA256 avec AUTH_HASH_SECRET, refus en production si absent |
| 9 | Jeton brûlé par un mot de passe refusé | NON | `peekRecoveryToken` appelle verifyOtp, qui consomme le jeton. Après un refus (courant, déjà utilisé), le lien est mort. Le commentaire du code est faux. Moyenne (utilisabilité) |
| 10 | En-têtes de sécurité | Oui dans le code | CSP, nosniff, X-Frame-Options, HSTS prod. `unsafe-inline` (script) accepté faute de nonce, mais affaiblit la protection XSS ; contrepartie : pas de dangerouslySetInnerHTML (aucun trouvé), origines fermées, object-src none. |
| 11 | Zone (app) non protégée | Oui | requireUser (getUser) dans le layout (app). Attention : un layout ne protège pas les routes API ni les actions serveur futures, chacune devra appeler requireUser. |

Nouvelles failles
- N1 [Haute, disponibilité] Blocage par IP identique à celui par identifiant (3 échecs). Derrière le CGNAT des opérateurs africains, des dizaines de clients partagent une IP : trois fautes de frappe de personnes différentes bloquent tout le monde 15 min, puis 30 min, 1 h... jusqu'à 24 h. Correction : seuil IP bien plus haut (ex. 20-30 échecs) avec la même progression. Responsable : lp-coder
- N2 [Moyenne] Déni de service ciblé : 4 requêtes avec l'email d'une victime la bloquent 15 min, et un attaquant qui revient à l'échéance monte à 24 h. Atténuer : Turnstile déjà présent ; envisager l'envoi d'un email d'alerte ou un déblocage par réinitialisation de mot de passe. Décision propriétaire.
- N3 [Basse] Email et téléphone d'un même compte sont deux compteurs : 3 essais gratuits de plus. L'IP limite quand même.
- N4 [Basse] Route reset sans plafond propre (jeton à forte entropie, risque faible).
- N5 [Info] npm audit : 8 vulnérabilités moyennes, aucune haute.

Priorités avant ACCEPTÉ : N1, #9 (peek qui consomme), #2 (ordre des en-têtes d'IP : préférer x-real-ip / x-vercel-forwarded-for sur Vercel), #1 (activer le captcha Supabase Turnstile dans config.toml, ou documenter le risque et décision du propriétaire).

---

VERDICT : ACCEPTÉ avec réserves documentées (3e passe)

Le tableau et les failles de la 2e passe ci-dessus sont conservés comme historique. Les points « priorités avant ACCEPTÉ » ont été traités : blocage par IP relevé à 30 échecs (N1, décision du propriétaire du 2026-11-08), zone privée protégée, hachage HMAC, en-têtes de sécurité, message « déjà utilisé » conservé avec plafond de 10 inscriptions par heure et par IP. Les points restants sont des réserves connues, pas des blocages de la phase 3.

Réserves documentées
1. API Supabase `/auth/v1/token` publique avec la clé anon : elle contourne notre compteur de blocage. À traiter en phase 15 (captcha Supabase et limites, sur l'hébergé).
2. `cf-connecting-ip` n'est sûr que derrière Cloudflare. À vérifier en phase 15 (sur une adresse *.vercel.app, l'en-tête est falsifiable).
3. Pas de confirmation d'email : assumé (décision du propriétaire).
4. Message « déjà utilisé » (énumération des comptes) : assumé, avec plafond de 10 inscriptions par heure et par IP.
5. Un tiers qui connaît un identifiant peut le bloquer 15 min (jusqu'à 24 h s'il insiste) : assumé.
6. Lien de réinitialisation perdu si le nouveau mot de passe est refusé après l'échange du jeton (`peekRecoveryToken` consomme le jeton) : à corriger par une migration `lp-db` si le propriétaire le veut.
7. `AUTH_HASH_SECRET` à définir sur Vercel (le code refuse de démarrer en production sans lui).
8. Supabase hébergé : reprendre les mêmes réglages que `config.toml` (inscription directe désactivée, longueur 8, changement de mot de passe sécurisé) et copier le gabarit d'email bilingue.
9. La CSP garde `unsafe-inline` pour les scripts : un nonce est possible plus tard.
10. `NOT_ADMIN` / `FORBIDDEN` : à revérifier en phase 10 (aucune route admin en phase 3). Chaque future route API et action serveur devra appeler `requireUser` : le layout ne les protège pas.
