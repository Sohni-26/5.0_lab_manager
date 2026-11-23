import { clearSessionCookie } from "@/lib/auth/session";
import { apiSuccess, handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await clearSessionCookie();
    return apiSuccess({ loggedOut: true });
  } catch (err) {
    return handleApiError(err);
  }
}
