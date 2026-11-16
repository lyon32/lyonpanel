import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Clés attendues dans src/messages/fr.json et en.json, espace « support » (phase 9).
 * Les noms sont figés ici : les composants de src/components/tickets/* les lisent tels quels.
 */

const load = (l: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), 'src/messages', `${l}.json`), 'utf8'));

function pick(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );
}

const FAQ = ['delivery', 'partial', 'refund', 'rechargeMissing', 'privateLink'];
const KEYS = [
  'support.title',
  'support.responseTime',
  'support.faq.title',
  ...FAQ.flatMap((k) => [`support.faq.items.${k}.question`, `support.faq.items.${k}.answer`]),
  ...['order', 'recharge', 'account', 'other'].map((s) => `support.subjects.${s}`),
  'support.form.title',
  'support.form.subject',
  'support.form.order',
  'support.form.orderPlaceholder',
  'support.form.body',
  'support.form.attach',
  'support.form.attachHint',
  'support.form.send',
  'support.form.sent',
  'support.list.empty',
  'support.list.new',
  'support.list.status.open',
  'support.list.status.answered',
  'support.list.status.closed',
  'support.thread.you',
  'support.thread.team',
  'support.thread.reply',
  'support.thread.send',
  'support.thread.close',
  'support.thread.closedNotice',
  'support.errors.openLimit',
  'support.errors.rateLimit',
  'support.errors.fileType',
  'support.errors.fileTooMany',
];

describe.each(['fr', 'en'])('messages support (%s)', (locale) => {
  const messages = load(locale);

  it.each(KEYS)('contient une valeur non vide pour %s', (key) => {
    const v = pick(messages, key);
    expect(typeof v === 'string' && v.trim().length > 0, `${key} manquante ou vide`).toBe(true);
  });

  it('annonce la réponse sous 24 h', () => {
    expect(String(pick(messages, 'support.responseTime'))).toMatch(/24\s?h/);
  });

  it('la FAQ ne cite ni fournisseur, ni JAP, ni marge', () => {
    const faq = JSON.stringify(pick(messages, 'support.faq')).toLowerCase();
    expect(faq).not.toMatch(/fournisseur|provider|\bjap\b|justanotherpanel|marge|margin/);
  });

  it('ne propose aucun lien Telegram ou WhatsApp au client', () => {
    const support = JSON.stringify(pick(messages, 'support')).toLowerCase();
    expect(support).not.toMatch(/telegram|whatsapp|t\.me/);
  });
});

describe('messages support : FR et EN ont les mêmes clés', () => {
  it('même arborescence sous « support »', () => {
    const keys = (o: unknown, p = ''): string[] =>
      o && typeof o === 'object'
        ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
        : [p];
    const fr = keys(pick(load('fr'), 'support')).sort();
    expect(fr.length).toBeGreaterThan(20);
    expect(keys(pick(load('en'), 'support')).sort()).toEqual(fr);
  });
});
