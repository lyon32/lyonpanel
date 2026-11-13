import { requireApiUser } from '@/server/auth/require-api-user';
import { apiError } from '@/server/http/api-error';
import { handler } from '@/server/http/handler';
import { assertSameOrigin } from '@/server/http/request';
import { uploadAttachment } from '@/server/tickets/attachments';

export const POST = handler(async (req, ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  let form: FormData | null = null;
  try {
    form = await req.formData();
  } catch {
    // Corps illisible : traité comme un champ absent.
  }
  const file = form?.get('file');
  if (!(file instanceof File)) apiError('VALIDATION_ERROR', { fields: { file: 'REQUIRED' } });
  return Response.json(await uploadAttachment(user.id, file), {
    status: 201,
    headers: { 'x-request-id': ctx.requestId, 'cache-control': 'private, no-store' },
  });
});
