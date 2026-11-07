import { useTranslations } from 'next-intl';
import { LoadingState } from '@/components/shared/loading-state';

export default function Loading() {
  const t = useTranslations('loading');
  return <LoadingState label={t('label')} />;
}
