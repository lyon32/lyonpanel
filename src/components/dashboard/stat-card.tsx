import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

type Props = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, hint, icon: Icon }: Props) {
  return (
    <Card data-testid="stat-card" className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-gris-600 text-sm font-medium">{label}</span>
        <Icon size={18} aria-hidden="true" className="text-gris-400 shrink-0" />
      </div>
      <p className="text-encre text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <div className="flex min-h-6 flex-wrap items-center gap-2">
        {hint ? <span className="text-gris-600 text-xs">{hint}</span> : null}
      </div>
    </Card>
  );
}
