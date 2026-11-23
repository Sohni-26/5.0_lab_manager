import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { bulkVisibilitySchema } from "@/lib/validators/schemas";
import { bulkToggleInventoryVisibility } from "@/services/inventory.service";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const body = await request.json();
    const parsed = bulkVisibilitySchema.parse(body);
    const result = await bulkToggleInventoryVisibility(
      actor,
      parsed.ids,
      parsed.isVisible
    );
    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err);
  }
}
