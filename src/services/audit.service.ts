import { prisma, type DbClient } from "@/lib/prisma";
import { assertRole, getEffectiveCampusScope } from "@/lib/auth/rbac";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AuditLogDTO,
  AuthUserDTO,
  PaginationMeta,
  UserRole,
} from "@/types/contracts";

export async function listAuditLogs(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: {
    campusId?: string;
    entityType?: string;
    action?: string;
  } = {},
  db: DbClient = prisma
): Promise<{ data: AuditLogDTO[]; meta: PaginationMeta }> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER"],
    "Only Central Lab Manager and Lab Managers can access audit logs"
  );

  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};
  if (effectiveCampusId) {
    where.campusId = effectiveCampusId;
  }
  if (filters.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters.action) {
    where.action = { contains: filters.action, mode: "insensitive" };
  }
  if (pagination.search) {
    where.OR = [
      { action: { contains: pagination.search, mode: "insensitive" } },
      { entityType: { contains: pagination.search, mode: "insensitive" } },
      { entityId: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
        campus: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.auditLog.count({ where }),
  ]);

  const data: AuditLogDTO[] = rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    actorRole: (row.actorRole as UserRole | null) ?? null,
    campusId: row.campusId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    previousState:
      row.previousState && typeof row.previousState === "object"
        ? (row.previousState as Record<string, unknown>)
        : null,
    newState:
      row.newState && typeof row.newState === "object"
        ? (row.newState as Record<string, unknown>)
        : null,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
    actor: row.actor ?? null,
    campus: row.campus ?? null,
  }));

  return {
    data,
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}
