'use client';

import imageCompression from 'browser-image-compression';
import { Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent } from 'react';
import { FormAlert } from '@/components/auth/form-alert';

const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGES = 3;
// Le serveur refuse au-delà : on réduit déjà dans le navigateur (économise le réseau mobile).
const MAX_SIZE_MB = 1;

type Chip = { id: string; name: string };

// Message d'erreur du serveur (format API_SPEC §3), ou null si la réponse n'en contient pas.
export async function readApiError(res: Response): Promise<string | null> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message ?? null;
  } catch {
    return null;
  }
}

export function AttachmentUpload({ onChange }: { onChange: (ids: string[]) => void }) {
  const t = useTranslations('support');
  const [chips, setChips] = useState<Chip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Copie à jour de la liste : les envois se suivent dans une même boucle asynchrone.
  const current = useRef<Chip[]>([]);

  function update(next: Chip[]) {
    current.current = next;
    setChips(next);
    onChange(next.map((c) => c.id));
  }

  async function sendOne(file: File): Promise<void> {
    const small = await imageCompression(file, { maxSizeMB: MAX_SIZE_MB, maxWidthOrHeight: 1600 });
    const body = new FormData();
    body.append('file', small);
    const res = await fetch('/api/v1/tickets/attachments', { method: 'POST', body });
    if (!res.ok) throw new Error((await readApiError(res)) ?? t('form.networkError'));
    const { id } = (await res.json()) as { id: string };
    update([...current.current, { id, name: file.name }]);
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError(null);
    if (files.length === 0) return;
    if (files.some((f) => !ACCEPT.includes(f.type))) {
      setError(t('errors.fileType'));
      return;
    }
    const slots = MAX_IMAGES - current.current.length;
    if (files.length > slots) setError(t('errors.fileTooMany'));
    setBusy(true);
    for (const file of files.slice(0, Math.max(slots, 0))) {
      try {
        await sendOne(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('form.networkError'));
        break;
      }
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="border-gris-400 text-encre focus-within:outline-bleu-600 flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold focus-within:outline-2">
        <Paperclip className="size-4" aria-hidden="true" />
        {t('form.attach')}
        <input
          type="file"
          data-testid="ticket-attach"
          accept={ACCEPT.join(',')}
          multiple
          disabled={busy}
          onChange={handleChange}
          className="sr-only"
        />
      </label>
      <p className="text-gris-600 text-sm">{t('form.attachHint')}</p>
      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip.id}
              data-testid="attachment-chip"
              className="bg-gris-50 text-encre flex min-h-11 max-w-full items-center gap-1 rounded-lg pl-3 text-sm"
            >
              <span className="truncate">{chip.name}</span>
              <button
                type="button"
                data-testid="attachment-remove"
                aria-label={t('form.remove')}
                onClick={() => update(current.current.filter((c) => c.id !== chip.id))}
                className="focus-visible:outline-bleu-600 flex size-11 items-center justify-center focus-visible:outline-2"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <FormAlert kind="error">{error}</FormAlert> : null}
    </div>
  );
}
