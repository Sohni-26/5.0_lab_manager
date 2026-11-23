import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { updateItemSchema } from "@/lib/validators/schemas";
import {
  deactivateMasterItem,
  getMasterItemById,
  updateMasterItem,
} from "@/services/item.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const item = await getMasterItemById(actor, id);
    return apiSuccess(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();
    const input = updateItemSchema.parse(body);
    const item = await updateMasterItem(actor, id, input);
    return apiSuccess(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const item = await deactivateMasterItem(actor, id);
    return apiSuccess(item);
  } catch (err) {
    return handleApiError(err);
  }
}
