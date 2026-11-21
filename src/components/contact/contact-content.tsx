import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-accent-11)]';
const PRESS = 'motion-safe:transition-colors motion-safe:duration-200';

export async function ContactContent({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'contact' });
  // Adresse optionnelle : sans la variable, la ligne n'est pas affichée.
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold text-balance text-[var(--lp-gray-12)] sm:text-4xl">
        {t('title')}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--lp-gray-11)]">{t('intro')}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/tickets"
          className={`inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--lp-accent-9)] px-7 text-base font-medium text-white hover:bg-[var(--lp-accent-10)] active:bg-[var(--lp-app-accent-hover)] ${PRESS} ${FOCUS}`}
        >
          {t('ticketsCta')}
        </Link>
        <Link
          href="/login"
          className={`inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--lp-gray-6)] px-7 text-base font-medium text-[var(--lp-gray-12)] hover:border-[var(--lp-gray-9)] hover:bg-[var(--lp-gray-3)] active:bg-[var(--lp-gray-4)] ${PRESS} ${FOCUS}`}
        >
          {t('loginCta')}
        </Link>
      </div>
      {email ? (
        <p className="mt-8 rounded-2xl border border-[var(--lp-gray-6)] bg-[var(--lp-gray-2)] px-5 py-4 text-base text-[var(--lp-gray-11)]">
          {t('emailLabel')}{' '}
          <a
            href={`mailto:${email}`}
            className={`inline-block py-2 font-medium break-all text-[var(--lp-accent-11)] underline underline-offset-4 ${FOCUS}`}
          >
            {email}
          </a>
        </p>
      ) : null}
    </div>
  );
}
