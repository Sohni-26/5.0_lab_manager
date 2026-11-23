import { prisma, type DbClient } from "@/lib/prisma";
import { requireUserCampusId } from "@/lib/auth/rbac";
import { NotFoundError } from "@/lib/errors";
import {
  LAB_REQUEST_INCLUDE,
  mapLabRequestToDTO,
} from "@/services/request.service";
import type {
  AuditLogDTO,
  AuthUserDTO,
  CentralDashboardDTO,
  InstructorDashboardDTO,
  InventoryTransactionDTO,
  LabManagerDashboardDTO,
  StockAllocationDTO,
  StudentDashboardDTO,
  UserRole,
} from "@/types/contracts";

function formatMonthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export async function getCentralDashboard(
  campusFilterId?: string,
  db: DbClient = prisma
): Promise<CentralDashboardDTO> {
  const campusWhere = campusFilterId ? { id: campusFilterId } : {};
  const invWhere = campusFilterId ? { campusId: campusFilterId } : {};
  const allocWhere = campusFilterId
    ? { destinationCampusId: campusFilterId }
    : {};
  const reqWhere = campusFilterId ? { campusId: campusFilterId } : {};
  const ticketWhere = campusFilterId ? { campusId: campusFilterId } : {};
  const auditWhere = campusFilterId ? { campusId: campusFilterId } : {};

  const [
    campuses,
    totalMasterItems,
    inventories,
    allocations,
    activeUsers,
    pendingRequests,
    openTickets,
    recentAuditRows,
  ] = await Promise.all([
    db.campus.findMany({
      where: campusWhere,
      orderBy: { code: "asc" },
    }),
    db.item.count({ where: { isActive: true } }),
    db.campusInventory.findMany({
      where: invWhere,
      include: { campus: { select: { code: true, name: true } } },
    }),
    db.stockAllocation.findMany({
      where: allocWhere,
      include: {
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
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({
      where: {
        status: "ACTIVE",
        ...(campusFilterId ? { campusId: campusFilterId } : {}),
      },
    }),
    db.labRequest.count({
      where: {
        ...reqWhere,
        status: {
          in: [
            "PENDING_INSTRUCTOR",
            "PENDING_LAB_MANAGER",
            "RETURN_VERIFICATION_PENDING",
          ],
        },
      },
    }),
    db.issueTicket.count({
      where: {
        ...ticketWhere,
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"] },
      },
    }),
    db.auditLog.findMany({
      where: auditWhere,
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
        campus: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  let totalAllocatedUnits = 0;
  const chartByCampus = new Map<
    string,
    {
      campusCode: string;
      campusName: string;
      available: number;
      borrowed: number;
      reserved: number;
      damaged: number;
    }
  >();

  for (const inv of inventories) {
    totalAllocatedUnits += inv.allocatedQuantity;
    const key = inv.campus.code;
    const bucket = chartByCampus.get(key) ?? {
      campusCode: inv.campus.code,
      campusName: inv.campus.name,
      available: 0,
      borrowed: 0,
      reserved: 0,
      damaged: 0,
    };
    bucket.available += inv.availableQuantity;
    bucket.borrowed += inv.borrowedQuantity;
    bucket.reserved += inv.reservedQuantity;
    bucket.damaged += inv.damagedQuantity;
    chartByCampus.set(key, bucket);
  }

  const campusInventoryChart = Array.from(chartByCampus.values())
    .sort((a, b) => b.available + b.borrowed - (a.available + a.borrowed))
    .slice(0, 10);

  const monthBuckets = new Map<
    string,
    { month: string; dispatched: number; received: number; discrepancies: number }
  >();

  for (const alloc of allocations) {
    const label = formatMonthLabel(alloc.createdAt);
    const b = monthBuckets.get(label) ?? {
      month: label,
      dispatched: 0,
      received: 0,
      discrepancies: 0,
    };
    if (alloc.status === "DISPATCHED" || alloc.dispatchedAt) b.dispatched += 1;
    if (alloc.status === "RECEIVED" || alloc.status === "PARTIALLY_RECEIVED") {
      b.received += 1;
    }
    if (alloc.status === "DISCREPANCY_REPORTED") b.discrepancies += 1;
    monthBuckets.set(label, b);
  }

  const pendingAllocationsList = allocations.filter((a) =>
    ["DRAFT", "DISPATCHED", "PARTIALLY_RECEIVED", "DISCREPANCY_REPORTED"].includes(
      a.status
    )
  );

  const pendingAllocations: StockAllocationDTO[] = pendingAllocationsList
    .slice(0, 8)
    .map((a) => ({
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
    }));

  const recentAuditLogs: AuditLogDTO[] = recentAuditRows.map((row) => ({
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
    kpis: {
      totalCampuses: campuses.length,
      activeCampuses: campuses.filter((c) => c.status === "ACTIVE").length,
      totalMasterItems,
      totalAllocatedUnits,
      pendingVerifications: allocations.filter((a) =>
        ["DISPATCHED", "PARTIALLY_RECEIVED"].includes(a.status)
      ).length,
      activeUsers,
      pendingRequests,
      openTickets,
    },
    campusInventoryChart,
    allocationActivityChart: Array.from(monthBuckets.values()).reverse(),
    pendingAllocations,
    recentAuditLogs,
  };
}

export async function getLabManagerDashboard(
  actor: AuthUserDTO,
  db: DbClient = prisma
): Promise<LabManagerDashboardDTO> {
  const campusId = requireUserCampusId(actor);
  const campus = await db.campus.findUnique({
    where: { id: campusId },
    select: { id: true, code: true, name: true },
  });
  if (!campus) throw new NotFoundError("Assigned campus not found");

  const [
    inventories,
    incomingAllocations,
    pendingRequests,
    openTickets,
    recentTx,
  ] = await Promise.all([
    db.campusInventory.findMany({ where: { campusId } }),
    db.stockAllocation.findMany({
      where: {
        destinationCampusId: campusId,
        status: { in: ["DISPATCHED", "PARTIALLY_RECEIVED"] },
      },
      include: {
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
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.labRequest.findMany({
      where: { campusId, status: "PENDING_LAB_MANAGER" },
      include: LAB_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.issueTicket.count({
      where: {
        campusId,
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"] },
      },
    }),
    db.inventoryTransaction.findMany({
      where: { campusId },
      include: {
        campus: { select: { id: true, code: true, name: true } },
        item: { select: { id: true, code: true, name: true } },
        performedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  let totalCampusUnits = 0;
  let availableUnits = 0;
  let borrowedUnits = 0;
  let reservedUnits = 0;
  let damagedUnits = 0;
  let missingUnits = 0;

  for (const inv of inventories) {
    totalCampusUnits += inv.receivedQuantity;
    availableUnits += inv.availableQuantity;
    borrowedUnits += inv.borrowedQuantity;
    reservedUnits += inv.reservedQuantity;
    damagedUnits += inv.damagedQuantity;
    missingUnits += inv.missingQuantity;
  }

  const recentTransactions: InventoryTransactionDTO[] = recentTx.map((t) => ({
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
  }));

  return {
    campus,
    kpis: {
      totalCampusUnits,
      availableUnits,
      borrowedUnits,
      reservedUnits,
      damagedUnits,
      missingUnits,
      incomingAllocations: incomingAllocations.length,
      pendingStudentRequests: pendingRequests.length,
      openTickets,
    },
    recentTransactions,
    pendingRequests: pendingRequests.map(mapLabRequestToDTO),
    incomingAllocationsList: incomingAllocations.map((a) => ({
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
    })),
  };
}

export async function getInstructorDashboard(
  actor: AuthUserDTO,
  db: DbClient = prisma
): Promise<InstructorDashboardDTO> {
  const campusId = requireUserCampusId(actor);
  const campus = await db.campus.findUnique({
    where: { id: campusId },
    select: { id: true, code: true, name: true },
  });
  if (!campus) throw new NotFoundError("Assigned campus not found");

  const [
    pendingRequests,
    approvedCount,
    activeBorrowingsCount,
    pendingReturns,
    openTicketsCount,
  ] = await Promise.all([
    db.labRequest.findMany({
      where: {
        campusId,
        instructorId: actor.id,
        status: "PENDING_INSTRUCTOR",
      },
      include: LAB_REQUEST_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.labRequest.count({
      where: {
        campusId,
        instructorId: actor.id,
        status: { in: ["APPROVED", "PARTIALLY_ISSUED"] },
      },
    }),
    db.borrowingRecord.count({
      where: {
        campusId,
        issuedByInstructorId: actor.id,
        closedAt: null,
      },
    }),
    db.labRequest.findMany({
      where: {
        campusId,
        instructorId: actor.id,
        status: { in: ["RETURN_VERIFICATION_PENDING", "RETURN_DISPUTED"] },
      },
      include: LAB_REQUEST_INCLUDE,
      orderBy: { updatedAt: "desc" },
      take: 10,
    }),
    db.issueTicket.count({
      where: {
        campusId,
        createdById: actor.id,
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "REOPENED"] },
      },
    }),
  ]);

  return {
    campus,
    kpis: {
      pendingStudentRequests: pendingRequests.length,
      approvedRequests: approvedCount,
      activeBorrowings: activeBorrowingsCount,
      pendingReturnVerifications: pendingReturns.length,
      openIssueTickets: openTicketsCount,
    },
    pendingRequestsList: pendingRequests.map(mapLabRequestToDTO),
    pendingReturnsList: pendingReturns.map(mapLabRequestToDTO),
  };
}

export async function getStudentDashboard(
  actor: AuthUserDTO,
  db: DbClient = prisma
): Promise<StudentDashboardDTO> {
  const campusId = requireUserCampusId(actor);
  const campus = await db.campus.findUnique({
    where: { id: campusId },
    select: { id: true, code: true, name: true },
  });
  if (!campus) throw new NotFoundError("Assigned campus not found");

  const [availableItemsCount, myRequests, activeBorrowings] = await Promise.all(
    [
      db.campusInventory.count({
        where: {
          campusId,
          isVerified: true,
          isVisible: true,
          availableQuantity: { gt: 0 },
          item: { isActive: true },
        },
      }),
      db.labRequest.findMany({
        where: { campusId, studentId: actor.id },
        include: LAB_REQUEST_INCLUDE,
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      db.borrowingRecord.findMany({
        where: { campusId, studentId: actor.id, closedAt: null },
        select: {
          issuedQuantity: true,
          returnedQuantity: true,
          damagedQuantity: true,
          missingQuantity: true,
        },
      }),
    ]
  );

  const myPendingRequests = myRequests.filter((r) =>
    ["PENDING_INSTRUCTOR", "PENDING_LAB_MANAGER"].includes(r.status)
  ).length;

  const myApprovedRequests = myRequests.filter((r) =>
    ["APPROVED", "PARTIALLY_ISSUED"].includes(r.status)
  ).length;

  const currentlyBorrowedItems = activeBorrowings.reduce(
    (acc, b) =>
      acc +
      Math.max(
        0,
        b.issuedQuantity -
          b.returnedQuantity -
          b.damagedQuantity -
          b.missingQuantity
      ),
    0
  );

  const itemsAwaitingReturn = myRequests.filter((r) =>
    [
      "ISSUED",
      "PARTIALLY_ISSUED",
      "RETURN_PENDING",
      "PARTIALLY_RETURNED",
      "RETURN_VERIFICATION_PENDING",
      "RETURN_DISPUTED",
    ].includes(r.status)
  ).length;

  return {
    campus,
    kpis: {
      availableItemsCount,
      myPendingRequests,
      myApprovedRequests,
      currentlyBorrowedItems,
      itemsAwaitingReturn,
    },
    recentRequests: myRequests.slice(0, 8).map(mapLabRequestToDTO),
  };
}

export async function getDashboardForActor(
  actor: AuthUserDTO,
  campusFilterId?: string,
  db: DbClient = prisma
): Promise<
  | CentralDashboardDTO
  | LabManagerDashboardDTO
  | InstructorDashboardDTO
  | StudentDashboardDTO
> {
  switch (actor.role) {
    case "CENTRAL_LAB_MANAGER":
      return getCentralDashboard(campusFilterId, db);
    case "LAB_MANAGER":
      return getLabManagerDashboard(actor, db);
    case "INSTRUCTOR":
      return getInstructorDashboard(actor, db);
    case "STUDENT":
      return getStudentDashboard(actor, db);
  }
}
