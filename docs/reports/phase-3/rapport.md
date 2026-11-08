# Rapport — Phase 3 : Comptes
Date : 2026-11-08 · Statut : faite – en attente de validation du propriétaire

## En une phrase
Un client peut maintenant créer un compte, se connecter par email ou par téléphone, se déconnecter et refaire son mot de passe ; la zone privée (tableau de bord) est fermée aux visiteurs non connectés.

## Ce qui a été fait
- **Inscription** : email, téléphone, pays (tous les pays d'Afrique), devise, langue, mot de passe, et vérification anti-robot Cloudflare Turnstile (le vrai widget ; clés de test tant que tu n'as pas créé le tien).
- **Connexion** par email **ou** par téléphone (le numéro sert d'identifiant avec le mot de passe, sans SMS), **déconnexion**, **mot de passe oublié** (email bilingue FR/EN) puis **nouveau mot de passe**.
- **Règles de mot de passe** : 8 à 72 caractères, refus des mots de passe très courants et d'un mot de passe égal à l'email ou au téléphone. Le nouveau mot de passe coupe les autres sessions ouvertes.
- **Blocage progressif des essais** : 3 échecs gratuits, puis pause de 15 min, 30 min, 1 h, 2 h… jusqu'à 24 h au maximum. Compté par identifiant et par adresse IP.
- **Zone privée protégée** : `/fr/tableau-de-bord` et `/en/dashboard` renvoient vers la connexion si on n'est pas connecté.
- **Socle technique** : une seule façon de gérer les routes API (`handler`) et les erreurs (`apiError`), messages d'erreur FR/EN, journaux sans données sensibles, en-têtes de sécurité (CSP, protection contre l'intégration dans un autre site), protection contre les requêtes venues d'un autre site.
- **Écrans** : inscription, connexion, mot de passe oublié, nouveau mot de passe, en FR et EN, sur téléphone (360 px) et ordinateur, au design system de la phase 2. Pages privées cachées de Google.

## Décisions du propriétaire (2026-11-08)
- **Blocage progressif** : 3 échecs, puis 15 min, 30 min, 1 h… plafond 24 h par identifiant.
- **Seuil par adresse IP : 30 échecs** (et non 3). Raison : sur les réseaux mobiles africains, beaucoup de clients partagent la même adresse ; trois fautes de frappe de personnes différentes ne doivent pas bloquer tout le monde.
- **Zone privée protégée** : vérification faite à chaque affichage de la zone.
- **Message « déjà utilisé » conservé** à l'inscription (email ou téléphone déjà pris), avec un **plafond de 10 inscriptions par heure et par IP** pour limiter les essais en série.
- **Pas de confirmation d'email** (je te l'avais conseillée ; risque assumé : faux comptes, et « mot de passe oublié » inutilisable si l'email est faux). À revoir en phase 15 si des abus apparaissent.
- **Pas de SMS** pour l'instant (aucun coût, aucun service SMS).
- **Turnstile réel** dès maintenant (clés de test en attendant ton widget).
- **Pays : tous les pays d'Afrique.** Certains ne pourront pas payer par Mobile Money : message clair prévu à la recharge (phase 5).

## Documents validés modifiés (avec ton accord)
- `SECURITY_NOTES.md §2` (et le tableau des limites) : les 5 échecs / 15 min deviennent « 3 échecs gratuits, puis pause progressive 15 min → 24 h, par identifiant et par IP ; les échecs de plus de 24 h sont oubliés ; un refus ne rallonge pas la pause ».
- `API_SPEC.md §3` : nouveau code d'erreur `FORBIDDEN` (403) pour une requête venue d'un autre site.
- Aucune migration de base de données ajoutée : la table `login_attempts` de la phase 1 suffit.

## Vérifications (résultats réels)
- **Tests unitaires** : 439 passés, dans 54 fichiers.
- **Navigateur (Playwright, parcours comptes)** : 18 sur 18 passés (dernier lancement du contrôle qualité, build de production, 42,9 s).
- **Types (`tsc`)** : 0 erreur. **Build** : OK.
- **Lint** : 0 erreur, 6 avertissements `max-lines` qui ne viennent pas de la phase 3 (5 composants de mouvement de la phase 2 et `types.ts`).
- **Tests de base de données (`test:db`)** : **non relancés dans le dernier état du code**. Le fichier `tests/db/auth-attempts.test.ts` existe, mais je n'ai pas de résultat récent à te donner. À relancer avant la PR.
- **CI GitHub** : pas encore passée sur la PR (la PR n'est pas ouverte dans ce rapport).
- Couverture en pourcentage : non mesurée.
- Contrôles :
  - Sécurité (`lp-security`) : 1re et 2e passes **À CORRIGER**, 3e passe **ACCEPTÉ avec réserves documentées** (voir `securite-comptes.md`).
  - Test navigateur (`lp-qa`) : 1re et 2e passes **À CORRIGER**. La 3e passe a encore listé un problème (session coupée = page d'erreur 500) ; ce rapport ne contient pas de 4e passe QA. Voir « Ce qui reste ».

## Corrections demandées puis faites
- Nouveau mot de passe qui répondait par une erreur 500 alors que le changement avait réussi → corrigé (200 et redirection vers la connexion, vérifié en 3e passe).
- Email de réinitialisation uniquement en français → sujet et texte bilingues FR puis EN.
- Blocage par IP à 3 échecs (risque pour les réseaux partagés) → seuil à 30.
- Boutons trop petits sur téléphone (sélecteur de langue, lien « Log in ») → 0 cible sous 44 px en 3e passe.
- Espace vide au-dessus du message d'erreur → rempli par le widget Turnstile visible.
- Lecture de l'adresse IP falsifiable, blocage non atomique, hachage des identifiants (HMAC avec `AUTH_HASH_SECRET`), en-têtes de sécurité, zone privée → corrigés (détail dans `securite-comptes.md`).

## Fichiers modifiés (grandes lignes)
- Serveur : `src/server/auth/*` (inscription, connexion, mot de passe oublié et nouveau mot de passe, blocage, Turnstile, règles de mot de passe, accès à la zone privée), `src/server/http/*` (`handler`, `apiError`, masquage des journaux), `src/server/db/supabase-*.ts`, `src/server/providers/telegram.ts`.
- Routes : `src/app/api/v1/auth/*`.
- Écrans : `src/app/[locale]/(auth)/*`, `src/components/auth/*`, mise à jour du layout `(app)`.
- Réglages : `src/lib/schemas/auth.ts`, `src/lib/countries.ts`, `src/lib/security-headers.ts`, `src/lib/seo/*`, `src/messages/*` (dont `errors.fr.json`, `errors.en.json`), `next.config.ts`, `supabase/config.toml`, `supabase/templates/` (email), `data/common-passwords.txt`.
- Tests : `tests/unit/auth/`, `tests/unit/http/`, `tests/unit/injection.test.ts`, `tests/db/auth-attempts.test.ts`, `tests/e2e/auth.spec.ts`.
- Documents : `SECURITY_NOTES.md`, `API_SPEC.md`, `ENV_SETUP.md`, `.env.example`.
- Rien n'a été commité par moi (pas de commit dans ce rapport).

## Ce que tu peux tester toi-même
Prérequis : Docker et Supabase local démarrés, puis `npm run dev` (ou le build de production), et ouvrir `http://localhost:3000/fr/inscription`. Tu verras le widget Turnstile de test.
1. **Inscription** : remplis le formulaire avec un mot de passe valide : tu arrives sur le tableau de bord. Essaie « password1 » : refusé car trop courant. Laisse des champs vides : un message clair par champ.
2. **Déconnexion** puis retour direct sur `/fr/tableau-de-bord` : tu es renvoyé vers la connexion.
3. **Connexion par téléphone** : avec le numéro du compte créé et son mot de passe. Puis par email.
4. **Blocage** : fais 3 erreurs de mot de passe sur un même identifiant. La 4e donne « Trop de tentatives. Réessayez dans 15 min. ».
5. **Mot de passe oublié** : demande un lien (l'email arrive dans Mailpit local, `http://127.0.0.1:55324`). Même message que l'email existe ou non. Ouvre le lien, choisis un bon mot de passe, reconnecte-toi avec lui. L'ancien est refusé et le lien ne marche plus une 2e fois.
6. **Anglais** : refais l'inscription et le mot de passe oublié sur `/en/register` et `/en/forgot-password` : textes, messages d'erreur et email en anglais.
7. **Téléphone** : ouvre les mêmes pages sur ton vrai téléphone : pas de défilement de côté, boutons faciles à toucher.
8. **Doublon** : crée un 2e compte avec le même email : le message « déjà utilisé » s'affiche.

## Risques restants
- Un tiers qui connaît un identifiant peut le bloquer 15 min (et plus s'il insiste jusqu'à 24 h). Assumé.
- L'API de connexion de Supabase reste publique avec sa clé publique et contourne notre compteur de blocage : à traiter en phase 15 (captcha Supabase et limites, sur l'hébergé).
- L'adresse IP vient de `cf-connecting-ip` : fiable seulement derrière Cloudflare. À vérifier en phase 15.
- Pas de confirmation d'email, et message « déjà utilisé » qui permet de savoir si un compte existe : assumés.
- Lien de réinitialisation perdu si le nouveau mot de passe est refusé après l'échange du jeton (migration `lp-db` possible si tu le veux).
- `AUTH_HASH_SECRET` à définir sur Vercel (refus de démarrer en production sinon).
- Sur Supabase hébergé : reprendre les mêmes réglages que `config.toml` et copier le gabarit d'email bilingue.
- La CSP garde `unsafe-inline` pour les scripts (un nonce serait possible plus tard).
- Dernier problème QA : après une réinitialisation, un autre appareil resté connecté voit une page d'erreur au lieu d'être renvoyé à la connexion (pas de faille d'accès, expérience cassée). Voir « Ce qui reste ».
- `npm audit` : 8 vulnérabilités moyennes, aucune haute (relevé de la 2e passe sécurité).
- Environnement : le CLI Supabase 3 refuse la section `[inbucket]` de `config.toml` (à remplacer par `[local_smtp]` avec ton accord).

## Ce qui reste / réserves
- **Test base de données non relancé** dans le dernier état : à faire avant la PR.
- **Session coupée = page d'erreur 500** (problème 1 de la 3e passe QA) : corrigé ensuite (test écrit d'abord, 439 tests verts) et vérifié par le développeur sur un build de production avec Supabase local : une session révoquée renvoie vers la page de connexion. Pas de 4e passe QA indépendante.
- Vérifier avec le vrai widget Turnstile que l'espace réservé ne réapparaît pas si le widget est invisible.
- CI GitHub à vérifier sur la PR.

## Ce que tu dois préparer pour la phase suivante
- Créer ton widget Cloudflare Turnstile et mettre les clés dans `.env.local` (jamais dans le dépôt, jamais `NEXT_PUBLIC_` pour la clé secrète).
- Définir `AUTH_HASH_SECRET` (valeur longue et aléatoire) en local, puis sur Vercel avant la mise en ligne.

## Décision attendue : « validé » ou corrections
Seul le propriétaire valide. Tant que tu n'as pas écrit « validé », la phase 3 reste « faite – en attente de validation ».
