'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ErrorStateProps {
  title: string;
  description?: string;
  retryLabel: string;
  onRetry: () => void;
}

export function ErrorState({ title, description, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <Card
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"
    >
      <AlertCircle size={20} aria-hidden="true" className="text-erreur" />
      <h2 className="text-encre text-lg font-bold">{title}</h2>
      {description ? <p className="text-gris-600 text-sm">{description}</p> : null}
      <Button variant="secondary" className="mt-2" onClick={onRetry}>
        {retryLabel}
      </Button>
    </Card>
  );
}
