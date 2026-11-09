// Aides d'animation des pages de compte (anime.js chargé à la demande).

// Retire les styles posés par l'animation : le CSS reprend la main.
export function clean(items: HTMLElement[]) {
  for (const el of items) {
    el.style.removeProperty('transform');
    el.style.removeProperty('opacity');
  }
}

// Vrai dès qu'anime.js est chargé. Sinon (réseau lent), on change d'écran sans animation
// plutôt que de laisser l'ancien écran attendre la bibliothèque.
let animeReady = false;
export const isAnimeReady = () => animeReady;
export function preloadAnime() {
  void import('animejs').then(() => {
    animeReady = true;
  });
}

export type Anim = { revert: () => unknown };

// anime.js n'est chargé que sur les pages de compte, au premier besoin.
// Renvoie la fonction d'annulation (à appeler au nettoyage de l'effet) : elle arrête
// l'animation, retire les styles posés, et empêche tout lancement après un import tardif.
export function run(
  items: HTMLElement[],
  build: (lib: typeof import('animejs')) => Anim[],
): () => void {
  let cancelled = false;
  let anims: Anim[] = [];
  import('animejs')
    .then((lib) => {
      if (!cancelled) anims = build(lib);
    })
    .catch(() => clean(items));
  return () => {
    cancelled = true;
    for (const anim of anims) anim.revert();
    clean(items);
  };
}
