import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { createTicketCommentSchema } from "@/lib/validators/schemas";
import { addTicketComment } from "@/services/ticket.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = createTicketCommentSchema.parse(body);
    const comment = await addTicketComment(actor, id, input);
    return apiSuccess(comment, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
