import * as React from 'react';
import { cn } from '@/lib/cn';

const statusClasses = {
  success: 'bg-succes-fond text-succes',
  pending: 'bg-jaune-50 text-jaune-700',
  failed: 'bg-erreur-fond text-erreur',
  info: 'bg-bleu-50 text-bleu-600',
} as const;

export interface BadgeProps extends React.ComponentProps<'span'> {
  status?: keyof typeof statusClasses;
  variant?: 'popular';
}

// Jamais de texte jaune 500 : le jaune reste en fond 50 / texte 700.
function Badge({ status = 'info', variant, className, ...props }: BadgeProps) {
  const colors = variant === 'popular' ? statusClasses.pending : statusClasses[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
        colors,
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
