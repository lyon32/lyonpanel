import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { authMetadata } from '@/lib/seo/auth-metadata';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return authMetadata('register', locale);
}

// Le formulaire est affiché par la carte du layout (AuthShell), pour que la bascule
// connexion ↔ inscription soit immédiate. Cette page ne porte que l'adresse et les métadonnées.
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return null;
}
