import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { approvalActionSchema } from "@/lib/validators/schemas";
import { processLabManagerApproval } from "@/services/request.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = approvalActionSchema.parse(body);
    const updated = await processLabManagerApproval(actor, id, input);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
