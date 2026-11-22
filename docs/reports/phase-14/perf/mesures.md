# Mesures de performance, phase 14 (tâche 14.7)

Build de production (`npm start`, port 3200), Chromium via Playwright.
Mobile : 360x800, CPU x4, 1,6 Mbit/s, 150 ms. Ordinateur : 1366x768, sans limitation.
Poids = octets transférés (compressés), serveur local.

| Page | Profil | LCP | FCP | CLS | TBT approx. | Poids | Requêtes | `load` |
|---|---|---|---|---|---|---|---|---|
| /fr | mobile | 1,56 s | 1,48 s | 0 | 1 613 ms | 661 Ko | 49 | 4,3 s |
| /en | mobile | 1,60 s | 1,57 s | 0 | 1 211 ms | 658 Ko | 50 | 4,1 s |
| /fr/faq | mobile | 1,20 s | 1,20 s | 0 | 663 ms | 381 Ko | 29 | 2,8 s |
| /fr/contact | mobile | 1,27 s | 1,27 s | 0 | 1 075 ms | 391 Ko | 35 | 3,2 s |
| /fr/login | mobile | 1,58 s | 1,58 s | 0 | 1 103 ms | 408 Ko | 30 | 3,4 s |
| /fr | ordinateur | 0,43 s | 0,20 s | 0 | 90 ms | 768 Ko | 55 | 0,4 s |
| /en | ordinateur | 0,15 s | 0,15 s | 0 | 23 ms | 765 Ko | 55 | 0,3 s |
| /fr/faq | ordinateur | 0,13 s | 0,13 s | 0 | 0 | 389 Ko | 33 | 0,2 s |
| /fr/contact | ordinateur | 0,12 s | 0,12 s | 0 | 0 | 399 Ko | 40 | 0,2 s |
| /fr/login | ordinateur | 0,09 s | 0,09 s | 0 | 35 ms | 408 Ko | 30 | 0,2 s |

Aucune erreur console, aucune requête 4xx/5xx, aucun débordement horizontal.

## Accueil mobile /fr, détail
- Répartition : JS 336 Ko, images 219 Ko, CSS 27 Ko, polices 26 Ko, document 27 Ko.
- Plus lourds : chunk JS 121 Ko, chunk JS 46 Ko, photo du héros 36 Ko (webp, w=750), chunk JS 29 Ko.
- Élément LCP : la photo du héros `femme-tresses-4x5.webp`, servie par `next/image` à 750 px. `priority: true` dans `src/components/home/hero.tsx`, pas de `loading="lazy"` (bon). Dimensions fixes 1594x2000 (CLS 0).
- Polices : Public Sans (400/600/700) en `font-display: swap`, 3 fichiers chargés. Atkinson Hyperlegible et IBM Plex Mono déclarées mais non chargées sur l'accueil.
- Image `fond-points-16x9.webp` : lazy, sans width/height, demandée à w=3840 (non chargée au moment de la mesure ; à surveiller au défilement).
- Logos de paiement : `loading="eager"` sur 7 images de 96 px (petit poids, mais inutile hors écran).

## Comparaison avec le constat précédent
Avant : `load` ~13 s à 200 Ko/s, CPU x4. Maintenant : 4,1 à 4,3 s à 1,6 Mbit/s (200 Ko/s). Réseau équivalent ou un peu plus lent que précédemment selon la mesure, gain net : environ x3. Poids accueil 661 Ko, sous l'objectif de 1,2 Mo.

## Objectifs
- LCP < 2,5 s : atteint (1,6 s).
- CLS < 0,1 : atteint (0).
- Poids accueil < 1,2 Mo : atteint (661 Ko).
- TBT < 200 ms en mobile : NON atteint (0,66 à 1,6 s sur toutes les pages, y compris FAQ/login).

## Dépassement TBT : cause et correction
Cause probable : le JavaScript est l'essentiel du poids (273 à 336 Ko selon la page, dont un chunk de 121 Ko, probablement le runtime React/Next et les bibliothèques d'animation) ; avec CPU x4, l'hydratation et l'exécution de GSAP/Lenis créent des tâches longues (9 sur l'accueil). La FAQ, qui n'a presque pas d'animation, a déjà 663 ms : une grande part vient du socle commun (layout, hydratation), pas seulement de l'accueil.
Corrections à examiner (sans les appliquer ici) :
1. Charger GSAP et Lenis en différé (`next/dynamic` avec `ssr: false`, ou `import()` après `requestIdleCallback`) dans le composant d'animation / de défilement lissé du layout public ; ne pas les charger sur FAQ, contact et login.
2. Identifier le chunk de 121 Ko (`.next/static/chunks/3x06hyv-_eju3.js`) avec `@next/bundle-analyzer` (ou l'option `--analyze` de Next), puis retirer ou remplacer la bibliothèque coupable.
3. Passer au serveur (composants serveur) les parties sans interaction (FAQ, textes) pour réduire l'hydratation.
4. Vérifier `src/app/layout.tsx` : Atkinson Hyperlegible et IBM Plex Mono sont déclarées sur toutes les pages ; limiter `preload`/poids aux pages qui les utilisent.

Remarque : le TBT est approximé par les tâches longues après le FCP, avec CPU x4 sur une machine de développement ; Lighthouse n'a pas été lancé (non demandé). Le TBT réel d'un petit Android est à confirmer sur Preview.

## Petites améliorations (non bloquantes)
- `src/components/home/payments.tsx` ligne 39 : retirer `loading="eager"` (lazy par défaut).
- Image `fond-points-16x9` : ajouter `sizes` (ex. `100vw`) et des dimensions, pour éviter la demande à 3840 px.

Captures : `accueil-mobile.png`, `accueil-desktop.png`.

## Verdict : A AMELIORER
LCP, CLS et poids sont bons. Seul le TBT mobile dépasse l'objectif.

## Après optimisation (tâche 14.7)
Changements : GSAP/ScrollTrigger chargés après le premier rendu (`requestIdleCallback`, repli `setTimeout`, échec ignoré : contenu visible par défaut) ; cascade du héros retirée (le héros reste visible dès le départ, bon pour le LCP et évite un clignotement avec un chargement différé) ; `loading="eager"` retiré des 7 logos de paiement. Déjà en place, rien à faire : `fond-points-16x9` a `fill` + `sizes="100vw"` ; Atkinson et IBM Plex Mono ont `preload: false` et ne se chargent pas sur le site public. Lenis n'est pas utilisé. GSAP n'est importé que dans l'accueil (FAQ, contact, login n'en chargent pas).

Mobile émulé /fr (CPU x4, 1,6 Mbit/s), 3 passages : 
| | Avant | Après |
|---|---|---|
| TBT | 1 613 ms | 1 214 à 1 270 ms |
| LCP | 1,56 s | 1,68 à 1,75 s (bruit de mesure) |
| CLS | 0 | 0 |
| JS transféré | 336 Ko | 322 Ko |
| Poids total | 661 Ko | 532 Ko |

Le chunk de 121 Ko (372 Ko décompressé) est react-dom : incompressible. Avec mouvement réduit (sans GSAP), le TBT tombe à 650-810 ms : le plancher restant est l'hydratation (tâche de 650-750 ms à 2,5 s), commune à toutes les pages. L'objectif TBT < 200 ms n'est pas atteint ; il faudrait réduire l'hydratation (composants serveur pour les sections statiques de l'accueil), hors périmètre de cette tâche. À confirmer sur Preview avec un vrai téléphone.
