import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

// Carte sobre : icône discrète, titre, texte et action facultative.
export function EmptyState({ title, description, action, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <Icon size={20} aria-hidden="true" className="text-gris-600" />
      <h2 className="text-encre text-lg font-bold">{title}</h2>
      {description ? <p className="text-gris-600 text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
