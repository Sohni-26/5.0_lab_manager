import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  assertMockAuthEnabled,
  setSessionCookie,
} from "@/lib/auth/session";
import { mockLoginSchema } from "@/lib/validators/schemas";
import {
  apiSuccess,
  ForbiddenError,
  handleApiError,
  NotFoundError,
} from "@/lib/errors";
import { recordAuditLog } from "@/lib/audit/audit";
import type { AuthUserDTO } from "@/types/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertMockAuthEnabled();
    const body = await request.json();
    const parsed = mockLoginSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: parsed.userId
        ? { id: parsed.userId }
        : { email: parsed.email!.toLowerCase() },
      include: {
        campus: {
          select: { id: true, code: true, name: true, city: true, status: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError("No matching user account found");
    }

    if (user.status !== "ACTIVE") {
      throw new ForbiddenError(
        `User account is ${user.status} and cannot sign in`
      );
    }

    if (
      user.role !== "CENTRAL_LAB_MANAGER" &&
      (!user.campus || user.campus.status !== "ACTIVE")
    ) {
      throw new ForbiddenError(
        "User's assigned campus is inactive. Sign-in denied."
      );
    }

    await setSessionCookie(user.id);

    await recordAuditLog(prisma, {
      actorId: user.id,
      actorRole: user.role,
      campusId: user.campusId,
      action: "USER_MOCK_LOGIN",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email },
    });

    const dto: AuthUserDTO = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      institutionalId: user.institutionalId,
      role: user.role,
      status: user.status,
      campusId: user.campusId,
      campus: user.campus
        ? {
            id: user.campus.id,
            code: user.campus.code,
            name: user.campus.name,
            city: user.campus.city,
          }
        : null,
    };

    return apiSuccess(dto);
  } catch (err) {
    return handleApiError(err);
  }
}
