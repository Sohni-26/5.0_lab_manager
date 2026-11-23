import { z } from "zod";

// ============================================================================
// Shared Enum Schemas
// ============================================================================

export const userRoleSchema = z.enum([
  "CENTRAL_LAB_MANAGER",
  "LAB_MANAGER",
  "INSTRUCTOR",
  "STUDENT",
]);

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);

export const campusStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const allocationStatusSchema = z.enum([
  "DRAFT",
  "DISPATCHED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "DISCREPANCY_REPORTED",
  "CANCELLED",
]);

export const approvalDecisionSchema = z.enum(["APPROVED", "REJECTED"]);

export const photoAngleSchema = z.enum([
  "FRONT_TOP",
  "BACK_BOTTOM",
  "LEFT_SIDE",
  "RIGHT_SIDE",
]);

export const returnConditionSchema = z.enum([
  "GOOD",
  "DAMAGED",
  "MISSING",
  "PARTIAL",
]);

export const issueCategorySchema = z.enum([
  "DAMAGED_EQUIPMENT",
  "MISSING_EQUIPMENT",
  "MALFUNCTIONING_EQUIPMENT",
  "INVENTORY_DISCREPANCY",
  "INCORRECT_ALLOCATION",
  "MAINTENANCE_REQUEST",
]);

export const ticketPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

export const ticketStatusSchema = z.enum([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
]);

// ============================================================================
// Auth Schemas
// ============================================================================

export const mockLoginSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().min(1).optional(),
    password: z.string().optional(), // Ignored in mock dev mode for login form compatibility
  })
  .refine((data) => Boolean(data.email || data.userId), {
    message: "Either email or userId is required",
  });

// ============================================================================
// Campus Schemas
// ============================================================================

export const createCampusSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  status: campusStatusSchema.optional().default("ACTIVE"),
});

export const updateCampusSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(24)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(2).max(160).optional(),
    city: z.string().trim().max(100).optional().nullable(),
    state: z.string().trim().max(100).optional().nullable(),
    address: z.string().trim().max(300).optional().nullable(),
    status: campusStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// ============================================================================
// User Schemas
// ============================================================================

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  institutionalId: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .transform((v) => v.toUpperCase()),
  role: userRoleSchema,
  campusId: z.string().min(1).optional().nullable(),
  status: userStatusSchema.optional().default("ACTIVE"),
});

export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150).optional(),
    email: z
      .string()
      .trim()
      .email()
      .transform((v) => v.toLowerCase())
      .optional(),
    institutionalId: z
      .string()
      .trim()
      .min(2)
      .max(64)
      .transform((v) => v.toUpperCase())
      .optional(),
    role: userRoleSchema.optional(),
    campusId: z.string().min(1).optional().nullable(),
    status: userStatusSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// ============================================================================
// Category & Master Item Schemas
// ============================================================================

export const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  description: z.string().trim().max(300).optional().nullable(),
});

export const createItemSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  categoryId: z.string().min(1),
  brand: z.string().trim().max(100).optional().nullable(),
  specifications: z.record(z.unknown()).optional().nullable(),
  unit: z.string().trim().min(1).max(32).optional().default("pcs"),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateItemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((v) => v.toUpperCase())
      .optional(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(1000).optional().nullable(),
    categoryId: z.string().min(1).optional(),
    brand: z.string().trim().max(100).optional().nullable(),
    specifications: z.record(z.unknown()).optional().nullable(),
    unit: z.string().trim().min(1).max(32).optional(),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// ============================================================================
// Campus Inventory Schemas
// ============================================================================

export const toggleVisibilitySchema = z.object({
  isVisible: z.boolean(),
});

export const bulkVisibilitySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one inventory ID is required"),
  isVisible: z.boolean(),
});

export const adjustInventorySchema = z.object({
  field: z.enum(["availableQuantity", "damagedQuantity", "missingQuantity"]),
  delta: z
    .number()
    .int("Delta must be an integer")
    .refine((v) => v !== 0, "Delta cannot be zero"),
  remarks: z
    .string()
    .trim()
    .min(3, "Mandatory remarks (at least 3 characters) are required for inventory adjustments")
    .max(500),
});

// ============================================================================
// Stock Allocation Schemas
// ============================================================================

export const createAllocationSchema = z.object({
  destinationCampusId: z.string().min(1),
  source: z.string().trim().min(2).max(150).optional().default("Central Warehouse"),
  notes: z.string().trim().max(1000).optional().nullable(),
  dispatchImmediately: z.boolean().optional().default(false),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        allocatedQuantity: z.number().int().positive("Allocated quantity must be greater than 0"),
      })
    )
    .min(1, "At least one item must be included in an allocation"),
});

export const updateAllocationStatusSchema = z.object({
  status: z.enum(["DISPATCHED", "CANCELLED"]),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const verifyAllocationItemSchema = z
  .object({
    allocationItemId: z.string().min(1).optional(),
    itemId: z.string().min(1).optional(),
    receivedQuantity: z.number().int().min(0),
    missingQuantity: z.number().int().min(0).default(0),
    damagedQuantity: z.number().int().min(0).default(0),
    verificationNotes: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => Boolean(d.allocationItemId || d.itemId), {
    message: "Either allocationItemId or itemId must be provided",
  });

export const verifyAllocationSchema = z.object({
  items: z
    .array(verifyAllocationItemSchema)
    .min(1, "At least one item verification entry is required"),
  notes: z.string().trim().max(1000).optional().nullable(),
});

// ============================================================================
// Lab Request, Borrowing & Return Schemas
// ============================================================================

export const createLabRequestSchema = z.object({
  instructorId: z.string().min(1),
  purpose: z.string().trim().min(5, "Purpose must be at least 5 characters").max(1000),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        requestedQuantity: z
          .number()
          .int()
          .positive("Requested quantity must be greater than 0"),
      })
    )
    .min(1, "At least one item must be requested"),
});

export const approvalActionSchema = z.object({
  decision: approvalDecisionSchema,
  comments: z.string().trim().max(1000).optional().nullable(),
});

export const uploadRequestPhotoJsonSchema = z
  .object({
    requestItemId: z.string().min(1),
    angle: photoAngleSchema,
    storageKey: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    dataUrl: z.string().min(1).optional(),
    filename: z.string().optional(),
  })
  .refine((d) => Boolean((d.storageKey && d.url) || d.dataUrl || d.url), {
    message: "Provide either (storageKey & url), url, or base64 dataUrl",
  });

export const confirmCollectionSchema = z.object({
  items: z
    .array(
      z.object({
        requestItemId: z.string().min(1),
        issuedQuantity: z.number().int().positive(),
      })
    )
    .optional(),
  dueAt: z.string().datetime().optional().nullable(),
});

export const submitReturnItemSchema = z
  .object({
    requestItemId: z.string().min(1).optional(),
    borrowingRecordId: z.string().min(1).optional(),
    returnedQuantity: z.number().int().positive(),
    studentComments: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((d) => Boolean(d.requestItemId || d.borrowingRecordId), {
    message: "Either requestItemId or borrowingRecordId must be provided",
  });

export const submitReturnSchema = z.object({
  items: z
    .array(submitReturnItemSchema)
    .min(1, "At least one returned item must be submitted"),
});

export const verifyReturnItemSchema = z
  .object({
    returnVerificationId: z.string().min(1).optional(),
    borrowingRecordId: z.string().min(1).optional(),
    requestItemId: z.string().min(1).optional(),
    condition: returnConditionSchema,
    returnedQuantity: z.number().int().min(0),
    damagedQuantity: z.number().int().min(0).optional().default(0),
    missingQuantity: z.number().int().min(0).optional().default(0),
    instructorRemarks: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (d) =>
      Boolean(d.returnVerificationId || d.borrowingRecordId || d.requestItemId),
    {
      message:
        "One of returnVerificationId, borrowingRecordId, or requestItemId is required",
    }
  );

export const verifyReturnSchema = z.object({
  items: z
    .array(verifyReturnItemSchema)
    .min(1, "At least one return verification entry is required"),
});

// ============================================================================
// Issue Ticket Schemas
// ============================================================================

export const createTicketSchema = z.object({
  category: issueCategorySchema,
  priority: ticketPrioritySchema.optional().default("MEDIUM"),
  title: z.string().trim().min(4).max(200),
  description: z.string().trim().min(5).max(3000),
  itemId: z.string().min(1).optional().nullable(),
  attachmentUrls: z.array(z.string().min(1)).max(10).optional().default([]),
});

export const updateTicketSchema = z
  .object({
    status: ticketStatusSchema.optional(),
    assignedToId: z.string().min(1).optional().nullable(),
    priority: ticketPrioritySchema.optional(),
    resolutionNotes: z.string().trim().max(3000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const createTicketCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  attachmentUrls: z.array(z.string().min(1)).max(10).optional().default([]),
});
