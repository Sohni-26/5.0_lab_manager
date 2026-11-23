import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { getCampusInventoryById } from "@/services/inventory.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const data = await getCampusInventoryById(actor, id);
    return apiSuccess(data);
  } catch (err) {
    return handleApiError(err);
  }
}
