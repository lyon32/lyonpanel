import * as React from 'react';
import { cn } from '@/lib/cn';

type Props = React.ComponentProps<'select'> & { label: string; error?: string };

// Liste déroulante native (fiable sur téléphone), même aspect que les champs texte.
export function SelectField({ label, error, id, className, children, ...props }: Props) {
  const autoId = React.useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-encre text-sm font-semibold">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'border-gris-200 bg-blanc text-encre focus-visible:border-bleu-600 focus-visible:ring-bleu-100 aria-invalid:border-erreur min-h-11 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-4',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="text-erreur text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
