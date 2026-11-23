import { prisma, type DbClient } from "@/lib/prisma";
import { assertCampusScope, assertRole } from "@/lib/auth/rbac";
import { recordAuditLog } from "@/lib/audit/audit";
import { realtimeEventBus } from "@/lib/realtime/event-bus";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import {
  LAB_REQUEST_INCLUDE,
  mapLabRequestToDTO,
  mapPhotoToDTO,
} from "@/services/request.service";
import {
  REQUIRED_PHOTO_ANGLES,
  type AuthUserDTO,
  type ItemPhotoDTO,
  type LabRequestDTO,
  type LabRequestStatus,
  type PhotoAngle,
  type ReturnCondition,
  type ReturnVerificationStatus,
} from "@/types/contracts";

/**
 * Uploads one of the 4 mandatory collection photos (`FRONT_TOP`, `BACK_BOTTOM`, `LEFT_SIDE`, `RIGHT_SIDE`).
 * - Allowed ONLY for the requesting Student (or assigned Instructor assisting during handover) on APPROVED / PARTIALLY_ISSUED requests.
 * - IMMUTABLE once the item has been collected (BorrowingRecord exists / issuedQuantity > 0).
 */
export async function uploadCollectionPhoto(
  actor: AuthUserDTO,
  requestId: string,
  input: {
    requestItemId: string;
    angle: PhotoAngle;
    storageKey: string;
    url: string;
  },
  db: DbClient = prisma
): Promise<ItemPhotoDTO> {
  assertRole(
    actor,
    ["STUDENT", "INSTRUCTOR"],
    "Only the requesting Student or assigned Instructor can upload collection photos"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: { items: true },
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "upload photos for this request");

  if (actor.role === "STUDENT" && request.studentId !== actor.id) {
    throw new ForbiddenError("You can only upload photos for your own requests");
  }
  if (actor.role === "INSTRUCTOR" && request.instructorId !== actor.id) {
    throw new ForbiddenError(
      "Only the assigned Instructor can assist with collection photos"
    );
  }

  if (!["APPROVED", "PARTIALLY_ISSUED"].includes(request.status)) {
    throw new ConflictError(
      `Collection photos can only be uploaded for APPROVED requests (current status: ${request.status})`
    );
  }

  const requestItem = request.items.find((i) => i.id === input.requestItemId);
  if (!requestItem) {
    throw new NotFoundError(
      `Request item '${input.requestItemId}' does not belong to request '${request.requestCode}'`
    );
  }

  // Immutability enforcement: once collected/issued, collection photos cannot be altered
  if (requestItem.issuedQuantity > 0) {
    throw new ConflictError(
      "Collection photos are immutable once equipment collection has been confirmed"
    );
  }

  const existing = await db.itemPhoto.findUnique({
    where: {
      requestItemId_phase_angle: {
        requestItemId: requestItem.id,
        phase: "COLLECTION",
        angle: input.angle,
      },
    },
  });

  const saved = existing
    ? await db.itemPhoto.update({
        where: { id: existing.id },
        data: {
          storageKey: input.storageKey,
          url: input.url,
          uploadedById: actor.id,
        },
      })
    : await db.itemPhoto.create({
        data: {
          requestId: request.id,
          requestItemId: requestItem.id,
          uploadedById: actor.id,
          angle: input.angle,
          phase: "COLLECTION",
          storageKey: input.storageKey,
          url: input.url,
        },
      });

  return mapPhotoToDTO(saved);
}

/**
 * Assigned Instructor confirms equipment collection (handover to student).
 * CRITICAL RULES:
 * - ONLY the assigned Instructor can confirm collection.
 * - Request must be APPROVED or PARTIALLY_ISSUED.
 * - ALL 4 mandatory collection photo angles (FRONT_TOP, BACK_BOTTOM, LEFT_SIDE, RIGHT_SIDE)
 *   MUST exist for EVERY item being collected!
 * - Atomically moves stock: `reservedQuantity -= issuedQty`, `borrowedQuantity += issuedQty`.
 * - Creates BorrowingRecord, links collection photos to it, logs `ITEM_ISSUED`, updates request status.
 */
export async function confirmCollection(
  actor: AuthUserDTO,
  requestId: string,
  input: {
    items?: Array<{ requestItemId: string; issuedQuantity: number }>;
    dueAt?: string | null;
  } = {},
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  assertRole(
    actor,
    ["INSTRUCTOR"],
    "Only the assigned Instructor can confirm equipment collection"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: {
      items: { include: { item: true, photos: true } },
    },
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "confirm collection for this request");

  if (request.instructorId !== actor.id) {
    throw new ForbiddenError(
      "Only the Instructor assigned to this request can confirm collection"
    );
  }

  if (!["APPROVED", "PARTIALLY_ISSUED"].includes(request.status)) {
    throw new ConflictError(
      `Collection cannot be confirmed in status '${request.status}'`
    );
  }

  // Default to remaining unissued approved quantity for all items if items[] not explicitly provided
  const itemsToIssue =
    input.items && input.items.length > 0
      ? input.items
      : request.items
          .filter((ri) => ri.approvedQuantity - ri.issuedQuantity > 0)
          .map((ri) => ({
            requestItemId: ri.id,
            issuedQuantity: ri.approvedQuantity - ri.issuedQuantity,
          }));

  if (itemsToIssue.length === 0) {
    throw new BadRequestError("No remaining approved items left to issue");
  }

  // Validate quantities and mandatory 4-angle collection photos BEFORE entering transaction
  for (const entry of itemsToIssue) {
    const reqItem = request.items.find((i) => i.id === entry.requestItemId);
    if (!reqItem) {
      throw new NotFoundError(
        `Request item '${entry.requestItemId}' not found in request '${request.requestCode}'`
      );
    }

    const remaining = reqItem.approvedQuantity - reqItem.issuedQuantity;
    if (entry.issuedQuantity <= 0 || entry.issuedQuantity > remaining) {
      throw new BadRequestError(
        `Invalid issue quantity ${entry.issuedQuantity} for '${reqItem.item.code}'. Remaining approved quantity is ${remaining}.`
      );
    }

    const collectionPhotos = reqItem.photos.filter(
      (p) => p.phase === "COLLECTION"
    );
    const presentAngles = new Set(collectionPhotos.map((p) => p.angle));
    const missingAngles = REQUIRED_PHOTO_ANGLES.filter(
      (angle) => !presentAngles.has(angle)
    );
    if (missingAngles.length > 0) {
      throw new BadRequestError(
        `Cannot confirm collection for '${reqItem.item.name}': missing mandatory collection photos for angles: ${missingAngles.join(", ")}`,
        {
          requestItemId: reqItem.id,
          missingAngles,
        }
      );
    }
  }

  const dueDate = input.dueAt ? new Date(input.dueAt) : null;

  const updated = await db.$transaction(async (tx) => {
    for (const entry of itemsToIssue) {
      const reqItem = request.items.find((i) => i.id === entry.requestItemId)!;
      const qty = entry.issuedQuantity;

      const inv = await tx.campusInventory.findUnique({
        where: {
          campusId_itemId: {
            campusId: request.campusId,
            itemId: reqItem.itemId,
          },
        },
      });
      if (!inv) {
        throw new NotFoundError("Campus inventory record not found");
      }

      // Atomic conditional stock transfer: reserved -> borrowed
      const transfer = await tx.campusInventory.updateMany({
        where: {
          id: inv.id,
          reservedQuantity: { gte: qty },
        },
        data: {
          reservedQuantity: { decrement: qty },
          borrowedQuantity: { increment: qty },
        },
      });
      if (transfer.count !== 1) {
        throw new ConflictError(
          `Insufficient reserved stock to issue ${qty} units of '${reqItem.item.name}'`
        );
      }

      const borrowing = await tx.borrowingRecord.create({
        data: {
          requestId: request.id,
          requestItemId: reqItem.id,
          campusId: request.campusId,
          itemId: reqItem.itemId,
          studentId: request.studentId,
          issuedByInstructorId: actor.id,
          issuedQuantity: qty,
          returnedQuantity: 0,
          damagedQuantity: 0,
          missingQuantity: 0,
          dueAt: dueDate,
        },
      });

      // Link existing collection photos to the borrowing record
      await tx.itemPhoto.updateMany({
        where: {
          requestItemId: reqItem.id,
          phase: "COLLECTION",
          borrowingRecordId: null,
        },
        data: { borrowingRecordId: borrowing.id },
      });

      await tx.labRequestItem.update({
        where: { id: reqItem.id },
        data: { issuedQuantity: reqItem.issuedQuantity + qty },
      });

      await tx.inventoryTransaction.create({
        data: {
          campusId: request.campusId,
          itemId: reqItem.itemId,
          type: "ITEM_ISSUED",
          quantity: qty,
          previousQuantity: inv.borrowedQuantity,
          updatedQuantity: inv.borrowedQuantity + qty,
          referenceType: "BorrowingRecord",
          referenceId: borrowing.id,
          performedById: actor.id,
          remarks: `Issued ${qty} units to student for request ${request.requestCode}`,
        },
      });
    }

    const refreshedItems = await tx.labRequestItem.findMany({
      where: { requestId: request.id },
    });
    const fullyIssued = refreshedItems.every(
      (i) => i.issuedQuantity >= i.approvedQuantity
    );
    const nextStatus: LabRequestStatus = fullyIssued
      ? "ISSUED"
      : "PARTIALLY_ISSUED";

    const req = await tx.labRequest.update({
      where: { id: request.id },
      data: { status: nextStatus },
      include: LAB_REQUEST_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: request.campusId,
      action: "COLLECTION_CONFIRMED",
      entityType: "LabRequest",
      entityId: request.id,
      previousState: { status: request.status },
      newState: { status: nextStatus, issuedItems: itemsToIssue },
    });

    return req;
  });

  realtimeEventBus.publish({
    type: "borrowing.issued",
    campusId: request.campusId,
    entityType: "LabRequest",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Equipment issued for request ${updated.requestCode} (${updated.status})`,
  });

  realtimeEventBus.publish({
    type: "inventory.updated",
    campusId: request.campusId,
    entityType: "CampusInventory",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Campus inventory updated upon issue of ${updated.requestCode}`,
  });

  return mapLabRequestToDTO(updated);
}

/**
 * Student uploads one of the 4 mandatory return photos (`FRONT_TOP`, `BACK_BOTTOM`, `LEFT_SIDE`, `RIGHT_SIDE`).
 * - ONLY the borrowing Student can upload return photos.
 * - Linked to original request, requestItem, and borrowingRecord.
 */
export async function uploadReturnPhoto(
  actor: AuthUserDTO,
  requestId: string,
  input: {
    requestItemId: string;
    angle: PhotoAngle;
    storageKey: string;
    url: string;
  },
  db: DbClient = prisma
): Promise<ItemPhotoDTO> {
  assertRole(
    actor,
    ["STUDENT"],
    "Only the borrowing Student can upload return photos"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: {
      items: { include: { borrowingRecords: true } },
    },
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "upload return photos");

  if (request.studentId !== actor.id) {
    throw new ForbiddenError(
      "You can only upload return photos for your own borrowed equipment"
    );
  }

  const allowedStatuses: LabRequestStatus[] = [
    "ISSUED",
    "PARTIALLY_ISSUED",
    "RETURN_PENDING",
    "PARTIALLY_RETURNED",
    "RETURN_DISPUTED",
  ];
  if (!allowedStatuses.includes(request.status)) {
    throw new ConflictError(
      `Return photos cannot be uploaded while request is in status '${request.status}'`
    );
  }

  const requestItem = request.items.find((i) => i.id === input.requestItemId);
  if (!requestItem || requestItem.issuedQuantity <= 0) {
    throw new NotFoundError(
      `Issued request item '${input.requestItemId}' not found in request '${request.requestCode}'`
    );
  }

  const activeBorrowing =
    requestItem.borrowingRecords.find((b) => !b.closedAt) ??
    requestItem.borrowingRecords[0] ??
    null;

  const existing = await db.itemPhoto.findUnique({
    where: {
      requestItemId_phase_angle: {
        requestItemId: requestItem.id,
        phase: "RETURN",
        angle: input.angle,
      },
    },
  });

  const saved = existing
    ? await db.itemPhoto.update({
        where: { id: existing.id },
        data: {
          storageKey: input.storageKey,
          url: input.url,
          borrowingRecordId: activeBorrowing?.id ?? null,
          uploadedById: actor.id,
        },
      })
    : await db.itemPhoto.create({
        data: {
          requestId: request.id,
          requestItemId: requestItem.id,
          borrowingRecordId: activeBorrowing?.id ?? null,
          uploadedById: actor.id,
          angle: input.angle,
          phase: "RETURN",
          storageKey: input.storageKey,
          url: input.url,
        },
      });

  return mapPhotoToDTO(saved);
}

/**
 * Student submits return of borrowed equipment.
 * CRITICAL RULES:
 * - ONLY the borrowing Student can submit a return.
 * - ALL 4 mandatory RETURN photo angles MUST exist for each returned item.
 * - Creates ReturnVerification with status PENDING.
 * - Moves request status to RETURN_VERIFICATION_PENDING.
 * - NEVER auto-closes the borrowing ticket! Physical Instructor verification is mandatory.
 */
export async function submitReturn(
  actor: AuthUserDTO,
  requestId: string,
  input: {
    items: Array<{
      requestItemId?: string;
      borrowingRecordId?: string;
      returnedQuantity: number;
      studentComments?: string | null;
    }>;
  },
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  assertRole(
    actor,
    ["STUDENT"],
    "Only the borrowing Student can submit equipment returns"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: {
      items: {
        include: {
          item: true,
          photos: true,
          borrowingRecords: true,
        },
      },
    },
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "submit return for this request");

  if (request.studentId !== actor.id) {
    throw new ForbiddenError("You can only submit returns for your own requests");
  }

  const allowedStatuses: LabRequestStatus[] = [
    "ISSUED",
    "PARTIALLY_ISSUED",
    "RETURN_PENDING",
    "PARTIALLY_RETURNED",
    "RETURN_DISPUTED",
  ];
  if (!allowedStatuses.includes(request.status)) {
    throw new ConflictError(
      `Return cannot be submitted when request is in status '${request.status}'`
    );
  }

  // Validate every returned item & mandatory 4-angle return photos
  const resolvedEntries: Array<{
    requestItemId: string;
    borrowingRecordId: string;
    returnedQuantity: number;
    studentComments: string | null;
  }> = [];

  for (const entry of input.items) {
    const reqItem = request.items.find(
      (ri) =>
        (entry.requestItemId && ri.id === entry.requestItemId) ||
        (entry.borrowingRecordId &&
          ri.borrowingRecords.some((br) => br.id === entry.borrowingRecordId))
    );

    if (!reqItem) {
      throw new NotFoundError(
        `Returned item not found in request '${request.requestCode}'`
      );
    }

    const borrowing = entry.borrowingRecordId
      ? reqItem.borrowingRecords.find((b) => b.id === entry.borrowingRecordId)
      : reqItem.borrowingRecords.find((b) => !b.closedAt) ??
        reqItem.borrowingRecords[0];

    if (!borrowing) {
      throw new BadRequestError(
        `No active borrowing record exists for item '${reqItem.item.code}'`
      );
    }

    const accounted =
      borrowing.returnedQuantity +
      borrowing.damagedQuantity +
      borrowing.missingQuantity;
    const outstanding = borrowing.issuedQuantity - accounted;

    if (entry.returnedQuantity <= 0 || entry.returnedQuantity > outstanding) {
      throw new BadRequestError(
        `Invalid return quantity ${entry.returnedQuantity} for '${reqItem.item.code}'. Outstanding borrowed units: ${outstanding}.`
      );
    }

    const returnPhotos = reqItem.photos.filter((p) => p.phase === "RETURN");
    const presentAngles = new Set(returnPhotos.map((p) => p.angle));
    const missingAngles = REQUIRED_PHOTO_ANGLES.filter(
      (angle) => !presentAngles.has(angle)
    );
    if (missingAngles.length > 0) {
      throw new BadRequestError(
        `Cannot submit return for '${reqItem.item.name}': missing mandatory return photos for angles: ${missingAngles.join(", ")}`,
        {
          requestItemId: reqItem.id,
          missingAngles,
        }
      );
    }

    resolvedEntries.push({
      requestItemId: reqItem.id,
      borrowingRecordId: borrowing.id,
      returnedQuantity: entry.returnedQuantity,
      studentComments: entry.studentComments ?? null,
    });
  }

  const updated = await db.$transaction(async (tx) => {
    for (const entry of resolvedEntries) {
      await tx.returnVerification.create({
        data: {
          borrowingRecordId: entry.borrowingRecordId,
          requestItemId: entry.requestItemId,
          returnedQuantity: entry.returnedQuantity,
          damagedQuantity: 0,
          missingQuantity: 0,
          condition: "GOOD",
          status: "PENDING",
          studentComments: entry.studentComments,
        },
      });
    }

    // NEVER auto-close: always require physical instructor verification!
    const req = await tx.labRequest.update({
      where: { id: request.id },
      data: { status: "RETURN_VERIFICATION_PENDING" },
      include: LAB_REQUEST_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: request.campusId,
      action: "RETURN_SUBMITTED",
      entityType: "LabRequest",
      entityId: request.id,
      previousState: { status: request.status },
      newState: {
        status: "RETURN_VERIFICATION_PENDING",
        items: resolvedEntries,
      },
    });

    return req;
  });

  realtimeEventBus.publish({
    type: "return.submitted",
    campusId: request.campusId,
    entityType: "LabRequest",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Student submitted return for ${updated.requestCode} — awaiting Instructor verification`,
  });

  return mapLabRequestToDTO(updated);
}

/**
 * Assigned Instructor physically verifies returned equipment & compares collection vs return photos.
 * CRITICAL RULES:
 * - ONLY the assigned Instructor can verify returns.
 * - GOOD: borrowedQuantity -= qty, availableQuantity += qty (logs ITEM_RETURNED).
 * - DAMAGED: borrowedQuantity -= dmg, damagedQuantity += dmg (logs ITEM_MARKED_DAMAGED), status -> RETURN_DISPUTED.
 * - MISSING: borrowedQuantity -= miss, missingQuantity += miss (logs ITEM_MARKED_MISSING), status -> RETURN_DISPUTED.
 * - PARTIAL: supports mixed good + damaged + missing in a single verification!
 * - Request closes (`CLOSED`) ONLY when every issued unit across all items is returned in GOOD condition
 *   and zero damaged/missing disputes remain unresolved!
 */
export async function verifyReturn(
  actor: AuthUserDTO,
  requestId: string,
  input: {
    items: Array<{
      returnVerificationId?: string;
      borrowingRecordId?: string;
      requestItemId?: string;
      condition: ReturnCondition;
      returnedQuantity: number;
      damagedQuantity?: number;
      missingQuantity?: number;
      instructorRemarks?: string | null;
    }>;
  },
  db: DbClient = prisma
): Promise<LabRequestDTO> {
  assertRole(
    actor,
    ["INSTRUCTOR"],
    "Only the assigned Instructor can verify equipment returns"
  );

  const request = await db.labRequest.findUnique({
    where: { id: requestId },
    include: {
      items: {
        include: {
          item: true,
          borrowingRecords: {
            include: { returnVerifications: true },
          },
        },
      },
    },
  });
  if (!request) {
    throw new NotFoundError(`Lab request '${requestId}' not found`);
  }

  assertCampusScope(actor, request.campusId, "verify return for this request");

  if (request.instructorId !== actor.id) {
    throw new ForbiddenError(
      "Only the Instructor assigned to this request can verify returned equipment"
    );
  }

  const allowedStatuses: LabRequestStatus[] = [
    "RETURN_VERIFICATION_PENDING",
    "RETURN_SUBMITTED",
    "RETURN_DISPUTED",
    "PARTIALLY_RETURNED",
    "ISSUED",
  ];
  if (!allowedStatuses.includes(request.status)) {
    throw new ConflictError(
      `Return verification is not allowed in status '${request.status}'`
    );
  }

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    let anyDisputeReported = false;

    for (const entry of input.items) {
      const reqItem = request.items.find(
        (ri) =>
          (entry.requestItemId && ri.id === entry.requestItemId) ||
          (entry.borrowingRecordId &&
            ri.borrowingRecords.some((b) => b.id === entry.borrowingRecordId)) ||
          (entry.returnVerificationId &&
            ri.borrowingRecords.some((b) =>
              b.returnVerifications.some(
                (rv) => rv.id === entry.returnVerificationId
              )
            ))
      );

      if (!reqItem) {
        throw new NotFoundError(
          `Return verification target not found in request '${request.requestCode}'`
        );
      }

      const borrowing = entry.borrowingRecordId
        ? reqItem.borrowingRecords.find((b) => b.id === entry.borrowingRecordId)
        : entry.returnVerificationId
          ? reqItem.borrowingRecords.find((b) =>
              b.returnVerifications.some(
                (rv) => rv.id === entry.returnVerificationId
              )
            )
          : reqItem.borrowingRecords.find((b) => !b.closedAt) ??
            reqItem.borrowingRecords[0];

      if (!borrowing) {
        throw new NotFoundError(
          `Borrowing record not found for item '${reqItem.item.code}'`
        );
      }

      const goodQty = entry.returnedQuantity;
      const damagedQty = entry.damagedQuantity ?? 0;
      const missingQty = entry.missingQuantity ?? 0;
      const totalProcessed = goodQty + damagedQty + missingQty;

      if (goodQty < 0 || damagedQty < 0 || missingQty < 0 || totalProcessed <= 0) {
        throw new BadRequestError(
          "Verified quantities must be non-negative and sum to at least 1"
        );
      }

      const alreadyAccounted =
        borrowing.returnedQuantity +
        borrowing.damagedQuantity +
        borrowing.missingQuantity;
      const outstanding = borrowing.issuedQuantity - alreadyAccounted;

      if (totalProcessed > outstanding) {
        throw new BadRequestError(
          `Verified total (${totalProcessed}) exceeds outstanding borrowed quantity (${outstanding}) for '${reqItem.item.code}'`
        );
      }

      // Enforce condition semantics
      if (entry.condition === "DAMAGED" && damagedQty <= 0) {
        throw new BadRequestError(
          "Condition 'DAMAGED' requires damagedQuantity > 0"
        );
      }
      if (entry.condition === "MISSING" && missingQty <= 0) {
        throw new BadRequestError(
          "Condition 'MISSING' requires missingQuantity > 0"
        );
      }

      const inv = await tx.campusInventory.findUnique({
        where: {
          campusId_itemId: {
            campusId: request.campusId,
            itemId: reqItem.itemId,
          },
        },
      });
      if (!inv) {
        throw new NotFoundError("Campus inventory record not found");
      }

      // Atomic stock reconciliation
      const stockUpdate = await tx.campusInventory.updateMany({
        where: {
          id: inv.id,
          borrowedQuantity: { gte: totalProcessed },
        },
        data: {
          borrowedQuantity: { decrement: totalProcessed },
          availableQuantity: { increment: goodQty },
          damagedQuantity: { increment: damagedQty },
          missingQuantity: { increment: missingQty },
        },
      });

      if (stockUpdate.count !== 1) {
        throw new ConflictError(
          `Borrowed stock invariant violation while reconciling '${reqItem.item.code}'`
        );
      }

      // Immutable InventoryTransaction entries
      if (goodQty > 0) {
        await tx.inventoryTransaction.create({
          data: {
            campusId: request.campusId,
            itemId: reqItem.itemId,
            type: "ITEM_RETURNED",
            quantity: goodQty,
            previousQuantity: inv.availableQuantity,
            updatedQuantity: inv.availableQuantity + goodQty,
            referenceType: "BorrowingRecord",
            referenceId: borrowing.id,
            performedById: actor.id,
            remarks:
              entry.instructorRemarks ||
              `Verified return of ${goodQty} units in GOOD condition (${request.requestCode})`,
          },
        });
      }

      if (damagedQty > 0) {
        anyDisputeReported = true;
        await tx.inventoryTransaction.create({
          data: {
            campusId: request.campusId,
            itemId: reqItem.itemId,
            type: "ITEM_MARKED_DAMAGED",
            quantity: damagedQty,
            previousQuantity: inv.damagedQuantity,
            updatedQuantity: inv.damagedQuantity + damagedQty,
            referenceType: "BorrowingRecord",
            referenceId: borrowing.id,
            performedById: actor.id,
            remarks:
              entry.instructorRemarks ||
              `Marked ${damagedQty} returned units as DAMAGED (${request.requestCode})`,
          },
        });
      }

      if (missingQty > 0) {
        anyDisputeReported = true;
        await tx.inventoryTransaction.create({
          data: {
            campusId: request.campusId,
            itemId: reqItem.itemId,
            type: "ITEM_MARKED_MISSING",
            quantity: missingQty,
            previousQuantity: inv.missingQuantity,
            updatedQuantity: inv.missingQuantity + missingQty,
            referenceType: "BorrowingRecord",
            referenceId: borrowing.id,
            performedById: actor.id,
            remarks:
              entry.instructorRemarks ||
              `Marked ${missingQty} borrowed units as MISSING (${request.requestCode})`,
          },
        });
      }

      let verificationStatus: ReturnVerificationStatus = "VERIFIED_GOOD";
      if (missingQty > 0) {
        verificationStatus = "DISPUTED_MISSING";
      } else if (damagedQty > 0) {
        verificationStatus = "DISPUTED_DAMAGED";
      }

      // Update pending ReturnVerification if one exists, otherwise create one
      const pendingRv = entry.returnVerificationId
        ? borrowing.returnVerifications.find(
            (rv) => rv.id === entry.returnVerificationId
          )
        : borrowing.returnVerifications.find((rv) => rv.status === "PENDING");

      if (pendingRv) {
        await tx.returnVerification.update({
          where: { id: pendingRv.id },
          data: {
            verifiedById: actor.id,
            returnedQuantity: goodQty,
            damagedQuantity: damagedQty,
            missingQuantity: missingQty,
            condition: entry.condition,
            status: verificationStatus,
            instructorRemarks: entry.instructorRemarks ?? null,
            verifiedAt: now,
          },
        });
      } else {
        await tx.returnVerification.create({
          data: {
            borrowingRecordId: borrowing.id,
            requestItemId: reqItem.id,
            verifiedById: actor.id,
            returnedQuantity: goodQty,
            damagedQuantity: damagedQty,
            missingQuantity: missingQty,
            condition: entry.condition,
            status: verificationStatus,
            instructorRemarks: entry.instructorRemarks ?? null,
            verifiedAt: now,
          },
        });
      }

      const nextBorrowReturned = borrowing.returnedQuantity + goodQty;
      const nextBorrowDamaged = borrowing.damagedQuantity + damagedQty;
      const nextBorrowMissing = borrowing.missingQuantity + missingQty;
      const isCleanlyClosed =
        nextBorrowReturned === borrowing.issuedQuantity &&
        nextBorrowDamaged === 0 &&
        nextBorrowMissing === 0;

      await tx.borrowingRecord.update({
        where: { id: borrowing.id },
        data: {
          returnedQuantity: nextBorrowReturned,
          damagedQuantity: nextBorrowDamaged,
          missingQuantity: nextBorrowMissing,
          closedAt: isCleanlyClosed ? now : null,
        },
      });

      await tx.labRequestItem.update({
        where: { id: reqItem.id },
        data: {
          returnedQuantity: reqItem.returnedQuantity + goodQty,
          damagedQuantity: reqItem.damagedQuantity + damagedQty,
          missingQuantity: reqItem.missingQuantity + missingQty,
        },
      });
    }

    // Recompute final request status across ALL items
    const refreshedItems = await tx.labRequestItem.findMany({
      where: { requestId: request.id },
    });

    const hasAnyDamageOrMissing = refreshedItems.some(
      (i) => i.damagedQuantity > 0 || i.missingQuantity > 0
    );
    const allUnitsCleanlyReturned = refreshedItems.every(
      (i) =>
        i.issuedQuantity > 0 &&
        i.returnedQuantity === i.issuedQuantity &&
        i.damagedQuantity === 0 &&
        i.missingQuantity === 0
    );

    let nextStatus: LabRequestStatus;
    if (anyDisputeReported || hasAnyDamageOrMissing) {
      // NEVER close a request with damaged or missing items!
      nextStatus = "RETURN_DISPUTED";
    } else if (allUnitsCleanlyReturned) {
      nextStatus = "CLOSED";
    } else {
      nextStatus = "PARTIALLY_RETURNED";
    }

    const req = await tx.labRequest.update({
      where: { id: request.id },
      data: { status: nextStatus },
      include: LAB_REQUEST_INCLUDE,
    });

    await recordAuditLog(tx, {
      actorId: actor.id,
      actorRole: actor.role,
      campusId: request.campusId,
      action: "RETURN_VERIFIED",
      entityType: "LabRequest",
      entityId: request.id,
      previousState: { status: request.status },
      newState: {
        status: nextStatus,
        verifiedEntries: input.items.length,
        hasDispute: anyDisputeReported || hasAnyDamageOrMissing,
      },
    });

    return req;
  });

  realtimeEventBus.publish({
    type: "return.verified",
    campusId: request.campusId,
    entityType: "LabRequest",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Return verification completed for ${updated.requestCode} (${updated.status})`,
  });

  realtimeEventBus.publish({
    type: "inventory.updated",
    campusId: request.campusId,
    entityType: "CampusInventory",
    entityId: updated.id,
    actorId: actor.id,
    summary: `Inventory reconciled after return verification of ${updated.requestCode}`,
  });

  return mapLabRequestToDTO(updated);
}
