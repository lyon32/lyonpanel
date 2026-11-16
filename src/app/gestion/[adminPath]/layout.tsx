import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { publicSans } from '@/lib/fonts';
import { isAdminSegment } from '@/server/auth/admin-path';
import { loadServerEnv } from '@/server/env';
import enMessages from '@/messages/admin.en.json';
import frMessages from '@/messages/admin.fr.json';
import '@/styles/globals.css';

// Jamais indexée ni suivie : doublé par l'en-tête X-Robots-Tag posé par le proxy.
export const metadata: Metadata = {
  title: 'LyonPanel',
  robots: { index: false, follow: false },
};

type Props = { children: ReactNode; params: Promise<{ adminPath: string }> };

// Racine propre à l'admin (hors [locale]). Un segment qui n'est pas l'adresse secrète = 404.
export default async function AdminLayout({ children, params }: Props) {
  const { adminPath } = await params;
  if (!isAdminSegment(adminPath, loadServerEnv().ADMIN_PATH)) notFound();
  const locale = (await cookies()).get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'fr';

  return (
    <html lang={locale} className={publicSans.variable}>
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={locale === 'en' ? enMessages : frMessages}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
