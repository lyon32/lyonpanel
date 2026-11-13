import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { TINY_PNG } from '../../helpers/tickets-db';
import { ApiError } from '@/server/http/api-error';
import {
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
  detectImageMime,
  validateAttachment,
} from '@/server/tickets/attachments';

/*
 * Contrat attendu (src/server/tickets/attachments.ts), fonctions pures :
 *   MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
 *   detectImageMime(bytes): 'image/jpeg' | 'image/png' | 'image/webp' | null   (lit les premiers octets)
 *   validateAttachment({ type, size, bytes }): void   -> lève ApiError FILE_TOO_LARGE ou FILE_TYPE_NOT_ALLOWED (422)
 *   attachmentPath(userId, fileId, mime): string       -> `<userId>/<fileId>.jpg|png|webp`
 */

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);
const GIF = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]);
const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

type Candidate = Parameters<typeof validateAttachment>[0];

function codeOf(file: Candidate): string | null {
  try {
    validateAttachment(file);
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.code : `autre:${String(e)}`;
  }
}

describe('detectImageMime', () => {
  it.each([
    ['png', TINY_PNG, 'image/png'],
    ['jpeg', JPEG, 'image/jpeg'],
    ['webp', WEBP, 'image/webp'],
  ])('reconnaît %s par son contenu', (_n, bytes, mime) => {
    expect(detectImageMime(bytes)).toBe(mime);
  });

  it.each([
    ['gif', GIF],
    ['pdf', PDF],
    ['vide', new Uint8Array()],
  ])('renvoie null pour %s', (_n, bytes) => {
    expect(detectImageMime(bytes)).toBeNull();
  });
});

describe('validateAttachment', () => {
  it('accepte une image PNG, JPEG ou WebP, même de 2 Mo pile', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(2_097_152);
    expect(codeOf({ type: 'image/png', size: MAX_ATTACHMENT_BYTES, bytes: TINY_PNG })).toBeNull();
    expect(codeOf({ type: 'image/jpeg', size: 1000, bytes: JPEG })).toBeNull();
    expect(codeOf({ type: 'image/webp', size: 1000, bytes: WEBP })).toBeNull();
  });

  it('refuse plus de 2 Mo (FILE_TOO_LARGE)', () => {
    expect(codeOf({ type: 'image/png', size: MAX_ATTACHMENT_BYTES + 1, bytes: TINY_PNG })).toBe(
      'FILE_TOO_LARGE',
    );
  });

  it('refuse un fichier vide (FILE_TYPE_NOT_ALLOWED)', () => {
    expect(codeOf({ type: 'image/png', size: 0, bytes: new Uint8Array() })).toBe(
      'FILE_TYPE_NOT_ALLOWED',
    );
  });

  it.each([
    ['image/gif', GIF],
    ['application/pdf', PDF],
    ['image/svg+xml', TINY_PNG],
    ['text/html', TINY_PNG],
  ])('refuse le type annoncé %s (FILE_TYPE_NOT_ALLOWED)', (type, bytes) => {
    expect(codeOf({ type, size: 1000, bytes })).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('refuse un PDF déguisé en image/png (le contenu compte, pas le type annoncé)', () => {
    expect(codeOf({ type: 'image/png', size: 1000, bytes: PDF })).toBe('FILE_TYPE_NOT_ALLOWED');
  });
});

describe('attachmentPath', () => {
  it('range le fichier sous le dossier de son propriétaire, avec une extension sûre', () => {
    const user = randomUUID();
    const file = randomUUID();
    expect(attachmentPath(user, file, 'image/png')).toBe(`${user}/${file}.png`);
    expect(attachmentPath(user, file, 'image/jpeg')).toBe(`${user}/${file}.jpg`);
    expect(attachmentPath(user, file, 'image/webp')).toBe(`${user}/${file}.webp`);
  });
});
