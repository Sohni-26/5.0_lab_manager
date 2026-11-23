import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { updateUserSchema } from "@/lib/validators/schemas";
import {
  deactivateUser,
  getUserById,
  updateUser,
} from "@/services/user.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const user = await getUserById(actor, id);
    return apiSuccess(user);
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
    const input = updateUserSchema.parse(body);
    const user = await updateUser(actor, id, input);
    return apiSuccess(user);
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
    const user = await deactivateUser(actor, id);
    return apiSuccess(user);
  } catch (err) {
    return handleApiError(err);
  }
}
