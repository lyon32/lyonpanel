// Compare les noms de la base LOCALE avec data/catalogue-services.csv : 0 écart attendu.
// Usage : variables Supabase locales, puis npm run catalogue:verify-local
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { createAdminClient } from '@/server/db/supabase-admin';

// Lecture d'une ligne CSV entre guillemets (les guillemets internes sont doublés).
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted && c === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else cell += c;
  }
  cells.push(cell);
  return cells;
}

test('les noms de la base locale sont ceux du CSV', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) {
    throw new Error("Refus : l'URL Supabase n'est pas locale.");
  }
  const file = process.env.CATALOGUE_CSV ?? 'data/catalogue-services.csv';
  const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).slice(1);
  const expected = new Map<number, string>();
  for (const line of lines.filter(Boolean)) {
    const cells = parseCsvLine(line);
    expected.set(Number(cells[0]), cells[3] ?? '');
  }

  const db = createAdminClient();
  const actual = new Map<number, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('services')
      .select('id, name_fr')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data) actual.set(r.id, r.name_fr ?? '');
    if (data.length < 1000) break;
  }

  const diffs = [...expected].filter(([id, name]) => actual.get(id) !== name).map(([id]) => id);
  const missing = [...actual.keys()].filter((id) => !expected.has(id));
  process.stdout.write(
    `\nVÉRIFICATION CSV=${expected.size} base=${actual.size} écarts=${diffs.length} hors-CSV=${missing.length}` +
      (diffs.length ? ` exemples=${diffs.slice(0, 5).join(',')}` : '') +
      '\n',
  );
  expect(diffs).toEqual([]);
});
