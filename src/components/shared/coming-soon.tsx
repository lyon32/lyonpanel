import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';

export function ComingSoon() {
  const t = useTranslations('comingSoon');
  return <EmptyState icon={Clock} title={t('title')} description={t('description')} />;
}
