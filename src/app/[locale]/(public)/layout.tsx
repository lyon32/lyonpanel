import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { setCurrencyCookie } from '@/lib/actions/currency';
import { CURRENCY_COOKIE, parseCurrency } from '@/lib/currency';

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const currency = parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
  return (
    <div className="lp-app flex min-h-screen flex-col">
      <SiteHeader currency={currency} setCurrencyCookie={setCurrencyCookie} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
