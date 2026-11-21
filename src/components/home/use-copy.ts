'use client';

import { useTranslations } from 'next-intl';
import type { TypeKey } from './networks';

// Textes de l'accueil, lus dans messages (namespace « home »), regroupés pour les composants.
export function useCopy() {
  const t = useTranslations('home');
  // Listes stockées en objets numérotés (« 1 », « 2 »…) : le test des messages interdit les tableaux.
  const steps = Object.values(
    t.raw('steps.items') as Record<string, { title: string; text: string; chip: string }>,
  );
  const faq = Object.values(t.raw('faq.items') as Record<string, { q: string; a: string }>);
  return {
    badge: t('hero.badge'),
    title: t('hero.title'),
    accent: t('hero.accent'),
    sub: t('hero.sub'),
    signup: t('hero.ctaPrimary'),
    how: t('hero.ctaSecondary'),
    networksTitle: t('hero.networksTitle'),
    heroAlt: t('hero.alt'),
    statsTitle: t('stats.title'),
    statsLabels: Object.values(t.raw('stats.items') as Record<string, string>),
    stepsTitle: t('steps.title'),
    stepsLead: t('steps.lead'),
    step: t('steps.step'),
    howAlt: t('steps.alt'),
    steps: steps.map((s) => [s.title, s.text, s.chip] as [string, string, string]),
    servicesTitle: t('services.title'),
    servicesLead: t('services.lead'),
    servicesUnit: t('services.unit'),
    seeServices: t('services.seeAll'),
    moreTitle: t('services.moreTitle'),
    moreText: t('services.moreText'),
    typeLabels: t.raw('services.types') as Record<TypeKey, string>,
    payTitle: t('payments.title'),
    payLead: t('payments.lead'),
    payText: t('payments.text'),
    payNote: t('payments.note'),
    payLogoAlt: t('payments.logoAlt'),
    faqTitle: t('faq.title'),
    faq: faq.map((f) => [f.q, f.a] as [string, string]),
    ctaTitle: t('cta.title'),
    ctaText: t('cta.text'),
  };
}

export type Copy = ReturnType<typeof useCopy>;
