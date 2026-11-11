import { useTranslations } from 'next-intl';
import { splitServiceName } from '@/lib/split-service-name';

// Nom propre du service, puis le numéro en petit gris (« Réf. 9747146 »), jamais coupé.
export function ServiceName({ name, className }: { name: string; className?: string }) {
  const t = useTranslations('service');
  const { title, ref } = splitServiceName(name);
  return (
    <span className={className}>
      <span className="break-words">{title}</span>
      {ref ? (
        <span className="text-gris-600 mt-0.5 block text-xs font-normal whitespace-nowrap tabular-nums">
          {t('ref', { id: ref })}
        </span>
      ) : null}
    </span>
  );
}
