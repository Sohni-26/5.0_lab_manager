import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parsePaginationParams } from "@/lib/pagination";
import { createLabRequestSchema } from "@/lib/validators/schemas";
import {
  createLabRequest,
  listLabRequests,
} from "@/services/request.service";
import type { LabRequestStatus } from "@/types/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 20,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      allowedSortFields: ["createdAt", "updatedAt", "status", "requestCode"],
    });

    const status = (sp.get("status") as LabRequestStatus | null) ?? undefined;
    const campusId = sp.get("campusId") ?? undefined;

    const result = await listLabRequests(actor, pagination, {
      status,
      campusId,
    });
    return apiSuccess(result.data, result.meta);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const body = await request.json();
    const input = createLabRequestSchema.parse(body);
    const created = await createLabRequest(actor, input);
    return apiSuccess(created, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
