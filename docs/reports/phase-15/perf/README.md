# Tâche 15.3 — Mesure de performance de l'accueil

Outil : Lighthouse 13.6.0 officiel (`npx lighthouse`, hors dépendances, `package.json` inchangé).
Cible : build de production local (`npm run build` puis `npm start`, `PROVIDER_MODE=mock`, aucune vraie clé), `http://localhost:3100/fr` et `/en`.
Profils : mobile (émulation Lighthouse par défaut : 412 px, réseau 4G lent, processeur ralenti x4) et bureau (préréglage desktop). Une seule passe par page : les valeurs varient d'une passe à l'autre.
Fichiers : `lh-<langue>-<profil>.report.json` et `.report.html`.

| Page | Profil | Perf. | LCP | TBT | CLS | Accessibilité | Bonnes prat. | SEO |
|---|---|---|---|---|---|---|---|---|
| /fr | mobile | 76 | 4,3 s | 390 ms | 0 | 100 | 100 | 61 |
| /en | mobile | 91 | 2,7 s | 260 ms | 0 | 100 | 100 | 61 |
| /fr | bureau | 99 | 1,0 s | 20 ms | 0 | 100 | 100 | 61 |
| /en | bureau | 98 | 1,1 s | 60 ms | 0 | 100 | 100 | 61 |

## Lecture
- Objectif du plan 14 : TBT < 200 ms en mobile. **Non atteint** : 390 ms (FR) et 260 ms (EN). C'est mieux que les ~1,2 s de Playwright de la phase 14 (autre méthode, non comparable). Bureau : atteint.
- Écart FR/EN important (76 contre 91) : une seule passe, bruit probable sur le LCP (4,3 s contre 2,7 s). À refaire plusieurs fois avant de conclure.
- CLS 0, accessibilité 100, bonnes pratiques 100 partout.
- SEO 61 : dû à `is-crawlable` et `canonical`. Le `noindex` est voulu tant que le domaine n'est pas branché (plan phase 14) ; à remesurer en ligne.
- Autres pistes Lighthouse sur mobile : JavaScript inutilisé, temps de démarrage JS (`bootup-time`), `label-content-name-mismatch` (bureau : nom accessible d'un lien/bouton différent de son texte visible, mineur).

## Ce qui n'a PAS été fait
- **Mesure sur le vrai site lyonpanel.com : non faite** (le domaine n'est pas encore branché, noindex). Le propriétaire peut lancer : `npx lighthouse https://lyonpanel.com/fr --output=html --view` (et `/en`), ou PageSpeed Insights.
- **Mesure sur un vrai Android : non faite** (le plan 15.3 la prévoit).
- Machine de développement, pas un serveur Vercel : pas de CDN, donc les chiffres de réseau sont indicatifs.

## Proposition (non appliquée, décision du propriétaire)
Le TBT mobile dépasse l'objectif. Piste : passer les sections statiques de l'accueil (textes, FAQ, étapes) en composants serveur et ne garder en composants client que les parties animées (GSAP) ou interactives, pour réduire l'hydratation de React. Aucun code modifié. Conseil : d'abord confirmer le chiffre sur le vrai site et sur un Android (3 passes), puis décider.
