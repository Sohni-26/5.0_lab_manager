"use client";

import {
  DEMO_ALLOCATIONS,
  DEMO_CAMPUS_INVENTORY,
  DEMO_CATEGORIES,
  DEMO_TICKETS,
  DEMO_TRANSACTIONS,
} from "@/lib/demo-data";
import { broadcastLocalRealtimeEvent } from "@/lib/realtime/client-sync";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  InventoryTransactionDTO,
  InventoryTransactionType,
  IssueTicketDTO,
  StockAllocationDTO,
  TicketPriority,
  TicketStatus,
} from "@/types/contracts";

const INV_OVERLAY_KEY = "campuslab_demo_inventory_overlay_v1";
const INV_CUSTOM_KEY = "campuslab_demo_inventory_custom_v1";
const ALLOC_KEY = "campuslab_demo_allocations_v1";
const TICKET_KEY = "campuslab_demo_tickets_v1";
const TXN_KEY = "campuslab_demo_transactions_v1";

type InventoryPatch = Partial<
  Pick<
    CampusInventoryDTO,
    | "allocatedQuantity"
    | "receivedQuantity"
    | "availableQuantity"
    | "reservedQuantity"
    | "borrowedQuantity"
    | "damagedQuantity"
    | "missingQuantity"
    | "isVisible"
    | "isVerified"
    | "lastVerifiedAt"
    | "updatedAt"
  >
> & {
  labBlock?: string;
};

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ============================================================================
// Transaction Ledger Store
// ============================================================================

export function loadDemoTransactions(): InventoryTransactionDTO[] {
  const custom = safeReadJson<InventoryTransactionDTO[]>(TXN_KEY, []);
  return [...custom, ...DEMO_TRANSACTIONS].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function appendDemoTransaction(entry: {
  campusId?: string;
  item: { id: string; code: string; name: string };
  type: InventoryTransactionType;
  quantity: number;
  previousQuantity: number;
  updatedQuantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  remarks?: string | null;
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null;
}): InventoryTransactionDTO {
  const txn: InventoryTransactionDTO = {
    id: makeId("txn-demo"),
    campusId: entry.campusId ?? "demo-campus-01",
    itemId: entry.item.id,
    type: entry.type,
    quantity: entry.quantity,
    previousQuantity: entry.previousQuantity,
    updatedQuantity: entry.updatedQuantity,
    referenceType: entry.referenceType ?? "MANUAL_ADJUSTMENT",
    referenceId: entry.referenceId ?? null,
    remarks: entry.remarks ?? null,
    createdAt: new Date().toISOString(),
    campus: {
      id: entry.campusId ?? "demo-campus-01",
      code: "CMP-01",
      name: "Bengaluru North Campus",
    },
    item: entry.item,
    performedBy: entry.actor
      ? { id: entry.actor.id, fullName: entry.actor.fullName, role: entry.actor.role }
      : { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", role: "LAB_MANAGER" },
  };
  const existing = safeReadJson<InventoryTransactionDTO[]>(TXN_KEY, []);
  safeWriteJson(TXN_KEY, [txn, ...existing].slice(0, 200));
  return txn;
}

// ============================================================================
// Campus Inventory Store
// ============================================================================

export function loadDemoCampusInventory(): CampusInventoryDTO[] {
  const overlay = safeReadJson<Record<string, InventoryPatch>>(INV_OVERLAY_KEY, {});
  const customItems = safeReadJson<CampusInventoryDTO[]>(INV_CUSTOM_KEY, []);

  const mergedBase = DEMO_CAMPUS_INVENTORY.map((row) => {
    const patch = overlay[row.id];
    if (!patch) return row;
    const { labBlock, ...rest } = patch;
    return {
      ...row,
      ...rest,
      item: labBlock
        ? {
            ...row.item,
            specifications: {
              ...(row.item.specifications ?? {}),
              lab: labBlock,
            },
          }
        : row.item,
    };
  });

  const mergedCustom = customItems.map((row) => {
    const patch = overlay[row.id];
    if (!patch) return row;
    const { labBlock, ...rest } = patch;
    return {
      ...row,
      ...rest,
      item: labBlock
        ? {
            ...row.item,
            specifications: {
              ...(row.item.specifications ?? {}),
              lab: labBlock,
            },
          }
        : row.item,
    };
  });

  return [...mergedCustom, ...mergedBase];
}

export function toggleDemoInventoryVisibility(
  inventoryId: string,
  isVisible: boolean,
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): CampusInventoryDTO[] {
  const overlay = safeReadJson<Record<string, InventoryPatch>>(INV_OVERLAY_KEY, {});
  const now = new Date().toISOString();
  overlay[inventoryId] = {
    ...(overlay[inventoryId] ?? {}),
    isVisible,
    updatedAt: now,
  };
  safeWriteJson(INV_OVERLAY_KEY, overlay);

  const list = loadDemoCampusInventory();
  const updated = list.find((r) => r.id === inventoryId);

  broadcastLocalRealtimeEvent({
    type: "inventory.visibility_changed",
    campusId: updated?.campusId ?? "demo-campus-01",
    entityType: "CampusInventory",
    entityId: inventoryId,
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: updated
      ? `${updated.item.name} ${isVisible ? "published to campus" : "hidden from students"}`
      : "Inventory visibility updated",
  });

  return list;
}

export function bulkDemoInventoryVisibility(
  ids: string[],
  isVisible: boolean,
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): CampusInventoryDTO[] {
  const overlay = safeReadJson<Record<string, InventoryPatch>>(INV_OVERLAY_KEY, {});
  const now = new Date().toISOString();
  for (const id of ids) {
    overlay[id] = {
      ...(overlay[id] ?? {}),
      isVisible,
      updatedAt: now,
    };
  }
  safeWriteJson(INV_OVERLAY_KEY, overlay);

  broadcastLocalRealtimeEvent({
    type: "inventory.visibility_changed",
    campusId: "demo-campus-01",
    entityType: "CampusInventory",
    entityId: ids[0] ?? "bulk",
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: `${ids.length} part${ids.length === 1 ? "" : "s"} ${isVisible ? "made visible" : "hidden"} on campus`,
  });

  return loadDemoCampusInventory();
}

export function adjustDemoInventoryStock(
  inventoryId: string,
  payload: {
    field: "availableQuantity" | "damagedQuantity" | "missingQuantity";
    delta: number;
    remarks: string;
  },
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): CampusInventoryDTO[] {
  const currentList = loadDemoCampusInventory();
  const target = currentList.find((r) => r.id === inventoryId);
  if (!target) return currentList;

  const prevVal = target[payload.field];
  const nextVal = Math.max(0, prevVal + payload.delta);
  const actualDelta = nextVal - prevVal;

  const overlay = safeReadJson<Record<string, InventoryPatch>>(INV_OVERLAY_KEY, {});
  const now = new Date().toISOString();

  // Keep receivedQuantity aligned when available stock increases
  const nextReceived =
    payload.field === "availableQuantity" && actualDelta > 0
      ? target.receivedQuantity + actualDelta
      : target.receivedQuantity;

  overlay[inventoryId] = {
    ...(overlay[inventoryId] ?? {}),
    [payload.field]: nextVal,
    receivedQuantity: nextReceived,
    updatedAt: now,
  };
  safeWriteJson(INV_OVERLAY_KEY, overlay);

  const txnType: InventoryTransactionType =
    payload.field === "damagedQuantity"
      ? "ITEM_MARKED_DAMAGED"
      : payload.field === "missingQuantity"
        ? "ITEM_MARKED_MISSING"
        : "INVENTORY_ADJUSTMENT";

  appendDemoTransaction({
    campusId: target.campusId,
    item: { id: target.item.id, code: target.item.code, name: target.item.name },
    type: txnType,
    quantity: actualDelta,
    previousQuantity: prevVal,
    updatedQuantity: nextVal,
    referenceType: "LAB_MANAGER_ADJUSTMENT",
    referenceId: target.id,
    remarks: payload.remarks,
    actor,
  });

  broadcastLocalRealtimeEvent({
    type: "inventory.updated",
    campusId: target.campusId,
    entityType: "CampusInventory",
    entityId: inventoryId,
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: `Adjusted ${target.item.name} (${payload.field.replace("Quantity", "")}: ${actualDelta >= 0 ? "+" : ""}${actualDelta})`,
  });

  return loadDemoCampusInventory();
}

export function addDemoCampusStockItem(
  input: {
    name: string;
    code: string;
    categoryId: string;
    labBlock: string;
    brand?: string;
    unit?: string;
    quantity: number;
    isVisible: boolean;
    notes?: string;
  },
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): CampusInventoryDTO[] {
  const cat =
    DEMO_CATEGORIES.find((c) => c.id === input.categoryId) ?? DEMO_CATEGORIES[0];
  const now = new Date().toISOString();
  const itemId = makeId("demo-custom-item");
  const invId = makeId("demo-custom-inv");
  const code = input.code.trim().toUpperCase() || `CMP-${Date.now().toString().slice(-4)}`;
  const qty = Math.max(0, Math.round(input.quantity));

  const newRow: CampusInventoryDTO = {
    id: invId,
    campusId: "demo-campus-01",
    itemId,
    allocatedQuantity: qty,
    receivedQuantity: qty,
    availableQuantity: qty,
    reservedQuantity: 0,
    borrowedQuantity: 0,
    damagedQuantity: 0,
    missingQuantity: 0,
    isVisible: input.isVisible,
    isVerified: true,
    lastVerifiedAt: now,
    updatedAt: now,
    campus: {
      id: "demo-campus-01",
      code: "CMP-01",
      name: "Bengaluru North Campus",
    },
    item: {
      id: itemId,
      code,
      name: input.name.trim(),
      description: input.notes?.trim() || "Registered directly by Campus Lab Manager",
      brand: input.brand?.trim() || "Campus Stock",
      unit: input.unit?.trim() || "pcs",
      imageUrl: null,
      specifications: { lab: input.labBlock.trim() || "General Lab" },
      isActive: true,
      category: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      },
    },
  };

  const existingCustom = safeReadJson<CampusInventoryDTO[]>(INV_CUSTOM_KEY, []);
  safeWriteJson(INV_CUSTOM_KEY, [newRow, ...existingCustom]);

  appendDemoTransaction({
    campusId: newRow.campusId,
    item: { id: newRow.item.id, code: newRow.item.code, name: newRow.item.name },
    type: "STOCK_RECEIVED",
    quantity: qty,
    previousQuantity: 0,
    updatedQuantity: qty,
    referenceType: "CAMPUS_STOCK_REGISTER",
    referenceId: invId,
    remarks: input.notes?.trim() || `Added ${qty} ${newRow.item.unit} to ${input.labBlock}`,
    actor,
  });

  broadcastLocalRealtimeEvent({
    type: "inventory.updated",
    campusId: newRow.campusId,
    entityType: "CampusInventory",
    entityId: invId,
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: `Added ${newRow.item.name} (${qty} ${newRow.item.unit}) to campus inventory`,
  });

  return loadDemoCampusInventory();
}

// ============================================================================
// Incoming Allocations Store
// ============================================================================

export function loadDemoAllocations(): StockAllocationDTO[] {
  const stored = safeReadJson<StockAllocationDTO[] | null>(ALLOC_KEY, null);
  if (!stored) return DEMO_ALLOCATIONS;
  return stored;
}

export function verifyDemoAllocation(
  allocationId: string,
  items: Array<{
    allocationItemId?: string;
    itemId?: string;
    receivedQuantity: number;
    missingQuantity: number;
    damagedQuantity: number;
    verificationNotes?: string;
  }>,
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): StockAllocationDTO[] {
  const list = loadDemoAllocations();
  const now = new Date().toISOString();
  const invList = loadDemoCampusInventory();
  const overlay = safeReadJson<Record<string, InventoryPatch>>(INV_OVERLAY_KEY, {});

  let verifiedRef = allocationId;

  const updated = list.map((alloc) => {
    if (alloc.id !== allocationId) return alloc;
    verifiedRef = alloc.referenceCode;

    let anyDiscrepancy = false;
    const nextItems = alloc.items.map((it) => {
      const match = items.find(
        (p) => p.allocationItemId === it.id || p.itemId === it.itemId
      );
      if (!match) return it;
      if (match.missingQuantity > 0 || match.damagedQuantity > 0) {
        anyDiscrepancy = true;
      }

      // Apply verified counts to campus inventory overlay
      const invRow = invList.find(
        (r) => r.itemId === it.itemId || r.item.code === it.item.code
      );
      if (invRow) {
        const prevAvail = invRow.availableQuantity;
        const nextAvail = prevAvail + match.receivedQuantity;
        overlay[invRow.id] = {
          ...(overlay[invRow.id] ?? {}),
          receivedQuantity: invRow.receivedQuantity + match.receivedQuantity,
          availableQuantity: nextAvail,
          damagedQuantity: invRow.damagedQuantity + match.damagedQuantity,
          missingQuantity: invRow.missingQuantity + match.missingQuantity,
          isVerified: true,
          lastVerifiedAt: now,
          updatedAt: now,
        };

        if (match.receivedQuantity > 0) {
          appendDemoTransaction({
            campusId: alloc.destinationCampusId,
            item: { id: it.item.id, code: it.item.code, name: it.item.name },
            type: "STOCK_RECEIVED",
            quantity: match.receivedQuantity,
            previousQuantity: prevAvail,
            updatedQuantity: nextAvail,
            referenceType: "STOCK_ALLOCATION",
            referenceId: alloc.referenceCode,
            remarks: match.verificationNotes || `Verified receipt of ${alloc.referenceCode}`,
            actor,
          });
        }
        if (match.damagedQuantity > 0) {
          appendDemoTransaction({
            campusId: alloc.destinationCampusId,
            item: { id: it.item.id, code: it.item.code, name: it.item.name },
            type: "DAMAGED_REPORTED",
            quantity: match.damagedQuantity,
            previousQuantity: invRow.damagedQuantity,
            updatedQuantity: invRow.damagedQuantity + match.damagedQuantity,
            referenceType: "STOCK_ALLOCATION",
            referenceId: alloc.referenceCode,
            remarks: match.verificationNotes || `Damaged units on delivery (${alloc.referenceCode})`,
            actor,
          });
        }
        if (match.missingQuantity > 0) {
          appendDemoTransaction({
            campusId: alloc.destinationCampusId,
            item: { id: it.item.id, code: it.item.code, name: it.item.name },
            type: "MISSING_REPORTED",
            quantity: match.missingQuantity,
            previousQuantity: invRow.missingQuantity,
            updatedQuantity: invRow.missingQuantity + match.missingQuantity,
            referenceType: "STOCK_ALLOCATION",
            referenceId: alloc.referenceCode,
            remarks: match.verificationNotes || `Missing units on delivery (${alloc.referenceCode})`,
            actor,
          });
        }
      }

      return {
        ...it,
        receivedQuantity: match.receivedQuantity,
        missingQuantity: match.missingQuantity,
        damagedQuantity: match.damagedQuantity,
        isVerified: true,
        verificationNotes: match.verificationNotes ?? null,
        verifiedAt: now,
      };
    });

    return {
      ...alloc,
      status: anyDiscrepancy ? ("DISCREPANCY_REPORTED" as const) : ("RECEIVED" as const),
      verifiedAt: now,
      verifiedById: actor?.id ?? "demo-user-lm-01",
      verifiedBy: {
        id: actor?.id ?? "demo-user-lm-01",
        fullName: actor?.fullName ?? "Rajesh Kulkarni",
      },
      updatedAt: now,
      items: nextItems,
    };
  });

  safeWriteJson(INV_OVERLAY_KEY, overlay);
  safeWriteJson(ALLOC_KEY, updated);

  broadcastLocalRealtimeEvent({
    type: "allocation.verified",
    campusId: "demo-campus-01",
    entityType: "StockAllocation",
    entityId: allocationId,
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: `Verified dispatch ${verifiedRef} into campus inventory`,
  });

  return updated;
}

// ============================================================================
// Issue Tickets Store
// ============================================================================

export function loadDemoTickets(): IssueTicketDTO[] {
  const stored = safeReadJson<IssueTicketDTO[] | null>(TICKET_KEY, null);
  if (!stored) return DEMO_TICKETS;
  return stored;
}

export function updateDemoTicket(
  ticketId: string,
  patch: {
    status?: TicketStatus;
    priority?: TicketPriority;
    resolutionNotes?: string | null;
  },
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): IssueTicketDTO[] {
  const list = loadDemoTickets();
  const now = new Date().toISOString();
  let code = ticketId;

  const updated = list.map((t) => {
    if (t.id !== ticketId) return t;
    code = t.ticketCode;
    const nextStatus = patch.status ?? t.status;
    return {
      ...t,
      status: nextStatus,
      priority: patch.priority ?? t.priority,
      resolutionNotes:
        patch.resolutionNotes !== undefined ? patch.resolutionNotes : t.resolutionNotes,
      resolvedAt:
        nextStatus === "RESOLVED" || nextStatus === "CLOSED"
          ? t.resolvedAt ?? now
          : null,
      updatedAt: now,
    };
  });

  safeWriteJson(TICKET_KEY, updated);

  broadcastLocalRealtimeEvent({
    type: "ticket.updated",
    campusId: "demo-campus-01",
    entityType: "IssueTicket",
    entityId: ticketId,
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: `Updated ticket ${code}${patch.status ? ` → ${patch.status.replace(/_/g, " ")}` : ""}`,
  });

  return updated;
}

export function addDemoTicketComment(
  ticketId: string,
  body: string,
  actor?: Pick<AuthUserDTO, "id" | "fullName" | "role"> | null
): IssueTicketDTO[] {
  const list = loadDemoTickets();
  const now = new Date().toISOString();
  let code = ticketId;

  const updated = list.map((t) => {
    if (t.id !== ticketId) return t;
    code = t.ticketCode;
    const nextComment = {
      id: makeId("cmt-demo"),
      ticketId: t.id,
      authorId: actor?.id ?? "demo-user-lm-01",
      body: body.trim(),
      attachmentUrls: [],
      createdAt: now,
      author: {
        id: actor?.id ?? "demo-user-lm-01",
        fullName: actor?.fullName ?? "Rajesh Kulkarni",
        role: actor?.role ?? ("LAB_MANAGER" as const),
      },
    };
    return {
      ...t,
      updatedAt: now,
      comments: [...(t.comments ?? []), nextComment],
    };
  });

  safeWriteJson(TICKET_KEY, updated);

  broadcastLocalRealtimeEvent({
    type: "ticket.updated",
    campusId: "demo-campus-01",
    entityType: "IssueTicket",
    entityId: ticketId,
    actorId: actor?.id ?? "demo-user-lm-01",
    summary: `New comment on ticket ${code}`,
  });

  return updated;
}
