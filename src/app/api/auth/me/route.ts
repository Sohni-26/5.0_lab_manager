import { requireAuth } from "@/lib/auth/rbac";
import { apiSuccess, handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireAuth();
    return apiSuccess(user);
  } catch (err) {
    return handleApiError(err);
  }
}
