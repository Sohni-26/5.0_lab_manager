import { describe, expect, it } from "vitest";
import { seedTestFixture } from "./helpers/mock-prisma";
import { ForbiddenError } from "@/lib/errors";
import { createCampus, getCampusById } from "@/services/campus.service";
import { createMasterItem } from "@/services/item.service";
import {
  createAllocation,
  verifyAllocation,
} from "@/services/allocation.service";
import {
  adjustCampusInventory,
  listCampusInventory,
  toggleInventoryVisibility,
} from "@/services/inventory.service";
import {
  createLabRequest,
  listLabRequests,
  processInstructorApproval,
  processLabManagerApproval,
} from "@/services/request.service";
import {
  createIssueTicket,
  listIssueTickets,
  updateIssueTicket,
} from "@/services/ticket.service";
import { listAuditLogs } from "@/services/audit.service";
import { realtimeEventBus } from "@/lib/realtime/event-bus";
import type { RealtimeEventPayload } from "@/types/contracts";

const DEFAULT_PAGE = {
  page: 1,
  pageSize: 20,
  skip: 0,
  take: 20,
  sortOrder: "desc" as const,
};

describe("RBAC & Multi-Campus Isolation", () => {
  it("prevents Lab Manager, Instructor, and Student from creating campuses or master items", async () => {
    const { db, users } = await seedTestFixture();

    await expect(
      createCampus(users.lm1Cmp1, { code: "CMP-99", name: "Rogue Campus" }, db)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      createMasterItem(
        users.inst1Cmp1,
        { code: "ROGUE-1", name: "Rogue Item", categoryId: "cat-mcu" },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    await expect(
      createAllocation(
        users.lm1Cmp1,
        {
          destinationCampusId: "cmp-1",
          items: [{ itemId: "item-arduino", allocatedQuantity: 5 }],
        },
        db
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("blocks cross-campus data access for Lab Manager, Instructor, and Student", async () => {
    const { db, users } = await seedTestFixture();

    // Campus 2 Lab Manager cannot view Campus 1 campus details
    await expect(getCampusById(users.lm1Cmp2, "cmp-1", db)).rejects.toThrow(
      ForbiddenError
    );

    // Campus 2 Lab Manager cannot list Campus 1 inventory by passing campusId=cmp-1
    await expect(
      listCampusInventory(
        users.lm1Cmp2,
        DEFAULT_PAGE,
        { campusId: "cmp-1" },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    // Campus 1 allocation verified by Campus 2 Lab Manager MUST fail
    const alloc = await createAllocation(
      users.centralUser,
      {
        destinationCampusId: "cmp-1",
        dispatchImmediately: true,
        items: [{ itemId: "item-arduino", allocatedQuantity: 10 }],
      },
      db
    );

    await expect(
      verifyAllocation(
        users.lm1Cmp2,
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
      )
    ).rejects.toThrow(ForbiddenError);

    // Verify by Campus 1 LM succeeds, then Campus 2 LM cannot toggle visibility or adjust Campus 1 inventory
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

    const cmp1Inv = await listCampusInventory(users.lm1Cmp1, DEFAULT_PAGE, {}, db);
    const invId = cmp1Inv.data[0].id;

    await expect(
      toggleInventoryVisibility(users.lm1Cmp2, invId, false, db)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      adjustCampusInventory(
        users.lm1Cmp2,
        invId,
        { field: "availableQuantity", delta: -1, remarks: "Cross campus hack" },
        db
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("prevents Student from selecting cross-campus Instructor or bypassing roles", async () => {
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

    // Student from Campus 1 tries to select Instructor from Campus 2
    await expect(
      createLabRequest(
        users.stu1Cmp1,
        {
          instructorId: users.inst1Cmp2.id,
          purpose: "Cross-campus instructor attempt",
          items: [{ itemId: "item-arduino", requestedQuantity: 2 }],
        },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    // Valid request to same-campus Instructor 1
    const req = await createLabRequest(
      users.stu1Cmp1,
      {
        instructorId: users.inst1Cmp1.id,
        purpose: "Robotics experiment",
        items: [{ itemId: "item-arduino", requestedQuantity: 2 }],
      },
      db
    );

    // Non-assigned Instructor 2 cannot approve Instructor 1's request
    await expect(
      processInstructorApproval(
        users.inst2Cmp1,
        req.id,
        { decision: "APPROVED" },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    // Instructor 1 approves, then Student / Instructor / Campus 2 LM cannot perform Lab Manager approval
    await processInstructorApproval(
      users.inst1Cmp1,
      req.id,
      { decision: "APPROVED" },
      db
    );

    await expect(
      processLabManagerApproval(
        users.stu1Cmp1,
        req.id,
        { decision: "APPROVED" },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    await expect(
      processLabManagerApproval(
        users.lm1Cmp2,
        req.id,
        { decision: "APPROVED" },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    // Student 2 cannot see Student 1's request in their request list
    const stu2List = await listLabRequests(users.stu2Cmp1, DEFAULT_PAGE, {}, db);
    expect(stu2List.data.length).toBe(0);
  });

  it("enforces ticket and audit log RBAC strictly", async () => {
    const { db, users } = await seedTestFixture();

    // Student cannot create or view issue tickets
    await expect(
      createIssueTicket(
        users.stu1Cmp1,
        {
          category: "DAMAGED_EQUIPMENT",
          title: "Broken board",
          description: "Student should be denied",
        },
        db
      )
    ).rejects.toThrow(ForbiddenError);

    await expect(
      listIssueTickets(users.stu1Cmp1, DEFAULT_PAGE, {}, db)
    ).rejects.toThrow(ForbiddenError);

    // Instructor creates ticket on Campus 1
    const ticket = await createIssueTicket(
      users.inst1Cmp1,
      {
        category: "MALFUNCTIONING_EQUIPMENT",
        priority: "HIGH",
        title: "Oscilloscope channel drift",
        description: "Channel 2 drifts 15%",
      },
      db
    );

    // Campus 2 Lab Manager cannot update Campus 1 ticket
    await expect(
      updateIssueTicket(users.lm1Cmp2, ticket.id, { status: "IN_PROGRESS" }, db)
    ).rejects.toThrow(ForbiddenError);

    // Campus 1 Lab Manager CAN update Campus 1 ticket
    const updated = await updateIssueTicket(
      users.lm1Cmp1,
      ticket.id,
      { status: "IN_PROGRESS", assignedToId: users.lm1Cmp1.id },
      db
    );
    expect(updated.status).toBe("IN_PROGRESS");

    // Audit logs: Student and Instructor denied; Lab Manager scoped to own campus; Central global
    await expect(
      listAuditLogs(users.stu1Cmp1, DEFAULT_PAGE, {}, db)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      listAuditLogs(users.inst1Cmp1, DEFAULT_PAGE, {}, db)
    ).rejects.toThrow(ForbiddenError);

    await expect(
      listAuditLogs(users.lm1Cmp2, DEFAULT_PAGE, { campusId: "cmp-1" }, db)
    ).rejects.toThrow(ForbiddenError);

    const centralLogs = await listAuditLogs(
      users.centralUser,
      DEFAULT_PAGE,
      {},
      db
    );
    expect(centralLogs.data.length).toBeGreaterThan(0);
  });

  it("enforces strict campus isolation on the Realtime Event Bus", async () => {
    const { users } = await seedTestFixture();
    const centralEvents: RealtimeEventPayload[] = [];
    const cmp1Events: RealtimeEventPayload[] = [];
    const cmp2Events: RealtimeEventPayload[] = [];

    const unsubCentral = realtimeEventBus.subscribeForUser(
      users.centralUser,
      (e) => centralEvents.push(e)
    );
    const unsubCmp1 = realtimeEventBus.subscribeForUser(users.lm1Cmp1, (e) =>
      cmp1Events.push(e)
    );
    const unsubCmp2 = realtimeEventBus.subscribeForUser(users.lm1Cmp2, (e) =>
      cmp2Events.push(e)
    );

    realtimeEventBus.publish({
      type: "inventory.updated",
      campusId: "cmp-1",
      entityType: "CampusInventory",
      entityId: "inv-1",
      actorId: users.lm1Cmp1.id,
      summary: "Campus 1 stock updated",
    });

    unsubCentral();
    unsubCmp1();
    unsubCmp2();

    expect(centralEvents.length).toBe(1);
    expect(cmp1Events.length).toBe(1);
    expect(cmp2Events.length).toBe(0); // NEVER leaked to Campus 2!
  });
});
