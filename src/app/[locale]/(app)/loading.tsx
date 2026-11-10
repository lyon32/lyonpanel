import { useTranslations } from 'next-intl';
import { LoadingState } from '@/components/shared/loading-state';

// Écran de chargement de la zone connectée. Il n'existe plus pour les pages publiques :
// sinon il ouvrirait l'envoi de la page avant que notFound() ne s'exécute et un 404 partirait en code 200.
export default function Loading() {
  const t = useTranslations('loading');
  return <LoadingState label={t('label')} />;
}
