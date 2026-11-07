import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SITE_NAME } from '@/lib/constants';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: SITE_NAME,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
