import type { AuthUserDTO, UserRole } from "@/types/contracts";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { getSessionUser } from "@/lib/auth/session";
import { prisma, type DbClient } from "@/lib/prisma";

/**
 * Resolves the authenticated user from server-side session cookies.
 * Throws 401 if unauthenticated or inactive.
 */
export async function requireAuth(db: DbClient = prisma): Promise<AuthUserDTO> {
  const user = await getSessionUser(db);
  if (!user) {
    throw new UnauthorizedError("Authentication required. Please sign in.");
  }
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("Your account is not active");
  }
  return user;
}

/**
 * Enforces that the authenticated actor holds one of the allowed roles.
 */
export function assertRole(
  user: AuthUserDTO,
  allowedRoles: readonly UserRole[],
  customMessage?: string
): void {
  if (user.status !== "ACTIVE") {
    throw new ForbiddenError("Your account is not active");
  }
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(
      customMessage ??
        `Access denied. Allowed roles: ${allowedRoles.join(", ")}`
    );
  }
}

/**
 * Convenience helper combining authentication and role enforcement for route handlers.
 */
export async function requireRole(
  allowedRoles: readonly UserRole[],
  db: DbClient = prisma
): Promise<AuthUserDTO> {
  const user = await requireAuth(db);
  assertRole(user, allowedRoles);
  return user;
}

/**
 * Enforces strict campus isolation:
 * - CENTRAL_LAB_MANAGER can access any campus.
 * - All campus-scoped roles (LAB_MANAGER, INSTRUCTOR, STUDENT) can ONLY access their assigned campusId.
 */
export function assertCampusScope(
  user: AuthUserDTO,
  targetCampusId: string | null | undefined,
  actionDescription = "access this campus resource"
): void {
  if (user.role === "CENTRAL_LAB_MANAGER") {
    return;
  }
  if (!user.campusId) {
    throw new ForbiddenError("User is not assigned to an active campus");
  }
  if (!targetCampusId || user.campusId !== targetCampusId) {
    throw new ForbiddenError(
      `Cross-campus access denied: you are not permitted to ${actionDescription}`
    );
  }
}

/**
 * Resolves the effective campusId filter for queries.
 * - CENTRAL_LAB_MANAGER: optional requestedCampusId (or undefined for global view)
 * - Campus roles: ALWAYS returns the authenticated user's own campusId, ignoring/rejecting any cross-campus query param.
 */
export function getEffectiveCampusScope(
  user: AuthUserDTO,
  requestedCampusId?: string | null
): string | undefined {
  if (user.role === "CENTRAL_LAB_MANAGER") {
    return requestedCampusId && requestedCampusId.trim().length > 0
      ? requestedCampusId.trim()
      : undefined;
  }
  if (!user.campusId) {
    throw new ForbiddenError("User is not assigned to any campus");
  }
  if (
    requestedCampusId &&
    requestedCampusId.trim().length > 0 &&
    requestedCampusId.trim() !== user.campusId
  ) {
    throw new ForbiddenError(
      "Cross-campus data access is strictly prohibited"
    );
  }
  return user.campusId;
}

/**
 * Asserts that a campus-scoped user has a valid campusId and returns it.
 */
export function requireUserCampusId(user: AuthUserDTO): string {
  if (!user.campusId) {
    throw new ForbiddenError("This action requires an assigned campus");
  }
  return user.campusId;
}
