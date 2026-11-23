import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parsePaginationParams } from "@/lib/pagination";
import {
  createUserSchema,
  userRoleSchema,
  userStatusSchema,
} from "@/lib/validators/schemas";
import { createUser, listUsers } from "@/services/user.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 25,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
      allowedSortFields: [
        "fullName",
        "email",
        "institutionalId",
        "role",
        "status",
        "createdAt",
      ],
    });

    const rawRole = sp.get("role");
    const rawStatus = sp.get("status");
    const role = rawRole ? userRoleSchema.parse(rawRole) : undefined;
    const status = rawStatus ? userStatusSchema.parse(rawStatus) : undefined;
    const campusId = sp.get("campusId") ?? undefined;

    const result = await listUsers(actor, pagination, {
      role,
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
    const input = createUserSchema.parse(body);
    const user = await createUser(actor, input);
    return apiSuccess(user, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
