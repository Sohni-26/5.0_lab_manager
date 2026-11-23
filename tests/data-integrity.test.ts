import { describe, expect, it } from "vitest";
import { seedTestFixture } from "./helpers/mock-prisma";
import { BadRequestError, ConflictError } from "@/lib/errors";
import { createUser, deactivateUser, updateUser } from "@/services/user.service";
import { deactivateMasterItem } from "@/services/item.service";
import {
  createAllocation,
  verifyAllocation,
} from "@/services/allocation.service";
import { listInventoryTransactions } from "@/services/inventory.service";
import { listAuditLogs } from "@/services/audit.service";

const DEFAULT_PAGE = {
  page: 1,
  pageSize: 20,
  skip: 0,
  take: 20,
  sortOrder: "desc" as const,
};

describe("Data Integrity & Global Constraints", () => {
  it("enforces strictly ONE Central Lab Manager globally", async () => {
    const { db, users } = await seedTestFixture();

    // Cannot create a second CENTRAL_LAB_MANAGER
    await expect(
      createUser(
        users.centralUser,
        {
          fullName: "Second Central Manager",
          email: "central2@campuslab.edu",
          institutionalId: "CLM-0002",
          role: "CENTRAL_LAB_MANAGER",
          campusId: null,
        },
        db
      )
    ).rejects.toThrow(ConflictError);

    // Cannot promote an existing Lab Manager to CENTRAL_LAB_MANAGER
    await expect(
      updateUser(
        users.centralUser,
        users.lm1Cmp1.id,
        { role: "CENTRAL_LAB_MANAGER", campusId: null },
        db
      )
    ).rejects.toThrow(ConflictError);
  });

  it("enforces role-campus assignment integrity and supports multiple Lab Managers per campus", async () => {
    const { db, users } = await seedTestFixture();

    // Campus role without campusId MUST fail
    await expect(
      createUser(
        users.centralUser,
        {
          fullName: "Orphan Manager",
          email: "orphan@campuslab.edu",
          institutionalId: "LM-ORPHAN",
          role: "LAB_MANAGER",
          campusId: null,
        },
        db
      )
    ).rejects.toThrow(BadRequestError);

    // Central Lab Manager with non-null campusId MUST fail
    await expect(
      updateUser(
        users.centralUser,
        users.centralUser.id,
        { campusId: "cmp-1" },
        db
      )
    ).rejects.toThrow(BadRequestError);

    // Adding a 3rd Lab Manager on Campus 1 succeeds cleanly!
    const lm3 = await createUser(
      users.centralUser,
      {
        fullName: "Kiran LM3",
        email: "lm3.c1@campuslab.edu",
        institutionalId: "LM-01-03",
        role: "LAB_MANAGER",
        campusId: "cmp-1",
      },
      db
    );
    expect(lm3.role).toBe("LAB_MANAGER");
    expect(lm3.campusId).toBe("cmp-1");
  });

  it("rejects duplicate email and duplicate institutionalId", async () => {
    const { db, users } = await seedTestFixture();

    await expect(
      createUser(
        users.centralUser,
        {
          fullName: "Dup Email",
          email: users.stu1Cmp1.email,
          institutionalId: "STU-NEW-999",
          role: "STUDENT",
          campusId: "cmp-1",
        },
        db
      )
    ).rejects.toThrow(ConflictError);

    await expect(
      createUser(
        users.centralUser,
        {
          fullName: "Dup Inst ID",
          email: "unique.new@campuslab.edu",
          institutionalId: users.stu1Cmp1.institutionalId,
          role: "STUDENT",
          campusId: "cmp-1",
        },
        db
      )
    ).rejects.toThrow(ConflictError);
  });

  it("preserves historical transactions and audit logs when soft-deactivating users or items", async () => {
    const { db, users } = await seedTestFixture();

    const alloc = await createAllocation(
      users.centralUser,
      {
        destinationCampusId: "cmp-1",
        dispatchImmediately: true,
        items: [{ itemId: "item-arduino", allocatedQuantity: 10 }],
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
            receivedQuantity: 10,
            missingQuantity: 0,
            damagedQuantity: 0,
          },
        ],
      },
      db
    );

    // Soft-deactivate Lab Manager and Master Item
    const deactivatedUser = await deactivateUser(
      users.centralUser,
      users.lm1Cmp1.id,
      db
    );
    expect(deactivatedUser.status).toBe("INACTIVE");

    const deactivatedItem = await deactivateMasterItem(
      users.centralUser,
      "item-arduino",
      db
    );
    expect(deactivatedItem.isActive).toBe(false);

    // Historical transactions & audit logs remain completely intact!
    const txs = await listInventoryTransactions(
      users.centralUser,
      DEFAULT_PAGE,
      {},
      db
    );
    expect(txs.data.length).toBeGreaterThanOrEqual(2);

    const logs = await listAuditLogs(users.centralUser, DEFAULT_PAGE, {}, db);
    expect(logs.data.some((l) => l.action === "USER_DEACTIVATED")).toBe(true);
    expect(logs.data.some((l) => l.action === "MASTER_ITEM_DEACTIVATED")).toBe(
      true
    );
  });
});
