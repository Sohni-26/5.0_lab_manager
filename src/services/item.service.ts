import type { Prisma } from "@prisma/client";
import { prisma, type DbClient } from "@/lib/prisma";
import { assertRole } from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AuthUserDTO,
  ItemCategoryDTO,
  MasterItemDTO,
  PaginationMeta,
} from "@/types/contracts";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCategories(
  db: DbClient = prisma
): Promise<ItemCategoryDTO[]> {
  const categories = await db.itemCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      items: { select: { id: true } },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    itemCount: c.items.length,
  }));
}

export async function createCategory(
  actor: AuthUserDTO,
  input: { name: string; slug?: string; description?: string | null },
  db: DbClient = prisma
): Promise<ItemCategoryDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can create item categories"
  );

  const name = input.name.trim();
  const slug = input.slug ? input.slug.trim().toLowerCase() : slugify(name);

  const existing = await db.itemCategory.findFirst({
    where: { OR: [{ name }, { slug }] },
  });
  if (existing) {
    throw new ConflictError(
      `Category with name '${name}' or slug '${slug}' already exists`
    );
  }

  const created = await db.$transaction(async (tx) => {
    const cat = await tx.itemCategory.create({
      data: {
        name,
        slug,
        description: input.description ?? null,
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: null,
      action: "CATEGORY_CREATED",
      entityType: "ItemCategory",
      entityId: cat.id,
      newState: { name: cat.name, slug: cat.slug },
    });

    return cat;
  });

  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    description: created.description,
    itemCount: 0,
  };
}

function summarizeItemInventories(
  inventories: Array<{
    allocatedQuantity: number;
    receivedQuantity: number;
    availableQuantity: number;
    borrowedQuantity: number;
  }>
): NonNullable<MasterItemDTO["summary"]> {
  let totalAllocated = 0;
  let totalReceived = 0;
  let totalAvailable = 0;
  let totalBorrowed = 0;

  for (const inv of inventories) {
    totalAllocated += inv.allocatedQuantity;
    totalReceived += inv.receivedQuantity;
    totalAvailable += inv.availableQuantity;
    totalBorrowed += inv.borrowedQuantity;
  }

  return {
    totalAllocated,
    totalReceived,
    totalAvailable,
    totalBorrowed,
    campusCount: inventories.length,
  };
}

function mapMasterItem(item: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string;
  brand: string | null;
  specifications: unknown;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: { id: string; name: string; slug: string };
  campusInventories?: Array<{
    allocatedQuantity: number;
    receivedQuantity: number;
    availableQuantity: number;
    borrowedQuantity: number;
  }>;
}): MasterItemDTO {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    category: item.category,
    brand: item.brand,
    specifications:
      item.specifications && typeof item.specifications === "object"
        ? (item.specifications as Record<string, unknown>)
        : null,
    unit: item.unit,
    imageUrl: item.imageUrl,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    ...(item.campusInventories
      ? { summary: summarizeItemInventories(item.campusInventories) }
      : {}),
  };
}

export async function listMasterItems(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: { categoryId?: string; isActive?: boolean } = {},
  db: DbClient = prisma
): Promise<{ data: MasterItemDTO[]; meta: PaginationMeta }> {
  const where: Record<string, unknown> = {};

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }
  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else if (actor.role !== "CENTRAL_LAB_MANAGER") {
    where.isActive = true;
  }

  if (pagination.search) {
    where.OR = [
      { code: { contains: pagination.search, mode: "insensitive" } },
      { name: { contains: pagination.search, mode: "insensitive" } },
      { brand: { contains: pagination.search, mode: "insensitive" } },
      { description: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  const orderByField = pagination.sortBy ?? "name";
  const orderBy = { [orderByField]: pagination.sortOrder };

  const [items, total] = await Promise.all([
    db.item.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        campusInventories: {
          ...(actor.role !== "CENTRAL_LAB_MANAGER" && actor.campusId
            ? { where: { campusId: actor.campusId } }
            : {}),
          select: {
            allocatedQuantity: true,
            receivedQuantity: true,
            availableQuantity: true,
            borrowedQuantity: true,
          },
        },
      },
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.item.count({ where }),
  ]);

  return {
    data: items.map(mapMasterItem),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getMasterItemById(
  actor: AuthUserDTO,
  itemId: string,
  db: DbClient = prisma
): Promise<
  MasterItemDTO & {
    campusBreakdown: Array<{
      campusId: string;
      campusCode: string;
      campusName: string;
      allocatedQuantity: number;
      receivedQuantity: number;
      availableQuantity: number;
      reservedQuantity: number;
      borrowedQuantity: number;
      damagedQuantity: number;
      missingQuantity: number;
      isVisible: boolean;
      isVerified: boolean;
    }>;
  }
> {
  const item = await db.item.findUnique({
    where: { id: itemId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      campusInventories: {
        ...(actor.role !== "CENTRAL_LAB_MANAGER" && actor.campusId
          ? { where: { campusId: actor.campusId } }
          : {}),
        include: {
          campus: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!item) {
    throw new NotFoundError(`Master item '${itemId}' not found`);
  }

  return {
    ...mapMasterItem(item),
    campusBreakdown: item.campusInventories.map((inv) => ({
      campusId: inv.campusId,
      campusCode: inv.campus.code,
      campusName: inv.campus.name,
      allocatedQuantity: inv.allocatedQuantity,
      receivedQuantity: inv.receivedQuantity,
      availableQuantity: inv.availableQuantity,
      reservedQuantity: inv.reservedQuantity,
      borrowedQuantity: inv.borrowedQuantity,
      damagedQuantity: inv.damagedQuantity,
      missingQuantity: inv.missingQuantity,
      isVisible: inv.isVisible,
      isVerified: inv.isVerified,
    })),
  };
}

export async function createMasterItem(
  actor: AuthUserDTO,
  input: {
    code: string;
    name: string;
    description?: string | null;
    categoryId: string;
    brand?: string | null;
    specifications?: Record<string, unknown> | null;
    unit?: string;
    imageUrl?: string | null;
    isActive?: boolean;
  },
  db: DbClient = prisma
): Promise<MasterItemDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can create master inventory items"
  );

  const code = input.code.trim().toUpperCase();
  const [dupCode, category] = await Promise.all([
    db.item.findUnique({ where: { code } }),
    db.itemCategory.findUnique({ where: { id: input.categoryId } }),
  ]);

  if (dupCode) {
    throw new ConflictError(`Item code '${code}' already exists`);
  }
  if (!category) {
    throw new NotFoundError(`Category '${input.categoryId}' not found`);
  }

  const created = await db.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        code,
        name: input.name.trim(),
        description: input.description ?? null,
        categoryId: input.categoryId,
        brand: input.brand ?? null,
        specifications: (input.specifications ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        unit: input.unit ?? "pcs",
        imageUrl: input.imageUrl ?? null,
        isActive: input.isActive ?? true,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        campusInventories: {
          select: {
            allocatedQuantity: true,
            receivedQuantity: true,
            availableQuantity: true,
            borrowedQuantity: true,
          },
        },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: null,
      action: "MASTER_ITEM_CREATED",
      entityType: "Item",
      entityId: item.id,
      newState: { code: item.code, name: item.name, categoryId: item.categoryId },
    });

    return item;
  });

  return mapMasterItem(created);
}

export async function updateMasterItem(
  actor: AuthUserDTO,
  itemId: string,
  input: {
    code?: string;
    name?: string;
    description?: string | null;
    categoryId?: string;
    brand?: string | null;
    specifications?: Record<string, unknown> | null;
    unit?: string;
    imageUrl?: string | null;
    isActive?: boolean;
  },
  db: DbClient = prisma
): Promise<MasterItemDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can update master inventory items"
  );

  const existing = await db.item.findUnique({ where: { id: itemId } });
  if (!existing) {
    throw new NotFoundError(`Master item '${itemId}' not found`);
  }

  if (input.code) {
    const normalized = input.code.trim().toUpperCase();
    if (normalized !== existing.code) {
      const dup = await db.item.findUnique({ where: { code: normalized } });
      if (dup) {
        throw new ConflictError(`Item code '${normalized}' already exists`);
      }
    }
  }

  if (input.categoryId) {
    const cat = await db.itemCategory.findUnique({
      where: { id: input.categoryId },
    });
    if (!cat) {
      throw new NotFoundError(`Category '${input.categoryId}' not found`);
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.item.update({
      where: { id: itemId },
      data: {
        ...(input.code !== undefined
          ? { code: input.code.trim().toUpperCase() }
          : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.specifications !== undefined
          ? {
              specifications: (input.specifications ?? undefined) as
                | Prisma.InputJsonValue
                | undefined,
            }
          : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        campusInventories: {
          select: {
            allocatedQuantity: true,
            receivedQuantity: true,
            availableQuantity: true,
            borrowedQuantity: true,
          },
        },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: null,
      action: "MASTER_ITEM_UPDATED",
      entityType: "Item",
      entityId: item.id,
      previousState: { name: existing.name, isActive: existing.isActive },
      newState: { name: item.name, isActive: item.isActive },
    });

    return item;
  });

  return mapMasterItem(updated);
}

export async function deactivateMasterItem(
  actor: AuthUserDTO,
  itemId: string,
  db: DbClient = prisma
): Promise<MasterItemDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can deactivate master inventory items"
  );

  const existing = await db.item.findUnique({ where: { id: itemId } });
  if (!existing) {
    throw new NotFoundError(`Master item '${itemId}' not found`);
  }

  const updated = await db.$transaction(async (tx) => {
    const item = await tx.item.update({
      where: { id: itemId },
      data: { isActive: false },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        campusInventories: {
          select: {
            allocatedQuantity: true,
            receivedQuantity: true,
            availableQuantity: true,
            borrowedQuantity: true,
          },
        },
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: null,
      action: "MASTER_ITEM_DEACTIVATED",
      entityType: "Item",
      entityId: item.id,
      previousState: { isActive: existing.isActive },
      newState: { isActive: false },
    });

    return item;
  });

  return mapMasterItem(updated);
}
