import { SITE_NAME } from '@/lib/constants';

// Page provisoire de la phase 0 ; l'accueil réel arrive en phase 14.
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-4xl font-bold text-[#1D4ED8]">{SITE_NAME}</h1>
      <p className="text-slate-600">Le site arrive bientôt.</p>
    </main>
  );
}
