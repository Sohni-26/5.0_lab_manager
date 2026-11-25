import type {
  AuditLogDTO,
  AuthUserDTO,
  CampusDTO,
  CampusInventoryDTO,
  CentralDashboardDTO,
  InstructorDashboardDTO,
  InventoryTransactionDTO,
  IssueTicketDTO,
  ItemCategoryDTO,
  LabManagerDashboardDTO,
  LabRequestDTO,
  MasterItemDTO,
  MockUserOptionDTO,
  PhotoAngle,
  StockAllocationDTO,
  StudentDashboardDTO,
} from "@/types/contracts";
import {
  PROCUREMENT_CATEGORIES,
  PROCUREMENT_ITEMS,
} from "@/lib/procurement-catalog";

function makeAngleSvg(title: string, angle: string, phase: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="${bg}" rx="16"/>
    <rect x="28" y="28" width="544" height="344" fill="none" stroke="#222321" stroke-opacity="0.12" stroke-width="2" stroke-dasharray="8 6" rx="12"/>
    <rect x="190" y="105" width="220" height="140" rx="14" fill="#222321" fill-opacity="0.08" stroke="#222321" stroke-opacity="0.2" stroke-width="2"/>
    <circle cx="255" cy="175" r="24" fill="#F26943" fill-opacity="0.25" stroke="#F26943" stroke-width="2"/>
    <rect x="300" y="152" width="84" height="14" rx="4" fill="#222321" fill-opacity="0.22"/>
    <rect x="300" y="176" width="60" height="10" rx="4" fill="#222321" fill-opacity="0.14"/>
    <text x="300" y="292" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="600" fill="#222321">${title}</text>
    <text x="300" y="320" text-anchor="middle" font-family="system-ui, sans-serif" font-size="13" fill="#72736E">${phase} PHOTO · ${angle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const CITIES: Array<[string, string]> = [
  ["Bengaluru", "Karnataka"],
  ["Hyderabad", "Telangana"],
  ["Pune", "Maharashtra"],
  ["Chennai", "Tamil Nadu"],
  ["Mumbai", "Maharashtra"],
  ["New Delhi", "Delhi"],
  ["Noida", "Uttar Pradesh"],
  ["Gurugram", "Haryana"],
  ["Ahmedabad", "Gujarat"],
  ["Kolkata", "West Bengal"],
  ["Jaipur", "Rajasthan"],
  ["Kochi", "Kerala"],
  ["Coimbatore", "Tamil Nadu"],
  ["Indore", "Madhya Pradesh"],
  ["Chandigarh", "Punjab"],
  ["Bhubaneswar", "Odisha"],
  ["Visakhapatnam", "Andhra Pradesh"],
  ["Nagpur", "Maharashtra"],
  ["Mysuru", "Karnataka"],
  ["Lucknow", "Uttar Pradesh"],
];

export const DEMO_CAMPUSES: CampusDTO[] = Array.from({ length: 40 }, (_, idx) => {
  const num = String(idx + 1).padStart(2, "0");
  const [city, state] = CITIES[idx % CITIES.length];
  const suffix = idx < 20 ? "North" : "Innovation";
  return {
    id: `demo-campus-${num}`,
    code: `CMP-${num}`,
    name: `${city} ${suffix} Campus`,
    city,
    state,
    address: `Sector ${idx + 4}, Tech Education Corridor, ${city}`,
    status: idx === 38 ? "INACTIVE" : "ACTIVE",
    createdAt: "2025-08-12T09:00:00.000Z",
    updatedAt: "2026-11-20T10:30:00.000Z",
    stats: {
      labManagerCount: 1,
      instructorCount: 4 + (idx % 4),
      studentCount: 180 + (idx % 9) * 25,
      totalStockUnits: 320 + ((idx * 37) % 240),
      availableUnits: 210 + ((idx * 29) % 140),
      borrowedUnits: 42 + ((idx * 13) % 55),
      pendingAllocations: idx < 6 ? 1 + (idx % 2) : 0,
      openTickets: idx % 5 === 0 ? 2 : idx % 3 === 0 ? 1 : 0,
    },
  };
});

export const DEMO_MOCK_USERS: MockUserOptionDTO[] = [
  {
    id: "demo-user-clm",
    fullName: "Dr. Meera Subramanian",
    email: "central@campuslab.edu",
    institutionalId: "CLM-0001",
    role: "CENTRAL_LAB_MANAGER",
    campusId: null,
    campusCode: null,
    campusName: null,
  },
  {
    id: "demo-user-lm-01",
    fullName: "Rajesh Kulkarni",
    email: "labmanager.cmp01@campuslab.edu",
    institutionalId: "LM-0101",
    role: "LAB_MANAGER",
    campusId: "demo-campus-01",
    campusCode: "CMP-01",
    campusName: "Bengaluru North Campus",
  },
  {
    id: "demo-user-inst-01",
    fullName: "Prof. Ananya Deshmukh",
    email: "instructor1.cmp01@campuslab.edu",
    institutionalId: "INS-0101",
    role: "INSTRUCTOR",
    campusId: "demo-campus-01",
    campusCode: "CMP-01",
    campusName: "Bengaluru North Campus",
  },
  {
    id: "demo-user-stu-01",
    fullName: "Aarav Nair",
    email: "student1.cmp01@campuslab.edu",
    institutionalId: "STU-0101",
    role: "STUDENT",
    campusId: "demo-campus-01",
    campusCode: "CMP-01",
    campusName: "Bengaluru North Campus",
  },
];

export const DEMO_USERS: AuthUserDTO[] = [
  ...DEMO_MOCK_USERS.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    institutionalId: u.institutionalId,
    role: u.role,
    status: "ACTIVE" as const,
    campusId: u.campusId,
    campus: u.campusId
      ? {
          id: u.campusId,
          code: u.campusCode ?? "CMP-01",
          name: u.campusName ?? "Bengaluru North Campus",
          city: "Bengaluru",
        }
      : null,
  })),
  {
    id: "demo-user-inst-02",
    fullName: "Dr. Vikramaditya Rao",
    email: "instructor2.cmp01@campuslab.edu",
    institutionalId: "INS-0102",
    role: "INSTRUCTOR",
    status: "ACTIVE",
    campusId: "demo-campus-01",
    campus: {
      id: "demo-campus-01",
      code: "CMP-01",
      name: "Bengaluru North Campus",
      city: "Bengaluru",
    },
  },
  {
    id: "demo-user-lm-02",
    fullName: "Sonalika Verma",
    email: "labmanager.cmp02@campuslab.edu",
    institutionalId: "LM-0201",
    role: "LAB_MANAGER",
    status: "ACTIVE",
    campusId: "demo-campus-02",
    campus: {
      id: "demo-campus-02",
      code: "CMP-02",
      name: "Hyderabad North Campus",
      city: "Hyderabad",
    },
  },
];

export const DEMO_CATEGORIES: ItemCategoryDTO[] = PROCUREMENT_CATEGORIES.map((c) => ({
  id: c.id,
  name: c.name,
  slug: c.slug,
  description: c.description,
  itemCount: c.itemCount,
}));

const CATEGORY_MAP = new Map(DEMO_CATEGORIES.map((c) => [c.slug, c]));

export const DEMO_MASTER_ITEMS: MasterItemDTO[] = PROCUREMENT_ITEMS.map((it, idx) => {
  const cat = CATEGORY_MAP.get(it.categorySlug) ?? DEMO_CATEGORIES[0];
  const activeCampuses = it.allocationScope === "ALL_40_LABS" ? 40 : 23;
  const totalAllocated =
    it.allocationScope === "ALL_40_LABS"
      ? it.procurementQty
      : it.procurementQty * activeCampuses;
  const isReceived =
    it.procurementStatus === "RECEIVED" ||
    it.procurementStatus === "PAYMENT_DONE" ||
    it.procurementStatus === "PR_RAISED";
  const totalReceived = isReceived
    ? Math.max(0, totalAllocated - (idx % 11 === 0 ? 2 : 0))
    : 0;
  const totalBorrowed =
    totalReceived > 4 ? Math.min(Math.floor(totalReceived * 0.22), 8 + (idx % 15)) : 0;
  const totalAvailable = Math.max(0, totalReceived - totalBorrowed);

  return {
    id: `item-${it.code.toLowerCase()}`,
    code: it.code,
    name: it.name,
    description: it.description,
    categoryId: cat.id,
    category: { id: cat.id, name: cat.name, slug: cat.slug },
    brand: it.brand,
    specifications: {
      srNo: it.srNo,
      labBlock: it.labBlock,
      vendorResearch: it.vendorResearch,
      vendorActual: it.vendorActual,
      productUrl: it.productUrl,
      unitPriceInr: it.unitPriceInr,
      procurementQty: it.procurementQty,
      perCampusQty: it.perCampusQty,
      totalPriceInr: it.totalPriceInr,
      addedOn: it.addedOn,
      procurementStatus: it.procurementStatus,
      allocationScope: it.allocationScope,
      remarks: it.remarks,
    },
    unit: it.unit,
    imageUrl: null,
    isActive: it.isActive,
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-11-22T11:20:00.000Z",
    summary: {
      totalAllocated,
      totalReceived,
      totalAvailable,
      totalBorrowed,
      campusCount: totalAllocated > 0 ? activeCampuses : 0,
    },
  };
});

const MASTER_BY_CODE = new Map(DEMO_MASTER_ITEMS.map((i) => [i.code, i]));
const REAL_JETSON = MASTER_BY_CODE.get("DEV-068") ?? DEMO_MASTER_ITEMS[0];
const REAL_ROSORIN = MASTER_BY_CODE.get("ROB-120") ?? DEMO_MASTER_ITEMS[1];
const REAL_RPI = MASTER_BY_CODE.get("DEV-067") ?? DEMO_MASTER_ITEMS[2];
const REAL_DMM = MASTER_BY_CODE.get("TME-084") ?? DEMO_MASTER_ITEMS[3];
const REAL_ESP32 = MASTER_BY_CODE.get("DEV-065") ?? DEMO_MASTER_ITEMS[4];
const REAL_SOLDER = MASTER_BY_CODE.get("TME-086") ?? DEMO_MASTER_ITEMS[5];
const REAL_BAMBU = MASTER_BY_CODE.get("PRO-111") ?? DEMO_MASTER_ITEMS[6];

export const DEMO_CAMPUS_INVENTORY: CampusInventoryDTO[] = DEMO_MASTER_ITEMS.filter(
  (it) => it.isActive
).map((item, idx) => {
  const specs = item.specifications ?? {};
  const perCampus =
    typeof specs.perCampusQty === "number" && specs.perCampusQty > 0
      ? specs.perCampusQty
      : 5;
  const status = typeof specs.procurementStatus === "string" ? specs.procurementStatus : "PR_RAISED";
  const isVerified = status !== "UNAVAILABLE" && status !== "DRAFT";
  const allocatedQuantity = perCampus;
  const damagedQuantity = idx === 1 || idx === 6 ? 1 : 0;
  const missingQuantity = idx === 6 ? 1 : 0;
  const receivedQuantity = isVerified ? Math.max(0, allocatedQuantity - missingQuantity) : 0;
  const borrowedQuantity =
    receivedQuantity >= 3 ? Math.min(2, Math.floor(receivedQuantity * 0.25)) : 0;
  const reservedQuantity = receivedQuantity >= 4 && idx % 5 === 0 ? 1 : 0;
  const availableQuantity = Math.max(
    0,
    receivedQuantity - borrowedQuantity - reservedQuantity - damagedQuantity
  );

  return {
    id: `inv-cmp01-${item.code.toLowerCase()}`,
    campusId: "demo-campus-01",
    itemId: item.id,
    allocatedQuantity,
    receivedQuantity,
    availableQuantity,
    reservedQuantity,
    borrowedQuantity,
    damagedQuantity,
    missingQuantity,
    isVisible: status !== "UNAVAILABLE" && item.code !== "PRO-111",
    isVerified,
    lastVerifiedAt: isVerified ? "2026-11-21T09:30:00.000Z" : null,
    updatedAt: "2026-11-23T08:15:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    item: {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      brand: item.brand,
      unit: item.unit,
      imageUrl: item.imageUrl,
      specifications: item.specifications,
      isActive: item.isActive,
      category: item.category!,
    },
  };
});

export const DEMO_ALLOCATIONS: StockAllocationDTO[] = [
  {
    id: "alloc-demo-01",
    referenceCode: "ALLOC-2026-0142",
    source: "Central Warehouse Bengaluru",
    destinationCampusId: "demo-campus-01",
    createdById: "demo-user-clm",
    status: "DISPATCHED",
    notes: "Q4 Robotics & Edge AI Lab Refresh Batch",
    dispatchedAt: "2026-11-21T10:00:00.000Z",
    verifiedAt: null,
    verifiedById: null,
    createdAt: "2026-11-20T14:30:00.000Z",
    updatedAt: "2026-11-21T10:00:00.000Z",
    destinationCampus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    createdBy: { id: "demo-user-clm", fullName: "Dr. Meera Subramanian", email: "central@campuslab.edu" },
    verifiedBy: null,
    items: [
      {
        id: "alloc-item-01",
        allocationId: "alloc-demo-01",
        itemId: REAL_JETSON.id,
        allocatedQuantity: 2,
        receivedQuantity: 0,
        missingQuantity: 0,
        damagedQuantity: 0,
        isVerified: false,
        verificationNotes: null,
        verifiedAt: null,
        item: { id: REAL_JETSON.id, code: REAL_JETSON.code, name: REAL_JETSON.name, unit: REAL_JETSON.unit, category: { id: REAL_JETSON.categoryId, name: REAL_JETSON.category!.name } },
      },
      {
        id: "alloc-item-02",
        allocationId: "alloc-demo-01",
        itemId: REAL_ROSORIN.id,
        allocatedQuantity: 1,
        receivedQuantity: 0,
        missingQuantity: 0,
        damagedQuantity: 0,
        isVerified: false,
        verificationNotes: null,
        verifiedAt: null,
        item: { id: REAL_ROSORIN.id, code: REAL_ROSORIN.code, name: REAL_ROSORIN.name, unit: REAL_ROSORIN.unit, category: { id: REAL_ROSORIN.categoryId, name: REAL_ROSORIN.category!.name } },
      },
      {
        id: "alloc-item-03",
        allocationId: "alloc-demo-01",
        itemId: REAL_BAMBU.id,
        allocatedQuantity: 1,
        receivedQuantity: 0,
        missingQuantity: 0,
        damagedQuantity: 0,
        isVerified: false,
        verificationNotes: null,
        verifiedAt: null,
        item: { id: REAL_BAMBU.id, code: REAL_BAMBU.code, name: REAL_BAMBU.name, unit: REAL_BAMBU.unit, category: { id: REAL_BAMBU.categoryId, name: REAL_BAMBU.category!.name } },
      },
    ],
  },
  {
    id: "alloc-demo-02",
    referenceCode: "ALLOC-2026-0138",
    source: "Central Warehouse Bengaluru",
    destinationCampusId: "demo-campus-02",
    createdById: "demo-user-clm",
    status: "DISCREPANCY_REPORTED",
    notes: "Hyderabad 5.0 Lab Equipment Batch (RoboCraze / Robu)",
    dispatchedAt: "2026-11-16T08:00:00.000Z",
    verifiedAt: "2026-11-18T15:20:00.000Z",
    verifiedById: "demo-user-lm-02",
    createdAt: "2026-11-15T11:00:00.000Z",
    updatedAt: "2026-11-18T15:20:00.000Z",
    destinationCampus: { id: "demo-campus-02", code: "CMP-02", name: "Hyderabad North Campus" },
    createdBy: { id: "demo-user-clm", fullName: "Dr. Meera Subramanian", email: "central@campuslab.edu" },
    verifiedBy: { id: "demo-user-lm-02", fullName: "Sonalika Verma" },
    items: [
      {
        id: "alloc-item-04",
        allocationId: "alloc-demo-02",
        itemId: REAL_RPI.id,
        allocatedQuantity: 4,
        receivedQuantity: 2,
        missingQuantity: 1,
        damagedQuantity: 1,
        isVerified: true,
        verificationNotes: "Outer carton crushed on corner; 1 Raspberry Pi 4B 8GB kit damaged, 1 missing.",
        verifiedAt: "2026-11-18T15:20:00.000Z",
        item: { id: REAL_RPI.id, code: REAL_RPI.code, name: REAL_RPI.name, unit: REAL_RPI.unit },
      },
    ],
  },
  {
    id: "alloc-demo-03",
    referenceCode: "ALLOC-2026-0131",
    source: "Central Warehouse Bengaluru",
    destinationCampusId: "demo-campus-01",
    createdById: "demo-user-clm",
    status: "RECEIVED",
    notes: "Assembly Arena Multimeter & Soldering Station Dispatch",
    dispatchedAt: "2026-11-10T09:00:00.000Z",
    verifiedAt: "2026-11-12T11:45:00.000Z",
    verifiedById: "demo-user-lm-01",
    createdAt: "2026-11-09T14:00:00.000Z",
    updatedAt: "2026-11-12T11:45:00.000Z",
    destinationCampus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    createdBy: { id: "demo-user-clm", fullName: "Dr. Meera Subramanian", email: "central@campuslab.edu" },
    verifiedBy: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni" },
    items: [
      {
        id: "alloc-item-05",
        allocationId: "alloc-demo-03",
        itemId: REAL_DMM.id,
        allocatedQuantity: 2,
        receivedQuantity: 2,
        missingQuantity: 0,
        damagedQuantity: 0,
        isVerified: true,
        verificationNotes: "Both Digital Multimeter (MAS830) units verified & sealed.",
        verifiedAt: "2026-11-12T11:45:00.000Z",
        item: { id: REAL_DMM.id, code: REAL_DMM.code, name: REAL_DMM.name, unit: REAL_DMM.unit },
      },
    ],
  },
];

function buildFourPhotos(
  requestId: string,
  requestItemId: string,
  borrowingRecordId: string | null,
  phase: "COLLECTION" | "RETURN",
  itemName: string
) {
  const angles: PhotoAngle[] = ["FRONT_TOP", "BACK_BOTTOM", "LEFT_SIDE", "RIGHT_SIDE"];
  const bg = phase === "COLLECTION" ? "#F7F5EE" : "#EEF6F3";
  return angles.map((angle, idx) => ({
    id: `photo-${requestItemId}-${phase.toLowerCase()}-${idx}`,
    requestId,
    requestItemId,
    borrowingRecordId,
    uploadedById: "demo-user-stu-01",
    angle,
    phase,
    storageKey: `demo/${requestItemId}/${phase}/${angle}.svg`,
    url: makeAngleSvg(itemName.slice(0, 26), angle.replace("_", " "), phase, bg),
    createdAt: phase === "COLLECTION" ? "2026-11-18T10:15:00.000Z" : "2026-11-22T16:40:00.000Z",
  }));
}

export const DEMO_REQUESTS: LabRequestDTO[] = [
  {
    id: "req-demo-01",
    requestCode: "REQ-CMP01-0412",
    campusId: "demo-campus-01",
    studentId: "demo-user-stu-01",
    instructorId: "demo-user-inst-01",
    purpose: "Capstone autonomous rover perception & SLAM lab testing",
    status: "PENDING_INSTRUCTOR",
    rejectionReason: null,
    createdAt: "2026-11-23T06:40:00.000Z",
    updatedAt: "2026-11-23T06:40:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    student: { id: "demo-user-stu-01", fullName: "Aarav Nair", email: "student1.cmp01@campuslab.edu", institutionalId: "STU-0101" },
    instructor: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", institutionalId: "INS-0101" },
    items: [
      {
        id: "req-item-01a",
        requestId: "req-demo-01",
        itemId: REAL_JETSON.id,
        requestedQuantity: 1,
        approvedQuantity: 0,
        issuedQuantity: 0,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: { id: REAL_JETSON.id, code: REAL_JETSON.code, name: REAL_JETSON.name, unit: REAL_JETSON.unit, imageUrl: null },
        photos: [],
      },
      {
        id: "req-item-01b",
        requestId: "req-demo-01",
        itemId: REAL_ROSORIN.id,
        requestedQuantity: 1,
        approvedQuantity: 0,
        issuedQuantity: 0,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: { id: REAL_ROSORIN.id, code: REAL_ROSORIN.code, name: REAL_ROSORIN.name, unit: REAL_ROSORIN.unit, imageUrl: null },
        photos: [],
      },
    ],
    approvals: [],
  },
  {
    id: "req-demo-02",
    requestCode: "REQ-CMP01-0409",
    campusId: "demo-campus-01",
    studentId: "demo-user-stu-01",
    instructorId: "demo-user-inst-01",
    purpose: "Signal conditioning & high-frequency PWM waveform analysis",
    status: "PENDING_LAB_MANAGER",
    rejectionReason: null,
    createdAt: "2026-11-22T11:20:00.000Z",
    updatedAt: "2026-11-22T14:15:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    student: { id: "demo-user-stu-01", fullName: "Aarav Nair", email: "student1.cmp01@campuslab.edu", institutionalId: "STU-0101" },
    instructor: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", institutionalId: "INS-0101" },
    items: [
      {
        id: "req-item-02a",
        requestId: "req-demo-02",
        itemId: REAL_SOLDER.id,
        requestedQuantity: 1,
        approvedQuantity: 1,
        issuedQuantity: 0,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: { id: REAL_SOLDER.id, code: REAL_SOLDER.code, name: REAL_SOLDER.name, unit: REAL_SOLDER.unit, imageUrl: null },
        photos: [],
      },
    ],
    approvals: [
      {
        id: "appr-02-inst",
        requestId: "req-demo-02",
        stage: "INSTRUCTOR_REVIEW",
        decision: "APPROVED",
        approverId: "demo-user-inst-01",
        comments: "Approved for EE-304 lab module.",
        createdAt: "2026-11-22T14:15:00.000Z",
        approver: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", role: "INSTRUCTOR" },
      },
    ],
  },
  {
    id: "req-demo-03",
    requestCode: "REQ-CMP01-0404",
    campusId: "demo-campus-01",
    studentId: "demo-user-stu-01",
    instructorId: "demo-user-inst-01",
    purpose: "Embedded Linux RTOS kernel lab assignment",
    status: "APPROVED",
    rejectionReason: null,
    createdAt: "2026-11-20T09:10:00.000Z",
    updatedAt: "2026-11-21T10:30:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    student: { id: "demo-user-stu-01", fullName: "Aarav Nair", email: "student1.cmp01@campuslab.edu", institutionalId: "STU-0101" },
    instructor: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", institutionalId: "INS-0101" },
    items: [
      {
        id: "req-item-03a",
        requestId: "req-demo-03",
        itemId: REAL_RPI.id,
        requestedQuantity: 2,
        approvedQuantity: 2,
        issuedQuantity: 0,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: { id: REAL_RPI.id, code: REAL_RPI.code, name: REAL_RPI.name, unit: REAL_RPI.unit, imageUrl: null },
        photos: buildFourPhotos("req-demo-03", "req-item-03a", null, "COLLECTION", REAL_RPI.name).slice(0, 2),
      },
    ],
    approvals: [
      {
        id: "appr-03-inst",
        requestId: "req-demo-03",
        stage: "INSTRUCTOR_REVIEW",
        decision: "APPROVED",
        approverId: "demo-user-inst-01",
        comments: "Approved for embedded systems coursework.",
        createdAt: "2026-11-20T12:00:00.000Z",
        approver: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", role: "INSTRUCTOR" },
      },
      {
        id: "appr-03-lm",
        requestId: "req-demo-03",
        stage: "LAB_MANAGER_FINAL",
        decision: "APPROVED",
        approverId: "demo-user-lm-01",
        comments: "Stock reserved at Bay B-04.",
        createdAt: "2026-11-21T10:30:00.000Z",
        approver: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", role: "LAB_MANAGER" },
      },
    ],
  },
  {
    id: "req-demo-04",
    requestCode: "REQ-CMP01-0396",
    campusId: "demo-campus-01",
    studentId: "demo-user-stu-01",
    instructorId: "demo-user-inst-01",
    purpose: "Power electronics DC-DC buck converter bench validation",
    status: "RETURN_VERIFICATION_PENDING",
    rejectionReason: null,
    createdAt: "2026-11-16T08:00:00.000Z",
    updatedAt: "2026-11-22T16:45:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    student: { id: "demo-user-stu-01", fullName: "Aarav Nair", email: "student1.cmp01@campuslab.edu", institutionalId: "STU-0101" },
    instructor: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", institutionalId: "INS-0101" },
    items: [
      {
        id: "req-item-04a",
        requestId: "req-demo-04",
        itemId: REAL_DMM.id,
        requestedQuantity: 1,
        approvedQuantity: 1,
        issuedQuantity: 1,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: { id: REAL_DMM.id, code: REAL_DMM.code, name: REAL_DMM.name, unit: REAL_DMM.unit, imageUrl: null },
        photos: [
          ...buildFourPhotos("req-demo-04", "req-item-04a", "borrow-demo-04a", "COLLECTION", REAL_DMM.name),
          ...buildFourPhotos("req-demo-04", "req-item-04a", "borrow-demo-04a", "RETURN", REAL_DMM.name),
        ],
        borrowingRecords: [
          {
            id: "borrow-demo-04a",
            requestId: "req-demo-04",
            requestItemId: "req-item-04a",
            campusId: "demo-campus-01",
            itemId: REAL_DMM.id,
            studentId: "demo-user-stu-01",
            issuedByInstructorId: "demo-user-inst-01",
            issuedQuantity: 1,
            returnedQuantity: 0,
            damagedQuantity: 0,
            missingQuantity: 0,
            issuedAt: "2026-11-18T10:30:00.000Z",
            dueAt: "2026-11-25T17:00:00.000Z",
            closedAt: null,
            item: { id: REAL_DMM.id, code: REAL_DMM.code, name: REAL_DMM.name, unit: REAL_DMM.unit },
            returnVerifications: [
              {
                id: "rv-demo-04a",
                borrowingRecordId: "borrow-demo-04a",
                requestItemId: "req-item-04a",
                verifiedById: null,
                returnedQuantity: 1,
                damagedQuantity: 0,
                missingQuantity: 0,
                condition: "GOOD",
                status: "PENDING",
                studentComments: "Returned with original probes & protective holster in clean condition.",
                instructorRemarks: null,
                submittedAt: "2026-11-22T16:45:00.000Z",
                verifiedAt: null,
              },
            ],
          },
        ],
      },
    ],
    approvals: [
      {
        id: "appr-04-inst",
        requestId: "req-demo-04",
        stage: "INSTRUCTOR_REVIEW",
        decision: "APPROVED",
        approverId: "demo-user-inst-01",
        comments: "Approved.",
        createdAt: "2026-11-16T11:00:00.000Z",
        approver: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", role: "INSTRUCTOR" },
      },
      {
        id: "appr-04-lm",
        requestId: "req-demo-04",
        stage: "LAB_MANAGER_FINAL",
        decision: "APPROVED",
        approverId: "demo-user-lm-01",
        comments: "Reserved and ready.",
        createdAt: "2026-11-17T09:00:00.000Z",
        approver: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", role: "LAB_MANAGER" },
      },
    ],
  },
  {
    id: "req-demo-05",
    requestCode: "REQ-CMP01-0391",
    campusId: "demo-campus-01",
    studentId: "demo-user-stu-01",
    instructorId: "demo-user-inst-01",
    purpose: "IoT telemetry mesh network prototype",
    status: "ISSUED",
    rejectionReason: null,
    createdAt: "2026-11-14T09:30:00.000Z",
    updatedAt: "2026-11-19T11:00:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    student: { id: "demo-user-stu-01", fullName: "Aarav Nair", email: "student1.cmp01@campuslab.edu", institutionalId: "STU-0101" },
    instructor: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", institutionalId: "INS-0101" },
    items: [
      {
        id: "req-item-05a",
        requestId: "req-demo-05",
        itemId: REAL_ESP32.id,
        requestedQuantity: 2,
        approvedQuantity: 2,
        issuedQuantity: 2,
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: 0,
        item: { id: REAL_ESP32.id, code: REAL_ESP32.code, name: REAL_ESP32.name, unit: REAL_ESP32.unit, imageUrl: null },
        photos: buildFourPhotos("req-demo-05", "req-item-05a", "borrow-demo-05a", "COLLECTION", REAL_ESP32.name),
        borrowingRecords: [
          {
            id: "borrow-demo-05a",
            requestId: "req-demo-05",
            requestItemId: "req-item-05a",
            campusId: "demo-campus-01",
            itemId: REAL_ESP32.id,
            studentId: "demo-user-stu-01",
            issuedByInstructorId: "demo-user-inst-01",
            issuedQuantity: 2,
            returnedQuantity: 0,
            damagedQuantity: 0,
            missingQuantity: 0,
            issuedAt: "2026-11-19T11:00:00.000Z",
            dueAt: "2026-11-28T17:00:00.000Z",
            closedAt: null,
            item: { id: REAL_ESP32.id, code: REAL_ESP32.code, name: REAL_ESP32.name, unit: REAL_ESP32.unit },
            returnVerifications: [],
          },
        ],
      },
    ],
    approvals: [],
  },
];

export const DEMO_TICKETS: IssueTicketDTO[] = [
  {
    id: "tkt-demo-01",
    ticketCode: "TKT-CMP01-0084",
    campusId: "demo-campus-01",
    createdById: "demo-user-inst-01",
    assignedToId: "demo-user-lm-01",
    itemId: REAL_SOLDER.id,
    category: "MALFUNCTIONING_EQUIPMENT",
    priority: "HIGH",
    status: "IN_PROGRESS",
    title: "Hot-air nozzle thermal drift on Soldron-878d station",
    description: "Temperature fluctuates ±15°C in Soldering Station Arena. Needs thermocouple inspection & tip calibration.",
    attachmentUrls: [],
    resolutionNotes: null,
    createdAt: "2026-11-21T13:15:00.000Z",
    updatedAt: "2026-11-22T09:40:00.000Z",
    resolvedAt: null,
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    createdBy: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", role: "INSTRUCTOR" },
    assignedTo: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", email: "labmanager.cmp01@campuslab.edu" },
    item: { id: REAL_SOLDER.id, code: REAL_SOLDER.code, name: REAL_SOLDER.name },
    comments: [
      {
        id: "cmt-01",
        ticketId: "tkt-demo-01",
        authorId: "demo-user-lm-01",
        body: "Tagged unit out of active circulation and ordered replacement heater core via RoboCraze.",
        attachmentUrls: [],
        createdAt: "2026-11-22T09:40:00.000Z",
        author: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", role: "LAB_MANAGER" },
      },
    ],
  },
  {
    id: "tkt-demo-02",
    ticketCode: "TKT-CMP01-0081",
    campusId: "demo-campus-01",
    createdById: "demo-user-inst-01",
    assignedToId: null,
    itemId: REAL_ROSORIN.id,
    category: "INVENTORY_DISCREPANCY",
    priority: "MEDIUM",
    status: "OPEN",
    title: "Missing LiDAR power jumper in ROSOrin Pro Display Rack kit",
    description: "ROSOrin Pro Smart Car in Display Rack is missing its spare USB-C telemetry harness.",
    attachmentUrls: [],
    resolutionNotes: null,
    createdAt: "2026-11-22T15:00:00.000Z",
    updatedAt: "2026-11-22T15:00:00.000Z",
    resolvedAt: null,
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    createdBy: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", email: "instructor1.cmp01@campuslab.edu", role: "INSTRUCTOR" },
    assignedTo: null,
    item: { id: REAL_ROSORIN.id, code: REAL_ROSORIN.code, name: REAL_ROSORIN.name },
    comments: [],
  },
];

export const DEMO_TRANSACTIONS: InventoryTransactionDTO[] = [
  {
    id: "txn-01",
    campusId: "demo-campus-01",
    itemId: REAL_RPI.id,
    type: "STOCK_RESERVED",
    quantity: 2,
    previousQuantity: 2,
    updatedQuantity: 0,
    referenceType: "LabRequest",
    referenceId: "req-demo-03",
    remarks: "Approved request REQ-CMP01-0404",
    createdAt: "2026-11-21T10:30:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    item: { id: REAL_RPI.id, code: REAL_RPI.code, name: REAL_RPI.name },
    performedBy: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", role: "LAB_MANAGER" },
  },
  {
    id: "txn-02",
    campusId: "demo-campus-01",
    itemId: REAL_ESP32.id,
    type: "ITEM_ISSUED",
    quantity: 2,
    previousQuantity: 5,
    updatedQuantity: 3,
    referenceType: "LabRequest",
    referenceId: "req-demo-05",
    remarks: "Confirmed collection after 4-angle photo verification",
    createdAt: "2026-11-19T11:00:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    item: { id: REAL_ESP32.id, code: REAL_ESP32.code, name: REAL_ESP32.name },
    performedBy: { id: "demo-user-inst-01", fullName: "Prof. Ananya Deshmukh", role: "INSTRUCTOR" },
  },
  {
    id: "txn-03",
    campusId: "demo-campus-01",
    itemId: REAL_DMM.id,
    type: "STOCK_RECEIVED",
    quantity: 2,
    previousQuantity: 0,
    updatedQuantity: 2,
    referenceType: "StockAllocation",
    referenceId: "alloc-demo-03",
    remarks: "Verified incoming allocation ALLOC-2026-0131",
    createdAt: "2026-11-12T11:45:00.000Z",
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
    item: { id: REAL_DMM.id, code: REAL_DMM.code, name: REAL_DMM.name },
    performedBy: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", role: "LAB_MANAGER" },
  },
];

export const DEMO_AUDIT_LOGS: AuditLogDTO[] = [
  {
    id: "aud-01",
    actorId: "demo-user-clm",
    actorRole: "CENTRAL_LAB_MANAGER",
    campusId: "demo-campus-01",
    action: "ALLOCATION_DISPATCHED",
    entityType: "StockAllocation",
    entityId: "alloc-demo-01",
    previousState: { status: "DRAFT" },
    newState: { status: "DISPATCHED", totalUnits: 20 },
    metadata: { referenceCode: "ALLOC-2026-0142" },
    createdAt: "2026-11-21T10:00:00.000Z",
    actor: { id: "demo-user-clm", fullName: "Dr. Meera Subramanian", email: "central@campuslab.edu" },
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
  },
  {
    id: "aud-02",
    actorId: "demo-user-lm-01",
    actorRole: "LAB_MANAGER",
    campusId: "demo-campus-01",
    action: "REQUEST_APPROVED_LAB_MANAGER",
    entityType: "LabRequest",
    entityId: "req-demo-03",
    previousState: { status: "PENDING_LAB_MANAGER" },
    newState: { status: "APPROVED", reservedQuantity: 2 },
    metadata: { requestCode: "REQ-CMP01-0404" },
    createdAt: "2026-11-21T10:30:00.000Z",
    actor: { id: "demo-user-lm-01", fullName: "Rajesh Kulkarni", email: "labmanager.cmp01@campuslab.edu" },
    campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
  },
  {
    id: "aud-03",
    actorId: "demo-user-lm-02",
    actorRole: "LAB_MANAGER",
    campusId: "demo-campus-02",
    action: "ALLOCATION_DISCREPANCY_REPORTED",
    entityType: "StockAllocation",
    entityId: "alloc-demo-02",
    previousState: { status: "DISPATCHED" },
    newState: { status: "DISCREPANCY_REPORTED", missing: 1, damaged: 1 },
    metadata: { referenceCode: "ALLOC-2026-0138" },
    createdAt: "2026-11-18T15:20:00.000Z",
    actor: { id: "demo-user-lm-02", fullName: "Sonalika Verma", email: "labmanager.cmp02@campuslab.edu" },
    campus: { id: "demo-campus-02", code: "CMP-02", name: "Hyderabad North Campus" },
  },
];

export const DEMO_CENTRAL_DASHBOARD: CentralDashboardDTO = {
  kpis: {
    totalCampuses: 40,
    activeCampuses: 39,
    totalMasterItems: DEMO_MASTER_ITEMS.filter((i) => i.isActive).length,
    totalAllocatedUnits: DEMO_MASTER_ITEMS.reduce(
      (sum, item) => sum + (item.summary?.totalAllocated ?? 0),
      0
    ),
    pendingVerifications: 7,
    activeUsers: 11240,
    pendingRequests: 64,
    openTickets: 14,
  },
  campusInventoryChart: DEMO_CAMPUSES.slice(0, 8).map((c) => ({
    campusCode: c.code,
    campusName: c.name,
    available: c.stats?.availableUnits ?? 200,
    borrowed: c.stats?.borrowedUnits ?? 45,
    reserved: 18,
    damaged: 4,
  })),
  allocationActivityChart: [
    { month: "Jun", dispatched: 1120, received: 1104, discrepancies: 16 },
    { month: "Jul", dispatched: 1480, received: 1468, discrepancies: 12 },
    { month: "Aug", dispatched: 2340, received: 2310, discrepancies: 30 },
    { month: "Sep", dispatched: 1890, received: 1875, discrepancies: 15 },
    { month: "Oct", dispatched: 2150, received: 2126, discrepancies: 24 },
    { month: "Nov", dispatched: 2680, received: 2642, discrepancies: 38 },
  ],
  pendingAllocations: DEMO_ALLOCATIONS.filter((a) => a.status !== "RECEIVED"),
  recentAuditLogs: DEMO_AUDIT_LOGS,
};

export const DEMO_LAB_MANAGER_DASHBOARD: LabManagerDashboardDTO = {
  campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
  kpis: {
    totalCampusUnits: DEMO_CAMPUS_INVENTORY.reduce((s, i) => s + i.allocatedQuantity, 0),
    availableUnits: DEMO_CAMPUS_INVENTORY.reduce((s, i) => s + i.availableQuantity, 0),
    borrowedUnits: DEMO_CAMPUS_INVENTORY.reduce((s, i) => s + i.borrowedQuantity, 0),
    reservedUnits: DEMO_CAMPUS_INVENTORY.reduce((s, i) => s + i.reservedQuantity, 0),
    damagedUnits: DEMO_CAMPUS_INVENTORY.reduce((s, i) => s + i.damagedQuantity, 0),
    missingUnits: DEMO_CAMPUS_INVENTORY.reduce((s, i) => s + i.missingQuantity, 0),
    incomingAllocations: 1,
    pendingStudentRequests: 1,
    openTickets: 2,
  },
  recentTransactions: DEMO_TRANSACTIONS,
  pendingRequests: DEMO_REQUESTS.filter((r) => r.status === "PENDING_LAB_MANAGER"),
  incomingAllocationsList: DEMO_ALLOCATIONS.filter(
    (a) => a.destinationCampusId === "demo-campus-01" && a.status === "DISPATCHED"
  ),
};

export const DEMO_INSTRUCTOR_DASHBOARD: InstructorDashboardDTO = {
  campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
  kpis: {
    pendingStudentRequests: 1,
    approvedRequests: 2,
    activeBorrowings: 2,
    pendingReturnVerifications: 1,
    openIssueTickets: 2,
  },
  pendingRequestsList: DEMO_REQUESTS.filter((r) => r.status === "PENDING_INSTRUCTOR"),
  pendingReturnsList: DEMO_REQUESTS.filter((r) => r.status === "RETURN_VERIFICATION_PENDING"),
};

export const DEMO_STUDENT_DASHBOARD: StudentDashboardDTO = {
  campus: { id: "demo-campus-01", code: "CMP-01", name: "Bengaluru North Campus" },
  kpis: {
    availableItemsCount: DEMO_CAMPUS_INVENTORY.filter((i) => i.isVisible && i.isVerified).length,
    myPendingRequests: 2,
    myApprovedRequests: 1,
    currentlyBorrowedItems: 1,
    itemsAwaitingReturn: 1,
  },
  recentRequests: DEMO_REQUESTS,
};
