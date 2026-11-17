import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { load } from '../../helpers/admin-db';
import en from '@/messages/admin.en.json';
import fr from '@/messages/admin.fr.json';

/*
 * Relecture 11.5 point 1 : la fiche client n'affiche plus le statut brut (completed, refunded...).
 *   - messages : admin.user.orderStatuses.<statut> dans admin.fr.json ET admin.en.json, pour CHAQUE valeur de l'enum
 *     order_status (lue dans les migrations, donc suit le schéma) ;
 *   - src/lib/admin-format.ts : orderStatusLabel(status: string, labels: Record<string, string>): string
 *     rend labels[status], ou la valeur brute si le statut est inconnu.
 */

function orderStatuses(): string[] {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  const created = /create type order_status\s+as enum\s*\(([^)]*)\)/i.exec(sql);
  const values = [...(created?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!);
  for (const m of sql.matchAll(
    /alter type order_status add value(?: if not exists)?\s+'([^']+)'/gi,
  )) {
    values.push(m[1]!);
  }
  return values;
}

type Labels = Record<string, unknown>;
const labelsOf = (messages: typeof fr): Labels =>
  ((messages.admin as { user?: { orderStatuses?: Labels } }).user?.orderStatuses ?? {}) as Labels;

describe('statuts de commande de la fiche client', () => {
  const statuses = orderStatuses();

  it('l’enum order_status est bien lue dans les migrations (7 statuts connus au minimum)', () => {
    expect(statuses).toEqual(
      expect.arrayContaining(['pending', 'completed', 'canceled', 'refunded']),
    );
    expect(statuses.length).toBeGreaterThanOrEqual(7);
  });

  it.each([
    ['fr', fr],
    ['en', en],
  ])(
    'admin.%s.json traduit chaque statut (texte non vide, différent de la valeur brute)',
    (_l, messages) => {
      const labels = labelsOf(messages);
      for (const status of statuses) {
        const label = labels[status];
        expect(typeof label, `statut « ${status} » sans traduction`).toBe('string');
        expect((label as string).trim().length).toBeGreaterThan(0);
        expect(label).not.toBe(status);
      }
    },
  );

  it('orderStatusLabel rend la traduction d’un statut connu', async () => {
    const { orderStatusLabel } = await load<{
      orderStatusLabel: (s: string, l: Record<string, string>) => string;
    }>('@/lib/admin-format');
    expect(orderStatusLabel('completed', { completed: 'Terminée' })).toBe('Terminée');
  });

  it('orderStatusLabel se replie sur la valeur brute pour un statut inconnu', async () => {
    const { orderStatusLabel } = await load<{
      orderStatusLabel: (s: string, l: Record<string, string>) => string;
    }>('@/lib/admin-format');
    expect(orderStatusLabel('nouveau_statut', { completed: 'Terminée' })).toBe('nouveau_statut');
  });
});
