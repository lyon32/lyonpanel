import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findSecrets } from '../../scripts/check-client-bundle.mjs';

describe('findSecrets', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bundle-'));
    mkdirSync(join(dir, 'chunks'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('ne trouve rien dans un bundle propre', () => {
    writeFileSync(join(dir, 'chunks', 'app.js'), 'console.log("bonjour LyonPanel");');
    expect(findSecrets(dir, ['sk_live_', 'valeur-secrete-123'])).toEqual([]);
  });

  it('trouve un motif sk_live_ dans un fichier js', () => {
    const file = join(dir, 'chunks', 'leak.js');
    writeFileSync(file, 'const k = "sk_live_abc123";');
    const result = findSecrets(dir, ['sk_live_']);
    expect(result).toHaveLength(1);
    expect(result[0]?.file).toBe(file);
    expect(result[0]?.needle).toBe('sk_live_');
  });

  it("trouve la valeur exacte d'un secret passé en aiguille", () => {
    const file = join(dir, 'chunks', 'leak2.js');
    writeFileSync(file, 'x="S3cr3t-Valeur-XYZ";');
    const result = findSecrets(dir, ['S3cr3t-Valeur-XYZ']);
    expect(result).toHaveLength(1);
    expect(result[0]?.file).toBe(file);
    expect(result[0]?.needle).toBe('S3cr3t-Valeur-XYZ');
  });

  it('ignore les fichiers .map', () => {
    writeFileSync(join(dir, 'chunks', 'app.js.map'), '{"sk_live_":"x"}');
    expect(findSecrets(dir, ['sk_live_'])).toEqual([]);
  });
});
