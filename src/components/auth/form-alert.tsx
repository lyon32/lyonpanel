import { CircleAlert, CircleCheck } from 'lucide-react';

// Message général d'un formulaire : erreur (role=alert) ou succès (role=status).
// Couleurs de la table « Statuts » du design system.
export function FormAlert({ kind, children }: { kind: 'error' | 'success'; children: string }) {
  const isError = kind === 'error';
  const Icon = isError ? CircleAlert : CircleCheck;
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={
        isError
          ? 'text-erreur bg-erreur-fond flex items-start gap-2 rounded-lg p-3 text-sm'
          : 'text-succes bg-succes-fond flex items-start gap-2 rounded-lg p-3 text-sm'
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
