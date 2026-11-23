import { describe, expect, it } from "vitest";
import { seedTestFixture } from "./helpers/mock-prisma";
import { BadRequestError, ConflictError } from "@/lib/errors";
import {
  createAllocation,
  updateAllocationStatus,
  verifyAllocation,
} from "@/services/allocation.service";
import {
  adjustCampusInventory,
  bulkToggleInventoryVisibility,
  listCampusInventory,
  listInventoryTransactions,
  toggleInventoryVisibility,
} from "@/services/inventory.service";

const DEFAULT_PAGE = {
  page: 1,
  pageSize: 20,
  skip: 0,
  take: 20,
  sortOrder: "desc" as const,
};

describe("Inventory, Stock Allocations & Verification Workflows", () => {
  it("never auto-verifies allocated stock; Lab Manager verification records discrepancies & transactions atomically", async () => {
    const { db, users } = await seedTestFixture();

    // Central creates DRAFT allocation for 50 Arduino boards
    const alloc = await createAllocation(
      users.centralUser,
      {
        destinationCampusId: "cmp-1",
        dispatchImmediately: false,
        items: [{ itemId: "item-arduino", allocatedQuantity: 50 }],
      },
      db
    );
    expect(alloc.status).toBe("DRAFT");

    // Before verification, CampusInventory has allocated=50, received=0, available=0, isVerified=false
    const lmBefore = await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db);
    expect(lmBefore.data.length).toBe(1);
    expect(lmBefore.data[0].allocatedQuantity).toBe(50);
    expect(lmBefore.data[0].receivedQuantity).toBe(0);
    expect(lmBefore.data[0].availableQuantity).toBe(0);
    expect(lmBefore.data[0].isVerified).toBe(false);

    // Unverified stock MUST NOT be visible to Students or Instructors
    const stuBefore = await listCampusInventory(users.stu1Cmp1, DEFAULT_PAGE, {}, db);
    const instBefore = await listCampusInventory(users.inst1Cmp1, DEFAULT_PAGE, {}, db);
    expect(stuBefore.data.length).toBe(0);
    expect(instBefore.data.length).toBe(0);

    // Lab Manager cannot verify a DRAFT allocation before it is DISPATCHED
    await expect(
      verifyAllocation(
        users.lm1Cmp1,
        alloc.id,
        {
          items: [
            {
              itemId: "item-arduino",
              receivedQuantity: 50,
              missingQuantity: 0,
              damagedQuantity: 0,
            },
          ],
        },
        db
      )
    ).rejects.toThrow(ConflictError);

    // Central dispatches the allocation
    const dispatched = await updateAllocationStatus(
      users.centralUser,
      alloc.id,
      { status: "DISPATCHED" },
      db
    );
    expect(dispatched.status).toBe("DISPATCHED");

    // Verification sum mismatch (48 + 1 + 0 != 50) must be rejected
    await expect(
      verifyAllocation(
        users.lm1Cmp1,
        alloc.id,
        {
          items: [
            {
              itemId: "item-arduino",
              receivedQuantity: 48,
              missingQuantity: 1,
              damagedQuantity: 0,
            },
          ],
        },
        db
      )
    ).rejects.toThrow(BadRequestError);

    // Lab Manager verifies: 47 received, 2 missing, 1 damaged (sum = 50)
    const verified = await verifyAllocation(
      users.lm1Cmp1,
      alloc.id,
      {
        items: [
          {
            itemId: "item-arduino",
            receivedQuantity: 47,
            missingQuantity: 2,
            damagedQuantity: 1,
            verificationNotes: "Box corner crushed during shipping",
          },
        ],
      },
      db
    );
    expect(verified.status).toBe("DISCREPANCY_REPORTED");
    expect(verified.items[0].receivedQuantity).toBe(47);
    expect(verified.items[0].missingQuantity).toBe(2);
    expect(verified.items[0].damagedQuantity).toBe(1);

    // Verify CampusInventory quantities updated atomically
    const lmAfter = await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db);
    expect(lmAfter.data[0].isVerified).toBe(true);
    expect(lmAfter.data[0].receivedQuantity).toBe(47);
    expect(lmAfter.data[0].availableQuantity).toBe(47);
    expect(lmAfter.data[0].missingQuantity).toBe(2);
    expect(lmAfter.data[0].damagedQuantity).toBe(1);

    // Verify Student and Instructor can now see verified & visible stock
    const stuAfter = await listCampusInventory(users.stu1Cmp1, DEFAULT_PAGE, {}, db);
    expect(stuAfter.data.length).toBe(1);
    expect(stuAfter.data[0].availableQuantity).toBe(47);

    // Verify all inventory transaction types logged cleanly
    const txs = await listInventoryTransactions(
      users.lm1Cmp1,
      DEFAULT_PAGE,
      {},
      db
    );
    const types = txs.data.map((t) => t.type);
    expect(types).toContain("STOCK_ALLOCATED");
    expect(types).toContain("STOCK_DISPATCHED");
    expect(types).toContain("STOCK_RECEIVED");
    expect(types).toContain("MISSING_REPORTED");
    expect(types).toContain("DAMAGED_REPORTED");
  });

  it("hides inventory items from Students and Instructors when Lab Manager sets isVisible=false", async () => {
    const { db, users } = await seedTestFixture();

    const alloc = await createAllocation(
      users.centralUser,
      {
        destinationCampusId: "cmp-1",
        dispatchImmediately: true,
        items: [
          { itemId: "item-arduino", allocatedQuantity: 20 },
          { itemId: "item-osc", allocatedQuantity: 5 },
        ],
      },
      db
    );
    await verifyAllocation(
      users.lm1Cmp1,
      alloc.id,
      {
        items: [
          { itemId: "item-arduino", receivedQuantity: 20, missingQuantity: 0, damagedQuantity: 0 },
          { itemId: "item-osc", receivedQuantity: 5, missingQuantity: 0, damagedQuantity: 0 },
        ],
      },
      db
    );

    const invList = await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db);
    const oscInv = invList.data.find((i) => i.itemId === "item-osc")!;

    // Hide oscilloscope
    await toggleInventoryVisibility(users.lm1Cmp1, oscInv.id, false, db);

    const stuList = await listCampusInventory(users.stu1Cmp1, DEFAULT_PAGE, {}, db);
    const instList = await listCampusInventory(users.inst1Cmp1, DEFAULT_PAGE, {}, db);
    expect(stuList.data.map((i) => i.itemId)).toEqual(["item-arduino"]);
    expect(instList.data.map((i) => i.itemId)).toEqual(["item-arduino"]);

    // Lab Manager & Central still see hidden items
    const lmList = await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db);
    expect(lmList.data.length).toBe(2);

    // Bulk hide all items
    await bulkToggleInventoryVisibility(
      users.lm1Cmp1,
      invList.data.map((i) => i.id),
      false,
      db
    );
    const stuAfterBulk = await listCampusInventory(users.stu1Cmp1, DEFAULT_PAGE, {}, db);
    expect(stuAfterBulk.data.length).toBe(0);
  });

  it("prevents negative stock quantities on manual inventory adjustments", async () => {
    const { db, users } = await seedTestFixture();

    const alloc = await createAllocation(
      users.centralUser,
      {
        destinationCampusId: "cmp-1",
        dispatchImmediately: true,
        items: [{ itemId: "item-arduino", allocatedQuantity: 5 }],
      },
      db
    );
    await verifyAllocation(
      users.lm1Cmp1,
      alloc.id,
      {
        items: [
          { itemId: "item-arduino", receivedQuantity: 5, missingQuantity: 0, damagedQuantity: 0 },
        ],
      },
      db
    );

    const inv = (await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db)).data[0];

    // Subtracting 6 from 5 available MUST fail
    await expect(
      adjustCampusInventory(
        users.lm1Cmp1,
        inv.id,
        {
          field: "availableQuantity",
          delta: -6,
          remarks: "Audit recount adjustment",
        },
        db
      )
    ).rejects.toThrow(BadRequestError);

    // Valid subtraction of 2 succeeds and logs INVENTORY_ADJUSTMENT
    const adjusted = await adjustCampusInventory(
      users.lm1Cmp1,
      inv.id,
      {
        field: "availableQuantity",
        delta: -2,
        remarks: "Quarantined 2 units for firmware update",
      },
      db
    );
    expect(adjusted.availableQuantity).toBe(3);
  });
});
