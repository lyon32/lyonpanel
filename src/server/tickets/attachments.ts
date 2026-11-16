import 'server-only';
import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/server/db/supabase-admin';
import { apiError } from '@/server/http/api-error';

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_BUCKET = 'ticket-attachments';

type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
const EXTENSIONS: Record<ImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Type réel d'après les premiers octets : le type annoncé par le navigateur ne prouve rien. */
export function detectImageMime(bytes: Uint8Array): ImageMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP : « RIFF » + taille + « WEBP ».
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateAttachment(file: { type: string; size: number; bytes: Uint8Array }): void {
  if (file.size > MAX_ATTACHMENT_BYTES) apiError('FILE_TOO_LARGE');
  if (file.size === 0) apiError('FILE_TYPE_NOT_ALLOWED');
  const real = detectImageMime(file.bytes);
  if (!real || real !== file.type) apiError('FILE_TYPE_NOT_ALLOWED');
}

/** Toujours sous le dossier du client : c'est ce que vérifient les règles du stockage. */
export function attachmentPath(userId: string, fileId: string, mime: ImageMime): string {
  return `${userId}/${fileId}.${EXTENSIONS[mime]}`;
}

/** Dépose l'image telle quelle dans le bucket privé ; l'id renvoyé sert d'attachment_ids. */
export async function uploadAttachment(userId: string, file: File): Promise<{ id: string }> {
  // Contrôle de la taille avant de lire le contenu en mémoire.
  if (file.size > MAX_ATTACHMENT_BYTES) apiError('FILE_TOO_LARGE');
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateAttachment({ type: file.type, size: bytes.length, bytes });
  const mime = detectImageMime(bytes);
  if (!mime) return apiError('FILE_TYPE_NOT_ALLOWED');
  const id = randomUUID();
  const { error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .upload(attachmentPath(userId, id, mime), bytes, { contentType: mime });
  if (error) throw new Error(`pièce jointe: ${error.message}`);
  return { id };
}
