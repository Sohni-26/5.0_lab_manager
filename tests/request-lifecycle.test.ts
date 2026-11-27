import { describe, expect, it } from "vitest";
import { seedTestFixture } from "./helpers/mock-prisma";
import { BadRequestError, ConflictError } from "@/lib/errors";
import {
  createAllocation,
  verifyAllocation,
} from "@/services/allocation.service";
import { listCampusInventory } from "@/services/inventory.service";
import {
  createLabRequest,
  processInstructorApproval,
  processLabManagerApproval,
} from "@/services/request.service";
import {
  confirmCollection,
  submitReturn,
  uploadCollectionPhoto,
  uploadReturnPhoto,
  verifyReturn,
} from "@/services/borrowing.service";
import { REQUIRED_PHOTO_ANGLES } from "@/types/contracts";

const DEFAULT_PAGE = {
  page: 1,
  pageSize: 20,
  skip: 0,
  take: 20,
  sortOrder: "desc" as const,
};

async function provisionVerifiedStock(
  qty: number
) {
  const fixture = await seedTestFixture();
  const { db, users } = fixture;

  const alloc = await createAllocation(
    users.centralUser,
    {
      destinationCampusId: "cmp-1",
      dispatchImmediately: true,
      items: [{ itemId: "item-arduino", allocatedQuantity: qty }],
    },
    db
  );
  await verifyAllocation(
    users.lm1Cmp1,
    alloc.id,
    {
      items: [
        {
          itemId: "item-arduino",
          receivedQuantity: qty,
          missingQuantity: 0,
          damagedQuantity: 0,
        },
      ],
    },
    db
  );
  return fixture;
}

describe("Request Lifecycle, Concurrency, 4-Photo Proof & Return Verification", () => {
  it("runs full multi-level approval -> 4 collection photos -> issue -> 4 return photos -> GOOD verification -> CLOSED", async () => {
    const { db, users } = await provisionVerifiedStock(10);

    // Stage 1: Student submits request for 3 Arduino boards
    const req = await createLabRequest(
      users.stu1Cmp1,
      {
        instructorId: users.inst1Cmp1.id,
        purpose: "Embedded Systems Capstone",
        items: [{ itemId: "item-arduino", requestedQuantity: 3 }],
      },
      db
    );
    expect(req.status).toBe("PENDING_INSTRUCTOR");
    const reqItemId = req.items[0].id;

    // Lab Manager CANNOT bypass Instructor approval
    await expect(
      processLabManagerApproval(
        users.lm1Cmp1,
        req.id,
        { decision: "APPROVED" },
        db
      )
    ).rejects.toThrow(ConflictError);

    // Stage 2: Instructor approves -> directly APPROVED and atomically reserves 3 units
    const afterInst = await processInstructorApproval(
      users.inst1Cmp1,
      req.id,
      { decision: "APPROVED", comments: "Approved for lab bench" },
      db
    );
    expect(afterInst.status).toBe("APPROVED");

    // Duplicate Instructor approval MUST be rejected
    await expect(
      processInstructorApproval(
        users.inst1Cmp1,
        req.id,
        { decision: "APPROVED" },
        db
      )
    ).rejects.toThrow(ConflictError);

    let inv = (await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db)).data[0];
    expect(inv.availableQuantity).toBe(7);
    expect(inv.reservedQuantity).toBe(3);
    expect(inv.borrowedQuantity).toBe(0);

    // Stage 4: Upload only 3 of 4 mandatory collection photos -> confirmCollection MUST fail
    for (const angle of REQUIRED_PHOTO_ANGLES.slice(0, 3)) {
      await uploadCollectionPhoto(
        users.stu1Cmp1,
        req.id,
        {
          requestItemId: reqItemId,
          angle,
          storageKey: `col/${angle}.jpg`,
          url: `/uploads/col/${angle}.jpg`,
        },
        db
      );
    }

    await expect(
      confirmCollection(users.inst1Cmp1, req.id, {}, db)
    ).rejects.toThrow(BadRequestError);

    // Upload 4th mandatory angle -> confirmCollection succeeds!
    await uploadCollectionPhoto(
      users.stu1Cmp1,
      req.id,
      {
        requestItemId: reqItemId,
        angle: "RIGHT_SIDE",
        storageKey: "col/RIGHT_SIDE.jpg",
        url: "/uploads/col/RIGHT_SIDE.jpg",
      },
      db
    );

    const issued = await confirmCollection(users.inst1Cmp1, req.id, {}, db);
    expect(issued.status).toBe("ISSUED");
    expect(issued.borrowingRecords?.length).toBe(1);

    // Collection photos are now IMMUTABLE! Attempting to overwrite MUST fail
    await expect(
      uploadCollectionPhoto(
        users.stu1Cmp1,
        req.id,
        {
          requestItemId: reqItemId,
          angle: "FRONT_TOP",
          storageKey: "col/tampered.jpg",
          url: "/uploads/col/tampered.jpg",
        },
        db
      )
    ).rejects.toThrow(ConflictError);

    // Verify stock transitioned reserved (3 -> 0) to borrowed (0 -> 3)
    inv = (await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db)).data[0];
    expect(inv.availableQuantity).toBe(7);
    expect(inv.reservedQuantity).toBe(0);
    expect(inv.borrowedQuantity).toBe(3);

    // Stage 5: Student tries submitting return with only 2 return photos -> MUST fail
    for (const angle of REQUIRED_PHOTO_ANGLES.slice(0, 2)) {
      await uploadReturnPhoto(
        users.stu1Cmp1,
        req.id,
        {
          requestItemId: reqItemId,
          angle,
          storageKey: `ret/${angle}.jpg`,
          url: `/uploads/ret/${angle}.jpg`,
        },
        db
      );
    }
    await expect(
      submitReturn(
        users.stu1Cmp1,
        req.id,
        { items: [{ requestItemId: reqItemId, returnedQuantity: 3 }] },
        db
      )
    ).rejects.toThrow(BadRequestError);

    // Upload remaining 2 return photos -> submitReturn succeeds and NEVER auto-closes!
    for (const angle of REQUIRED_PHOTO_ANGLES.slice(2)) {
      await uploadReturnPhoto(
        users.stu1Cmp1,
        req.id,
        {
          requestItemId: reqItemId,
          angle,
          storageKey: `ret/${angle}.jpg`,
          url: `/uploads/ret/${angle}.jpg`,
        },
        db
      );
    }
    const returnSubmitted = await submitReturn(
      users.stu1Cmp1,
      req.id,
      {
        items: [
          {
            requestItemId: reqItemId,
            returnedQuantity: 3,
            studentComments: "All 3 boards cleaned and packed",
          },
        ],
      },
      db
    );
    expect(returnSubmitted.status).toBe("RETURN_VERIFICATION_PENDING");

    // Stage 6: Instructor verifies GOOD condition -> restores available stock and closes request!
    const closed = await verifyReturn(
      users.inst1Cmp1,
      req.id,
      {
        items: [
          {
            requestItemId: reqItemId,
            condition: "GOOD",
            returnedQuantity: 3,
            instructorRemarks: "Compared with collection photos — intact",
          },
        ],
      },
      db
    );
    expect(closed.status).toBe("CLOSED");

    inv = (await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db)).data[0];
    expect(inv.availableQuantity).toBe(10);
    expect(inv.borrowedQuantity).toBe(0);
    expect(inv.damagedQuantity).toBe(0);
    expect(inv.missingQuantity).toBe(0);
  });

  it("prevents concurrent double-booking when two requests race for limited stock", async () => {
    const { db, users } = await provisionVerifiedStock(10);

    // Both students request 6 units (total 12 > 10 available)
    const req1 = await createLabRequest(
      users.stu1Cmp1,
      {
        instructorId: users.inst1Cmp1.id,
        purpose: "Project Alpha",
        items: [{ itemId: "item-arduino", requestedQuantity: 6 }],
      },
      db
    );
    const req2 = await createLabRequest(
      users.stu2Cmp1,
      {
        instructorId: users.inst1Cmp1.id,
        purpose: "Project Beta",
        items: [{ itemId: "item-arduino", requestedQuantity: 6 }],
      },
      db
    );

    // Fire BOTH Instructor approvals concurrently!
    const results = await Promise.allSettled([
      processInstructorApproval(users.inst1Cmp1, req1.id, { decision: "APPROVED" }, db),
      processInstructorApproval(users.inst1Cmp1, req2.id, { decision: "APPROVED" }, db),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Strictly ONE succeeds and ONE fails with ConflictError — zero double booking!
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictError
    );

    const inv = (await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db)).data[0];
    expect(inv.availableQuantity).toBe(4);
    expect(inv.reservedQuantity).toBe(6);
  });

  it("keeps request in RETURN_DISPUTED (never closes) when items are returned DAMAGED or MISSING", async () => {
    const { db, users } = await provisionVerifiedStock(10);

    const req = await createLabRequest(
      users.stu1Cmp1,
      {
        instructorId: users.inst1Cmp1.id,
        purpose: "High voltage circuit test",
        items: [{ itemId: "item-arduino", requestedQuantity: 4 }],
      },
      db
    );
    const reqItemId = req.items[0].id;

    await processInstructorApproval(users.inst1Cmp1, req.id, { decision: "APPROVED" }, db);

    for (const angle of REQUIRED_PHOTO_ANGLES) {
      await uploadCollectionPhoto(
        users.stu1Cmp1,
        req.id,
        { requestItemId: reqItemId, angle, storageKey: `c/${angle}`, url: `/u/c/${angle}` },
        db
      );
    }
    await confirmCollection(users.inst1Cmp1, req.id, {}, db);

    for (const angle of REQUIRED_PHOTO_ANGLES) {
      await uploadReturnPhoto(
        users.stu1Cmp1,
        req.id,
        { requestItemId: reqItemId, angle, storageKey: `r/${angle}`, url: `/u/r/${angle}` },
        db
      );
    }
    await submitReturn(
      users.stu1Cmp1,
      req.id,
      { items: [{ requestItemId: reqItemId, returnedQuantity: 4 }] },
      db
    );

    // Instructor inspects: 2 GOOD, 1 DAMAGED, 1 MISSING
    const disputed = await verifyReturn(
      users.inst1Cmp1,
      req.id,
      {
        items: [
          {
            requestItemId: reqItemId,
            condition: "PARTIAL",
            returnedQuantity: 2,
            damagedQuantity: 1,
            missingQuantity: 1,
            instructorRemarks: "1 board burnt USB port, 1 board missing from box",
          },
        ],
      },
      db
    );

    expect(disputed.status).toBe("RETURN_DISPUTED");

    const inv = (await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db)).data[0];
    expect(inv.borrowedQuantity).toBe(0);
    expect(inv.availableQuantity).toBe(8); // 6 remaining + 2 returned good
    expect(inv.damagedQuantity).toBe(1);
    expect(inv.missingQuantity).toBe(1);
  });
});
