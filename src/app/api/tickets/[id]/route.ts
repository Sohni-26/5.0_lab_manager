import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { updateTicketSchema } from "@/lib/validators/schemas";
import {
  getIssueTicketById,
  updateIssueTicket,
} from "@/services/ticket.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const ticket = await getIssueTicketById(actor, id);
    return apiSuccess(ticket);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateTicketSchema.parse(body);
    const updated = await updateIssueTicket(actor, id, input);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
