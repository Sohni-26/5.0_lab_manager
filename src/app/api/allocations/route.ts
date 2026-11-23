import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parsePaginationParams } from "@/lib/pagination";
import {
  allocationStatusSchema,
  createAllocationSchema,
} from "@/lib/validators/schemas";
import {
  createAllocation,
  listAllocations,
} from "@/services/allocation.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 20,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      allowedSortFields: ["createdAt", "updatedAt", "status", "referenceCode"],
    });

    const campusId = sp.get("campusId") ?? undefined;
    const rawStatus = sp.get("status");
    const status = rawStatus
      ? allocationStatusSchema.parse(rawStatus)
      : undefined;

    const result = await listAllocations(actor, pagination, {
      campusId,
      status,
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
    const input = createAllocationSchema.parse(body);
    const allocation = await createAllocation(actor, input);
    return apiSuccess(allocation, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
