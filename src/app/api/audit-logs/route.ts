import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parsePaginationParams } from "@/lib/pagination";
import { listAuditLogs } from "@/services/audit.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 30,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
    });

    const campusId = sp.get("campusId") ?? undefined;
    const entityType = sp.get("entityType") ?? undefined;
    const action = sp.get("action") ?? undefined;

    const result = await listAuditLogs(actor, pagination, {
      campusId,
      entityType,
      action,
    });
    return apiSuccess(result.data, result.meta);
  } catch (err) {
    return handleApiError(err);
  }
}
