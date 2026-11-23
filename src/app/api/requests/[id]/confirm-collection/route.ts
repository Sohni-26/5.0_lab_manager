import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { confirmCollectionSchema } from "@/lib/validators/schemas";
import { confirmCollection } from "@/services/borrowing.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const rawText = await request.text();
    const body = rawText.trim().length > 0 ? JSON.parse(rawText) : {};
    const input = confirmCollectionSchema.parse(body);
    const updated = await confirmCollection(actor, id, input);
    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
