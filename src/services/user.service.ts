import { prisma, type DbClient } from "@/lib/prisma";
import {
  assertCampusScope,
  assertRole,
  getEffectiveCampusScope,
} from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AuthUserDTO,
  MockUserOptionDTO,
  PaginationMeta,
  UserRole,
  UserStatus,
} from "@/types/contracts";

function mapUserToDTO(user: {
  id: string;
  fullName: string;
  email: string;
  institutionalId: string;
  role: UserRole;
  status: UserStatus;
  campusId: string | null;
  campus?: {
    id: string;
    code: string;
    name: string;
    city: string | null;
  } | null;
}): AuthUserDTO {
  return {
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
}

export async function listMockUsers(
  db: DbClient = prisma
): Promise<MockUserOptionDTO[]> {
  const users = await db.user.findMany({
    where: { status: "ACTIVE" },
    include: {
      campus: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    take: 100,
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    institutionalId: u.institutionalId,
    role: u.role,
    campusId: u.campusId,
    campusCode: u.campus?.code ?? null,
    campusName: u.campus?.name ?? null,
  }));
}

export async function listUsers(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: {
    role?: UserRole;
    campusId?: string;
    status?: UserStatus;
  } = {},
  db: DbClient = prisma
): Promise<{ data: AuthUserDTO[]; meta: PaginationMeta }> {
  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};

  if (effectiveCampusId) {
    where.campusId = effectiveCampusId;
  }

  // Students can only list active instructors from their own campus (for selecting request reviewer)
  if (actor.role === "STUDENT") {
    if (filters.role && filters.role !== "INSTRUCTOR") {
      throw new ForbiddenError(
        "Students may only view instructors in their own campus"
      );
    }
    where.role = "INSTRUCTOR";
    where.status = "ACTIVE";
  } else if (actor.role === "INSTRUCTOR") {
    if (filters.role && !["INSTRUCTOR", "STUDENT", "LAB_MANAGER"].includes(filters.role)) {
      throw new ForbiddenError(
        "Instructors may only view campus personnel and students"
      );
    }
    where.role = filters.role ?? { in: ["INSTRUCTOR", "STUDENT", "LAB_MANAGER"] };
  } else if (filters.role) {
    where.role = filters.role;
  }

  if (filters.status && actor.role !== "STUDENT") {
    where.status = filters.status;
  }

  if (pagination.search) {
    where.OR = [
      { fullName: { contains: pagination.search, mode: "insensitive" } },
      { email: { contains: pagination.search, mode: "insensitive" } },
      { institutionalId: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  const orderByField = pagination.sortBy ?? "createdAt";
  const orderBy = { [orderByField]: pagination.sortOrder };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      include: {
        campus: { select: { id: true, code: true, name: true, city: true } },
      },
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.user.count({ where }),
  ]);

  return {
    data: users.map(mapUserToDTO),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getUserById(
  actor: AuthUserDTO,
  userId: string,
  db: DbClient = prisma
): Promise<AuthUserDTO> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      campus: { select: { id: true, code: true, name: true, city: true } },
    },
  });

  if (!user) {
    throw new NotFoundError(`User '${userId}' not found`);
  }

  if (actor.role !== "CENTRAL_LAB_MANAGER" && actor.id !== user.id) {
    assertCampusScope(actor, user.campusId, "view this user");
  }

  return mapUserToDTO(user);
}

async function validateRoleCampusAssignment(
  role: UserRole,
  campusId: string | null | undefined,
  db: DbClient,
  excludeUserId?: string
): Promise<string | null> {
  if (role === "CENTRAL_LAB_MANAGER") {
    if (campusId !== null && campusId !== undefined) {
      throw new BadRequestError(
        "CENTRAL_LAB_MANAGER must not be assigned to a specific campus (campusId must be null)"
      );
    }

    const existingCentral = await db.user.findFirst({
      where: {
        role: "CENTRAL_LAB_MANAGER",
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
    });
    if (existingCentral) {
      throw new ConflictError(
        "Only ONE Central Lab Manager is permitted across the entire system"
      );
    }

    return null;
  }

  if (!campusId) {
    throw new BadRequestError(
      `Role '${role}' requires a valid campusId assignment`
    );
  }

  const campus = await db.campus.findUnique({ where: { id: campusId } });
  if (!campus) {
    throw new NotFoundError(`Campus '${campusId}' not found`);
  }
  if (campus.status !== "ACTIVE") {
    throw new BadRequestError(
      `Cannot assign user to inactive campus '${campus.code}'`
    );
  }

  return campus.id;
}

export async function createUser(
  actor: AuthUserDTO,
  input: {
    fullName: string;
    email: string;
    institutionalId: string;
    role: UserRole;
    campusId?: string | null;
    status?: UserStatus;
  },
  db: DbClient = prisma
): Promise<AuthUserDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can create users"
  );

  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedInstId = input.institutionalId.trim().toUpperCase();

  const [dupEmail, dupInstId] = await Promise.all([
    db.user.findUnique({ where: { email: normalizedEmail } }),
    db.user.findUnique({ where: { institutionalId: normalizedInstId } }),
  ]);

  if (dupEmail) {
    throw new ConflictError(`Email '${normalizedEmail}' is already registered`);
  }
  if (dupInstId) {
    throw new ConflictError(
      `Institutional ID '${normalizedInstId}' is already registered`
    );
  }

  const resolvedCampusId = await validateRoleCampusAssignment(
    input.role,
    input.campusId ?? null,
    db
  );

  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName.trim(),
        email: normalizedEmail,
        institutionalId: normalizedInstId,
        role: input.role,
        status: input.status ?? "ACTIVE",
        campusId: resolvedCampusId,
      },
      include: {
        campus: { select: { id: true, code: true, name: true, city: true } },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: user.campusId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      newState: {
        fullName: user.fullName,
        email: user.email,
        institutionalId: user.institutionalId,
        role: user.role,
        campusId: user.campusId,
        status: user.status,
      },
    });

    return user;
  });

  return mapUserToDTO(created);
}

export async function updateUser(
  actor: AuthUserDTO,
  userId: string,
  input: {
    fullName?: string;
    email?: string;
    institutionalId?: string;
    role?: UserRole;
    campusId?: string | null;
    status?: UserStatus;
  },
  db: DbClient = prisma
): Promise<AuthUserDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can update users"
  );

  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new NotFoundError(`User '${userId}' not found`);
  }

  const nextEmail = input.email ? input.email.trim().toLowerCase() : existing.email;
  const nextInstId = input.institutionalId
    ? input.institutionalId.trim().toUpperCase()
    : existing.institutionalId;

  if (nextEmail !== existing.email) {
    const dupEmail = await db.user.findUnique({ where: { email: nextEmail } });
    if (dupEmail) {
      throw new ConflictError(`Email '${nextEmail}' is already registered`);
    }
  }

  if (nextInstId !== existing.institutionalId) {
    const dupInstId = await db.user.findUnique({
      where: { institutionalId: nextInstId },
    });
    if (dupInstId) {
      throw new ConflictError(
        `Institutional ID '${nextInstId}' is already registered`
      );
    }
  }

  const nextRole = input.role ?? existing.role;
  const nextCampusInput =
    input.campusId !== undefined ? input.campusId : existing.campusId;

  const resolvedCampusId = await validateRoleCampusAssignment(
    nextRole,
    nextCampusInput,
    db,
    existing.id
  );

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined
          ? { fullName: input.fullName.trim() }
          : {}),
        email: nextEmail,
        institutionalId: nextInstId,
        role: nextRole,
        campusId: resolvedCampusId,
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      include: {
        campus: { select: { id: true, code: true, name: true, city: true } },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: user.campusId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: user.id,
      previousState: {
        role: existing.role,
        campusId: existing.campusId,
        status: existing.status,
      },
      newState: {
        role: user.role,
        campusId: user.campusId,
        status: user.status,
      },
    });

    return user;
  });

  return mapUserToDTO(updated);
}

export async function deactivateUser(
  actor: AuthUserDTO,
  userId: string,
  db: DbClient = prisma
): Promise<AuthUserDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can deactivate users"
  );

  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) {
    throw new NotFoundError(`User '${userId}' not found`);
  }

  if (existing.id === actor.id) {
    throw new BadRequestError("Central Lab Manager cannot deactivate their own account");
  }

  const updated = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: "INACTIVE" },
      include: {
        campus: { select: { id: true, code: true, name: true, city: true } },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: user.campusId,
      action: "USER_DEACTIVATED",
      entityType: "User",
      entityId: user.id,
      previousState: { status: existing.status },
      newState: { status: "INACTIVE" },
    });

    return user;
  });

  return mapUserToDTO(updated);
}
