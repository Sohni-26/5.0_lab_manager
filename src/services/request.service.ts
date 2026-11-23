import crypto from "crypto";
import { prisma, type DbClient } from "@/lib/prisma";
import {
  assertCampusScope,
  assertRole,
  getEffectiveCampusScope,
  requireUserCampusId,
} from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import { realtimeEventBus } from "@/lib/realtime/event-bus";
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
  ApprovalDecision,
  ApprovalStage,
  AuthUserDTO,
  BorrowingRecordDTO,
  ItemPhotoDTO,
  LabRequestDTO,
  LabRequestStatus,
  PaginationMeta,
  PhotoAngle,
  PhotoPhase,
  ReturnCondition,
  ReturnVerificationDTO,
  ReturnVerificationStatus,
  UserRole,
} from "@/types/contracts";

function generateRequestCode(campusCode: string): string {
  const short = crypto.randomBytes(3).toString("hex").toUpperCase();
  const year = new Date().getFullYear();
  return `REQ-${year}-${campusCode}-${short}`;
}

export const LAB_REQUEST_INCLUDE = {
  campus: { select: { id: true, code: true, name: true } },
  student: {
    select: { id: true, fullName: true, email: true, institutionalId: true },
  },
  instructor: {
    select: { id: true, fullName: true, email: true, institutionalId: true },
  },
  items: {
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          imageUrl: true,
          category: { select: { id: true, name: true } },
        },
      },
      photos: true,
      borrowingRecords: {
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          photos: true,
          returnVerifications: {
            include: {
              verifiedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { submittedAt: "desc" as const },
          },
        },
      },
    },
  },
  approvals: {
    include: {
      approver: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  photos: true,
  borrowingRecords: {
    include: {
      item: { select: { id: true, code: true, name: true, unit: true } },
      photos: true,
      returnVerifications: {
        include: {
          verifiedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { submittedAt: "desc" as const },
      },
    },
  },
} as const;

export function mapPhotoToDTO(p: {
  id: string;
  requestId: string;
  requestItemId: string;
  borrowingRecordId: string | null;
  uploadedById: string;
  angle: PhotoAngle;
  phase: PhotoPhase;
  storageKey: string;
  url: string;
  createdAt: Date;
}): ItemPhotoDTO {
  return {
    id: p.id,
    requestId: p.requestId,
    requestItemId: p.requestItemId,
    borrowingRecordId: p.borrowingRecordId,
    uploadedById: p.uploadedById,
    angle: p.angle,
    phase: p.phase,
    storageKey: p.storageKey,
    url: p.url,
    createdAt: p.createdAt.toISOString(),
  };
}

export function mapReturnVerificationToDTO(rv: {
  id: string;
  borrowingRecordId: string;
  requestItemId: string;
  verifiedById: string | null;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  condition: ReturnCondition;
  status: ReturnVerificationStatus;
  studentComments: string | null;
  instructorRemarks: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
  verifiedBy?: { id: string; fullName: string } | null;
}): ReturnVerificationDTO {
  return {
    id: rv.id,
    borrowingRecordId: rv.borrowingRecordId,
    requestItemId: rv.requestItemId,
    verifiedById: rv.verifiedById,
    returnedQuantity: rv.returnedQuantity,
    damagedQuantity: rv.damagedQuantity,
    missingQuantity: rv.missingQuantity,
    condition: rv.condition,
    status: rv.status,
    studentComments: rv.studentComments,
    instructorRemarks: rv.instructorRemarks,
    submittedAt: rv.submittedAt.toISOString(),
    verifiedAt: rv.verifiedAt ? rv.verifiedAt.toISOString() : null,
    verifiedBy: rv.verifiedBy ?? null,
  };
}

export function mapBorrowingRecordToDTO(br: {
  id: string;
  requestId: string;
  requestItemId: string;
  campusId: string;
  itemId: string;
  studentId: string;
  issuedByInstructorId: string;
  issuedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  issuedAt: Date;
  dueAt: Date | null;
  closedAt: Date | null;
  item?: { id: string; code: string; name: string; unit: string };
  photos?: Parameters<typeof mapPhotoToDTO>[0][];
  returnVerifications?: Parameters<typeof mapReturnVerificationToDTO>[0][];
}): BorrowingRecordDTO {
  return {
    id: br.id,
    requestId: br.requestId,
    requestItemId: br.requestItemId,
    campusId: br.campusId,
    itemId: br.itemId,
    studentId: br.studentId,
    issuedByInstructorId: br.issuedByInstructorId,
    issuedQuantity: br.issuedQuantity,
    returnedQuantity: br.returnedQuantity,
    damagedQuantity: br.damagedQuantity,
    missingQuantity: br.missingQuantity,
    issuedAt: br.issuedAt.toISOString(),
    dueAt: br.dueAt ? br.dueAt.toISOString() : null,
    closedAt: br.closedAt ? br.closedAt.toISOString() : null,
    item: br.item,
    photos: br.photos?.map(mapPhotoToDTO),
    returnVerifications: br.returnVerifications?.map(
      mapReturnVerificationToDTO
    ),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLabRequestToDTO(r: any): LabRequestDTO {
  return {
    id: r.id,
    requestCode: r.requestCode,
    campusId: r.campusId,
    studentId: r.studentId,
    instructorId: r.instructorId,
    purpose: r.purpose,
    status: r.status as LabRequestStatus,
    rejectionReason: r.rejectionReason ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    campus: r.campus,
    student: r.student,
    instructor: r.instructor,
    items: (r.items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (it: any) => ({
        id: it.id,
        requestId: it.requestId,
        itemId: it.itemId,
        requestedQuantity: it.requestedQuantity,
        approvedQuantity: it.approvedQuantity,
        issuedQuantity: it.issuedQuantity,
        returnedQuantity: it.returnedQuantity,
        damagedQuantity: it.damagedQuantity,
        missingQuantity: it.missingQuantity,
        item: it.item,
        photos: it.photos?.map(mapPhotoToDTO),
        borrowingRecords: it.borrowingRecords?.map(mapBorrowingRecordToDTO),
      })
    ),
    approvals: (r.approvals ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any) => ({
        id: a.id,
        requestId: a.requestId,
        stage: a.stage as ApprovalStage,
        decision: a.decision as ApprovalDecision,
        approverId: a.approverId,
        comments: a.comments ?? null,
        createdAt: a.createdAt.toISOString(),
        approver: {
          id: a.approver.id,
          fullName: a.approver.fullName,
          role: a.approver.role as UserRole,
        },
      })
    ),
    photos: r.photos?.map(mapPhotoToDTO),
    borrowingRecords: r.borrowingRecords?.map(mapBorrowingRecordToDTO),
  };
}

export async function listLabRequests(
  actor: AuthUserDTO,
  pagination: PaginationParams,
  filters: {
    status?: LabRequestStatus;
    campusId?: string;
  } = {},
  db: DbClient = prisma
): Promise<{ data: LabRequestDTO[]; meta: PaginationMeta }> {
  const effectiveCampusId = getEffectiveCampusScope(actor, filters.campusId);

  const where: Record<string, unknown> = {};
  if (effectiveCampusId) {
    where.campusId = effectiveCampusId;
  }

  // Strict per-role visibility scoping
  if (actor.role === "STUDENT") {
    where.studentId = actor.id;
  } else if (actor.role === "INSTRUCTOR") {
    where.instructorId = actor.id;
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (pagination.search) {
    where.OR = [
      { requestCode: { contains: pagination.search, mode: "insensitive" } },
      { purpose: { contains: pagination.search, mode: "insensitive" } },
      {
        student: {
          fullName: { contains: pagination.search, mode: "insensitive" },
        },
      },
      {
        instructor: {
          fullName: { contains: pagination.search, mode: "insensitive" },
        },
      },
    ];
  }

  const orderByField = pagination.sortBy ?? "createdAt";
  const orderBy = { [orderByField]: pagination.sortOrder };

  const [rows, total] = await Promise.all([
    db.labRequest.findMany({
      where,
      include: LAB_REQUEST_INCLUDE,
      orderBy,
      skip: pagination.skip,
      take: pagination.take,
    }),
    db.labRequest.count({ where }),
  ]);

  return {
    data: rows.map(mapLabRequestToDTO),
    meta: buildPaginationMeta(pagination.page, pagination.pageSize, total),
  };
}

export async function getLabRequestById(
  actor: AuthUserDTO,
  requestId: string,
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: LAB_REQUEST_INCLUDE,
  });

  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "view this lab request");

  if (actor.role === "STUDENT" && request.studentId !== actor.id) {
    throw new ForbiddenError("Students can only view their own lab requests");
  }
  if (actor.role === "INSTRUCTOR" && request.instructorId !== actor.id) {
    throw new ForbiddenError(
      "Instructors can only view lab requests assigned to them"
    );
  }

  return mapLabRequestToDTO(request);
}

/**
 * Stage 1: Student submits multi-item borrowing request.
 * - ONLY Students can submit requests.
 * - Selected instructor must be an ACTIVE INSTRUCTOR in the student's OWN campus.
 * - Every requested item must exist in the student's campus inventory, be verified, visible, active, and have sufficient available stock.
 */
export async function createLabRequest(
  actor: AuthUserDTO,
  input: {
    instructorId: string;
    purpose: string;
    items: Array<{ itemId: string; requestedQuantity: number }>;
  },
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  assertRole(
    actor,
    ["STUDENT"],
    "Only Students can submit lab equipment borrowing requests"
  );
  const campusId = requireUserCampusId(actor);

  const [campus, instructor] = await Promise.all([
    db.campus.findUnique({ where: { id: campusId } }),
    db.user.findUnique({ where: { id: input.instructorId } }),
  ]);

  if (!campus || campus.status !== "ACTIVE") {
    throw new ForbiddenError("Your campus is not active");
  }

  if (!instructor || instructor.role !== "INSTRUCTOR" || instructor.status !== "ACTIVE") {
    throw new BadRequestError(
      "Selected reviewer must be an active Instructor"
    );
  }

  if (instructor.campusId !== campusId) {
    throw new ForbiddenError(
      "Cross-campus instructor selection is not permitted. Select an Instructor from your own campus."
    );
  }

  // Deduplicate items
  const seen = new Set<string>();
  for (const entry of input.items) {
    if (seen.has(entry.itemId)) {
      throw new BadRequestError("Duplicate items are not allowed in a single request");
    }
    seen.add(entry.itemId);
    if (entry.requestedQuantity <= 0) {
      throw new BadRequestError("Requested quantity must be positive");
    }
  }

  // Validate every requested item is verified, visible, active, and in stock on student's campus
  const inventories = await db.campusInventory.findMany({
    where: {
      campusId,
      itemId: { in: Array.from(seen) },
    },
    include: { item: true },
  });

  if (inventories.length !== seen.size) {
    throw new BadRequestError(
      "One or more requested items are not available at your campus"
    );
  }

  for (const entry of input.items) {
    const inv = inventories.find((i) => i.itemId === entry.itemId);
    if (!inv || !inv.isVerified || !inv.isVisible || !inv.item.isActive) {
      throw new ForbiddenError(
        `Item '${inv?.item.code ?? entry.itemId}' is hidden, unverified, or inactive and cannot be requested`
      );
    }
    if (inv.availableQuantity < entry.requestedQuantity) {
      throw new ConflictError(
        `Insufficient available stock for '${inv.item.name}': requested ${entry.requestedQuantity}, available ${inv.availableQuantity}`
      );
    }
  }

  const requestCode = generateRequestCode(campus.code);

  const created = await db.$transaction(async (tx) => {
    const req = await tx.labRequest.create({
      data: {
        requestCode,
        campusId,
        studentId: actor.id,
        instructorId: instructor.id,
        purpose: input.purpose.trim(),
        status: "PENDING_INSTRUCTOR",
        items: {
          create: input.items.map((item) => ({
            itemId: item.itemId,
            requestedQuantity: item.requestedQuantity,
            approvedQuantity: 0,
            issuedQuantity: 0,
            returnedQuantity: 0,
            damagedQuantity: 0,
            missingQuantity: 0,
          })),
        },
      },
      include: LAB_REQUEST_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId,
      action: "LAB_REQUEST_CREATED",
      entityType: "LabRequest",
      entityId: req.id,
      newState: {
        requestCode,
        instructorId: instructor.id,
        status: "PENDING_INSTRUCTOR",
        itemCount: input.items.length,
      },
    });

    return req;
  });

  realtimeEventBus.publish({
    type: "request.created",
    campusId,
    entityType: "LabRequest",
    entityId: created.id,
    actorId: actor.id,
    summary: `New borrowing request ${created.requestCode} submitted by ${actor.fullName}`,
  });

  return mapLabRequestToDTO(created);
}

/**
 * Stage 2: Assigned Instructor reviews request.
 * - ONLY the assigned Instructor from the same campus can approve/reject.
 * - Prevents duplicate processing via status check + RequestApproval unique(requestId, stage).
 * - Approved -> PENDING_LAB_MANAGER; Rejected -> REJECTED_BY_INSTRUCTOR.
 */
export async function processInstructorApproval(
  actor: AuthUserDTO,
  requestId: string,
  input: { decision: ApprovalDecision; comments?: string | null },
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  assertRole(
    actor,
    ["INSTRUCTOR"],
    "Only the assigned Instructor can perform Stage 1 review"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: LAB_REQUEST_INCLUDE,
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "review this lab request");

  if (request.instructorId !== actor.id) {
    throw new ForbiddenError(
      "Only the Instructor assigned to this request may approve or reject it"
    );
  }

  if (request.status !== "PENDING_INSTRUCTOR") {
    throw new ConflictError(
      `Request '${request.requestCode}' is not awaiting Instructor review (current status: ${request.status})`
    );
  }

  const nextStatus: LabRequestStatus =
    input.decision === "APPROVED"
      ? "PENDING_LAB_MANAGER"
      : "REJECTED_BY_INSTRUCTOR";

  const updated = await db.$transaction(async (tx) => {
    const existingApproval = await tx.requestApproval.findUnique({
      where: {
        requestId_stage: { requestId, stage: "INSTRUCTOR_REVIEW" },
      },
    });
    if (existingApproval) {
      throw new ConflictError("Instructor review has already been processed");
    }

    await tx.requestApproval.create({
      data: {
        requestId,
        stage: "INSTRUCTOR_REVIEW",
        decision: input.decision,
        approverId: actor.id,
        comments: input.comments ?? null,
      },
    });

    const req = await tx.labRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        ...(input.decision === "REJECTED"
          ? {
              rejectionReason:
                input.comments?.trim() || "Rejected by Instructor",
            }
          : {}),
      },
      include: LAB_REQUEST_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: request.campusId,
      action:
        input.decision === "APPROVED"
          ? "REQUEST_INSTRUCTOR_APPROVED"
          : "REQUEST_INSTRUCTOR_REJECTED",
      entityType: "LabRequest",
      entityId: requestId,
      previousState: { status: request.status },
      newState: { status: nextStatus, comments: input.comments ?? null },
    });

    return req;
  });

  realtimeEventBus.publish({
    type: "request.status_changed",
    campusId: request.campusId,
    entityType: "LabRequest",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Request ${updated.requestCode} ${input.decision.toLowerCase()} by Instructor`,
  });

  return mapLabRequestToDTO(updated);
}

/**
 * Stage 3: Campus Lab Manager gives final approval & ATOMICALLY RESERVES STOCK.
 * - ONLY a LAB_MANAGER of the request's campus can process.
 * - Cannot bypass Instructor approval (must be in PENDING_LAB_MANAGER).
 * - Uses atomic conditional update (`availableQuantity: { gte: qty }`) inside `$transaction`
 *   to guarantee ZERO double-booking and ZERO negative stock under concurrency!
 */
export async function processLabManagerApproval(
  actor: AuthUserDTO,
  requestId: string,
  input: { decision: ApprovalDecision; comments?: string | null },
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  assertRole(
    actor,
    ["LAB_MANAGER"],
    "Only a Campus Lab Manager can perform final approval"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: LAB_REQUEST_INCLUDE,
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(
    actor,
    request.campusId,
    "approve or reject requests for another campus"
  );

  if (request.status !== "PENDING_LAB_MANAGER") {
    throw new ConflictError(
      `Request '${request.requestCode}' is not awaiting Lab Manager final approval (current status: ${request.status})`
    );
  }

  const nextStatus: LabRequestStatus =
    input.decision === "APPROVED" ? "APPROVED" : "REJECTED_BY_LAB_MANAGER";

  const updated = await db.$transaction(async (tx) => {
    // Re-check status inside transaction for concurrency safety
    const lockedReq = await tx.labRequest.findUnique({
      where: { id: requestId },
      include: { items: { include: { item: true } } },
    });
    if (!lockedReq || lockedReq.status !== "PENDING_LAB_MANAGER") {
      throw new ConflictError(
        `Request '${request.requestCode}' has already been processed`
      );
    }

    const existingApproval = await tx.requestApproval.findUnique({
      where: {
        requestId_stage: { requestId, stage: "LAB_MANAGER_FINAL" },
      },
    });
    if (existingApproval) {
      throw new ConflictError("Lab Manager approval has already been processed");
    }

    if (input.decision === "APPROVED") {
      // ATOMIC stock reservation per item with conditional guard to eliminate double-booking
      for (const reqItem of lockedReq.items) {
        const qty = reqItem.requestedQuantity;
        const inv = await tx.campusInventory.findUnique({
          where: {
            campusId_itemId: {
              campusId: lockedReq.campusId,
              itemId: reqItem.itemId,
            },
          },
        });

        if (!inv || !inv.isVerified) {
          throw new ConflictError(
            `Item '${reqItem.item.code}' is not verified in campus inventory`
          );
        }

        // Atomic conditional update: only succeeds if availableQuantity >= qty at commit time
        const reserveResult = await tx.campusInventory.updateMany({
          where: {
            id: inv.id,
            availableQuantity: { gte: qty },
          },
          data: {
            availableQuantity: { decrement: qty },
            reservedQuantity: { increment: qty },
          },
        });

        if (reserveResult.count !== 1) {
          throw new ConflictError(
            `Insufficient available stock to reserve ${qty} units of '${reqItem.item.name}' (concurrent booking conflict)`
          );
        }

        await tx.labRequestItem.update({
          where: { id: reqItem.id },
          data: { approvedQuantity: qty },
        });

        await tx.inventoryTransaction.create({
          data: {
            campusId: lockedReq.campusId,
            itemId: reqItem.itemId,
            type: "STOCK_RESERVED",
            quantity: qty,
            previousQuantity: inv.availableQuantity,
            updatedQuantity: inv.availableQuantity - qty,
            referenceType: "LabRequest",
            referenceId: lockedReq.id,
            performedById: actor.id,
            remarks: `Reserved ${qty} units upon Lab Manager approval of ${lockedReq.requestCode}`,
          },
        });
      }
    }

    await tx.requestApproval.create({
      data: {
        requestId,
        stage: "LAB_MANAGER_FINAL",
        decision: input.decision,
        approverId: actor.id,
        comments: input.comments ?? null,
      },
    });

    const req = await tx.labRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        ...(input.decision === "REJECTED"
          ? {
              rejectionReason:
                input.comments?.trim() || "Rejected by Lab Manager",
            }
          : {}),
      },
      include: LAB_REQUEST_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: request.campusId,
      action:
        input.decision === "APPROVED"
          ? "REQUEST_LAB_MANAGER_APPROVED"
          : "REQUEST_LAB_MANAGER_REJECTED",
      entityType: "LabRequest",
      entityId: requestId,
      previousState: { status: request.status },
      newState: { status: nextStatus, comments: input.comments ?? null },
    });

    return req;
  });

  realtimeEventBus.publish({
    type: "request.status_changed",
    campusId: request.campusId,
    entityType: "LabRequest",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Request ${updated.requestCode} ${input.decision.toLowerCase()} by Lab Manager`,
  });

  if (input.decision === "APPROVED") {
    realtimeEventBus.publish({
      type: "inventory.updated",
      campusId: request.campusId,
      entityType: "CampusInventory",
      entityId: updated.id,
      actorId: actor.id,
      summary: `Stock reserved for approved request ${updated.requestCode}`,
    });
  }

  return mapLabRequestToDTO(updated);
}
