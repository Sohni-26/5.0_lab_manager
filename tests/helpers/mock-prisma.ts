import crypto from "crypto";
import type { DbClient } from "@/lib/prisma";
import type { AuthUserDTO } from "@/types/contracts";

type Row = Record<string, unknown>;

function cuid(): string {
  return `c_${crypto.randomBytes(8).toString("hex")}`;
}

function deepClone<T>(val: T): T {
  if (val instanceof Date) return new Date(val.getTime()) as unknown as T;
  if (Array.isArray(val)) return val.map(deepClone) as unknown as T;
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = deepClone(v);
    }
    return out as T;
  }
  return val;
}

export interface MockStore {
  campuses: Row[];
  users: Row[];
  itemCategories: Row[];
  items: Row[];
  campusInventories: Row[];
  stockAllocations: Row[];
  stockAllocationItems: Row[];
  inventoryTransactions: Row[];
  labRequests: Row[];
  labRequestItems: Row[];
  requestApprovals: Row[];
  borrowingRecords: Row[];
  itemPhotos: Row[];
  returnVerifications: Row[];
  issueTickets: Row[];
  ticketComments: Row[];
  auditLogs: Row[];
}

function createEmptyStore(): MockStore {
  return {
    campuses: [],
    users: [],
    itemCategories: [],
    items: [],
    campusInventories: [],
    stockAllocations: [],
    stockAllocationItems: [],
    inventoryTransactions: [],
    labRequests: [],
    labRequestItems: [],
    requestApprovals: [],
    borrowingRecords: [],
    itemPhotos: [],
    returnVerifications: [],
    issueTickets: [],
    ticketComments: [],
    auditLogs: [],
  };
}

function matchCondition(value: unknown, cond: unknown): boolean {
  if (cond === undefined) return true;
  if (cond === null) return value === null || value === undefined;
  if (typeof cond !== "object" || cond instanceof Date) {
    return value === cond;
  }
  const c = cond as Record<string, unknown>;
  if ("in" in c && Array.isArray(c.in)) {
    return c.in.includes(value);
  }
  if ("gte" in c) {
    return typeof value === "number" && value >= (c.gte as number);
  }
  if ("gt" in c) {
    return typeof value === "number" && value > (c.gt as number);
  }
  if ("lte" in c) {
    return typeof value === "number" && value <= (c.lte as number);
  }
  if ("contains" in c) {
    if (typeof value !== "string") return false;
    const needle = String(c.contains);
    if (c.mode === "insensitive") {
      return value.toLowerCase().includes(needle.toLowerCase());
    }
    return value.includes(needle);
  }
  return value === cond;
}

function applyUpdateData(row: Row, data: Record<string, unknown>): Row {
  const next = { ...row };
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (val && typeof val === "object" && !(val instanceof Date) && !Array.isArray(val)) {
      const op = val as Record<string, unknown>;
      if ("increment" in op && typeof op.increment === "number") {
        next[key] = ((next[key] as number) ?? 0) + op.increment;
        continue;
      }
      if ("decrement" in op && typeof op.decrement === "number") {
        next[key] = ((next[key] as number) ?? 0) - op.decrement;
        continue;
      }
    }
    next[key] = val;
  }
  if ("updatedAt" in next) {
    next.updatedAt = new Date();
  }
  return next;
}

export function createMockPrisma(): { db: DbClient; store: MockStore } {
  let store = createEmptyStore();
  let txQueue = Promise.resolve();

  function resolveRelation(
    table: keyof MockStore,
    row: Row,
    relName: string,
    spec: unknown
  ): unknown {
    const subInclude =
      spec && typeof spec === "object" && "include" in (spec as Row)
        ? ((spec as Row).include as Record<string, unknown>)
        : undefined;
    const subWhere =
      spec && typeof spec === "object" && "where" in (spec as Row)
        ? ((spec as Row).where as Record<string, unknown>)
        : undefined;

    const hydrate = (targetTable: keyof MockStore, r: Row | undefined): Row | null => {
      if (!r) return null;
      return applyInclude(targetTable, { ...r }, subInclude);
    };
    const hydrateMany = (targetTable: keyof MockStore, rows: Row[]): Row[] => {
      const filtered = subWhere
        ? rows.filter((r) => matchesWhere(targetTable, r, subWhere))
        : rows;
      return filtered.map((r) => applyInclude(targetTable, { ...r }, subInclude));
    };

    switch (`${table}.${relName}`) {
      case "users.campus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.campusId));
      case "itemCategories.items":
        return hydrateMany("items", store.items.filter((i) => i.categoryId === row.id));
      case "items.category":
        return hydrate("itemCategories", store.itemCategories.find((c) => c.id === row.categoryId));
      case "items.campusInventories":
        return hydrateMany("campusInventories", store.campusInventories.filter((ci) => ci.itemId === row.id));
      case "campusInventories.campus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.campusId));
      case "campusInventories.item":
        return hydrate("items", store.items.find((i) => i.id === row.itemId));
      case "stockAllocations.destinationCampus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.destinationCampusId));
      case "stockAllocations.createdBy":
        return hydrate("users", store.users.find((u) => u.id === row.createdById));
      case "stockAllocations.verifiedBy":
        return hydrate("users", store.users.find((u) => u.id === row.verifiedById));
      case "stockAllocations.items":
        return hydrateMany("stockAllocationItems", store.stockAllocationItems.filter((i) => i.allocationId === row.id));
      case "stockAllocationItems.item":
        return hydrate("items", store.items.find((i) => i.id === row.itemId));
      case "inventoryTransactions.campus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.campusId));
      case "inventoryTransactions.item":
        return hydrate("items", store.items.find((i) => i.id === row.itemId));
      case "inventoryTransactions.performedBy":
        return hydrate("users", store.users.find((u) => u.id === row.performedById));
      case "labRequests.campus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.campusId));
      case "labRequests.student":
        return hydrate("users", store.users.find((u) => u.id === row.studentId));
      case "labRequests.instructor":
        return hydrate("users", store.users.find((u) => u.id === row.instructorId));
      case "labRequests.items":
        return hydrateMany("labRequestItems", store.labRequestItems.filter((i) => i.requestId === row.id));
      case "labRequests.approvals":
        return hydrateMany("requestApprovals", store.requestApprovals.filter((a) => a.requestId === row.id));
      case "labRequests.photos":
        return hydrateMany("itemPhotos", store.itemPhotos.filter((p) => p.requestId === row.id));
      case "labRequests.borrowingRecords":
        return hydrateMany("borrowingRecords", store.borrowingRecords.filter((b) => b.requestId === row.id));
      case "labRequestItems.item":
        return hydrate("items", store.items.find((i) => i.id === row.itemId));
      case "labRequestItems.photos":
        return hydrateMany("itemPhotos", store.itemPhotos.filter((p) => p.requestItemId === row.id));
      case "labRequestItems.borrowingRecords":
        return hydrateMany("borrowingRecords", store.borrowingRecords.filter((b) => b.requestItemId === row.id));
      case "requestApprovals.approver":
        return hydrate("users", store.users.find((u) => u.id === row.approverId));
      case "borrowingRecords.item":
        return hydrate("items", store.items.find((i) => i.id === row.itemId));
      case "borrowingRecords.photos":
        return hydrateMany("itemPhotos", store.itemPhotos.filter((p) => p.borrowingRecordId === row.id));
      case "borrowingRecords.returnVerifications":
        return hydrateMany("returnVerifications", store.returnVerifications.filter((rv) => rv.borrowingRecordId === row.id));
      case "returnVerifications.verifiedBy":
        return hydrate("users", store.users.find((u) => u.id === row.verifiedById));
      case "issueTickets.campus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.campusId));
      case "issueTickets.createdBy":
        return hydrate("users", store.users.find((u) => u.id === row.createdById));
      case "issueTickets.assignedTo":
        return hydrate("users", store.users.find((u) => u.id === row.assignedToId));
      case "issueTickets.item":
        return hydrate("items", store.items.find((i) => i.id === row.itemId));
      case "issueTickets.comments":
        return hydrateMany("ticketComments", store.ticketComments.filter((c) => c.ticketId === row.id));
      case "ticketComments.author":
        return hydrate("users", store.users.find((u) => u.id === row.authorId));
      case "auditLogs.actor":
        return hydrate("users", store.users.find((u) => u.id === row.actorId));
      case "auditLogs.campus":
        return hydrate("campuses", store.campuses.find((c) => c.id === row.campusId));
      default:
        return undefined;
    }
  }

  function applyInclude(
    table: keyof MockStore,
    row: Row,
    include?: Record<string, unknown>
  ): Row {
    if (!include) return row;
    const out = { ...row };
    for (const [rel, spec] of Object.entries(include)) {
      if (!spec) continue;
      out[rel] = resolveRelation(table, out, rel, spec);
    }
    return out;
  }

  function matchesWhere(
    table: keyof MockStore,
    row: Row,
    where?: Record<string, unknown>
  ): boolean {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (val === undefined) continue;
      if (key === "OR" && Array.isArray(val)) {
        if (!val.some((sub) => matchesWhere(table, row, sub as Record<string, unknown>))) {
          return false;
        }
        continue;
      }
      if (key === "NOT" && val && typeof val === "object") {
        if (matchesWhere(table, row, val as Record<string, unknown>)) {
          return false;
        }
        continue;
      }
      // Composite unique keys
      if (key === "campusId_itemId" && val && typeof val === "object") {
        const k = val as { campusId: string; itemId: string };
        if (row.campusId !== k.campusId || row.itemId !== k.itemId) return false;
        continue;
      }
      if (key === "requestId_stage" && val && typeof val === "object") {
        const k = val as { requestId: string; stage: string };
        if (row.requestId !== k.requestId || row.stage !== k.stage) return false;
        continue;
      }
      if (key === "requestItemId_phase_angle" && val && typeof val === "object") {
        const k = val as { requestItemId: string; phase: string; angle: string };
        if (
          row.requestItemId !== k.requestItemId ||
          row.phase !== k.phase ||
          row.angle !== k.angle
        ) {
          return false;
        }
        continue;
      }
      // Relation filters (e.g. campusInventories where item: { isActive: true })
      if (key === "item" && table === "campusInventories" && val && typeof val === "object") {
        const relItem = store.items.find((i) => i.id === row.itemId);
        if (!relItem || !matchesWhere("items", relItem, val as Record<string, unknown>)) {
          return false;
        }
        continue;
      }
      if (key === "student" && table === "labRequests" && val && typeof val === "object") {
        const relUser = store.users.find((u) => u.id === row.studentId);
        if (!relUser || !matchesWhere("users", relUser, val as Record<string, unknown>)) {
          return false;
        }
        continue;
      }
      if (key === "instructor" && table === "labRequests" && val && typeof val === "object") {
        const relUser = store.users.find((u) => u.id === row.instructorId);
        if (!relUser || !matchesWhere("users", relUser, val as Record<string, unknown>)) {
          return false;
        }
        continue;
      }
      if (!matchCondition(row[key], val)) return false;
    }
    return true;
  }

  function makeDelegate(
    table: keyof MockStore,
    defaults: () => Row = () => ({})
  ) {
    return {
      async findUnique(args: { where: Record<string, unknown>; include?: Record<string, unknown> }) {
        const found = store[table].find((r) => matchesWhere(table, r, args.where));
        return found ? applyInclude(table, { ...found }, args.include) : null;
      },
      async findFirst(args: { where?: Record<string, unknown>; include?: Record<string, unknown> } = {}) {
        const found = store[table].find((r) => matchesWhere(table, r, args.where));
        return found ? applyInclude(table, { ...found }, args.include) : null;
      },
      async findMany(
        args: {
          where?: Record<string, unknown>;
          include?: Record<string, unknown>;
          orderBy?: Record<string, unknown> | Array<Record<string, unknown>>;
          skip?: number;
          take?: number;
        } = {}
      ) {
        let rows = store[table].filter((r) => matchesWhere(table, r, args.where));
        if (args.orderBy) {
          const order = Array.isArray(args.orderBy) ? args.orderBy[0] : args.orderBy;
          const [field, dir] = Object.entries(order)[0] ?? [];
          if (field && (dir === "asc" || dir === "desc")) {
            rows = [...rows].sort((a, b) => {
              const av = a[field] as string | number | Date;
              const bv = b[field] as string | number | Date;
              const aVal = av instanceof Date ? av.getTime() : av ?? "";
              const bVal = bv instanceof Date ? bv.getTime() : bv ?? "";
              if (aVal < bVal) return dir === "asc" ? -1 : 1;
              if (aVal > bVal) return dir === "asc" ? 1 : -1;
              return 0;
            });
          }
        }
        if (typeof args.skip === "number") rows = rows.slice(args.skip);
        if (typeof args.take === "number") rows = rows.slice(0, args.take);
        return rows.map((r) => applyInclude(table, { ...r }, args.include));
      },
      async count(args: { where?: Record<string, unknown> } = {}) {
        return store[table].filter((r) => matchesWhere(table, r, args.where)).length;
      },
      async create(args: { data: Record<string, unknown>; include?: Record<string, unknown> }) {
        const now = new Date();
        const rawData = { ...args.data };
        const nestedItems =
          rawData.items && typeof rawData.items === "object" && "create" in (rawData.items as Row)
            ? ((rawData.items as Row).create as Row[])
            : null;
        delete rawData.items;

        const row: Row = {
          id: cuid(),
          createdAt: now,
          updatedAt: now,
          ...defaults(),
          ...rawData,
        };

        // DB-level constraint checks mirrored in mock store
        if (table === "campusInventories") {
          for (const f of [
            "allocatedQuantity",
            "receivedQuantity",
            "availableQuantity",
            "reservedQuantity",
            "borrowedQuantity",
            "damagedQuantity",
            "missingQuantity",
          ]) {
            if (typeof row[f] === "number" && (row[f] as number) < 0) {
              throw new Error(`CHECK constraint failed: ${f} >= 0`);
            }
          }
        }

        store[table].push(row);

        if (nestedItems) {
          if (table === "stockAllocations") {
            for (const ni of nestedItems) {
              store.stockAllocationItems.push({
                id: cuid(),
                allocationId: row.id,
                receivedQuantity: 0,
                missingQuantity: 0,
                damagedQuantity: 0,
                isVerified: false,
                verificationNotes: null,
                verifiedAt: null,
                ...ni,
              });
            }
          } else if (table === "labRequests") {
            for (const ni of nestedItems) {
              store.labRequestItems.push({
                id: cuid(),
                requestId: row.id,
                approvedQuantity: 0,
                issuedQuantity: 0,
                returnedQuantity: 0,
                damagedQuantity: 0,
                missingQuantity: 0,
                ...ni,
              });
            }
          }
        }

        return applyInclude(table, { ...row }, args.include);
      },
      async update(args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
        include?: Record<string, unknown>;
      }) {
        const idx = store[table].findIndex((r) => matchesWhere(table, r, args.where));
        if (idx === -1) throw new Error(`Record not found in ${table}`);
        const updated = applyUpdateData(store[table][idx], args.data);
        if (table === "campusInventories") {
          for (const f of [
            "allocatedQuantity",
            "receivedQuantity",
            "availableQuantity",
            "reservedQuantity",
            "borrowedQuantity",
            "damagedQuantity",
            "missingQuantity",
          ]) {
            if (typeof updated[f] === "number" && (updated[f] as number) < 0) {
              throw new Error(`CHECK constraint failed: ${f} >= 0`);
            }
          }
        }
        store[table][idx] = updated;
        return applyInclude(table, { ...updated }, args.include);
      },
      async updateMany(args: {
        where?: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        let count = 0;
        for (let i = 0; i < store[table].length; i++) {
          if (matchesWhere(table, store[table][i], args.where)) {
            const updated = applyUpdateData(store[table][i], args.data);
            store[table][i] = updated;
            count += 1;
          }
        }
        return { count };
      },
    };
  }

  const client = {
    campus: makeDelegate("campuses", () => ({
      city: null,
      state: null,
      address: null,
      status: "ACTIVE",
    })),
    user: makeDelegate("users", () => ({
      status: "ACTIVE",
      campusId: null,
    })),
    itemCategory: makeDelegate("itemCategories", () => ({
      description: null,
    })),
    item: makeDelegate("items", () => ({
      description: null,
      brand: null,
      specifications: null,
      unit: "pcs",
      imageUrl: null,
      isActive: true,
    })),
    campusInventory: makeDelegate("campusInventories", () => ({
      allocatedQuantity: 0,
      receivedQuantity: 0,
      availableQuantity: 0,
      reservedQuantity: 0,
      borrowedQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 0,
      isVisible: true,
      isVerified: false,
      lastVerifiedAt: null,
    })),
    stockAllocation: makeDelegate("stockAllocations", () => ({
      source: "Central Warehouse",
      status: "DRAFT",
      notes: null,
      dispatchedAt: null,
      verifiedAt: null,
      verifiedById: null,
    })),
    stockAllocationItem: makeDelegate("stockAllocationItems", () => ({
      receivedQuantity: 0,
      missingQuantity: 0,
      damagedQuantity: 0,
      isVerified: false,
      verificationNotes: null,
      verifiedAt: null,
    })),
    inventoryTransaction: makeDelegate("inventoryTransactions", () => ({
      referenceType: null,
      referenceId: null,
      remarks: null,
    })),
    labRequest: makeDelegate("labRequests", () => ({
      status: "PENDING_INSTRUCTOR",
      rejectionReason: null,
    })),
    labRequestItem: makeDelegate("labRequestItems", () => ({
      approvedQuantity: 0,
      issuedQuantity: 0,
      returnedQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 0,
    })),
    requestApproval: makeDelegate("requestApprovals", () => ({
      comments: null,
    })),
    borrowingRecord: makeDelegate("borrowingRecords", () => ({
      returnedQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 0,
      issuedAt: new Date(),
      dueAt: null,
      closedAt: null,
    })),
    itemPhoto: makeDelegate("itemPhotos", () => ({
      borrowingRecordId: null,
    })),
    returnVerification: makeDelegate("returnVerifications", () => ({
      verifiedById: null,
      returnedQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 0,
      condition: "GOOD",
      status: "PENDING",
      studentComments: null,
      instructorRemarks: null,
      submittedAt: new Date(),
      verifiedAt: null,
    })),
    issueTicket: makeDelegate("issueTickets", () => ({
      assignedToId: null,
      itemId: null,
      priority: "MEDIUM",
      status: "OPEN",
      attachmentUrls: [],
      resolutionNotes: null,
      resolvedAt: null,
    })),
    ticketComment: makeDelegate("ticketComments", () => ({
      attachmentUrls: [],
    })),
    auditLog: makeDelegate("auditLogs", () => ({
      actorId: null,
      actorRole: null,
      campusId: null,
      previousState: null,
      newState: null,
      metadata: null,
    })),
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      // Serialize interactive transactions (simulating PostgreSQL row-level locking & rollback on failure)
      let result!: T;
      let caughtError: unknown = null;

      const run = async () => {
        const snapshot = deepClone(store);
        try {
          result = await fn(client);
        } catch (err) {
          // Atomic rollback on any error inside transaction
          store = snapshot;
          caughtError = err;
        }
      };

      const next = txQueue.then(run, run);
      txQueue = next.catch(() => {});
      await next;

      if (caughtError) {
        throw caughtError;
      }
      return result;
    },
  };

  return { db: client as unknown as DbClient, store };
}

/**
 * Seeds a clean multi-campus test fixture (Campus 1 & Campus 2, all 4 roles, categories, items).
 */
export async function seedTestFixture() {
  const { db, store } = createMockPrisma();

  const now = new Date();
  const cmp1 = {
    id: "cmp-1",
    code: "CMP-01",
    name: "Bengaluru Campus",
    city: "Bengaluru",
    state: "Karnataka",
    address: "Tech Park 1",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  const cmp2 = {
    id: "cmp-2",
    code: "CMP-02",
    name: "Hyderabad Campus",
    city: "Hyderabad",
    state: "Telangana",
    address: "Tech Park 2",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  store.campuses.push(cmp1, cmp2);

  const centralUser: AuthUserDTO = {
    id: "u-central",
    fullName: "Dr. Central Manager",
    email: "central@campuslab.edu",
    institutionalId: "CLM-0001",
    role: "CENTRAL_LAB_MANAGER",
    status: "ACTIVE",
    campusId: null,
    campus: null,
  };
  const lm1Cmp1: AuthUserDTO = {
    id: "u-lm1-c1",
    fullName: "Rajesh LM1",
    email: "lm1.c1@campuslab.edu",
    institutionalId: "LM-01-01",
    role: "LAB_MANAGER",
    status: "ACTIVE",
    campusId: "cmp-1",
    campus: { id: "cmp-1", code: "CMP-01", name: "Bengaluru Campus", city: "Bengaluru" },
  };
  const lm2Cmp1: AuthUserDTO = {
    id: "u-lm2-c1",
    fullName: "Meera LM2",
    email: "lm2.c1@campuslab.edu",
    institutionalId: "LM-01-02",
    role: "LAB_MANAGER",
    status: "ACTIVE",
    campusId: "cmp-1",
    campus: { id: "cmp-1", code: "CMP-01", name: "Bengaluru Campus", city: "Bengaluru" },
  };
  const inst1Cmp1: AuthUserDTO = {
    id: "u-inst1-c1",
    fullName: "Prof. Vikram",
    email: "inst1.c1@campuslab.edu",
    institutionalId: "INS-01-01",
    role: "INSTRUCTOR",
    status: "ACTIVE",
    campusId: "cmp-1",
    campus: { id: "cmp-1", code: "CMP-01", name: "Bengaluru Campus", city: "Bengaluru" },
  };
  const inst2Cmp1: AuthUserDTO = {
    id: "u-inst2-c1",
    fullName: "Prof. Priya",
    email: "inst2.c1@campuslab.edu",
    institutionalId: "INS-01-02",
    role: "INSTRUCTOR",
    status: "ACTIVE",
    campusId: "cmp-1",
    campus: { id: "cmp-1", code: "CMP-01", name: "Bengaluru Campus", city: "Bengaluru" },
  };
  const stu1Cmp1: AuthUserDTO = {
    id: "u-stu1-c1",
    fullName: "Aarav Student",
    email: "stu1.c1@campuslab.edu",
    institutionalId: "STU-01-01",
    role: "STUDENT",
    status: "ACTIVE",
    campusId: "cmp-1",
    campus: { id: "cmp-1", code: "CMP-01", name: "Bengaluru Campus", city: "Bengaluru" },
  };
  const stu2Cmp1: AuthUserDTO = {
    id: "u-stu2-c1",
    fullName: "Diya Student",
    email: "stu2.c1@campuslab.edu",
    institutionalId: "STU-01-02",
    role: "STUDENT",
    status: "ACTIVE",
    campusId: "cmp-1",
    campus: { id: "cmp-1", code: "CMP-01", name: "Bengaluru Campus", city: "Bengaluru" },
  };
  const lm1Cmp2: AuthUserDTO = {
    id: "u-lm1-c2",
    fullName: "Sandeep LM C2",
    email: "lm1.c2@campuslab.edu",
    institutionalId: "LM-02-01",
    role: "LAB_MANAGER",
    status: "ACTIVE",
    campusId: "cmp-2",
    campus: { id: "cmp-2", code: "CMP-02", name: "Hyderabad Campus", city: "Hyderabad" },
  };
  const inst1Cmp2: AuthUserDTO = {
    id: "u-inst1-c2",
    fullName: "Prof. Kavitha C2",
    email: "inst1.c2@campuslab.edu",
    institutionalId: "INS-02-01",
    role: "INSTRUCTOR",
    status: "ACTIVE",
    campusId: "cmp-2",
    campus: { id: "cmp-2", code: "CMP-02", name: "Hyderabad Campus", city: "Hyderabad" },
  };
  const stu1Cmp2: AuthUserDTO = {
    id: "u-stu1-c2",
    fullName: "Rohan Student C2",
    email: "stu1.c2@campuslab.edu",
    institutionalId: "STU-02-01",
    role: "STUDENT",
    status: "ACTIVE",
    campusId: "cmp-2",
    campus: { id: "cmp-2", code: "CMP-02", name: "Hyderabad Campus", city: "Hyderabad" },
  };

  for (const u of [
    centralUser,
    lm1Cmp1,
    lm2Cmp1,
    inst1Cmp1,
    inst2Cmp1,
    stu1Cmp1,
    stu2Cmp1,
    lm1Cmp2,
    inst1Cmp2,
    stu1Cmp2,
  ]) {
    store.users.push({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      institutionalId: u.institutionalId,
      role: u.role,
      status: u.status,
      campusId: u.campusId,
      createdAt: now,
      updatedAt: now,
    });
  }

  store.itemCategories.push({
    id: "cat-mcu",
    name: "Microcontrollers",
    slug: "microcontrollers",
    description: "Dev boards",
    createdAt: now,
    updatedAt: now,
  });

  store.items.push(
    {
      id: "item-arduino",
      code: "ARD-UNO-R4",
      name: "Arduino Uno R4",
      description: "Arduino board",
      categoryId: "cat-mcu",
      brand: "Arduino",
      specifications: { voltage: "5V" },
      unit: "pcs",
      imageUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "item-osc",
      code: "OSC-100",
      name: "Digital Oscilloscope",
      description: "100MHz scope",
      categoryId: "cat-mcu",
      brand: "Rigol",
      specifications: { bandwidth: "100MHz" },
      unit: "unit",
      imageUrl: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return {
    db,
    store,
    users: {
      centralUser,
      lm1Cmp1,
      lm2Cmp1,
      inst1Cmp1,
      inst2Cmp1,
      stu1Cmp1,
      stu2Cmp1,
      lm1Cmp2,
      inst1Cmp2,
      stu1Cmp2,
    },
  };
}
