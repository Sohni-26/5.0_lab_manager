import { assertMockAuthEnabled } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/errors";
import { listMockUsers } from "@/services/user.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertMockAuthEnabled();
    const users = await listMockUsers();
    return apiSuccess(users);
  } catch (err) {
    return handleApiError(err);
  }
}
