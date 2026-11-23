import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { createCategorySchema } from "@/lib/validators/schemas";
import { createCategory, listCategories } from "@/services/item.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const categories = await listCategories();
    return apiSuccess(categories);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAuth();
    const body = await request.json();
    const input = createCategorySchema.parse(body);
    const category = await createCategory(actor, input);
    return apiSuccess(category, undefined, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
