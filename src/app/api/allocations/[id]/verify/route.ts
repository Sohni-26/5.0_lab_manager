import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { verifyAllocationSchema } from "@/lib/validators/schemas";
import { verifyAllocation } from "@/services/allocation.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = verifyAllocationSchema.parse(body);
    const verified = await verifyAllocation(actor, id, input);
    return apiSuccess(verified);
  } catch (err) {
    return handleApiError(err);
  }
}
