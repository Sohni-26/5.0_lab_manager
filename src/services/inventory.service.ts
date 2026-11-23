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
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  InventoryTransactionDTO,
  InventoryTransactionType,
  PaginationMeta,
  UserRole,
} from "@/types/contracts";

const INVENTORY_INCLUDE = {
  campus: { select: { id: true, code: true, name: true } },
  item: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

function mapInventoryToDTO(inv: {
  id: string;
  campusId: string;
  itemId: string;
  allocatedQuantity: number;
  receivedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  borrowedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  isVisible: boolean;
  isVerified: boolean;
  lastVerifiedAt: Date | null;
  updatedAt: Date;
  campus?: { id: string; code: string; name: string };
  item: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    brand: string | null;
    unit: string;
    imageUrl: string | null;
    specifications: unknown;
    isActive: boolean;
    category: { id: string; name: string; slug: string };
  };
}): CampusInventoryDTO {
  return {
    id: inv.id,
    campusId: inv.campusId,
    itemId: inv.itemId,
    allocatedQuantity: inv.allocatedQuantity,
    receivedQuantity: inv.receivedQuantity,
    availableQuantity: inv.availableQuantity,
    reservedQuantity: inv.reservedQuantity,
    borrowedQuantity: inv.borrowedQuantity,
    damagedQuantity: inv.damagedQuantity,
    missingQuantity: inv.missingQuantity,
    isVisible: inv.isVisible,
    isVerified: inv.isVerified,
    lastVerifiedAt: inv.lastVerifiedAt
      ? inv.lastVerifiedAt.toISOString()
      : null,
    updatedAt: inv.updatedAt.toISOString(),
    campus: inv.campus,
    item: {
      id: inv.item.id,
      code: inv.item.code,
      name: inv.item.name,
      description: inv.item.description,
      brand: inv.item.brand,
      unit: inv.item.unit,
      imageUrl: inv.item.imageUrl,
      specifications:
        inv.item.specifications && typeof inv.item.specifications === "object"
          ? (inv.item.specifications as Record<string, unknown>)
          : null,
      isActive: inv.item.isActive,
      category: inv.item.category,
    },
  };
}

export async function listCampusInventory(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: {
    campusId?: string;
    categoryId?: string;
    isVisible?: boolean;
    isVerified?: boolean;
  } = {},
  db: DbClient = prisma
): Promise<{ data: CampusInventoryDTO[]; meta: PaginationMeta }> {
  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};
  if (effectiveCampusId) {
    where.campusId = effectiveCampusId;
  }

  // CRITICAL RBAC RULE:
  // Students and Instructors ONLY ever see verified, visible, active items from their own campus!
  const itemWhere: Record<string, unknown> = {};
  if (actor.role === "STUDENT" || actor.role === "INSTRUCTOR") {
    where.isVerified = true;
    where.isVisible = true;
    itemWhere.isActive = true;
  } else {
    if (filters.isVisible !== undefined) {
      where.isVisible = filters.isVisible;
    }
    if (filters.isVerified !== undefined) {
      where.isVerified = filters.isVerified;
    }
  }

  if (filters.categoryId) {
    itemWhere.categoryId = filters.categoryId;
  }

  if (pagination.search) {
    itemWhere.OR = [
      { code: { contains: pagination.search, mode: "insensitive" } },
      { name: { contains: pagination.search, mode: "insensitive" } },
      { brand: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  if (Object.keys(itemWhere).length > 0) {
    where.item = itemWhere;
  }

  const orderByField = pagination.sortBy ?? "updatedAt";
  const orderBy =
    orderByField === "name" || orderByField === "code"
      ? { item: { [orderByField]: pagination.sortOrder } }
      : { [orderByField]: pagination.sortOrder };

  const [records, total] = await Promise.all([
    db.campusInventory.findMany({
      where,
      include: INVENTORY_INCLUDE,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.campusInventory.count({ where }),
  ]);

  return {
    data: records.map(mapInventoryToDTO),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getCampusInventoryById(
  actor: AuthUserDTO,
  inventoryId: string,
  db: DbClient = prisma
): Promise<
  CampusInventoryDTO & { recentTransactions: InventoryTransactionDTO[] }
> {
  const inv = await db.campusInventory.findUnique({
    where: { id: inventoryId },
    include: INVENTORY_INCLUDE,
  });

  if (!inv) {
    throw new NotFoundError(`Campus inventory record '${inventoryId}' not found`);
  }

  assertCampusScope(actor, inv.campusId, "view this campus inventory item");

  if (actor.role === "STUDENT" || actor.role === "INSTRUCTOR") {
    if (!inv.isVerified || !inv.isVisible || !inv.item.isActive) {
      throw new ForbiddenError("This inventory item is not visible to your role");
    }
  }

  const txRecords = await db.inventoryTransaction.findMany({
    where: { campusId: inv.campusId, itemId: inv.itemId },
    include: {
      campus: { select: { id: true, code: true, name: true } },
      item: { select: { id: true, code: true, name: true } },
      performedBy: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return {
    ...mapInventoryToDTO(inv),
    recentTransactions: txRecords.map((t) => ({
      id: t.id,
      campusId: t.campusId,
      itemId: t.itemId,
      type: t.type,
      quantity: t.quantity,
      previousQuantity: t.previousQuantity,
      updatedQuantity: t.updatedQuantity,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      remarks: t.remarks,
      createdAt: t.createdAt.toISOString(),
      campus: t.campus,
      item: t.item,
      performedBy: t.performedBy as {
        id: string;
        fullName: string;
        role: UserRole;
      },
    })),
  };
}

export async function toggleInventoryVisibility(
  actor: AuthUserDTO,
  inventoryId: string,
  isVisible: boolean,
  db: DbClient = prisma
): Promise<CampusInventoryDTO> {
  assertRole(
    actor,
    ["LAB_MANAGER"],
    "Only a Campus Lab Manager can toggle inventory visibility"
  );

  const existing = await db.campusInventory.findUnique({
    where: { id: inventoryId },
    include: INVENTORY_INCLUDE,
  });
  if (!existing) {
    throw new NotFoundError(`Campus inventory record '${inventoryId}' not found`);
  }

  assertCampusScope(
    actor,
    existing.campusId,
    "change visibility for another campus's inventory"
  );

  const updated = await db.$transaction(async (tx) => {
    const rec = await tx.campusInventory.update({
      where: { id: inventoryId },
      data: { isVisible },
      include: INVENTORY_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: existing.campusId,
      action: "INVENTORY_VISIBILITY_CHANGED",
      entityType: "CampusInventory",
      entityId: existing.id,
      previousState: { isVisible: existing.isVisible },
      newState: { isVisible },
      metadata: { itemId: existing.itemId, itemCode: existing.item.code },
    });

    return rec;
  });

  realtimeEventBus.publish({
    type: "inventory.visibility_changed",
    campusId: existing.campusId,
    entityType: "CampusInventory",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Item ${updated.item.code} marked ${isVisible ? "visible" : "hidden"}`,
    data: { itemId: updated.itemId, isVisible },
  });

  return mapInventoryToDTO(updated);
}

export async function bulkToggleInventoryVisibility(
  actor: AuthUserDTO,
  ids: string[],
  isVisible: boolean,
  db: DbClient = prisma
): Promise<{ updatedCount: number; isVisible: boolean }> {
  assertRole(
    actor,
    ["LAB_MANAGER"],
    "Only a Campus Lab Manager can bulk toggle inventory visibility"
  );

  const records = await db.campusInventory.findMany({
    where: { id: { in: ids } },
    select: { id: true, campusId: true, itemId: true },
  });

  if (records.length === 0) {
    throw new NotFoundError("No matching campus inventory records found");
  }

  for (const rec of records) {
    assertCampusScope(
      actor,
      rec.campusId,
      "change visibility for another campus's inventory"
    );
  }

  const campusId = records[0].campusId;
  const targetIds = records.map((r) => r.id);

  await db.$transaction(async (tx) => {
    await tx.campusInventory.updateMany({
      where: { id: { in: targetIds } },
      data: { isVisible },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId,
      action: "INVENTORY_BULK_VISIBILITY_CHANGED",
      entityType: "CampusInventory",
      entityId: campusId,
      newState: { ids: targetIds, isVisible },
    });
  });

  realtimeEventBus.publish({
    type: "inventory.visibility_changed",
    campusId,
    entityType: "CampusInventory",
    entityId: campusId,
    actorId: actor.id,
    summary: `Bulk visibility updated for ${targetIds.length} items (${isVisible ? "visible" : "hidden"})`,
  });

  return { updatedCount: targetIds.length, isVisible };
}

export async function adjustCampusInventory(
  actor: AuthUserDTO,
  inventoryId: string,
  input: {
    field: "availableQuantity" | "damagedQuantity" | "missingQuantity";
    delta: number;
    remarks: string;
  },
  db: DbClient = prisma
): Promise<CampusInventoryDTO> {
  assertRole(
    actor,
    ["LAB_MANAGER"],
    "Only a Campus Lab Manager can perform inventory adjustments"
  );

  const existing = await db.campusInventory.findUnique({
    where: { id: inventoryId },
    include: INVENTORY_INCLUDE,
  });
  if (!existing) {
    throw new NotFoundError(`Campus inventory record '${inventoryId}' not found`);
  }

  assertCampusScope(
    actor,
    existing.campusId,
    "adjust inventory for another campus"
  );

  const prevVal = existing[input.field];
  const nextVal = prevVal + input.delta;

  if (nextVal < 0) {
    throw new BadRequestError(
      `Adjustment rejected: ${input.field} (${prevVal}) + delta (${input.delta}) would result in negative stock (${nextVal})`
    );
  }

  const updated = await db.$transaction(async (tx) => {
    const rec = await tx.campusInventory.update({
      where: { id: inventoryId },
      data: {
        [input.field]: nextVal,
      },
      include: INVENTORY_INCLUDE,
    });

    await tx.inventoryTransaction.create({
      data: {
        campusId: existing.campusId,
        itemId: existing.itemId,
        type: "INVENTORY_ADJUSTMENT",
        quantity: input.delta,
        previousQuantity: prevVal,
        updatedQuantity: nextVal,
        referenceType: "ManualAdjustment",
        referenceId: existing.id,
        performedById: actor.id,
        remarks: `[${input.field}] ${input.remarks}`,
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: existing.campusId,
      action: "INVENTORY_ADJUSTED",
      entityType: "CampusInventory",
      entityId: existing.id,
      previousState: { [input.field]: prevVal },
      newState: { [input.field]: nextVal },
      metadata: { remarks: input.remarks, itemCode: existing.item.code },
    });

    return rec;
  });

  realtimeEventBus.publish({
    type: "inventory.updated",
    campusId: existing.campusId,
    entityType: "CampusInventory",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Adjusted ${updated.item.code} ${input.field} by ${input.delta > 0 ? `+${input.delta}` : input.delta}`,
  });

  return mapInventoryToDTO(updated);
}

export async function listInventoryTransactions(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: {
    campusId?: string;
    itemId?: string;
    type?: InventoryTransactionType;
  } = {},
  db: DbClient = prisma
): Promise<{ data: InventoryTransactionDTO[]; meta: PaginationMeta }> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER", "LAB_MANAGER", "INSTRUCTOR"],
    "Students do not have access to the inventory transaction ledger"
  );

  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};
  if (effectiveCampusId) {
    where.campusId = effectiveCampusId;
  }
  if (filters.itemId) {
    where.itemId = filters.itemId;
  }
  if (filters.type) {
    where.type = filters.type;
  }
  if (pagination.search) {
    where.OR = [
      { remarks: { contains: pagination.search, mode: "insensitive" } },
      { referenceId: { contains: pagination.search, mode: "insensitive" } },
      { item: { name: { contains: pagination.search, mode: "insensitive" } } },
      { item: { code: { contains: pagination.search, mode: "insensitive" } } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.inventoryTransaction.findMany({
      where,
      include: {
        campus: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, code: true, name: true } },
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.inventoryTransaction.count({ where }),
  ]);

  return {
    data: rows.map((t) => ({
      id: t.id,
      campusId: t.campusId,
      itemId: t.itemId,
      type: t.type,
      quantity: t.quantity,
      previousQuantity: t.previousQuantity,
      updatedQuantity: t.updatedQuantity,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      remarks: t.remarks,
      createdAt: t.createdAt.toISOString(),
      campus: t.campus,
      item: t.item,
      performedBy: t.performedBy as {
        id: string;
        fullName: string;
        role: UserRole;
      },
    })),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}
