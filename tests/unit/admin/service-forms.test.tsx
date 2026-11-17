// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceActiveToggle } from '@/components/admin/service-active-toggle';
import { ServiceEditForm } from '@/components/admin/service-edit-form';
import { SettingsForm } from '@/components/admin/settings-form';
import { readSettingValues } from '@/lib/admin-settings-form';
import en from '@/messages/admin.en.json';
import fr from '@/messages/admin.fr.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

const wrap = (node: ReactNode, lang: 'fr' | 'en' = 'fr') =>
  render(
    <NextIntlClientProvider locale={lang} messages={lang === 'fr' ? fr : en}>
      {node}
    </NextIntlClientProvider>,
  );

type Call = [string, RequestInit];
const bodyOf = (call: Call) => JSON.parse(String(call[1].body));

const service = {
  id: 7,
  nameFr: 'Abonnés TikTok',
  nameEn: 'TikTok followers',
  descriptionFr: 'Texte généré FR',
  descriptionEn: 'Generated EN',
  customNameFr: null,
  customNameEn: null,
  customDescriptionFr: null,
  customDescriptionEn: null,
  multiplier: 2.5,
  sortOrder: 0,
};

describe('activer / masquer', () => {
  it("demande une confirmation avant d'envoyer", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({}, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    wrap(<ServiceActiveToggle serviceId={7} active />);
    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0] as unknown as Call;
    expect(call[0]).toBe('/api/v1/admin/services/7');
    expect(bodyOf(call)).toEqual({ active: false });
  });
});

describe('fiche service', () => {
  it('affiche le texte généré quand la description est vide, et le compteur', () => {
    wrap(<ServiceEditForm service={service} locale="fr" />);
    expect(screen.getAllByText(/Texte généré/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('0 / 400').length).toBe(2);
  });

  it('marge : aperçu par la route, puis confirmation, puis envoi avec confirm', async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push([url, init]);
        return url.endsWith('/preview')
          ? Response.json({ old_price_xaf_1000: 2500, new_price_xaf_1000: 2800 })
          : Response.json({ service: {} });
      }),
    );
    wrap(<ServiceEditForm service={service} locale="fr" />);
    fireEvent.change(screen.getByLabelText(/Marge \(multiplicateur\)/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await screen.findByText(/passe de/);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe('/api/v1/admin/services/7/preview');
    expect(bodyOf(calls[0]!)).toEqual({ multiplier: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Confirmer l'enregistrement/ }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]![0]).toBe('/api/v1/admin/services/7');
    expect(bodyOf(calls[1]!)).toEqual({ multiplier: 3, confirm: true });
  });

  it('refuse une marge invalide sans appeler le serveur', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    wrap(<ServiceEditForm service={service} locale="fr" />);
    fireEvent.change(screen.getByLabelText(/Marge \(multiplicateur\)/), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText(/Marge invalide/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un champ texte vidé part comme chaîne vide (retour au texte généré)', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ service: {} }));
    vi.stubGlobal('fetch', fetchMock);
    wrap(<ServiceEditForm service={{ ...service, customNameFr: 'Perso' }} locale="fr" />);
    fireEvent.change(screen.getByLabelText('Nom en français'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirmer l'enregistrement/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(bodyOf(fetchMock.mock.calls[0] as unknown as Call)).toEqual({ custom_name_fr: '' });
  });
});

describe('réglages (formulaire)', () => {
  const current = readSettingValues({
    usd_xaf_rate: 600,
    default_multiplier: 2.5,
    min_recharge_xaf: 500,
    max_recharge_xaf: 500000,
    daily_order_cap_xaf: 1000000,
    provider_low_balance_usd: 5,
    price_alert_pct: 30,
    referral_pct: 5,
    auto_discount: { threshold_xaf: 100000, pct: 3 },
  })!;

  it('récapitule ancienne et nouvelle valeur puis envoie après confirmation', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => Response.json({ settings: {} }));
    vi.stubGlobal('fetch', fetchMock);
    wrap(<SettingsForm current={current} />, 'en');
    fireEvent.change(screen.getByLabelText(/USD exchange rate/), { target: { value: '620' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/600 → 620/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0] as unknown as Call;
    expect(call[1].method).toBe('PATCH');
    expect(bodyOf(call)).toEqual({ usd_xaf_rate: 620 });
  });

  it('bloque une valeur hors bornes', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    wrap(<SettingsForm current={current} />);
    fireEvent.change(screen.getByLabelText(/Parrainage/), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getAllByText('Valeur hors limites.').length).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("affiche le message d'erreur de l'API", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Valeur refusée' } },
          { status: 400 },
        ),
      ),
    );
    wrap(<SettingsForm current={current} />);
    fireEvent.change(screen.getByLabelText(/Taux de change/), { target: { value: '610' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    fireEvent.click(await screen.findByRole('button', { name: /Confirmer l'enregistrement/ }));
    expect(await screen.findByText('Valeur refusée')).toBeTruthy();
  });
});
