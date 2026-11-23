import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { updateCampusSchema } from "@/lib/validators/schemas";
import {
  deactivateCampus,
  getCampusById,
  updateCampus,
} from "@/services/campus.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAuth();
    const { id } = await context.params;
    const campus = await getCampusById(actor, id);
    return apiSuccess(campus);
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
    const input = updateCampusSchema.parse(body);
    const campus = await updateCampus(actor, id, input);
    return apiSuccess(campus);
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
    const campus = await deactivateCampus(actor, id);
    return apiSuccess(campus);
  } catch (err) {
    return handleApiError(err);
  }
}
