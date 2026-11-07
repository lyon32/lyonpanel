'use client';

import AttractButton from '@/components/motion/attract-button';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/navigation';

type Props = { primary: string; secondary: string };

// Bouton principal avec l'effet d'attraction (ordinateur) ; il mène à l'inscription.
export function HeroCtas({ primary, secondary }: Props) {
  const router = useRouter();
  return (
    <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
      <AttractButton
        onClick={() => router.push('/register')}
        containerClassName="w-full sm:w-auto"
        className="w-full text-base sm:w-auto"
      >
        {primary}
      </AttractButton>
      <Button asChild variant="secondary" className="w-full sm:w-auto">
        <Link href="/services">{secondary}</Link>
      </Button>
    </div>
  );
}
