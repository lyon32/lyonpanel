'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { adminFetch } from './admin-api';
import { FormAlert } from '@/components/auth/form-alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

const codeField = {
  name: 'code',
  type: 'text',
  inputMode: 'numeric' as const,
  autoComplete: 'one-time-code',
  maxLength: 6,
  pattern: '[0-9]{6}',
  required: true,
};

function readCode(event: FormEvent<HTMLFormElement>): string {
  const value = new FormData(event.currentTarget).get('code');
  return typeof value === 'string' ? value.trim() : '';
}

// Saisie du code à 6 chiffres (n'importe lequel des 2 appareils).
export function CodeStep({ onDone }: { onDone: () => Promise<void> }) {
  const t = useTranslations('admin');
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = readCode(event);
    setPending(true);
    setFailed(false);
    const res = await adminFetch('/api/v1/admin/mfa/verify', 'POST', { code });
    if (res.ok) await onDone();
    else setFailed(true);
    setPending(false);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3"
      noValidate
      data-testid="admin-code-form"
    >
      <p className="text-gris-600 text-sm">{t('code.intro')}</p>
      <Field label={t('code.label')} {...codeField} data-testid="admin-code" />
      {failed ? <FormAlert kind="error">{t('code.error')}</FormAlert> : null}
      <Button type="submit" loading={pending} loadingLabel={t('loading')}>
        {t('code.submit')}
      </Button>
    </form>
  );
}

type Device = { factorId: string; qrCode: string; secret: string };

function asDevice(data: unknown): Device | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.factorId !== 'string' || typeof d.qrCode !== 'string') return null;
  if (typeof d.secret !== 'string') return null;
  return { factorId: d.factorId, qrCode: d.qrCode, secret: d.secret };
}

// Enrôlement d'un appareil : QR (ou clé à recopier), puis premier code pour le confirmer.
export function EnrollStep({ onDone }: { onDone: () => Promise<void> }) {
  const t = useTranslations('admin');
  const [device, setDevice] = useState<Device | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setPending(true);
    setFailed(false);
    const res = await adminFetch('/api/v1/admin/mfa/enroll', 'POST');
    const created = res.ok ? asDevice(res.data) : null;
    if (created) setDevice(created);
    else setFailed(true);
    setPending(false);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!device) return;
    const code = readCode(event);
    setPending(true);
    setFailed(false);
    const res = await adminFetch('/api/v1/admin/mfa/enroll', 'PUT', {
      factor_id: device.factorId,
      code,
    });
    if (res.ok) {
      setDevice(null);
      await onDone();
    } else setFailed(true);
    setPending(false);
  }

  if (!device) {
    return (
      <div className="flex flex-col gap-3" data-testid="admin-enroll">
        <p className="text-gris-600 text-sm">{t('enroll.intro')}</p>
        {failed ? <FormAlert kind="error">{t('enroll.error')}</FormAlert> : null}
        <Button type="button" loading={pending} loadingLabel={t('loading')} onClick={start}>
          {t('enroll.start')}
        </Button>
      </div>
    );
  }
  return (
    <form
      onSubmit={confirm}
      className="flex flex-col gap-3"
      noValidate
      data-testid="admin-enroll-form"
    >
      <p className="text-gris-600 text-sm">{t('enroll.scan')}</p>
      <Image src={device.qrCode} alt={t('enroll.qrAlt')} width={192} height={192} unoptimized />
      <p className="text-sm">
        {t('enroll.manual')} <code className="font-mono break-all">{device.secret}</code>
      </p>
      <Field label={t('code.label')} {...codeField} data-testid="admin-code" />
      {failed ? <FormAlert kind="error">{t('code.error')}</FormAlert> : null}
      <Button type="submit" loading={pending} loadingLabel={t('loading')}>
        {t('enroll.confirm')}
      </Button>
    </form>
  );
}
