import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { toggleVisibilitySchema } from "@/lib/validators/schemas";
import { toggleInventoryVisibility } from "@/services/inventory.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = toggleVisibilitySchema.parse(body);
    const updated = await toggleInventoryVisibility(actor, id, parsed.isVisible);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
