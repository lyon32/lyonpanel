// @vitest-environment jsdom
// ComingSoon : sans props, basé sur EmptyState. Clés : comingSoon.title, comingSoon.description.
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { ComingSoon } from '@/components/shared/coming-soon';

const messages = {
  fr: {
    comingSoon: { title: 'Bientôt disponible', description: 'Cette page arrive prochainement.' },
  },
  en: { comingSoon: { title: 'Coming soon', description: 'This page is on its way.' } },
};

describe('ComingSoon', () => {
  it.each([
    ['fr', 'Bientôt disponible'],
    ['en', 'Coming soon'],
  ] as const)('affiche le titre traduit (%s) en heading', (locale, title) => {
    render(
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <ComingSoon />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText(messages[locale].comingSoon.description)).toBeInTheDocument();
  });
});
