import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';

// Cadre commun des pages de compte : un seul h1, texte d'introduction, puis le formulaire.
export function AuthCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="gap-2 p-6 pb-4">
        <h1 className="text-encre text-[28px] leading-tight font-bold">{title}</h1>
        {intro ? <CardDescription>{intro}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-6 pt-2">{children}</CardContent>
    </Card>
  );
}
