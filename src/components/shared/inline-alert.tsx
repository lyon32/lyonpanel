import { CircleAlert } from 'lucide-react';

// Message d'erreur d'un formulaire : dit ce qui s'est passé et quoi faire.
export function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="bg-erreur-fond text-erreur flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
    >
      <CircleAlert size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
