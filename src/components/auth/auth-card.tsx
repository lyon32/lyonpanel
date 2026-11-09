import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Contenu commun des pages de compte : un seul h1, texte d'introduction, puis le formulaire.
// La surface (feuille blanche ou panneau) est fournie par AuthShell.
export function AuthCard({
  title,
  intro,
  children,
  compactOnPhone = false,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  // Téléphone : masque l'introduction pour garder la place des messages d'erreur.
  compactOnPhone?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-4 lg:gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-encre text-2xl leading-tight font-bold lg:text-[28px]">{title}</h1>
        {intro ? (
          <p
            data-intro
            className={cn('text-gris-600 text-sm lg:text-base', compactOnPhone && 'max-lg:hidden')}
          >
            {intro}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
