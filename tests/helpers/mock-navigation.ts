import { createElement, type ReactNode } from 'react';
import { vi } from 'vitest';

// Faux @/i18n/navigation : vraies adresses traduites (getPathname réel), pas de Next.
export const navState = { pathname: '/', lastUrl: '' };
export const replaceSpy = vi.fn();

export async function buildNavigationMock() {
  const { createNavigation } = await import('next-intl/navigation');
  const { routing } = await import('@/i18n/routing');
  const real = createNavigation(routing);
  const resolve = (href: string, locale: string) => {
    try {
      return real.getPathname({ href: href as never, locale });
    } catch {
      return `/${locale}${href === '/' ? '' : href}`;
    }
  };
  return {
    usePathname: () => navState.pathname,
    useRouter: () => ({
      replace: (href: string | { pathname: string }, opts?: { locale?: string }) => {
        replaceSpy(href, opts);
        const p = typeof href === 'string' ? href : href.pathname;
        navState.lastUrl = resolve(p, opts?.locale ?? 'fr');
      },
      push: vi.fn(),
    }),
    Link: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
      createElement('a', { href: resolve(href, 'fr'), ...rest }, children),
  };
}
