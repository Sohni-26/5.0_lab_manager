import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parseBooleanParam, parsePaginationParams } from "@/lib/pagination";
import { listCampusInventory } from "@/services/inventory.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 25,
      defaultSortBy: "updatedAt",
      defaultSortOrder: "desc",
      allowedSortFields: [
        "updatedAt",
        "availableQuantity",
        "receivedQuantity",
        "borrowedQuantity",
        "allocatedQuantity",
        "name",
        "code",
      ],
    });

    const campusId = sp.get("campusId") ?? undefined;
    const categoryId = sp.get("categoryId") ?? undefined;
    const isVisible = parseBooleanParam(sp.get("isVisible"));
    const isVerified = parseBooleanParam(sp.get("isVerified"));

    const result = await listCampusInventory(actor, pagination, {
      campusId,
      categoryId,
      isVisible,
      isVerified,
    });

    return apiSuccess(result.data, result.meta);
  } catch (err) {
    return handleApiError(err);
  }
}
