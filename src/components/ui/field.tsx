import * as React from 'react';
import { Input } from './input';
import { cn } from '@/lib/cn';

export interface FieldProps extends React.ComponentProps<'input'> {
  label: string;
  hint?: string;
  error?: string;
}

// Libellé + champ + aide/erreur, reliés pour les lecteurs d'écran.
function Field({ label, hint, error, id, className, ...props }: FieldProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-encre text-sm font-semibold">
        {label}
      </label>
      <Input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-gris-600 text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-erreur text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
