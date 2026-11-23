import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { parsePaginationParams } from "@/lib/pagination";
import { listInventoryTransactions } from "@/services/inventory.service";
import type { InventoryTransactionType } from "@/types/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const sp = request.nextUrl.searchParams;
    const pagination = parsePaginationParams(sp, {
      defaultPageSize: 25,
      defaultSortBy: "createdAt",
      defaultSortOrder: "desc",
    });

    const campusId = sp.get("campusId") ?? undefined;
    const itemId = sp.get("itemId") ?? undefined;
    const type = (sp.get("type") as InventoryTransactionType | null) ?? undefined;

    const result = await listInventoryTransactions(actor, pagination, {
      campusId,
      itemId,
      type,
    });
    return apiSuccess(result.data, result.meta);
  } catch (err) {
    return handleApiError(err);
  }
}
