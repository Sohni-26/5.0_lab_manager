import { prisma, type DbClient } from "@/lib/prisma";
import { assertCampusScope, assertRole } from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import { ConflictError, NotFoundError } from "@/lib/errors";
import {
  buildPaginationMeta,
  type PaginationParams,
} from "@/lib/pagination";
import type {
  AuthUserDTO,
  CampusDTO,
  CampusStatus,
  PaginationMeta,
} from "@/types/contracts";

function toIso(date: Date): string {
  return date.toISOString();
}

async function computeCampusStats(
  campusIds: string[],
  db: DbClient
): Promise<Map<string, NonNullable<CampusDTO["stats"]>>> {
  const statsMap = new Map<string, NonNullable<CampusDTO["stats"]>>();
  for (const id of campusIds) {
    statsMap.set(id, {
      labManagerCount: 0,
      instructorCount: 0,
      studentCount: 0,
      totalStockUnits: 0,
      availableUnits: 0,
      borrowedUnits: 0,
      pendingAllocations: 0,
      openTickets: 0,
    });
  }
  if (campusIds.length === 0) return statsMap;

  const [users, inventories, pendingAllocations, openTickets] =
    await Promise.all([
      db.user.findMany({
        where: { campusId: { in: campusIds }, status: "ACTIVE" },
        select: { campusId: true, role: true },
      }),
      db.campusInventory.findMany({
        where: { campusId: { in: campusIds } },
        select: {
          campusId: true,
          receivedQuantity: true,
          availableQuantity: true,
          borrowedQuantity: true,
        },
      }),
      db.stockAllocation.findMany({
        where: {
          destinationCampusId: { in: campusIds },
          status: { in: ["DRAFT", "DISPATCHED", "PARTIALLY_RECEIVED"] },
        },
        select: { destinationCampusId: true },
      }),
      db.issueTicket.findMany({
        where: {
          campusId: { in: campusIds },
          status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"] },
        },
        select: { campusId: true },
      }),
    ]);

  for (const u of users) {
    if (!u.campusId) continue;
    const s = statsMap.get(u.campusId);
    if (!s) continue;
    if (u.role === "LAB_MANAGER") s.labManagerCount += 1;
    else if (u.role === "INSTRUCTOR") s.instructorCount += 1;
    else if (u.role === "STUDENT") s.studentCount += 1;
  }

  for (const inv of inventories) {
    const s = statsMap.get(inv.campusId);
    if (!s) continue;
    s.totalStockUnits += inv.receivedQuantity;
    s.availableUnits += inv.availableQuantity;
    s.borrowedUnits += inv.borrowedQuantity;
  }

  for (const alloc of pendingAllocations) {
    const s = statsMap.get(alloc.destinationCampusId);
    if (s) s.pendingAllocations += 1;
  }

  for (const t of openTickets) {
    const s = statsMap.get(t.campusId);
    if (s) s.openTickets += 1;
  }

  return statsMap;
}

export async function listCampuses(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: { status?: CampusStatus; includeStats?: boolean } = {},
  db: DbClient = prisma
): Promise<{ data: CampusDTO[]; meta: PaginationMeta }> {
  const where: Record<string, unknown> = {};

  if (actor.role !== "CENTRAL_LAB_MANAGER") {
    where.id = actor.campusId ?? "__none__";
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (pagination.search) {
    where.OR = [
      { code: { contains: pagination.search, mode: "insensitive" } },
      { name: { contains: pagination.search, mode: "insensitive" } },
      { city: { contains: pagination.search, mode: "insensitive" } },
      { state: { contains: pagination.search, mode: "insensitive" } },
    ];
  }

  const orderByField = pagination.sortBy ?? "code";
  const orderBy = { [orderByField]: pagination.sortOrder };

  const [campuses, total] = await Promise.all([
    db.campus.findMany({
      where,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.campus.count({ where }),
  ]);

  const includeStats = filters.includeStats !== false;
  const statsMap = includeStats
    ? await computeCampusStats(
        campuses.map((c) => c.id),
        db
      )
    : new Map<string, NonNullable<CampusDTO["stats"]>>();

  const data: CampusDTO[] = campuses.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    city: c.city,
    state: c.state,
    address: c.address,
    status: c.status,
    createdAt: toIso(c.createdAt),
    updatedAt: toIso(c.updatedAt),
    ...(includeStats ? { stats: statsMap.get(c.id) } : {}),
  }));

  return {
    data,
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getCampusById(
  actor: AuthUserDTO,
  campusId: string,
  db: DbClient = prisma
): Promise<CampusDTO> {
  assertCampusScope(actor, campusId, "view this campus");

  const campus = await db.campus.findUnique({ where: { id: campusId } });
  if (!campus) {
    throw new NotFoundError(`Campus '${campusId}' not found`);
  }

  const statsMap = await computeCampusStats([campus.id], db);
  return {
    id: campus.id,
    code: campus.code,
    name: campus.name,
    city: campus.city,
    state: campus.state,
    address: campus.address,
    status: campus.status,
    createdAt: toIso(campus.createdAt),
    updatedAt: toIso(campus.updatedAt),
    stats: statsMap.get(campus.id),
  };
}

export async function createCampus(
  actor: AuthUserDTO,
  input: {
    code: string;
    name: string;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    status?: CampusStatus;
  },
  db: DbClient = prisma
): Promise<CampusDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can create campuses"
  );

  const normalizedCode = input.code.trim().toUpperCase();
  const existing = await db.campus.findUnique({
    where: { code: normalizedCode },
  });
  if (existing) {
    throw new ConflictError(`Campus code '${normalizedCode}' already exists`);
  }

  const created = await db.$transaction(async (tx) => {
    const campus = await tx.campus.create({
      data: {
        code: normalizedCode,
        name: input.name.trim(),
        city: input.city ?? null,
        state: input.state ?? null,
        address: input.address ?? null,
        status: input.status ?? "ACTIVE",
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: campus.id,
      action: "CAMPUS_CREATED",
      entityType: "Campus",
      entityId: campus.id,
      newState: {
        code: campus.code,
        name: campus.name,
        status: campus.status,
      },
    });

    return campus;
  });

  const statsMap = await computeCampusStats([created.id], db);
  return {
    id: created.id,
    code: created.code,
    name: created.name,
    city: created.city,
    state: created.state,
    address: created.address,
    status: created.status,
    createdAt: toIso(created.createdAt),
    updatedAt: toIso(created.updatedAt),
    stats: statsMap.get(created.id),
  };
}

export async function updateCampus(
  actor: AuthUserDTO,
  campusId: string,
  input: {
    code?: string;
    name?: string;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    status?: CampusStatus;
  },
  db: DbClient = prisma
): Promise<CampusDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can update campuses"
  );

  const existing = await db.campus.findUnique({ where: { id: campusId } });
  if (!existing) {
    throw new NotFoundError(`Campus '${campusId}' not found`);
  }

  if (input.code) {
    const normalizedCode = input.code.trim().toUpperCase();
    if (normalizedCode !== existing.code) {
      const dup = await db.campus.findUnique({
        where: { code: normalizedCode },
      });
      if (dup) {
        throw new ConflictError(
          `Campus code '${normalizedCode}' already exists`
        );
      }
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const campus = await tx.campus.update({
      where: { id: campusId },
      data: {
        ...(input.code !== undefined
          ? { code: input.code.trim().toUpperCase() }
          : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: campus.id,
      action: "CAMPUS_UPDATED",
      entityType: "Campus",
      entityId: campus.id,
      previousState: {
        code: existing.code,
        name: existing.name,
        status: existing.status,
      },
      newState: {
        code: campus.code,
        name: campus.name,
        status: campus.status,
      },
    });

    return campus;
  });

  const statsMap = await computeCampusStats([updated.id], db);
  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    city: updated.city,
    state: updated.state,
    address: updated.address,
    status: updated.status,
    createdAt: toIso(updated.createdAt),
    updatedAt: toIso(updated.updatedAt),
    stats: statsMap.get(updated.id),
  };
}

export async function deactivateCampus(
  actor: AuthUserDTO,
  campusId: string,
  db: DbClient = prisma
): Promise<CampusDTO> {
  assertRole(
    actor,
    ["CENTRAL_LAB_MANAGER"],
    "Only Central Lab Manager can deactivate campuses"
  );

  const existing = await db.campus.findUnique({ where: { id: campusId } });
  if (!existing) {
    throw new NotFoundError(`Campus '${campusId}' not found`);
  }

  const updated = await db.$transaction(async (tx) => {
    const campus = await tx.campus.update({
      where: { id: campusId },
      data: { status: "INACTIVE" },
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: campus.id,
      action: "CAMPUS_DEACTIVATED",
      entityType: "Campus",
      entityId: campus.id,
      previousState: { status: existing.status },
      newState: { status: "INACTIVE" },
    });

    return campus;
  });

  const statsMap = await computeCampusStats([updated.id], db);
  return {
    id: updated.id,
    code: updated.code,
    name: updated.name,
    city: updated.city,
    state: updated.state,
    address: updated.address,
    status: updated.status,
    createdAt: toIso(updated.createdAt),
    updatedAt: toIso(updated.updatedAt),
    stats: statsMap.get(updated.id),
  };
}
