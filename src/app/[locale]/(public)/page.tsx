import { setRequestLocale } from 'next-intl/server';
import { HomeHero } from '@/components/shared/home-hero';
import {
  HomeCta,
  HomeFaq,
  HomeFeatures,
  HomeNetworks,
  HomeServices,
} from '@/components/shared/home-sections';
import { HomeSteps } from '@/components/shared/home-steps';

// Accueil provisoire (héros et sections de démonstration) ; l'accueil complet arrive en phase 14.
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <HomeHero />
      <HomeNetworks />
      <HomeServices />
      <HomeSteps />
      <HomeFeatures />
      <HomeFaq />
      <HomeCta />
    </>
  );
}
