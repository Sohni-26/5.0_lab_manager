import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { verifyReturnSchema } from "@/lib/validators/schemas";
import { verifyReturn } from "@/services/borrowing.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = verifyReturnSchema.parse(body);
    const updated = await verifyReturn(actor, id, input);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
