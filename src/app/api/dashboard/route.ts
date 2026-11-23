import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { getDashboardForActor } from "@/services/dashboard.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const campusId =
      actor.role === "CENTRAL_LAB_MANAGER"
        ? request.nextUrl.searchParams.get("campusId") ?? undefined
        : undefined;

    const data = await getDashboardForActor(actor, campusId);
    return apiSuccess(data);
  } catch (err) {
    return handleApiError(err);
  }
}
