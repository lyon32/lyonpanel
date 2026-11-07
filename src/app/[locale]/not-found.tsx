import { FileQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('notFound');
  return (
    <div className="px-4 py-16">
      <EmptyState
        icon={FileQuestion}
        title={t('title')}
        description={t('description')}
        action={
          <Button asChild>
            <Link href="/">{t('backHome')}</Link>
          </Button>
        }
      />
    </div>
  );
}
