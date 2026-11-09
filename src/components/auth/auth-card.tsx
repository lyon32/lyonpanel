import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

// Cadre commun des pages de compte : un seul h1, texte d'introduction, puis le formulaire.
export function AuthCard({
  title,
  intro,
  children,
  wide = false,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Card className={wide ? 'mx-auto w-full max-w-2xl' : 'mx-auto w-full max-w-md'}>
      <CardHeader className="gap-1 p-5 pb-3 sm:px-6">
        <h1 className="text-encre text-2xl leading-tight font-bold sm:text-[28px]">{title}</h1>
        {intro ? <CardDescription>{intro}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-5 pt-1 sm:px-6 sm:pb-6">{children}</CardContent>
    </Card>
  );
}
