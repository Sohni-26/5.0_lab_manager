import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { getAllocationById } from "@/services/allocation.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const allocation = await getAllocationById(actor, id);
    return apiSuccess(allocation);
  } catch (err) {
    return handleApiError(err);
  }
}
