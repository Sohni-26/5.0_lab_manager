import crypto from "crypto";
import { prisma, type DbClient } from "@/lib/prisma";
import {
  assertCampusScope,
  assertRole,
  getEffectiveCampusScope,
} from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import { realtimeEventBus } from "@/lib/realtime/event-bus";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AllocationStatus,
  AuthUserDTO,
  PaginationMeta,
  StockAllocationDTO,
} from "@/types/contracts";

function generateAllocationReference(campusCode: string): string {
  const short = crypto.randomBytes(3).toString("hex").toUpperCase();
  const year = new Date().getFullYear();
  return `ALLOC-${year}-${campusCode}-${short}`;
}

const ALLOCATION_INCLUDE = {
  destinationCampus: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true, email: true } },
  verifiedBy: { select: { id: true, fullName: true } },
  items: {
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

function mapAllocationToDTO(a: {
  id: string;
  referenceCode: string;
  source: string;
  destinationCampusId: string;
  createdById: string;
  status: AllocationStatus;
  notes: string | null;
  dispatchedAt: Date | null;
  verifiedAt: Date | null;
  verifiedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  destinationCampus: { id: string; code: string; name: string };
  createdBy: { id: string; fullName: string; email: string };
  verifiedBy?: { id: string; fullName: string } | null;
  items: Array<{
    id: string;
    allocationId: string;
    itemId: string;
    allocatedQuantity: number;
    receivedQuantity: number;
    missingQuantity: number;
    damagedQuantity: number;
    isVerified: boolean;
    verificationNotes: string | null;
    verifiedAt: Date | null;
    item: {
      id: string;
      code: string;
      name: string;
      unit: string;
      category?: { id: string; name: string };
    };
  }>;
}): StockAllocationDTO {
  return {
    id: a.id,
    referenceCode: a.referenceCode,
    source: a.source,
    destinationCampusId: a.destinationCampusId,
    createdById: a.createdById,
    status: a.status,
    notes: a.notes,
    dispatchedAt: a.dispatchedAt ? a.dispatchedAt.toISOString() : null,
    verifiedAt: a.verifiedAt ? a.verifiedAt.toISOString() : null,
    verifiedById: a.verifiedById,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    destinationCampus: a.destinationCampus,
    createdBy: a.createdBy,
    verifiedBy: a.verifiedBy ?? null,
    items: a.items.map((item) => ({
      id: item.id,
      allocationId: item.allocationId,
      itemId: item.itemId,
      allocatedQuantity: item.allocatedQuantity,
      receivedQuantity: item.receivedQuantity,
      missingQuantity: item.missingQuantity,
      damagedQuantity: item.damagedQuantity,
      isVerified: item.isVerified,
      verificationNotes: item.verificationNotes,
      verifiedAt: item.verifiedAt ? item.verifiedAt.toISOString() : null,
      item: item.item,
    })),
  };
}

export async function listAllocations(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: { campusId?: string; status?: AllocationStatus } = {},
  db: DbClient = prisma
): Promise<{ data: StockAllocationDTO[]; meta: PaginationMeta }> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER"],
    "Only Central Lab Manager and Lab Managers can access stock allocations"
  );

  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};
  if (effectiveCampusId) {
    where.destinationCampusId = effectiveCampusId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (pagination.search) {
    where.OR = [
      { referenceCode: { contains: pagination.search, mode: "insensitive" } },
      { source: { contains: pagination.search, mode: "insensitive" } },
      { notes: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  const orderByField = pagination.sortBy ?? "createdAt";
  const orderBy = { [orderByField]: pagination.sortOrder };

  const [allocations, total] = await Promise.all([
    db.stockAllocation.findMany({
      where,
      include: ALLOCATION_INCLUDE,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.stockAllocation.count({ where }),
  ]);

  return {
    data: allocations.map(mapAllocationToDTO),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getAllocationById(
  actor: AuthUserDTO,
  allocationId: string,
  db: DbClient = prisma
): Promise<StockAllocationDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER"],
    "Only Central Lab Manager and Lab Managers can view stock allocations"
  );

  const allocation = await db.stockAllocation.findUnique({
    where: { id: allocationId },
    include: ALLOCATION_INCLUDE,
  });

  if (!allocation) {
    throw new NotFoundError(`Allocation '${allocationId}' not found`);
  }

  assertCampusScope(
    actor,
    allocation.destinationCampusId,
    "view this campus allocation"
  );

  return mapAllocationToDTO(allocation);
}

export async function createAllocation(
  actor: AuthUserDTO,
  input: {
    destinationCampusId: string;
    source?: string;
    notes?: string | null;
    dispatchImmediately?: boolean;
    items: Array<{ itemId: string; allocatedQuantity: number }>;
  },
  db: DbClient = prisma
): Promise<StockAllocationDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can create stock allocations"
  );

  const campus = await db.campus.findUnique({
    where: { id: input.destinationCampusId },
  });
  if (!campus) {
    throw new NotFoundError(
      `Destination campus '${input.destinationCampusId}' not found`
    );
  }
  if (campus.status !== "ACTIVE") {
    throw new BadRequestError(
      `Cannot allocate stock to inactive campus '${campus.code}'`
    );
  }

  // Deduplicate itemIds check
  const seenItemIds = new Set<string>();
  for (const entry of input.items) {
    if (seenItemIds.has(entry.itemId)) {
      throw new BadRequestError(
        `Duplicate item '${entry.itemId}' in allocation items list`
      );
    }
    seenItemIds.add(entry.itemId);
    if (entry.allocatedQuantity <= 0) {
      throw new BadRequestError("Allocated quantity must be greater than zero");
    }
  }

  const masterItems = await db.item.findMany({
    where: { id: { in: Array.from(seenItemIds) } },
  });
  if (masterItems.length !== seenItemIds.size) {
    throw new NotFoundError("One or more specified master items do not exist");
  }
  const inactiveItem = masterItems.find((i) => !i.isActive);
  if (inactiveItem) {
    throw new BadRequestError(
      `Cannot allocate deactivated master item '${inactiveItem.code}'`
    );
  }

  const initialStatus: AllocationStatus = input.dispatchImmediately
    ? "DISPATCHED"
    : "DRAFT";
  const now = new Date();
  const referenceCode = generateAllocationReference(campus.code);

  const created = await db.$transaction(async (tx) => {
    const allocation = await tx.stockAllocation.create({
      data: {
        referenceCode,
        source: input.source?.trim() || "Central Warehouse",
        destinationCampusId: campus.id,
        createdById: actor.id,
        status: initialStatus,
        notes: input.notes ?? null,
        dispatchedAt: input.dispatchImmediately ? now : null,
        items: {
          create: input.items.map((item) => ({
            itemId: item.itemId,
            allocatedQuantity: item.allocatedQuantity,
            receivedQuantity: 0,
            missingQuantity: 0,
            damagedQuantity: 0,
            isVerified: false,
          })),
        },
      },
      include: ALLOCATION_INCLUDE,
    });

    // Update or create CampusInventory allocatedQuantity (NOTE: NEVER auto-verify or add to available!)
    for (const item of input.items) {
      const existingInv = await tx.campusInventory.findUnique({
        where: {
          campusId_itemId: { campusId: campus.id, itemId: item.itemId },
        },
      });

      const prevAllocated = existingInv?.allocatedQuantity ?? 0;
      const nextAllocated = prevAllocated + item.allocatedQuantity;

      if (existingInv) {
        await tx.campusInventory.update({
          where: { id: existingInv.id },
          data: { allocatedQuantity: nextAllocated },
        });
      } else {
        await tx.campusInventory.create({
          data: {
            campusId: campus.id,
            itemId: item.itemId,
            allocatedQuantity: item.allocatedQuantity,
            receivedQuantity: 0,
            availableQuantity: 0,
            reservedQuantity: 0,
            borrowedQuantity: 0,
            damagedQuantity: 0,
            missingQuantity: 0,
            isVisible: true,
            isVerified: false, // Must be physically verified by Campus Lab Manager
          },
        });
      }

      await tx.inventoryTransaction.create({
        data: {
          campusId: campus.id,
          itemId: item.itemId,
          type: "STOCK_ALLOCATED",
          quantity: item.allocatedQuantity,
          previousQuantity: prevAllocated,
          updatedQuantity: nextAllocated,
          referenceType: "StockAllocation",
          referenceId: allocation.id,
          performedById: actor.id,
          remarks: `Allocated ${item.allocatedQuantity} units via ${referenceCode}`,
        },
      });

      if (input.dispatchImmediately) {
        await tx.inventoryTransaction.create({
          data: {
            campusId: campus.id,
            itemId: item.itemId,
            type: "STOCK_DISPATCHED",
            quantity: item.allocatedQuantity,
            previousQuantity: nextAllocated,
            updatedQuantity: nextAllocated,
            referenceType: "StockAllocation",
            referenceId: allocation.id,
            performedById: actor.id,
            remarks: `Dispatched ${item.allocatedQuantity} units via ${referenceCode}`,
          },
        });
      }
    }

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: campus.id,
      action: "ALLOCATION_CREATED",
      entityType: "StockAllocation",
      entityId: allocation.id,
      newState: {
        referenceCode,
        destinationCampusId: campus.id,
        status: initialStatus,
        itemCount: input.items.length,
      },
    });

    return allocation;
  });

  realtimeEventBus.publish({
    type: "allocation.created",
    campusId: campus.id,
    entityType: "StockAllocation",
    entityId: created.id,
    actorId: actor.id,
    summary: `Stock allocation ${created.referenceCode} (${created.status}) created for ${campus.code}`,
  });

  return mapAllocationToDTO(created);
}

export async function updateAllocationStatus(
  actor: AuthUserDTO,
  allocationId: string,
  input: { status: "DISPATCHED" | "CANCELLED"; notes?: string | null },
  db: DbClient = prisma
): Promise<StockAllocationDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can dispatch or cancel stock allocations"
  );

  const existing = await db.stockAllocation.findUnique({
    where: { id: allocationId },
    include: ALLOCATION_INCLUDE,
  });
  if (!existing) {
    throw new NotFoundError(`Allocation '${allocationId}' not found`);
  }

  if (input.status === "DISPATCHED" && existing.status !== "DRAFT") {
    throw new ConflictError(
      `Only DRAFT allocations can be dispatched (current status: ${existing.status})`
    );
  }
  if (
    input.status === "CANCELLED" &&
    !["DRAFT", "DISPATCHED"].includes(existing.status)
  ) {
    throw new ConflictError(
      `Cannot cancel allocation with status '${existing.status}'`
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const alloc = await tx.stockAllocation.update({
      where: { id: allocationId },
      data: {
        status: input.status,
        ...(input.status === "DISPATCHED" ? { dispatchedAt: new Date() } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: ALLOCATION_INCLUDE,
    });

    for (const item of existing.items) {
      const inv = await tx.campusInventory.findUnique({
        where: {
          campusId_itemId: {
            campusId: existing.destinationCampusId,
            itemId: item.itemId,
          },
        },
      });

      if (input.status === "DISPATCHED") {
        const currentAllocated = inv?.allocatedQuantity ?? item.allocatedQuantity;
        await tx.inventoryTransaction.create({
          data: {
            campusId: existing.destinationCampusId,
            itemId: item.itemId,
            type: "STOCK_DISPATCHED",
            quantity: item.allocatedQuantity,
            previousQuantity: currentAllocated,
            updatedQuantity: currentAllocated,
            referenceType: "StockAllocation",
            referenceId: existing.id,
            performedById: actor.id,
            remarks: `Dispatched allocation ${existing.referenceCode}`,
          },
        });
      } else if (input.status === "CANCELLED" && inv) {
        const nextAllocated = Math.max(
          0,
          inv.allocatedQuantity - item.allocatedQuantity
        );
        await tx.campusInventory.update({
          where: { id: inv.id },
          data: { allocatedQuantity: nextAllocated },
        });
        await tx.inventoryTransaction.create({
          data: {
            campusId: existing.destinationCampusId,
            itemId: item.itemId,
            type: "INVENTORY_ADJUSTMENT",
            quantity: -item.allocatedQuantity,
            previousQuantity: inv.allocatedQuantity,
            updatedQuantity: nextAllocated,
            referenceType: "StockAllocation",
            referenceId: existing.id,
            performedById: actor.id,
            remarks: `Cancelled allocation ${existing.referenceCode}`,
          },
        });
      }
    }

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: existing.destinationCampusId,
      action: `ALLOCATION_${input.status}`,
      entityType: "StockAllocation",
      entityId: existing.id,
      previousState: { status: existing.status },
      newState: { status: input.status },
    });

    return alloc;
  });

  realtimeEventBus.publish({
    type: "allocation.status_changed",
    campusId: existing.destinationCampusId,
    entityType: "StockAllocation",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Allocation ${updated.referenceCode} status updated to ${updated.status}`,
  });

  return mapAllocationToDTO(updated);
}

/**
 * Campus Lab Manager verifies incoming physical stock.
 * CRITICAL RULES:
 * - Only LAB_MANAGER of destinationCampusId can verify.
 * - Allocation must be DISPATCHED or PARTIALLY_RECEIVED.
 * - Never auto-marks expected as received: Lab Manager explicitly provides receivedQuantity, missingQuantity, damagedQuantity.
 * - received + missing + damaged must equal allocatedQuantity (or <= allocatedQuantity for partial verification).
 * - Updates CampusInventory atomically (`receivedQuantity += recv`, `availableQuantity += recv`, `missingQuantity += miss`, `damagedQuantity += dmg`, `isVerified = true`).
 * - Creates immutable InventoryTransaction entries (`STOCK_RECEIVED`, `MISSING_REPORTED`, `DAMAGED_REPORTED`).
 */
export async function verifyAllocation(
  actor: AuthUserDTO,
  allocationId: string,
  input: {
    items: Array<{
      allocationItemId?: string;
      itemId?: string;
      receivedQuantity: number;
      missingQuantity: number;
      damagedQuantity: number;
      verificationNotes?: string | null;
    }>;
    notes?: string | null;
  },
  db: DbClient = prisma
): Promise<StockAllocationDTO> {
  assertRole(
    actor,
    ["LAB_MANAGER"],
    "Only a Campus Lab Manager can verify incoming stock allocations"
  );

  const allocation = await db.stockAllocation.findUnique({
    where: { id: allocationId },
    include: ALLOCATION_INCLUDE,
  });
  if (!allocation) {
    throw new NotFoundError(`Allocation '${allocationId}' not found`);
  }

  assertCampusScope(
    actor,
    allocation.destinationCampusId,
    "verify stock allocations for another campus"
  );

  if (!["DISPATCHED", "PARTIALLY_RECEIVED"].includes(allocation.status)) {
    throw new ConflictError(
      `Allocation '${allocation.referenceCode}' cannot be verified in status '${allocation.status}'. It must be DISPATCHED first.`
    );
  }

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    for (const entry of input.items) {
      const allocItem = allocation.items.find(
        (ai) =>
          (entry.allocationItemId && ai.id === entry.allocationItemId) ||
          (entry.itemId && ai.itemId === entry.itemId)
      );

      if (!allocItem) {
        throw new NotFoundError(
          `Allocation item not found in allocation '${allocation.referenceCode}'`
        );
      }

      if (allocItem.isVerified) {
        throw new ConflictError(
          `Item '${allocItem.item.code}' in allocation '${allocation.referenceCode}' has already been verified`
        );
      }

      if (
        entry.receivedQuantity < 0 ||
        entry.missingQuantity < 0 ||
        entry.damagedQuantity < 0
      ) {
        throw new BadRequestError("Verification quantities cannot be negative");
      }

      const accountedTotal =
        entry.receivedQuantity + entry.missingQuantity + entry.damagedQuantity;
      if (accountedTotal !== allocItem.allocatedQuantity) {
        throw new BadRequestError(
          `For item '${allocItem.item.code}', received (${entry.receivedQuantity}) + missing (${entry.missingQuantity}) + damaged (${entry.damagedQuantity}) = ${accountedTotal} must equal allocated quantity (${allocItem.allocatedQuantity})`
        );
      }

      await tx.stockAllocationItem.update({
        where: { id: allocItem.id },
        data: {
          receivedQuantity: entry.receivedQuantity,
          missingQuantity: entry.missingQuantity,
          damagedQuantity: entry.damagedQuantity,
          isVerified: true,
          verificationNotes: entry.verificationNotes ?? null,
          verifiedAt: now,
        },
      });

      const existingInv = await tx.campusInventory.findUnique({
        where: {
          campusId_itemId: {
            campusId: allocation.destinationCampusId,
            itemId: allocItem.itemId,
          },
        },
      });

      const prevAvailable = existingInv?.availableQuantity ?? 0;
      const prevReceived = existingInv?.receivedQuantity ?? 0;
      const prevMissing = existingInv?.missingQuantity ?? 0;
      const prevDamaged = existingInv?.damagedQuantity ?? 0;

      const nextReceived = prevReceived + entry.receivedQuantity;
      const nextAvailable = prevAvailable + entry.receivedQuantity;
      const nextMissing = prevMissing + entry.missingQuantity;
      const nextDamaged = prevDamaged + entry.damagedQuantity;

      if (existingInv) {
        await tx.campusInventory.update({
          where: { id: existingInv.id },
          data: {
            receivedQuantity: nextReceived,
            availableQuantity: nextAvailable,
            missingQuantity: nextMissing,
            damagedQuantity: nextDamaged,
            isVerified: true,
            lastVerifiedAt: now,
          },
        });
      } else {
        await tx.campusInventory.create({
          data: {
            campusId: allocation.destinationCampusId,
            itemId: allocItem.itemId,
            allocatedQuantity: allocItem.allocatedQuantity,
            receivedQuantity: nextReceived,
            availableQuantity: nextAvailable,
            reservedQuantity: 0,
            borrowedQuantity: 0,
            missingQuantity: nextMissing,
            damagedQuantity: nextDamaged,
            isVisible: true,
            isVerified: true,
            lastVerifiedAt: now,
          },
        });
      }

      if (entry.receivedQuantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            campusId: allocation.destinationCampusId,
            itemId: allocItem.itemId,
            type: "STOCK_RECEIVED",
            quantity: entry.receivedQuantity,
            previousQuantity: prevAvailable,
            updatedQuantity: nextAvailable,
            referenceType: "StockAllocation",
            referenceId: allocation.id,
            performedById: actor.id,
            remarks:
              entry.verificationNotes ||
              `Verified ${entry.receivedQuantity} received units from ${allocation.referenceCode}`,
          },
        });
      }

      if (entry.missingQuantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            campusId: allocation.destinationCampusId,
            itemId: allocItem.itemId,
            type: "MISSING_REPORTED",
            quantity: entry.missingQuantity,
            previousQuantity: prevMissing,
            updatedQuantity: nextMissing,
            referenceType: "StockAllocation",
            referenceId: allocation.id,
            performedById: actor.id,
            remarks:
              entry.verificationNotes ||
              `Reported ${entry.missingQuantity} missing units during verification of ${allocation.referenceCode}`,
          },
        });
      }

      if (entry.damagedQuantity > 0) {
        await tx.inventoryTransaction.create({
          data: {
            campusId: allocation.destinationCampusId,
            itemId: allocItem.itemId,
            type: "DAMAGED_REPORTED",
            quantity: entry.damagedQuantity,
            previousQuantity: prevDamaged,
            updatedQuantity: nextDamaged,
            referenceType: "StockAllocation",
            referenceId: allocation.id,
            performedById: actor.id,
            remarks:
              entry.verificationNotes ||
              `Reported ${entry.damagedQuantity} damaged units during verification of ${allocation.referenceCode}`,
          },
        });
      }
    }

    // Recompute overall allocation status from all allocation items
    const refreshedItems = await tx.stockAllocationItem.findMany({
      where: { allocationId: allocation.id },
    });

    const allVerified = refreshedItems.every((i) => i.isVerified);
    const anyDiscrepancy = refreshedItems.some(
      (i) => i.missingQuantity > 0 || i.damagedQuantity > 0
    );

    let nextStatus: AllocationStatus;
    if (!allVerified) {
      nextStatus = "PARTIALLY_RECEIVED";
    } else if (anyDiscrepancy) {
      nextStatus = "DISCREPANCY_REPORTED";
    } else {
      nextStatus = "RECEIVED";
    }

    const updatedAlloc = await tx.stockAllocation.update({
      where: { id: allocation.id },
      data: {
        status: nextStatus,
        verifiedAt: allVerified ? now : null,
        verifiedById: actor.id,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: ALLOCATION_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: allocation.destinationCampusId,
      action: "ALLOCATION_VERIFIED",
      entityType: "StockAllocation",
      entityId: allocation.id,
      previousState: { status: allocation.status },
      newState: {
        status: nextStatus,
        verifiedItems: input.items.length,
        hasDiscrepancy: anyDiscrepancy,
      },
    });

    return updatedAlloc;
  });

  realtimeEventBus.publish({
    type: "allocation.verified",
    campusId: allocation.destinationCampusId,
    entityType: "StockAllocation",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Allocation ${updated.referenceCode} verified (${updated.status})`,
  });

  realtimeEventBus.publish({
    type: "inventory.updated",
    campusId: allocation.destinationCampusId,
    entityType: "CampusInventory",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Campus inventory updated from verified allocation ${updated.referenceCode}`,
  });

  return mapAllocationToDTO(updated);
}
