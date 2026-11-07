import { setRequestLocale } from 'next-intl/server';
import { HomeHero } from '@/components/shared/home-hero';
import { HomeSteps } from '@/components/shared/home-steps';

// Accueil provisoire (héros + 3 étapes) ; l'accueil complet arrive en phase 14.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <HomeHero />
      <HomeSteps />
    </>
  );
}
