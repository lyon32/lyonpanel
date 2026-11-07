import { Atkinson_Hyperlegible, IBM_Plex_Mono, Public_Sans } from 'next/font/google';

// Polices du design system (docs/05 §2). Branchées au layout ailleurs.
export const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-public-sans',
});

export const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-atkinson',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});
