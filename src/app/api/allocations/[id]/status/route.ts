import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { updateAllocationStatusSchema } from "@/lib/validators/schemas";
import { updateAllocationStatus } from "@/services/allocation.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateAllocationStatusSchema.parse(body);
    const updated = await updateAllocationStatus(actor, id, input);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
