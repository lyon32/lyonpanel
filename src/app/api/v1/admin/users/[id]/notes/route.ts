import type { NextRequest } from 'next/server';
import { addNote } from '@/server/admin/users';
import { requireAdminWrite } from '@/server/http/admin-write';
import { handler } from '@/server/http/handler';
import { parseBody } from '@/server/http/request';
import { noteSchema } from '@/server/schemas/admin-users';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handler(async (request, ctx) => {
    const admin = await requireAdminWrite(request);
    const { body } = await parseBody(request, noteSchema);
    const note = await addNote(admin.id, id, body);
    return Response.json(note, { status: 201, headers: { 'x-request-id': ctx.requestId } });
  })(req);
}
