VERDICT : À CORRIGER (2e passe)
Tâche : 3 — Comptes (inscription, connexion, déconnexion, mot de passe oublié, zone privée)
Environnement : local, build de production (`next start`, port 3210), faux JAP, SasPay test, Turnstile clés de test, Supabase local relancé, Chromium (Playwright). Captures : docs/reports/phase-3/qa2/ (m- = téléphone 360 px réseau 1,6 Mbit/s 150 ms CPU x4, d- = ordinateur 1366 px).

Environnement (important)
- Docker disponible. `npx supabase` (CLI 3.0.0) refuse de démarrer avec le config.toml du dépôt : « [inbucket] in supabase/config.toml is no longer supported. Use [local_smtp] instead. » (la section existait déjà avant la phase 3). Contournement sans toucher au dépôt : copie du dossier supabase dans le dossier temporaire avec `[inbucket]` renommé `[local_smtp]`, puis `stop` + `start`. Les migrations n'ont pas été touchées.
- Ports 3190 et 3197 étaient déjà occupés par d'autres processus (le premier test a répondu avec une ancienne version : ignoré). Test final sur 3210.
- Gabarit email et enable_signup=false bien chargés (POST /auth/v1/signup direct → 422 signup_disabled).

Parcours testés
- [téléphone + ordinateur, FR + EN] zone privée déconnecté : /fr/tableau-de-bord → /fr/connexion, /en/dashboard → /en/login ; accueil, connexion, inscription restent ouverts (200) → OK
- inscription (champs vides : 5 messages clairs ; mot de passe « password1 » refusé « trop courant » ; mot de passe valide → tableau de bord) → OK
- déconnexion puis retour direct sur le tableau de bord → redirigé vers connexion → OK
- connexion par téléphone, par email, rechargement de page → OK
- blocage : 3 échecs « Identifiant ou mot de passe incorrect. », 4e = « Trop de tentatives. Réessayez dans 15 min. » (FR) / « Please try again in 15 min. » (EN) ; passage au palier suivant vérifié en API (après 16 min simulées : « 30 min ») → OK
- mot de passe oublié : même message pour compte connu ou non ; email reçu dans Mailpit local ; lien ouvert → page dans la bonne langue (/fr/nouveau-mot-de-passe, /en/reset-password) ; mot de passe « password1 » refusé et lien conservé → OK
- **choix d'un bon nouveau mot de passe → KO** (voir problème 1)
- `npx playwright test tests/e2e/auth.spec.ts` (config temporaire sur le port 3210, la config du dépôt vise le port 3000) : **18 passés / 18**.

Mesures : erreurs console : seulement les 400/401/429 provoqués volontairement + avertissements du faux widget Turnstile (postMessage / « Cannot find Widget ») ; aucune violation CSP ; requêtes 5xx : 1 (problème 1) ; débordement horizontal 360 px : non (0 sur toutes les pages) ; cibles < 44 px : 2 par page (boutons FR 42x44 du sélecteur de langue) + lien « Log in » 40x44 sur /en/register ; chargement téléphone lent (build prod) : ~0,5 à 0,75 s par page (1,9 s une fois) ; en-têtes : CSP stricte en prod (pas d'unsafe-eval, connect-src limité à self + Supabase), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy présents ; aucune clé brute, image sans alt ou champ sans libellé.

Problèmes
1. [Bloquant] Nouveau mot de passe (/fr/nouveau-mot-de-passe, /en/reset-password) — avec un mot de passe valide, POST /api/v1/auth/password/reset répond 500 « Une erreur inattendue… » (journal serveur : `AuthSessionMissingError: Auth session missing!`, venant de `signOutAll` → `admin.auth.admin.signOut(accessToken,'global')` dans src/server/auth/supabase-deps.ts). Le mot de passe est bien changé (la reconnexion avec le nouveau marche, l'ancien est refusé) et le lien est consommé, mais le client voit une erreur, et le lien rejoué dit « invalide ou expiré ». Attendu : succès et message/redirection vers la connexion ; la fermeture des sessions ne doit pas faire échouer l'opération (ou doit se faire avant la consommation/avec une session valide). Reproduit 4 fois sur 4 (FR/EN, téléphone/ordinateur). Captures : qa2/m-fr-reset-ok.png, d-en-reset-ok.png — Responsable : lp-coder
2. [Important] Email de réinitialisation — le gabarit est en français même pour un client EN (sujet « Réinitialisez votre mot de passe LyonPanel », texte « Pour choisir un nouveau mot de passe… »), seul le texte du lien est en anglais (« Choose a new password »). Le lien, lui, pointe bien vers /en/reset-password. Attendu : sujet et texte en anglais pour EN. (Le sujet est fixe dans config.toml : prévoir un sujet bilingue ou le gérer côté envoi.) — Responsable : lp-coder
3. [Important] Blocage par adresse IP — la pause s'applique aussi par IP : 3 échecs sur des identifiants quelconques depuis une même IP bloquent 15 min la connexion d'un compte légitime venant de cette IP (testé avec l'en-tête cf-connecting-ip : bon compte → « Réessayez dans 15 min »). Les opérateurs mobiles africains partagent souvent une IP (NAT) : risque de bloquer de vrais clients. À arbitrer par le propriétaire (seuil IP plus haut que le seuil par identifiant). — Responsable : lp-coder (décision propriétaire)
4. [Mineur] Cibles tactiles — boutons FR/EN du sélecteur de langue 42x44 et 44x44 (FR trop étroit) ; lien « Log in » 40 px de haut sur /en/register. Attendu ≥ 44 px. — Responsable : lp-designer
5. [Mineur] Formulaire de connexion/inscription — grand espace vide au-dessus du message d'erreur (emplacement du widget Turnstile réservé), visible sur qa2/m-en-echec-4.png. — Responsable : lp-designer
6. [Mineur, outillage] playwright.config.ts fixe le port 3000 ; `supabase` CLI 3.0 refuse `[inbucket]` dans config.toml (à remplacer par `[local_smtp]`, document ENV_SETUP.md). — Responsable : lp-coder

Remarques : les messages 400/401/429 en console sont normaux (erreurs provoquées). Le test du blocage n'a pas pu vérifier la remise à zéro après 24 h (non attendu). Table login_attempts : j'ai décalé des lignes de test de 40 min dans la base locale pour tester le palier suivant (données de test locales uniquement). Serveur arrêté ; Supabase local laissé démarré.
Captures : docs/reports/phase-3/qa2/

---

VERDICT : À CORRIGER (3e passe)
Environnement : local, build de production (`next start`, port 3230), Supabase local relancé (stop puis start) avec le nouveau gabarit recovery.html (chargé sans erreur), Turnstile clés de test, Chromium. Captures : docs/reports/phase-3/qa3/. Le CLI Supabase 3 refuse toujours `[inbucket]` (« use [local_smtp] ») : contournement par copie temporaire du dossier supabase hors dépôt, `[inbucket]` renommé. Port 3190 occupé, donc 3230.

Résultats des 5 points
1. Mot de passe oublié de bout en bout (FR ordinateur, EN téléphone) : OK, sauf un point.
   - Email : sujet bilingue « Réinitialisez votre mot de passe LyonPanel / Reset your LyonPanel password », corps FR puis EN, lisible (capture qa3/dfr-email.png, simple mais propre). Lien FR vers /fr/nouveau-mot-de-passe, lien EN vers /en/reset-password : OK. En local le lien pointe vers 127.0.0.1:3000 (site_url de config.toml) : normal en local.
   - Bon nouveau mot de passe : POST /password/reset → 200 (plus de 500), redirection vers connexion?reset=1 avec « Mot de passe modifié. Vous pouvez vous connecter. » / « Password changed. You can now log in. » : OK.
   - Connexion avec le nouveau mot de passe : OK. Ancien mot de passe : refusé (« Incorrect identifier or password. ») : OK. Lien rejoué : « Ce lien est invalide ou a expiré. Demandez-en un nouveau. » : OK.
   - Autre session ouverte avant : bien coupée (le jeton ancien est rejeté par Supabase, accès refusé), MAIS voir problème 1.
2. Cibles tactiles 360 px : 0 cible < 44 px sur connexion, inscription, mot de passe oublié, nouveau mot de passe (FR et EN), y compris bouton FR et lien « Log in » : OK (corrigé).
3. Espace vide au-dessus de l'erreur : l'espace est désormais occupé par le widget Turnstile visible (qa3/m-en-erreur-login.png), plus de trou. À recontrôler avec la vraie clé Turnstile (si le widget est invisible en production, l'espace réservé pourrait réapparaître).
4. Blocage : 3 échecs « Identifiant ou mot de passe incorrect. », 4e et 5e « Trop de tentatives. Réessayez dans 15 min. » : OK (qa3/m-fr-blocage.png). Seuil par IP (30) non testé ici, couvert par le test unitaire.
5. `PLAYWRIGHT_PORT=3230 npx playwright test tests/e2e/auth.spec.ts` : 18 passés / 18 (42,9 s).

Mesures : erreurs console hors erreurs provoquées : 0 ; requêtes 5xx sur les parcours : 0 sauf problème 1 ; débordement horizontal : non ; cibles < 44 px : 0 ; chargement téléphone : < 1 s par page.

Problèmes
1. [Important] Session révoquée (cas : autre appareil encore connecté après une réinitialisation, ou session coupée) — recharger /fr/tableau-de-bord avec l'ancienne session répond 500 et affiche « Un problème est survenu. Réessayez dans un instant. » au lieu de rediriger vers la connexion. « Réessayer » ne sert à rien tant que le cookie n'est pas supprimé. Journal serveur : « Cookies can only be modified in a Server Action or Route Handler » (le rafraîchissement du jeton échoue, Supabase tente d'effacer le cookie pendant le rendu d'une page). Attendu : redirection vers /fr/connexion (et nettoyage du cookie par le proxy/middleware ou un try/catch dans createSessionClient). L'accès aux données reste bien refusé (pas de faille), mais l'expérience du client est cassée. Capture : qa3/dfr-ancienne-session.png — Responsable : lp-coder
2. [Mineur] Playwright : `playwright.config.ts` lance `npm run dev` si le port n'a pas de serveur ; OK avec PLAYWRIGHT_PORT. Rien à faire.
3. [Mineur, rappel] Le CLI Supabase 3 refuse `[inbucket]` dans config.toml : à remplacer par `[local_smtp]` (ENV_SETUP.md) quand le propriétaire l'accepte. Environnement de test : AUTH/SASPAY exigent SASPAY_API_KEY commençant par sk_test_ en mode test (c'est voulu).
Rappel ouvert (décision propriétaire, passe 2) : blocage par IP maintenant à 30 échecs (seuil relevé), considéré traité.

Serveur arrêté ; Supabase local laissé démarré. Captures : docs/reports/phase-3/qa3/
