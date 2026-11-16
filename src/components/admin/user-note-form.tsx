'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useAdminAction } from './use-admin-action';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Note privée : visible de l'administrateur seul, jamais du client.
export function UserNoteForm({ userId }: { userId: string }) {
  const t = useTranslations('admin');
  const { pending, feedback, run } = useAdminAction({
    error: t('common.error'),
    success: t('common.saved'),
  });
  const [body, setBody] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const res = await run(`/api/v1/admin/users/${userId}/notes`, 'POST', { body });
    if (res.ok) setBody('');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="admin-note" className="text-encre text-sm font-semibold">
        {t('user.noteLabel')}
      </label>
      <Textarea
        id="admin-note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        required
      />
      {feedback ? <FormAlert kind={feedback.kind}>{feedback.text}</FormAlert> : null}
      <div>
        <Button type="submit" disabled={pending || body.trim() === ''}>
          {t('user.noteSubmit')}
        </Button>
      </div>
    </form>
  );
}
