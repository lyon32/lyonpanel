import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = process.cwd();
export const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
export const exists = (p: string) => existsSync(join(ROOT, p));

export type Json = { [k: string]: Json } | string | number | boolean | null | Json[];
export const messages = (loc: 'fr' | 'en') =>
  JSON.parse(read(`src/messages/${loc}.json`)) as Record<string, Json>;

// Aplatit un objet de messages en « a.b.c » -> texte.
export function flatten(obj: Json, prefix = ''): Record<string, string> {
  if (typeof obj !== 'object' || obj === null) return { [prefix]: String(obj) };
  return Object.entries(obj).reduce<Record<string, string>>(
    (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
    {},
  );
}

export function listFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
  );
}
export const sizeOf = (p: string) => statSync(join(ROOT, p)).size;
