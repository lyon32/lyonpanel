'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';

// Purge manuelle : la liste est déjà affichée par la page ; rien ne part sans la case cochée.
export function PurgeOrphansForm({ paths }: { paths: string[] }) {
  const t = useTranslations('admin');
  const { pending, feedback, run } = useAdminAction({
    error: t('common.error'),
    success: t('common.saved'),
  });
  const [confirmed, setConfirmed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) return;
    void run('/api/v1/admin/storage/orphans/purge', 'POST', { paths, confirm: true }, (res) => {
      const d = res.data as { deleted?: unknown[]; skipped?: unknown[] } | null;
      return t('storage.result', {
        deleted: d?.deleted?.length ?? 0,
        skipped: d?.skipped?.length ?? 0,
      });
    });
    setConfirmed(false);
  }

  return (
    <form
      onSubmit={submit}
      className="border-erreur bg-erreur-fond flex flex-col gap-3 rounded-xl border p-4"
    >
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-bleu-600 focus-visible:ring-bleu-100 mt-0.5 size-6 shrink-0 outline-none focus-visible:ring-4"
        />
        <span>{t('storage.confirm')}</span>
      </label>
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div>
        <Button
          type="submit"
          variant="destructive"
          className="w-full sm:w-fit"
          loading={pending}
          loadingLabel={t('common.loading')}
          disabled={!confirmed}
        >
          {t('storage.purge')}
        </Button>
      </div>
    </form>
  );
}
