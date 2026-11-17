import 'server-only';
import { createTranslator } from 'next-intl';
import { cookies } from 'next/headers';
import enMessages from '@/messages/admin.en.json';
import frMessages from '@/messages/admin.fr.json';

/** Traducteur de l'espace admin (hors [locale]) : la langue vient du cookie, comme dans le layout. */
export async function getAdminTranslator() {
  const locale = (await cookies()).get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'fr';
  const messages = locale === 'en' ? enMessages : frMessages;
  return { locale, t: createTranslator({ locale, messages, namespace: 'admin' }) };
}
