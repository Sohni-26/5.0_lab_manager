import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parseBooleanParam, parsePaginationParams } from "@/lib/pagination";
import { createItemSchema } from "@/lib/validators/schemas";
import { createMasterItem, listMasterItems } from "@/services/item.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 25,
      defaultSortBy: "name",
      defaultSortOrder: "asc",
      allowedSortFields: ["code", "name", "brand", "createdAt", "updatedAt"],
    });
    const categoryId = sp.get("categoryId") ?? undefined;
    const isActive = parseBooleanParam(sp.get("isActive"));

    const result = await listMasterItems(actor, pagination, {
      categoryId,
      isActive,
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
    const input = createItemSchema.parse(body);
    const item = await createMasterItem(actor, input);
    return apiSuccess(item, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
