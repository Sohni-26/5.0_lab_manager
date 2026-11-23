import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parseBooleanParam, parsePaginationParams } from "@/lib/pagination";
import {
  campusStatusSchema,
  createCampusSchema,
} from "@/lib/validators/schemas";
import { createCampus, listCampuses } from "@/services/campus.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 40,
      defaultSortBy: "code",
      defaultSortOrder: "asc",
      allowedSortFields: ["code", "name", "city", "status", "createdAt"],
    });
    const rawStatus = sp.get("status");
    const status = rawStatus ? campusStatusSchema.parse(rawStatus) : undefined;
    const includeStats = parseBooleanParam(sp.get("includeStats"));

    const result = await listCampuses(actor, pagination, {
      status,
      includeStats,
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
    const input = createCampusSchema.parse(body);
    const campus = await createCampus(actor, input);
    return apiSuccess(campus, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
