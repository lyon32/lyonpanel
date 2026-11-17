import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/server/auth/require-admin';
import { addNote } from '@/server/admin/users';
import { handler } from '@/server/http/handler';
import { assertSameOrigin, parseBody } from '@/server/http/request';
import { noteSchema } from '@/server/schemas/admin-users';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { body } = await parseBody(request, noteSchema);
    const note = await addNote(admin.id, id, body);
    return Response.json(note, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  })(req);
}
