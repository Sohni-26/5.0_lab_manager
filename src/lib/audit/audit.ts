import type { Prisma } from "@prisma/client";
import type { PrismaLike } from "@/lib/prisma";
import type { UserRole } from "@/types/contracts";

export interface RecordAuditLogInput {
  actorId: string | null;
  actorRole: UserRole | null;
  campusId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Appends an immutable entry to the audit_logs table.
 * Accepts either a standalone PrismaClient or an active transaction client `tx`.
 */
export async function recordAuditLog(
  db: PrismaLike,
  input: RecordAuditLogInput
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      campusId: input.campusId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousState: (input.previousState ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      newState: (input.newState ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      metadata: (input.metadata ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
    },
  });
}
