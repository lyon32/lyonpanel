// Génère data/catalogue-services.csv, data/catalogue-resume.json et les tableaux pour docs/01.
// Usage : CATALOGUE_RAW=<fichier brut .json> npm run catalogue:build
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { buildMarkdown, buildRows, buildSummary, toCsv } from './generate';
import { providerServicesSchema } from '@/server/providers/types';

test('génère le catalogue', () => {
  const raw = process.env.CATALOGUE_RAW;
  if (!raw) throw new Error('Variable CATALOGUE_RAW manquante (chemin du fichier brut).');
  const services = providerServicesSchema.parse(JSON.parse(readFileSync(raw, 'utf8')));
  const rows = buildRows(services);
  const out = resolve(process.cwd(), 'data');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'catalogue-services.csv'), toCsv(rows), 'utf8');
  writeFileSync(
    resolve(out, 'catalogue-resume.json'),
    `${JSON.stringify(buildSummary(rows), null, 2)}\n`,
    'utf8',
  );
  // Tableaux à coller dans docs/01 : écrits hors du dépôt si CATALOGUE_MD_OUT est donné.
  const md = buildMarkdown(rows);
  const mdOut = process.env.CATALOGUE_MD_OUT;
  if (mdOut) {
    writeFileSync(
      mdOut,
      `${md.recap}\n\n${md.perNetwork}\n\n## Chers (${md.expensive.count})\n\n${md.expensive.table}\n\n## Minimum élevé (${md.bigMin.count})\n\n${md.bigMin.table}\n`,
      'utf8',
    );
  }
});
