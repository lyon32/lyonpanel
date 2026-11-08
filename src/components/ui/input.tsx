import * as React from 'react';
import { cn } from '@/lib/cn';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'border-gris-200 bg-blanc text-encre placeholder:text-gris-400 focus-visible:border-bleu-600 focus-visible:ring-bleu-100 aria-invalid:border-erreur min-h-11 w-full rounded-lg border px-3 text-base transition-colors duration-150 ease-out outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
