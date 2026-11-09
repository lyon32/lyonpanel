import { describe, expect, it, vi } from 'vitest';
import { makeProviderService } from '../../factories/provider-service';
import { loadProviderFixture } from '../../helpers/provider-fixture';

vi.mock('server-only', () => ({}));

import { providerServicesSchema } from '@/server/providers/types';
import { createMockProvider } from '@/server/providers/mock-provider';

// Modules attendus :
//   src/server/providers/types.ts          : providerServiceSchema, providerServicesSchema (Zod), ProviderService, ProviderApi
//   src/server/providers/mock-provider.ts  : createMockProvider(options?: { services?: ProviderService[]; balanceUsd?: number }): ProviderApi
// ProviderApi = { services(), balance(), add({service, link, quantity, comments?}), status(ids) } (LLD §4.5)

describe('schéma des services du fournisseur (Zod)', () => {
  it('accepte toute la fixture (format API v2)', () => {
    const parsed = providerServicesSchema.parse(loadProviderFixture());
    expect(parsed).toHaveLength(loadProviderFixture().length);
  });

  it('accepte min et max donnés en texte (certains fournisseurs les envoient ainsi)', () => {
    const [s] = providerServicesSchema.parse([makeProviderService({ min: '10', max: '5000' })]);
    expect(s?.min).toBe(10);
    expect(s?.max).toBe(5000);
  });

  it('refuse un service sans coût', () => {
    const sansRate: Record<string, unknown> = { ...makeProviderService() };
    delete sansRate.rate;
    expect(providerServicesSchema.safeParse([sansRate]).success).toBe(false);
  });

  it('refuse un coût au-dessus du plafond (100 000 USD pour 1 000)', () => {
    const ok = providerServicesSchema.safeParse([makeProviderService({ rate: '100000' })]);
    expect(ok.success).toBe(true);
    expect(
      providerServicesSchema.safeParse([makeProviderService({ rate: '100000.01' })]).success,
    ).toBe(false);
  });

  it.each(['abc', '', '-1', 'NaN'])('refuse un coût illisible ou négatif (%j)', (rate) => {
    expect(providerServicesSchema.safeParse([makeProviderService({ rate })]).success).toBe(false);
  });

  it('refuse un identifiant de service qui n est pas un entier positif', () => {
    expect(providerServicesSchema.safeParse([makeProviderService({ service: 0 })]).success).toBe(
      false,
    );
    expect(providerServicesSchema.safeParse([makeProviderService({ service: 1.5 })]).success).toBe(
      false,
    );
  });

  it('refuse min > max ou min <= 0', () => {
    expect(
      providerServicesSchema.safeParse([makeProviderService({ min: 100, max: 10 })]).success,
    ).toBe(false);
    expect(
      providerServicesSchema.safeParse([makeProviderService({ min: 0, max: 10 })]).success,
    ).toBe(false);
  });

  it('refuse autre chose qu une liste', () => {
    expect(providerServicesSchema.safeParse({ error: 'x' }).success).toBe(false);
  });
});

describe('faux fournisseur (PROVIDER_MODE=mock)', () => {
  it('services() renvoie la fixture validée par Zod', async () => {
    const list = await createMockProvider().services();
    expect(providerServicesSchema.safeParse(list).success).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(100);
    expect(list.some((s) => s.service === 4763)).toBe(true);
  });

  it('services() renvoie la liste fournie quand on en donne une', async () => {
    const one = makeProviderService({ service: 424242 });
    const list = await createMockProvider({ services: [one] }).services();
    expect(list.map((s) => s.service)).toEqual([424242]);
  });

  it('services() renvoie une copie : modifier le résultat ne change pas le suivant', async () => {
    const p = createMockProvider();
    const first = await p.services();
    first.length = 0;
    expect((await p.services()).length).toBeGreaterThan(0);
  });

  it('balance() est en dollars', async () => {
    const b = await createMockProvider({ balanceUsd: 42.5 }).balance();
    expect(b).toEqual({ balance: 42.5, currency: 'USD' });
  });

  it('balance() a un solde par défaut positif en USD', async () => {
    const b = await createMockProvider().balance();
    expect(b.currency).toBe('USD');
    expect(b.balance).toBeGreaterThan(0);
  });

  it('add() renvoie un numéro de commande, différent à chaque appel', async () => {
    const p = createMockProvider({
      services: [makeProviderService({ service: 55, min: 10, max: 1000 })],
    });
    const a = await p.add({ service: 55, link: 'https://example.com/a', quantity: 100 });
    const b = await p.add({ service: 55, link: 'https://example.com/a', quantity: 100 });
    expect(Number.isInteger(a.order)).toBe(true);
    expect(a.order).toBeGreaterThan(0);
    expect(b.order).not.toBe(a.order);
  });

  it('add() refuse un service inconnu avec une erreur PROVIDER_ERROR', async () => {
    const p = createMockProvider({ services: [makeProviderService({ service: 55 })] });
    await expect(
      p.add({ service: 999, link: 'https://example.com', quantity: 100 }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('add() refuse une quantité hors des bornes du service', async () => {
    const p = createMockProvider({
      services: [makeProviderService({ service: 55, min: 10, max: 1000 })],
    });
    await expect(
      p.add({ service: 55, link: 'https://example.com', quantity: 5 }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
    await expect(
      p.add({ service: 55, link: 'https://example.com', quantity: 1001 }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
    });
  });

  it('status() renvoie une entrée par commande connue, avec un statut texte du fournisseur', async () => {
    const p = createMockProvider({
      services: [makeProviderService({ service: 55, min: 10, max: 1000 })],
    });
    const { order } = await p.add({ service: 55, link: 'https://example.com', quantity: 100 });
    const res = await p.status([order]);
    expect(Object.keys(res)).toEqual([String(order)]);
    expect(['Pending', 'In progress', 'Completed', 'Partial', 'Canceled', 'Processing']).toContain(
      res[order]?.status,
    );
  });

  it('status() ignore les commandes inconnues', async () => {
    const res = await createMockProvider().status([987654321]);
    expect(res[987654321]).toBeUndefined();
  });
});
