import { PrismaClient } from "@prisma/client";
import path from "path";
import { promises as fs } from "fs";
import {
  PROCUREMENT_CATEGORIES,
  PROCUREMENT_ITEMS,
} from "../src/lib/procurement-catalog";

const prisma = new PrismaClient();

const CAMPUSES_40 = [
  { code: "CMP-01", name: "Bengaluru Central Engineering Campus", city: "Bengaluru", state: "Karnataka" },
  { code: "CMP-02", name: "Hyderabad Robotics & AI Campus", city: "Hyderabad", state: "Telangana" },
  { code: "CMP-03", name: "Pune Applied Sciences Campus", city: "Pune", state: "Maharashtra" },
  { code: "CMP-04", name: "Chennai Coastal Technology Campus", city: "Chennai", state: "Tamil Nadu" },
  { code: "CMP-05", name: "Mumbai Harbor Innovation Campus", city: "Mumbai", state: "Maharashtra" },
  { code: "CMP-06", name: "Delhi NCR North Engineering Campus", city: "New Delhi", state: "Delhi" },
  { code: "CMP-07", name: "Noida Embedded Systems Campus", city: "Noida", state: "Uttar Pradesh" },
  { code: "CMP-08", name: "Gurugram Cloud & IoT Campus", city: "Gurugram", state: "Haryana" },
  { code: "CMP-09", name: "Kolkata Eastern Tech Campus", city: "Kolkata", state: "West Bengal" },
  { code: "CMP-10", name: "Ahmedabad Industrial Design Campus", city: "Ahmedabad", state: "Gujarat" },
  { code: "CMP-11", name: "Jaipur Pink City STEM Campus", city: "Jaipur", state: "Rajasthan" },
  { code: "CMP-12", name: "Kochi Marine & Electronics Campus", city: "Kochi", state: "Kerala" },
  { code: "CMP-13", name: "Coimbatore Precision Labs Campus", city: "Coimbatore", state: "Tamil Nadu" },
  { code: "CMP-14", name: "Chandigarh Tri-City Engineering Campus", city: "Chandigarh", state: "Chandigarh" },
  { code: "CMP-15", name: "Indore Central India Tech Campus", city: "Indore", state: "Madhya Pradesh" },
  { code: "CMP-16", name: "Bhopal Lakeview Engineering Campus", city: "Bhopal", state: "Madhya Pradesh" },
  { code: "CMP-17", name: "Nagpur Vidarbha Research Campus", city: "Nagpur", state: "Maharashtra" },
  { code: "CMP-18", name: "Lucknow Heritage Engineering Campus", city: "Lucknow", state: "Uttar Pradesh" },
  { code: "CMP-19", name: "Bhubaneswar Kalinga Labs Campus", city: "Bhubaneswar", state: "Odisha" },
  { code: "CMP-20", name: "Visakhapatnam Port Tech Campus", city: "Visakhapatnam", state: "Andhra Pradesh" },
  { code: "CMP-21", name: "Thiruvananthapuram Technopark Campus", city: "Thiruvananthapuram", state: "Kerala" },
  { code: "CMP-22", name: "Mysuru Silicon Valley South Campus", city: "Mysuru", state: "Karnataka" },
  { code: "CMP-23", name: "Mangaluru Coastal Engineering Campus", city: "Mangaluru", state: "Karnataka" },
  { code: "CMP-24", name: "Surat Diamond Valley Tech Campus", city: "Surat", state: "Gujarat" },
  { code: "CMP-25", name: "Vadodara Instrumentation Campus", city: "Vadodara", state: "Gujarat" },
  { code: "CMP-26", name: "Guwahati Northeast Innovation Campus", city: "Guwahati", state: "Assam" },
  { code: "CMP-27", name: "Patna Magadh Engineering Campus", city: "Patna", state: "Bihar" },
  { code: "CMP-28", name: "Ranchi Mineral & Robotics Campus", city: "Ranchi", state: "Jharkhand" },
  { code: "CMP-29", name: "Dehradun Himalayan STEM Campus", city: "Dehradun", state: "Uttarakhand" },
  { code: "CMP-30", name: "Shimla Alpine Research Campus", city: "Shimla", state: "Himachal Pradesh" },
  { code: "CMP-31", name: "Amritsar Northern Engineering Campus", city: "Amritsar", state: "Punjab" },
  { code: "CMP-32", name: "Ludhiana Manufacturing Labs Campus", city: "Ludhiana", state: "Punjab" },
  { code: "CMP-33", name: "Kanpur Ganga Tech Campus", city: "Kanpur", state: "Uttar Pradesh" },
  { code: "CMP-34", name: "Varanasi Photonics & Optics Campus", city: "Varanasi", state: "Uttar Pradesh" },
  { code: "CMP-35", name: "Raipur Energy Systems Campus", city: "Raipur", state: "Chhattisgarh" },
  { code: "CMP-36", name: "Madurai Southern Science Campus", city: "Madurai", state: "Tamil Nadu" },
  { code: "CMP-37", name: "Tiruchirappalli Aerospace Labs Campus", city: "Tiruchirappalli", state: "Tamil Nadu" },
  { code: "CMP-38", name: "Vijayawada Amaravati Tech Campus", city: "Vijayawada", state: "Andhra Pradesh" },
  { code: "CMP-39", name: "Nashik Mechatronics Campus", city: "Nashik", state: "Maharashtra" },
  { code: "CMP-40", name: "Panaji Goa Robotics & Marine Campus", city: "Panaji", state: "Goa" },
] as const;

// Categories & master items are loaded from src/lib/procurement-catalog.ts (12 categories, 166 real items).

async function ensureSamplePhotoFiles() {
  const dir = path.join(process.cwd(), "public", "uploads", "samples");
  await fs.mkdir(dir, { recursive: true });
  const angles = [
    { key: "front-top", label: "FRONT / TOP VIEW", color: "#0f766e" },
    { key: "back-bottom", label: "BACK / BOTTOM VIEW", color: "#0369a1" },
    { key: "left-side", label: "LEFT SIDE VIEW", color: "#4338ca" },
    { key: "right-side", label: "RIGHT SIDE VIEW", color: "#7c3aed" },
  ];
  for (const phase of ["collection", "return"]) {
    for (const a of angles) {
      const filePath = path.join(dir, `${phase}-${a.key}.svg`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#0f172a"/>
  <rect x="24" y="24" width="592" height="372" rx="16" fill="#1e293b" stroke="${a.color}" stroke-width="3"/>
  <rect x="170" y="105" width="300" height="170" rx="12" fill="${a.color}" fill-opacity="0.18" stroke="${a.color}" stroke-width="2"/>
  <text x="320" y="178" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="22" font-weight="700" text-anchor="middle">${a.label}</text>
  <text x="320" y="212" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="15" text-anchor="middle">CampusLab ${phase.toUpperCase()} Evidence Photo</text>
  <text x="320" y="345" fill="#64748b" font-family="monospace" font-size="13" text-anchor="middle">4-Angle Inspection Verified • Immutable Storage Record</text>
</svg>`;
      await fs.writeFile(filePath, svg, "utf8");
    }
  }
}

async function main() {
  console.log("🌱 Seeding CampusLab Multi-Campus Lab Management System...");
  await ensureSamplePhotoFiles();

  // 1. Seed 40 Campuses
  const campusByCode = new Map<string, { id: string; code: string; name: string }>();
  for (const c of CAMPUSES_40) {
    const campus = await prisma.campus.upsert({
      where: { code: c.code },
      update: { name: c.name, city: c.city, state: c.state, status: "ACTIVE" },
      create: {
        code: c.code,
        name: c.name,
        city: c.city,
        state: c.state,
        address: `Academic Tech Park, ${c.city}, ${c.state}`,
        status: "ACTIVE",
      },
    });
    campusByCode.set(campus.code, campus);
  }
  console.log(`✅ Seeded ${campusByCode.size} campuses (CMP-01..CMP-40)`);

  const cmp1 = campusByCode.get("CMP-01")!;
  const cmp2 = campusByCode.get("CMP-02")!;
  const cmp3 = campusByCode.get("CMP-03")!;

  // 2. Seed Users (EXACTLY 1 Central Lab Manager + multiple campus roles)
  const centralManager = await prisma.user.upsert({
    where: { email: "central@campuslab.edu" },
    update: { fullName: "Dr. Ananya Deshmukh", role: "CENTRAL_LAB_MANAGER", campusId: null, status: "ACTIVE" },
    create: {
      fullName: "Dr. Ananya Deshmukh",
      email: "central@campuslab.edu",
      institutionalId: "CLM-0001",
      role: "CENTRAL_LAB_MANAGER",
      campusId: null,
      status: "ACTIVE",
    },
  });

  const userSeeds = [
    // Campus 1 — TWO Lab Managers, TWO Instructors, TWO Students
    { fullName: "Rajesh Kulkarni", email: "lm1.cmp01@campuslab.edu", institutionalId: "LM-01-001", role: "LAB_MANAGER" as const, campusId: cmp1.id },
    { fullName: "Meera Nair", email: "lm2.cmp01@campuslab.edu", institutionalId: "LM-01-002", role: "LAB_MANAGER" as const, campusId: cmp1.id },
    { fullName: "Prof. Vikram Rao", email: "inst1.cmp01@campuslab.edu", institutionalId: "INS-01-001", role: "INSTRUCTOR" as const, campusId: cmp1.id },
    { fullName: "Prof. Priya Iyer", email: "inst2.cmp01@campuslab.edu", institutionalId: "INS-01-002", role: "INSTRUCTOR" as const, campusId: cmp1.id },
    { fullName: "Aarav Sharma", email: "student1.cmp01@campuslab.edu", institutionalId: "STU-01-101", role: "STUDENT" as const, campusId: cmp1.id },
    { fullName: "Diya Menon", email: "student2.cmp01@campuslab.edu", institutionalId: "STU-01-102", role: "STUDENT" as const, campusId: cmp1.id },

    // Campus 2 — Lab Manager, Instructor, Student
    { fullName: "Sandeep Reddy", email: "lm1.cmp02@campuslab.edu", institutionalId: "LM-02-001", role: "LAB_MANAGER" as const, campusId: cmp2.id },
    { fullName: "Prof. Kavitha Rao", email: "inst1.cmp02@campuslab.edu", institutionalId: "INS-02-001", role: "INSTRUCTOR" as const, campusId: cmp2.id },
    { fullName: "Rohan Verma", email: "student1.cmp02@campuslab.edu", institutionalId: "STU-02-101", role: "STUDENT" as const, campusId: cmp2.id },

    // Campus 3 — Lab Manager, Instructor, Student
    { fullName: "Nikhil Joshi", email: "lm1.cmp03@campuslab.edu", institutionalId: "LM-03-001", role: "LAB_MANAGER" as const, campusId: cmp3.id },
    { fullName: "Prof. Sneha Patil", email: "inst1.cmp03@campuslab.edu", institutionalId: "INS-03-001", role: "INSTRUCTOR" as const, campusId: cmp3.id },
    { fullName: "Ishaan Kulkarni", email: "student1.cmp03@campuslab.edu", institutionalId: "STU-03-101", role: "STUDENT" as const, campusId: cmp3.id },
  ];

  const usersByEmail = new Map<string, { id: string; email: string; campusId: string | null }>();
  usersByEmail.set(centralManager.email, centralManager);

  for (const u of userSeeds) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, campusId: u.campusId, status: "ACTIVE" },
      create: u,
    });
    usersByEmail.set(user.email, user);
  }
  console.log(`✅ Seeded ${usersByEmail.size} users (1 Central Lab Manager + 12 campus users)`);

  const lm1Cmp1 = usersByEmail.get("lm1.cmp01@campuslab.edu")!;
  const inst1Cmp1 = usersByEmail.get("inst1.cmp01@campuslab.edu")!;
  const inst2Cmp1 = usersByEmail.get("inst2.cmp01@campuslab.edu")!;
  const stu1Cmp1 = usersByEmail.get("student1.cmp01@campuslab.edu")!;
  const stu2Cmp1 = usersByEmail.get("student2.cmp01@campuslab.edu")!;
  const lm1Cmp2 = usersByEmail.get("lm1.cmp02@campuslab.edu")!;
  const inst1Cmp2 = usersByEmail.get("inst1.cmp02@campuslab.edu")!;
  const stu1Cmp2 = usersByEmail.get("student1.cmp02@campuslab.edu")!;

  // 3. Seed 12 Real Categories & ALL 166 Real 5.0 Lab Procurement Master Items
  const catBySlug = new Map<string, string>();
  for (const cat of PROCUREMENT_CATEGORIES) {
    const rec = await prisma.itemCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
      },
    });
    catBySlug.set(rec.slug, rec.id);
  }

  const itemByCode = new Map<string, { id: string; code: string; name: string }>();
  for (const it of PROCUREMENT_ITEMS) {
    const specifications = {
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
    };

    const rec = await prisma.item.upsert({
      where: { code: it.code },
      update: {
        name: it.name,
        description: it.description,
        categoryId: catBySlug.get(it.categorySlug)!,
        brand: it.brand,
        unit: it.unit,
        specifications,
        isActive: it.isActive,
      },
      create: {
        code: it.code,
        name: it.name,
        description: it.description,
        categoryId: catBySlug.get(it.categorySlug)!,
        brand: it.brand,
        unit: it.unit,
        specifications,
        isActive: it.isActive,
      },
    });
    itemByCode.set(rec.code, rec);
  }
  console.log(`✅ Seeded ${catBySlug.size} real categories & ${itemByCode.size} real master items`);

  const arduino = itemByCode.get("DEV-063")!;
  const rpi = itemByCode.get("DEV-067")!;
  const esp32 = itemByCode.get("DEV-065")!;
  const osc = itemByCode.get("DEV-068")!;
  const dmm = itemByCode.get("TME-084")!;
  const breadboard = itemByCode.get("PRO-091")!;
  const jumpers = itemByCode.get("PRO-105")!;
  const servo = itemByCode.get("ACT-060")!;
  const solder = itemByCode.get("TME-086")!;
  const thermal = itemByCode.get("PRO-111")!;

  // 4. Seed Campus Inventories (verified + visible, verified + hidden, and unverified)
  const inventorySeeds = [
    // Campus 1
    { campusId: cmp1.id, itemId: arduino.id, allocated: 50, received: 48, available: 38, reserved: 4, borrowed: 6, damaged: 0, missing: 2, isVisible: true, isVerified: true },
    { campusId: cmp1.id, itemId: rpi.id, allocated: 25, received: 25, available: 19, reserved: 2, borrowed: 3, damaged: 1, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp1.id, itemId: esp32.id, allocated: 40, received: 40, available: 36, reserved: 0, borrowed: 4, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp1.id, itemId: osc.id, allocated: 12, received: 12, available: 10, reserved: 1, borrowed: 1, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp1.id, itemId: dmm.id, allocated: 30, received: 30, available: 26, reserved: 0, borrowed: 4, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp1.id, itemId: breadboard.id, allocated: 80, received: 80, available: 70, reserved: 4, borrowed: 6, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp1.id, itemId: jumpers.id, allocated: 60, received: 60, available: 54, reserved: 2, borrowed: 4, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    // Hidden item on Campus 1 (only Lab Manager & Central see it; students/instructors cannot)
    { campusId: cmp1.id, itemId: thermal.id, allocated: 4, received: 4, available: 4, reserved: 0, borrowed: 0, damaged: 0, missing: 0, isVisible: false, isVerified: true },
    // Unverified incoming stock on Campus 1 (allocated & dispatched, awaiting Lab Manager verification)
    { campusId: cmp1.id, itemId: solder.id, allocated: 15, received: 0, available: 0, reserved: 0, borrowed: 0, damaged: 0, missing: 0, isVisible: true, isVerified: false },

    // Campus 2
    { campusId: cmp2.id, itemId: arduino.id, allocated: 40, received: 40, available: 34, reserved: 0, borrowed: 6, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp2.id, itemId: rpi.id, allocated: 20, received: 20, available: 18, reserved: 0, borrowed: 2, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp2.id, itemId: servo.id, allocated: 35, received: 35, available: 32, reserved: 0, borrowed: 3, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp2.id, itemId: osc.id, allocated: 8, received: 8, available: 7, reserved: 0, borrowed: 1, damaged: 0, missing: 0, isVisible: true, isVerified: true },

    // Campus 3
    { campusId: cmp3.id, itemId: arduino.id, allocated: 30, received: 30, available: 28, reserved: 0, borrowed: 2, damaged: 0, missing: 0, isVisible: true, isVerified: true },
    { campusId: cmp3.id, itemId: dmm.id, allocated: 25, received: 25, available: 24, reserved: 0, borrowed: 1, damaged: 0, missing: 0, isVisible: true, isVerified: true },
  ];

  for (const inv of inventorySeeds) {
    await prisma.campusInventory.upsert({
      where: { campusId_itemId: { campusId: inv.campusId, itemId: inv.itemId } },
      update: {},
      create: {
        campusId: inv.campusId,
        itemId: inv.itemId,
        allocatedQuantity: inv.allocated,
        receivedQuantity: inv.received,
        availableQuantity: inv.available,
        reservedQuantity: inv.reserved,
        borrowedQuantity: inv.borrowed,
        damagedQuantity: inv.damaged,
        missingQuantity: inv.missing,
        isVisible: inv.isVisible,
        isVerified: inv.isVerified,
        lastVerifiedAt: inv.isVerified ? new Date() : null,
      },
    });
  }
  console.log(`✅ Seeded ${inventorySeeds.length} campus inventory records`);

  // 5. Seed Stock Allocations across statuses (DISCREPANCY_REPORTED, RECEIVED, DISPATCHED, DRAFT)
  const allocSeeds = [
    {
      referenceCode: "ALLOC-2026-CMP-01-DISC01",
      destinationCampusId: cmp1.id,
      status: "DISCREPANCY_REPORTED" as const,
      notes: "Initial microcontroller batch — 2 Arduino units missing in transit",
      dispatchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      verifiedById: lm1Cmp1.id,
      items: [
        { itemId: arduino.id, allocated: 50, received: 48, missing: 2, damaged: 0, isVerified: true, notes: "Box #3 seal broken; 48 units counted, 2 missing" },
        { itemId: breadboard.id, allocated: 80, received: 80, missing: 0, damaged: 0, isVerified: true, notes: "All 80 verified in good condition" },
      ],
    },
    {
      referenceCode: "ALLOC-2026-CMP-01-DISP02",
      destinationCampusId: cmp1.id,
      status: "DISPATCHED" as const,
      notes: "Soldering stations & thermal cameras dispatched via BlueDart Express",
      dispatchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      verifiedAt: null,
      verifiedById: null,
      items: [
        { itemId: solder.id, allocated: 15, received: 0, missing: 0, damaged: 0, isVerified: false, notes: null },
      ],
    },
    {
      referenceCode: "ALLOC-2026-CMP-02-RECV01",
      destinationCampusId: cmp2.id,
      status: "RECEIVED" as const,
      notes: "Robotics lab starter allocation verified complete",
      dispatchedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
      verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
      verifiedById: lm1Cmp2.id,
      items: [
        { itemId: arduino.id, allocated: 40, received: 40, missing: 0, damaged: 0, isVerified: true, notes: "Full shipment verified" },
        { itemId: servo.id, allocated: 35, received: 35, missing: 0, damaged: 0, isVerified: true, notes: "Full shipment verified" },
      ],
    },
    {
      referenceCode: "ALLOC-2026-CMP-03-DRFT01",
      destinationCampusId: cmp3.id,
      status: "DRAFT" as const,
      notes: "Planned Q2 expansion shipment for Pune Applied Sciences Campus",
      dispatchedAt: null,
      verifiedAt: null,
      verifiedById: null,
      items: [
        { itemId: esp32.id, allocated: 25, received: 0, missing: 0, damaged: 0, isVerified: false, notes: null },
      ],
    },
  ];

  for (const a of allocSeeds) {
    const exists = await prisma.stockAllocation.findUnique({
      where: { referenceCode: a.referenceCode },
    });
    if (!exists) {
      await prisma.stockAllocation.create({
        data: {
          referenceCode: a.referenceCode,
          source: "Central Warehouse — Bengaluru Hub",
          destinationCampusId: a.destinationCampusId,
          createdById: centralManager.id,
          status: a.status,
          notes: a.notes,
          dispatchedAt: a.dispatchedAt,
          verifiedAt: a.verifiedAt,
          verifiedById: a.verifiedById,
          items: {
            create: a.items.map((it) => ({
              itemId: it.itemId,
              allocatedQuantity: it.allocated,
              receivedQuantity: it.received,
              missingQuantity: it.missing,
              damagedQuantity: it.damaged,
              isVerified: it.isVerified,
              verificationNotes: it.notes,
              verifiedAt: it.isVerified ? a.verifiedAt : null,
            })),
          },
        },
      });
    }
  }
  console.log(`✅ Seeded ${allocSeeds.length} stock allocations`);

  // 6. Seed Student Requests across ALL lifecycle stages
  const sampleCollectionPhotos = [
    { angle: "FRONT_TOP" as const, key: "samples/collection-front-top.svg", url: "/uploads/samples/collection-front-top.svg" },
    { angle: "BACK_BOTTOM" as const, key: "samples/collection-back-bottom.svg", url: "/uploads/samples/collection-back-bottom.svg" },
    { angle: "LEFT_SIDE" as const, key: "samples/collection-left-side.svg", url: "/uploads/samples/collection-left-side.svg" },
    { angle: "RIGHT_SIDE" as const, key: "samples/collection-right-side.svg", url: "/uploads/samples/collection-right-side.svg" },
  ];
  const sampleReturnPhotos = [
    { angle: "FRONT_TOP" as const, key: "samples/return-front-top.svg", url: "/uploads/samples/return-front-top.svg" },
    { angle: "BACK_BOTTOM" as const, key: "samples/return-back-bottom.svg", url: "/uploads/samples/return-back-bottom.svg" },
    { angle: "LEFT_SIDE" as const, key: "samples/return-left-side.svg", url: "/uploads/samples/return-left-side.svg" },
    { angle: "RIGHT_SIDE" as const, key: "samples/return-right-side.svg", url: "/uploads/samples/return-right-side.svg" },
  ];

  // Stage A: PENDING_INSTRUCTOR
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-01-PEND01" } }))) {
    await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-01-PEND01",
        campusId: cmp1.id,
        studentId: stu1Cmp1.id,
        instructorId: inst1Cmp1.id,
        purpose: "Embedded Systems Lab 4: Smart Greenhouse IoT telemetry prototype",
        status: "PENDING_INSTRUCTOR",
        items: {
          create: [
            { itemId: esp32.id, requestedQuantity: 2 },
            { itemId: breadboard.id, requestedQuantity: 2 },
          ],
        },
      },
    });
  }

  // Stage B: PENDING_LAB_MANAGER
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-01-LMGR02" } }))) {
    await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-01-LMGR02",
        campusId: cmp1.id,
        studentId: stu2Cmp1.id,
        instructorId: inst1Cmp1.id,
        purpose: "Digital Signal Processing Mini-Project: Audio FFT spectrum analyzer",
        status: "PENDING_LAB_MANAGER",
        items: {
          create: [
            { itemId: rpi.id, requestedQuantity: 1 },
            { itemId: osc.id, requestedQuantity: 1 },
          ],
        },
        approvals: {
          create: [
            {
              stage: "INSTRUCTOR_REVIEW",
              decision: "APPROVED",
              approverId: inst1Cmp1.id,
              comments: "Approved for DSP Week 6 lab bench session.",
            },
          ],
        },
      },
    });
  }

  // Stage C: APPROVED (ready for 4-angle photo upload & collection confirmation)
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-01-APPR03" } }))) {
    await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-01-APPR03",
        campusId: cmp1.id,
        studentId: stu1Cmp1.id,
        instructorId: inst1Cmp1.id,
        purpose: "Microcontrollers Assignment 3: PID DC Motor Speed Controller",
        status: "APPROVED",
        items: {
          create: [
            { itemId: arduino.id, requestedQuantity: 2, approvedQuantity: 2 },
            { itemId: jumpers.id, requestedQuantity: 2, approvedQuantity: 2 },
          ],
        },
        approvals: {
          create: [
            { stage: "INSTRUCTOR_REVIEW", decision: "APPROVED", approverId: inst1Cmp1.id, comments: "Verified lab group membership." },
            { stage: "LAB_MANAGER_FINAL", decision: "APPROVED", approverId: lm1Cmp1.id, comments: "Stock reserved at Lab Counter B." },
          ],
        },
      },
    });
  }

  // Stage D: ISSUED (with 4 collection photos & BorrowingRecord)
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-01-ISSU04" } }))) {
    const issuedReq = await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-01-ISSU04",
        campusId: cmp1.id,
        studentId: stu1Cmp1.id,
        instructorId: inst1Cmp1.id,
        purpose: "Autonomous Line Follower Bot — Semester Capstone",
        status: "ISSUED",
        items: {
          create: [
            { itemId: arduino.id, requestedQuantity: 2, approvedQuantity: 2, issuedQuantity: 2 },
          ],
        },
        approvals: {
          create: [
            { stage: "INSTRUCTOR_REVIEW", decision: "APPROVED", approverId: inst1Cmp1.id, comments: "Approved for capstone." },
            { stage: "LAB_MANAGER_FINAL", decision: "APPROVED", approverId: lm1Cmp1.id, comments: "Reserved." },
          ],
        },
      },
      include: { items: true },
    });
    const reqItem = issuedReq.items[0];
    const br = await prisma.borrowingRecord.create({
      data: {
        requestId: issuedReq.id,
        requestItemId: reqItem.id,
        campusId: cmp1.id,
        itemId: arduino.id,
        studentId: stu1Cmp1.id,
        issuedByInstructorId: inst1Cmp1.id,
        issuedQuantity: 2,
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });
    for (const p of sampleCollectionPhotos) {
      await prisma.itemPhoto.create({
        data: {
          requestId: issuedReq.id,
          requestItemId: reqItem.id,
          borrowingRecordId: br.id,
          uploadedById: stu1Cmp1.id,
          angle: p.angle,
          phase: "COLLECTION",
          storageKey: p.key,
          url: p.url,
        },
      });
    }
  }

  // Stage E: RETURN_VERIFICATION_PENDING (4 collection + 4 return photos, awaiting Instructor inspection)
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-01-RETP05" } }))) {
    const retReq = await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-01-RETP05",
        campusId: cmp1.id,
        studentId: stu2Cmp1.id,
        instructorId: inst1Cmp1.id,
        purpose: "Power Electronics Lab: Buck Converter Ripple Analysis",
        status: "RETURN_VERIFICATION_PENDING",
        items: {
          create: [
            { itemId: dmm.id, requestedQuantity: 2, approvedQuantity: 2, issuedQuantity: 2 },
          ],
        },
        approvals: {
          create: [
            { stage: "INSTRUCTOR_REVIEW", decision: "APPROVED", approverId: inst1Cmp1.id, comments: "Approved." },
            { stage: "LAB_MANAGER_FINAL", decision: "APPROVED", approverId: lm1Cmp1.id, comments: "Reserved." },
          ],
        },
      },
      include: { items: true },
    });
    const reqItem = retReq.items[0];
    const br = await prisma.borrowingRecord.create({
      data: {
        requestId: retReq.id,
        requestItemId: reqItem.id,
        campusId: cmp1.id,
        itemId: dmm.id,
        studentId: stu2Cmp1.id,
        issuedByInstructorId: inst1Cmp1.id,
        issuedQuantity: 2,
      },
    });
    for (const p of sampleCollectionPhotos) {
      await prisma.itemPhoto.create({
        data: {
          requestId: retReq.id,
          requestItemId: reqItem.id,
          borrowingRecordId: br.id,
          uploadedById: stu2Cmp1.id,
          angle: p.angle,
          phase: "COLLECTION",
          storageKey: p.key,
          url: p.url,
        },
      });
    }
    for (const p of sampleReturnPhotos) {
      await prisma.itemPhoto.create({
        data: {
          requestId: retReq.id,
          requestItemId: reqItem.id,
          borrowingRecordId: br.id,
          uploadedById: stu2Cmp1.id,
          angle: p.angle,
          phase: "RETURN",
          storageKey: p.key,
          url: p.url,
        },
      });
    }
    await prisma.returnVerification.create({
      data: {
        borrowingRecordId: br.id,
        requestItemId: reqItem.id,
        returnedQuantity: 2,
        condition: "GOOD",
        status: "PENDING",
        studentComments: "Both multimeters returned with test leads intact.",
      },
    });
  }

  // Stage F: RETURN_DISPUTED (1 damaged unit reported by instructor)
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-01-DISP06" } }))) {
    const dispReq = await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-01-DISP06",
        campusId: cmp1.id,
        studentId: stu1Cmp1.id,
        instructorId: inst2Cmp1.id,
        purpose: "Edge AI Vision Lab — Raspberry Pi Camera Inference",
        status: "RETURN_DISPUTED",
        items: {
          create: [
            { itemId: rpi.id, requestedQuantity: 1, approvedQuantity: 1, issuedQuantity: 1, damagedQuantity: 1 },
          ],
        },
        approvals: {
          create: [
            { stage: "INSTRUCTOR_REVIEW", decision: "APPROVED", approverId: inst2Cmp1.id },
            { stage: "LAB_MANAGER_FINAL", decision: "APPROVED", approverId: lm1Cmp1.id },
          ],
        },
      },
      include: { items: true },
    });
    const reqItem = dispReq.items[0];
    const br = await prisma.borrowingRecord.create({
      data: {
        requestId: dispReq.id,
        requestItemId: reqItem.id,
        campusId: cmp1.id,
        itemId: rpi.id,
        studentId: stu1Cmp1.id,
        issuedByInstructorId: inst2Cmp1.id,
        issuedQuantity: 1,
        damagedQuantity: 1,
      },
    });
    await prisma.returnVerification.create({
      data: {
        borrowingRecordId: br.id,
        requestItemId: reqItem.id,
        verifiedById: inst2Cmp1.id,
        returnedQuantity: 0,
        damagedQuantity: 1,
        missingQuantity: 0,
        condition: "DAMAGED",
        status: "DISPUTED_DAMAGED",
        studentComments: "Board stopped booting after GPIO short.",
        instructorRemarks: "Visible scorch mark near 5V GPIO pin compared to collection photo.",
        verifiedAt: new Date(),
      },
    });
  }

  // Stage G: CLOSED (clean full return verified on Campus 2)
  if (!(await prisma.labRequest.findUnique({ where: { requestCode: "REQ-2026-CMP-02-CLSD07" } }))) {
    const closedReq = await prisma.labRequest.create({
      data: {
        requestCode: "REQ-2026-CMP-02-CLSD07",
        campusId: cmp2.id,
        studentId: stu1Cmp2.id,
        instructorId: inst1Cmp2.id,
        purpose: "Robotic Arm Inverse Kinematics Verification",
        status: "CLOSED",
        items: {
          create: [
            { itemId: servo.id, requestedQuantity: 2, approvedQuantity: 2, issuedQuantity: 2, returnedQuantity: 2 },
          ],
        },
        approvals: {
          create: [
            { stage: "INSTRUCTOR_REVIEW", decision: "APPROVED", approverId: inst1Cmp2.id },
            { stage: "LAB_MANAGER_FINAL", decision: "APPROVED", approverId: lm1Cmp2.id },
          ],
        },
      },
      include: { items: true },
    });
    const reqItem = closedReq.items[0];
    const br = await prisma.borrowingRecord.create({
      data: {
        requestId: closedReq.id,
        requestItemId: reqItem.id,
        campusId: cmp2.id,
        itemId: servo.id,
        studentId: stu1Cmp2.id,
        issuedByInstructorId: inst1Cmp2.id,
        issuedQuantity: 2,
        returnedQuantity: 2,
        closedAt: new Date(),
      },
    });
    await prisma.returnVerification.create({
      data: {
        borrowingRecordId: br.id,
        requestItemId: reqItem.id,
        verifiedById: inst1Cmp2.id,
        returnedQuantity: 2,
        condition: "GOOD",
        status: "VERIFIED_GOOD",
        instructorRemarks: "Both servo kits verified in spotless condition.",
        verifiedAt: new Date(),
      },
    });
  }
  console.log("✅ Seeded 7 student lab requests across all lifecycle stages");

  // 7. Seed Issue Tickets + Comments
  const ticketSeeds = [
    {
      ticketCode: "TKT-2026-CMP-01-001",
      campusId: cmp1.id,
      createdById: inst1Cmp1.id,
      assignedToId: lm1Cmp1.id,
      itemId: osc.id,
      category: "MALFUNCTIONING_EQUIPMENT" as const,
      priority: "HIGH" as const,
      status: "IN_PROGRESS" as const,
      title: "Oscilloscope Bench #4 Channel 2 probe calibration drift",
      description: "Channel 2 exhibits 15% voltage offset even after auto-calibration. Needs probe replacement.",
      comment: "Replacement 10x passive probes ordered from central store; unit quarantined temporarily.",
    },
    {
      ticketCode: "TKT-2026-CMP-01-002",
      campusId: cmp1.id,
      createdById: inst2Cmp1.id,
      assignedToId: null,
      itemId: rpi.id,
      category: "DAMAGED_EQUIPMENT" as const,
      priority: "CRITICAL" as const,
      status: "OPEN" as const,
      title: "Raspberry Pi 5 GPIO 5V rail burn reported during return inspection",
      description: "Linked to REQ-2026-CMP-01-DISP06. Needs hardware inspection and potential RMA.",
      comment: null,
    },
    {
      ticketCode: "TKT-2026-CMP-02-001",
      campusId: cmp2.id,
      createdById: inst1Cmp2.id,
      assignedToId: lm1Cmp2.id,
      itemId: arduino.id,
      category: "MAINTENANCE_REQUEST" as const,
      priority: "MEDIUM" as const,
      status: "RESOLVED" as const,
      title: "Firmware update needed for Lab B Arduino R4 boards",
      description: "20 Arduino Uno R4 WiFi boards need latest connectivity firmware flashed prior to midterms.",
      comment: "All 20 boards updated to firmware v0.4.1 and verified.",
    },
  ];

  for (const t of ticketSeeds) {
    const exists = await prisma.issueTicket.findUnique({
      where: { ticketCode: t.ticketCode },
    });
    if (!exists) {
      const commentAuthorId: string = t.assignedToId || t.createdById;
      await prisma.issueTicket.create({
        data: {
          ticketCode: t.ticketCode,
          campusId: t.campusId,
          createdById: t.createdById,
          assignedToId: t.assignedToId,
          itemId: t.itemId,
          category: t.category,
          priority: t.priority,
          status: t.status,
          title: t.title,
          description: t.description,
          resolutionNotes: t.status === "RESOLVED" ? t.comment : null,
          resolvedAt: t.status === "RESOLVED" ? new Date() : null,
          ...(t.comment
            ? {
                comments: {
                  create: [
                    {
                      authorId: commentAuthorId,
                      body: t.comment,
                    },
                  ],
                },
              }
            : {}),
        },
      });
    }
  }
  console.log("✅ Seeded operational issue tickets & threaded comments");

  // 8. Seed Sample Inventory Transactions & Audit Logs (idempotent guard)
  const existingTxCount = await prisma.inventoryTransaction.count();
  if (existingTxCount === 0) {
    await prisma.inventoryTransaction.createMany({
      data: [
        {
          campusId: cmp1.id,
          itemId: arduino.id,
          type: "STOCK_ALLOCATED",
          quantity: 50,
          previousQuantity: 0,
          updatedQuantity: 50,
          referenceType: "StockAllocation",
          referenceId: "ALLOC-2026-CMP-01-DISC01",
          performedById: centralManager.id,
          remarks: "Initial central allocation to CMP-01",
        },
        {
          campusId: cmp1.id,
          itemId: arduino.id,
          type: "STOCK_RECEIVED",
          quantity: 48,
          previousQuantity: 0,
          updatedQuantity: 48,
          referenceType: "StockAllocation",
          referenceId: "ALLOC-2026-CMP-01-DISC01",
          performedById: lm1Cmp1.id,
          remarks: "Verified 48 units received physically",
        },
        {
          campusId: cmp1.id,
          itemId: arduino.id,
          type: "MISSING_REPORTED",
          quantity: 2,
          previousQuantity: 0,
          updatedQuantity: 2,
          referenceType: "StockAllocation",
          referenceId: "ALLOC-2026-CMP-01-DISC01",
          performedById: lm1Cmp1.id,
          remarks: "2 units missing from box #3 on delivery",
        },
        {
          campusId: cmp1.id,
          itemId: arduino.id,
          type: "STOCK_RESERVED",
          quantity: 2,
          previousQuantity: 40,
          updatedQuantity: 38,
          referenceType: "LabRequest",
          referenceId: "REQ-2026-CMP-01-APPR03",
          performedById: lm1Cmp1.id,
          remarks: "Reserved for approved student request",
        },
        {
          campusId: cmp1.id,
          itemId: rpi.id,
          type: "ITEM_MARKED_DAMAGED",
          quantity: 1,
          previousQuantity: 0,
          updatedQuantity: 1,
          referenceType: "LabRequest",
          referenceId: "REQ-2026-CMP-01-DISP06",
          performedById: inst2Cmp1.id,
          remarks: "GPIO 5V rail scorch identified during return verification",
        },
      ],
    });
  }

  const existingAuditCount = await prisma.auditLog.count();
  if (existingAuditCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          actorId: centralManager.id,
          actorRole: "CENTRAL_LAB_MANAGER",
          campusId: cmp1.id,
          action: "ALLOCATION_CREATED",
          entityType: "StockAllocation",
          entityId: "ALLOC-2026-CMP-01-DISC01",
          newState: { status: "DISPATCHED", campus: "CMP-01" },
        },
        {
          actorId: lm1Cmp1.id,
          actorRole: "LAB_MANAGER",
          campusId: cmp1.id,
          action: "ALLOCATION_VERIFIED",
          entityType: "StockAllocation",
          entityId: "ALLOC-2026-CMP-01-DISC01",
          newState: { status: "DISCREPANCY_REPORTED", received: 48, missing: 2 },
        },
        {
          actorId: lm1Cmp1.id,
          actorRole: "LAB_MANAGER",
          campusId: cmp1.id,
          action: "INVENTORY_VISIBILITY_CHANGED",
          entityType: "CampusInventory",
          entityId: thermal.id,
          previousState: { isVisible: true },
          newState: { isVisible: false },
          metadata: { reason: "Reserved for faculty calibration only" },
        },
        {
          actorId: inst2Cmp1.id,
          actorRole: "INSTRUCTOR",
          campusId: cmp1.id,
          action: "RETURN_VERIFIED",
          entityType: "LabRequest",
          entityId: "REQ-2026-CMP-01-DISP06",
          newState: { status: "RETURN_DISPUTED", damagedQuantity: 1 },
        },
      ],
    });
  }

  console.log("🎉 CampusLab database seed complete!");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
