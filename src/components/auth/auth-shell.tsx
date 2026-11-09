'use client';

import { useTranslations } from 'next-intl';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { AuthLanguageSwitcher } from './auth-language-switcher';
import { Logo } from '@/components/shared/logo';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type Mode = 'login' | 'register' | 'recover';

// Où mène le bouton de bascule depuis chaque page.
const SWITCH = {
  login: { href: '/register', mode: 'register' },
  register: { href: '/login', mode: 'login' },
  recover: { href: '/login', mode: 'login' },
} as const;

function modeOf(pathname: string): Mode {
  if (pathname.startsWith('/register')) return 'register';
  if (pathname.startsWith('/login')) return 'login';
  return 'recover';
}

const DESKTOP = '(min-width: 1024px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
// Départ rapide, arrivée douce : le panneau ne « claque » pas.
const SLIDE_MS = 720;
const SLIDE_EASE = 'inOutQuart';

// Retire les styles posés par l'animation : le CSS reprend la main.
function clean(items: HTMLElement[]) {
  for (const el of items) {
    el.style.removeProperty('transform');
    el.style.removeProperty('opacity');
  }
}

type Anim = { revert: () => unknown };

// anime.js n'est chargé que sur les pages de compte, au premier besoin.
// Renvoie la fonction d'annulation (à appeler au nettoyage de l'effet) : elle arrête
// l'animation, retire les styles posés, et empêche tout lancement après un import tardif.
function run(items: HTMLElement[], build: (lib: typeof import('animejs')) => Anim[]): () => void {
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

// Carte des pages de compte, gardée entre connexion et inscription.
// Ordinateur : formulaire blanc + panneau de verre qui glisse de l'autre côté.
// Téléphone : bande bleue en haut, feuille blanche qui monte par-dessus.
export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  const pathname = usePathname();
  const routeMode = modeOf(pathname);
  // Bascule « optimiste » : le panneau part dès le clic, sans attendre la nouvelle page.
  const [optimistic, setOptimistic] = useState<{ mode: Mode; from: string } | null>(null);
  // La bascule ne vaut que pour la page d'où l'on part : on l'oublie dès que l'adresse change.
  if (optimistic && optimistic.from !== pathname) setOptimistic(null);
  const mode = optimistic && optimistic.from === pathname ? optimistic.mode : routeMode;
  const side = mode === 'register' ? 'left' : 'right';

  const panelRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const panelTextRef = useRef<HTMLDivElement>(null);
  const previous = useRef({ side, mode, pathname });
  const focusAfter = useRef(false);

  // Charge anime.js à l'avance pour que la première bascule soit immédiate.
  useEffect(() => {
    void import('animejs');
  }, []);

  // 1. Le panneau et le formulaire changent de côté.
  useLayoutEffect(() => {
    const before = previous.current.side;
    previous.current.side = side;
    if (before === side) return;
    const panel = panelRef.current;
    const pane = paneRef.current;
    if (!panel || !pane) return;
    if (!window.matchMedia(DESKTOP).matches || window.matchMedia(REDUCED).matches) return;
    const toLeft = side === 'left';
    const panelFrom = toLeft ? '150%' : '-150%';
    const paneFrom = toLeft ? '-66.6667%' : '66.6667%';
    // Avant le premier affichage : on garde l'ancienne position le temps de charger anime.js.
    panel.style.transform = `translateX(${panelFrom})`;
    pane.style.transform = `translateX(${paneFrom})`;
    const items = [panel, pane];
    return run(items, ({ animate }) => {
      const common = { duration: SLIDE_MS, ease: SLIDE_EASE, onComplete: () => clean(items) };
      return [
        animate(panel, { translateX: [panelFrom, '0%'], ...common }),
        animate(pane, { translateX: [paneFrom, '0%'], ...common }),
      ];
    });
  }, [side]);

  // 2. Le texte du panneau change : fondu et léger décalage entre les lignes.
  useLayoutEffect(() => {
    const before = previous.current.mode;
    previous.current.mode = mode;
    if (before === mode) return;
    const box = panelTextRef.current;
    if (!box || window.matchMedia(REDUCED).matches) return;
    const items = Array.from(box.children) as HTMLElement[];
    for (const el of items) el.style.opacity = '0';
    return run(items, ({ animate, stagger }) => [
      animate(items, {
        opacity: [0, 1],
        translateY: [10, 0],
        delay: stagger(70, { start: 260 }),
        duration: 420,
        ease: 'outCubic',
        onComplete: () => clean(items),
      }),
    ]);
  }, [mode]);

  // 3. La nouvelle page est affichée : ses éléments apparaissent l'un après l'autre.
  useLayoutEffect(() => {
    if (previous.current.pathname === pathname) return;
    previous.current.pathname = pathname;
    const pane = paneRef.current;
    if (!pane) return;
    if (focusAfter.current) {
      focusAfter.current = false;
      pane
        .querySelector<HTMLElement>('input:not([type=hidden]), [data-field]')
        ?.focus({ preventScroll: true });
    }
    if (window.matchMedia(REDUCED).matches) return;
    const items = Array.from(
      pane.querySelectorAll<HTMLElement>('h1, [data-intro], form > *'),
    ) as HTMLElement[];
    for (const el of items) el.style.opacity = '0';
    return run(items, ({ animate, stagger }) => [
      animate(items, {
        opacity: [0, 1],
        translateY: [12, 0],
        delay: stagger(55, { start: 120 }),
        duration: 440,
        ease: 'outCubic',
        onComplete: () => clean(items),
      }),
    ]);
  }, [pathname]);

  function onSwitch(event: MouseEvent<HTMLAnchorElement>) {
    // Bascule déjà en cours : un second clic ne fait rien (pas de retour en arrière, pas d'historique en trop).
    if (optimistic) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    focusAfter.current = true;
    const from = pathname;
    setOptimistic({ mode: SWITCH[routeMode].mode, from });
    // Filet de sécurité : si la page n'arrive jamais, le bouton redevient utilisable.
    window.setTimeout(
      () => setOptimistic((current) => (current?.from === from ? null : current)),
      5000,
    );
  }

  const panel = {
    heading: t(`panel.${mode}.heading`),
    text: t(`panel.${mode}.text`),
    cta: t(`panel.${mode}.cta`),
  };

  return (
    <div
      data-auth-shell
      data-side={side}
      className="lp-auth-bg lp-auth-shell flex h-dvh flex-col overflow-hidden"
    >
      <div className="lp-auth-band shrink-0">
        <header className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-4 lg:h-20 lg:px-8">
          <Link
            href="/"
            className="bg-blanc/90 focus-visible:ring-bleu-100 inline-flex min-h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 shadow-[0_1px_3px_rgba(14,23,38,0.12)] outline-none focus-visible:ring-4"
          >
            <Logo variant="icon" alt="" className="size-8" />
            <span className="text-bleu-700 text-lg font-bold">{t('brandAlt')}</span>
            <span className="sr-only">{t('homeLabel')}</span>
          </Link>
          <AuthLanguageSwitcher />
        </header>
        {/* Téléphone : phrase courte + lien de bascule dans la bande bleue. */}
        <p className="text-blanc flex flex-wrap items-center gap-x-1 px-4 pb-8 text-base lg:hidden">
          <span>{panel.heading}</span>
          <Link
            href={SWITCH[routeMode].href}
            onClick={onSwitch}
            className="focus-visible:ring-blanc/60 -my-2 inline-flex min-h-11 items-center rounded-lg px-1 font-bold underline underline-offset-4 outline-none focus-visible:ring-4"
          >
            {panel.cta}
          </Link>
        </p>
      </div>

      <main className="flex min-h-0 flex-1 flex-col lg:items-center lg:justify-center lg:px-8 lg:pb-8">
        <div className="relative -mt-5 flex min-h-0 flex-1 flex-col lg:mt-0 lg:h-[min(620px,100%)] lg:w-full lg:max-w-[1040px] lg:flex-none lg:overflow-hidden lg:rounded-3xl lg:shadow-[0_24px_60px_rgba(20,40,107,0.22)]">
          <section
            ref={paneRef}
            className={cn(
              'lp-auth-pane bg-blanc flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-3',
              'lg:absolute lg:inset-y-0 lg:left-0 lg:w-[60%] lg:justify-center lg:overflow-visible lg:rounded-none lg:px-12 lg:py-8',
            )}
          >
            <div className="mx-auto w-full max-w-md lg:max-w-[32rem]">{children}</div>
          </section>

          <aside
            ref={panelRef}
            className="lp-auth-glass lp-auth-panel text-blanc absolute inset-y-0 left-0 z-10 hidden w-[40%] flex-col items-center justify-center px-10 text-center lg:flex"
          >
            <div ref={panelTextRef} className="flex max-w-xs flex-col items-center gap-4">
              <p className="text-3xl leading-tight font-bold">{panel.heading}</p>
              <p className="text-base leading-relaxed">{panel.text}</p>
              <Link
                href={SWITCH[routeMode].href}
                onClick={onSwitch}
                className="border-blanc text-blanc hover:bg-blanc/15 focus-visible:ring-blanc/60 mt-2 inline-flex min-h-11 items-center justify-center rounded-full border-2 px-10 text-base font-semibold transition-colors duration-150 ease-out outline-none focus-visible:ring-4"
              >
                {panel.cta}
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
