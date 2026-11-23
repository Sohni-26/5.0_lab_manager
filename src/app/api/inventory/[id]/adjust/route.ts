import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { adjustInventorySchema } from "@/lib/validators/schemas";
import { adjustCampusInventory } from "@/services/inventory.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const parsed = adjustInventorySchema.parse(body);
    const updated = await adjustCampusInventory(actor, id, parsed);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
