-- ============================================================================
-- CampusLab Multi-Campus Lab Management System — Initial PostgreSQL Migration
-- Includes all 17 tables, enums, indexes, foreign keys, and DB-level invariants
-- ============================================================================

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CENTRAL_LAB_MANAGER', 'LAB_MANAGER', 'INSTRUCTOR', 'STUDENT');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "CampusStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AllocationStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'DISCREPANCY_REPORTED', 'CANCELLED');
CREATE TYPE "InventoryTransactionType" AS ENUM (
  'STOCK_ALLOCATED',
  'STOCK_DISPATCHED',
  'STOCK_RECEIVED',
  'MISSING_REPORTED',
  'DAMAGED_REPORTED',
  'STOCK_RESERVED',
  'RESERVATION_RELEASED',
  'ITEM_ISSUED',
  'ITEM_RETURNED',
  'ITEM_MARKED_DAMAGED',
  'ITEM_MARKED_MISSING',
  'INVENTORY_ADJUSTMENT'
);
CREATE TYPE "LabRequestStatus" AS ENUM (
  'PENDING_INSTRUCTOR',
  'REJECTED_BY_INSTRUCTOR',
  'PENDING_LAB_MANAGER',
  'REJECTED_BY_LAB_MANAGER',
  'APPROVED',
  'PARTIALLY_ISSUED',
  'ISSUED',
  'RETURN_PENDING',
  'RETURN_SUBMITTED',
  'RETURN_VERIFICATION_PENDING',
  'RETURN_DISPUTED',
  'PARTIALLY_RETURNED',
  'CLOSED',
  'CANCELLED'
);
CREATE TYPE "ApprovalStage" AS ENUM ('INSTRUCTOR_REVIEW', 'LAB_MANAGER_FINAL');
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "PhotoAngle" AS ENUM ('FRONT_TOP', 'BACK_BOTTOM', 'LEFT_SIDE', 'RIGHT_SIDE');
CREATE TYPE "PhotoPhase" AS ENUM ('COLLECTION', 'RETURN');
CREATE TYPE "ReturnCondition" AS ENUM ('GOOD', 'DAMAGED', 'MISSING', 'PARTIAL');
CREATE TYPE "ReturnVerificationStatus" AS ENUM ('PENDING', 'VERIFIED_GOOD', 'DISPUTED_DAMAGED', 'DISPUTED_MISSING', 'RESOLVED');
CREATE TYPE "IssueCategory" AS ENUM (
  'DAMAGED_EQUIPMENT',
  'MISSING_EQUIPMENT',
  'MALFUNCTIONING_EQUIPMENT',
  'INVENTORY_DISCREPANCY',
  'INCORRECT_ALLOCATION',
  'MAINTENANCE_REQUEST'
);
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');

-- 1. campuses
CREATE TABLE "campuses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "address" TEXT,
    "status" "CampusStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- 2. users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "institutionalId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "campusId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- 3. item_categories
CREATE TABLE "item_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_categories_pkey" PRIMARY KEY ("id")
);

-- 4. items
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT,
    "specifications" JSONB,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- 5. campus_inventories
CREATE TABLE "campus_inventories" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "allocatedQuantity" INTEGER NOT NULL DEFAULT 0,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "borrowedQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "missingQuantity" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_inventories_pkey" PRIMARY KEY ("id")
);

-- 6. stock_allocations
CREATE TABLE "stock_allocations" (
    "id" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Central Warehouse',
    "destinationCampusId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_allocations_pkey" PRIMARY KEY ("id")
);

-- 7. stock_allocation_items
CREATE TABLE "stock_allocation_items" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "allocatedQuantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "missingQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "stock_allocation_items_pkey" PRIMARY KEY ("id")
);

-- 8. inventory_transactions
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previousQuantity" INTEGER NOT NULL,
    "updatedQuantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "performedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- 9. lab_requests
CREATE TABLE "lab_requests" (
    "id" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "LabRequestStatus" NOT NULL DEFAULT 'PENDING_INSTRUCTOR',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_requests_pkey" PRIMARY KEY ("id")
);

-- 10. lab_request_items
CREATE TABLE "lab_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQuantity" INTEGER NOT NULL,
    "approvedQuantity" INTEGER NOT NULL DEFAULT 0,
    "issuedQuantity" INTEGER NOT NULL DEFAULT 0,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "missingQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lab_request_items_pkey" PRIMARY KEY ("id")
);

-- 11. request_approvals
CREATE TABLE "request_approvals" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stage" "ApprovalStage" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "approverId" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_approvals_pkey" PRIMARY KEY ("id")
);

-- 12. borrowing_records
CREATE TABLE "borrowing_records" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestItemId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "issuedByInstructorId" TEXT NOT NULL,
    "issuedQuantity" INTEGER NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "missingQuantity" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "borrowing_records_pkey" PRIMARY KEY ("id")
);

-- 13. item_photos
CREATE TABLE "item_photos" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "requestItemId" TEXT NOT NULL,
    "borrowingRecordId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "angle" "PhotoAngle" NOT NULL,
    "phase" "PhotoPhase" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_photos_pkey" PRIMARY KEY ("id")
);

-- 14. return_verifications
CREATE TABLE "return_verifications" (
    "id" TEXT NOT NULL,
    "borrowingRecordId" TEXT NOT NULL,
    "requestItemId" TEXT NOT NULL,
    "verifiedById" TEXT,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "damagedQuantity" INTEGER NOT NULL DEFAULT 0,
    "missingQuantity" INTEGER NOT NULL DEFAULT 0,
    "condition" "ReturnCondition" NOT NULL DEFAULT 'GOOD',
    "status" "ReturnVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "studentComments" TEXT,
    "instructorRemarks" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "return_verifications_pkey" PRIMARY KEY ("id")
);

-- 15. issue_tickets
CREATE TABLE "issue_tickets" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "itemId" TEXT,
    "category" "IssueCategory" NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "issue_tickets_pkey" PRIMARY KEY ("id")
);

-- 16. ticket_comments
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- 17. audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "campusId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Unique Constraints & Performance Indexes
-- ============================================================================

CREATE UNIQUE INDEX "campuses_code_key" ON "campuses"("code");
CREATE INDEX "campuses_status_idx" ON "campuses"("status");

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_institutionalId_key" ON "users"("institutionalId");
CREATE INDEX "users_campusId_role_idx" ON "users"("campusId", "role");
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

CREATE UNIQUE INDEX "item_categories_name_key" ON "item_categories"("name");
CREATE UNIQUE INDEX "item_categories_slug_key" ON "item_categories"("slug");

CREATE UNIQUE INDEX "items_code_key" ON "items"("code");
CREATE INDEX "items_categoryId_idx" ON "items"("categoryId");
CREATE INDEX "items_isActive_idx" ON "items"("isActive");

CREATE UNIQUE INDEX "campus_inventories_campusId_itemId_key" ON "campus_inventories"("campusId", "itemId");
CREATE INDEX "campus_inventories_campusId_isVerified_isVisible_idx" ON "campus_inventories"("campusId", "isVerified", "isVisible");
CREATE INDEX "campus_inventories_itemId_idx" ON "campus_inventories"("itemId");

CREATE UNIQUE INDEX "stock_allocations_referenceCode_key" ON "stock_allocations"("referenceCode");
CREATE INDEX "stock_allocations_destinationCampusId_status_idx" ON "stock_allocations"("destinationCampusId", "status");
CREATE INDEX "stock_allocations_status_idx" ON "stock_allocations"("status");

CREATE UNIQUE INDEX "stock_allocation_items_allocationId_itemId_key" ON "stock_allocation_items"("allocationId", "itemId");
CREATE INDEX "stock_allocation_items_itemId_idx" ON "stock_allocation_items"("itemId");

CREATE INDEX "inventory_transactions_campusId_createdAt_idx" ON "inventory_transactions"("campusId", "createdAt" DESC);
CREATE INDEX "inventory_transactions_campusId_itemId_idx" ON "inventory_transactions"("campusId", "itemId");
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions"("type");

CREATE UNIQUE INDEX "lab_requests_requestCode_key" ON "lab_requests"("requestCode");
CREATE INDEX "lab_requests_campusId_status_idx" ON "lab_requests"("campusId", "status");
CREATE INDEX "lab_requests_studentId_status_idx" ON "lab_requests"("studentId", "status");
CREATE INDEX "lab_requests_instructorId_status_idx" ON "lab_requests"("instructorId", "status");

CREATE UNIQUE INDEX "lab_request_items_requestId_itemId_key" ON "lab_request_items"("requestId", "itemId");
CREATE INDEX "lab_request_items_itemId_idx" ON "lab_request_items"("itemId");

CREATE UNIQUE INDEX "request_approvals_requestId_stage_key" ON "request_approvals"("requestId", "stage");
CREATE INDEX "request_approvals_approverId_idx" ON "request_approvals"("approverId");

CREATE INDEX "borrowing_records_campusId_studentId_idx" ON "borrowing_records"("campusId", "studentId");
CREATE INDEX "borrowing_records_requestId_idx" ON "borrowing_records"("requestId");
CREATE INDEX "borrowing_records_requestItemId_idx" ON "borrowing_records"("requestItemId");

CREATE UNIQUE INDEX "item_photos_requestItemId_phase_angle_key" ON "item_photos"("requestItemId", "phase", "angle");
CREATE INDEX "item_photos_requestId_phase_idx" ON "item_photos"("requestId", "phase");
CREATE INDEX "item_photos_borrowingRecordId_idx" ON "item_photos"("borrowingRecordId");

CREATE INDEX "return_verifications_borrowingRecordId_status_idx" ON "return_verifications"("borrowingRecordId", "status");
CREATE INDEX "return_verifications_requestItemId_idx" ON "return_verifications"("requestItemId");

CREATE UNIQUE INDEX "issue_tickets_ticketCode_key" ON "issue_tickets"("ticketCode");
CREATE INDEX "issue_tickets_campusId_status_idx" ON "issue_tickets"("campusId", "status");
CREATE INDEX "issue_tickets_createdById_idx" ON "issue_tickets"("createdById");
CREATE INDEX "issue_tickets_assignedToId_idx" ON "issue_tickets"("assignedToId");

CREATE INDEX "ticket_comments_ticketId_createdAt_idx" ON "ticket_comments"("ticketId", "createdAt");

CREATE INDEX "audit_logs_campusId_createdAt_idx" ON "audit_logs"("campusId", "createdAt" DESC);
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- ============================================================================
-- Foreign Keys
-- ============================================================================

ALTER TABLE "users" ADD CONSTRAINT "users_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "items" ADD CONSTRAINT "items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campus_inventories" ADD CONSTRAINT "campus_inventories_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "campus_inventories" ADD CONSTRAINT "campus_inventories_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_destinationCampusId_fkey" FOREIGN KEY ("destinationCampusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_allocations" ADD CONSTRAINT "stock_allocations_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_allocation_items" ADD CONSTRAINT "stock_allocation_items_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "stock_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_allocation_items" ADD CONSTRAINT "stock_allocation_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_requests" ADD CONSTRAINT "lab_requests_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_request_items" ADD CONSTRAINT "lab_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_request_items" ADD CONSTRAINT "lab_request_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "request_approvals" ADD CONSTRAINT "request_approvals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "lab_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_issuedByInstructorId_fkey" FOREIGN KEY ("issuedByInstructorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "lab_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "lab_request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_borrowingRecordId_fkey" FOREIGN KEY ("borrowingRecordId") REFERENCES "borrowing_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "item_photos" ADD CONSTRAINT "item_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_verifications" ADD CONSTRAINT "return_verifications_borrowingRecordId_fkey" FOREIGN KEY ("borrowingRecordId") REFERENCES "borrowing_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_verifications" ADD CONSTRAINT "return_verifications_requestItemId_fkey" FOREIGN KEY ("requestItemId") REFERENCES "lab_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_verifications" ADD CONSTRAINT "return_verifications_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "issue_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Strict PostgreSQL Data Integrity Constraints
-- ============================================================================

-- 1. Guarantee at most ONE CENTRAL_LAB_MANAGER across the entire database
CREATE UNIQUE INDEX "users_single_central_lab_manager_idx"
  ON "users" ("role")
  WHERE "role" = 'CENTRAL_LAB_MANAGER';

-- 2. Guarantee CENTRAL_LAB_MANAGER has NULL campusId and all other roles have NOT NULL campusId
ALTER TABLE "users"
  ADD CONSTRAINT "users_role_campus_check"
  CHECK (
    ("role" = 'CENTRAL_LAB_MANAGER' AND "campusId" IS NULL)
    OR ("role" <> 'CENTRAL_LAB_MANAGER' AND "campusId" IS NOT NULL)
  );

-- 3. Guarantee non-negative stock quantities across campus_inventories
ALTER TABLE "campus_inventories"
  ADD CONSTRAINT "campus_inventories_non_negative_check"
  CHECK (
    "allocatedQuantity" >= 0
    AND "receivedQuantity" >= 0
    AND "availableQuantity" >= 0
    AND "reservedQuantity" >= 0
    AND "borrowedQuantity" >= 0
    AND "damagedQuantity" >= 0
    AND "missingQuantity" >= 0
  );

-- 4. Guarantee non-negative quantities on stock_allocation_items
ALTER TABLE "stock_allocation_items"
  ADD CONSTRAINT "stock_allocation_items_non_negative_check"
  CHECK (
    "allocatedQuantity" > 0
    AND "receivedQuantity" >= 0
    AND "missingQuantity" >= 0
    AND "damagedQuantity" >= 0
  );

-- 5. Guarantee non-negative quantities on lab_request_items
ALTER TABLE "lab_request_items"
  ADD CONSTRAINT "lab_request_items_non_negative_check"
  CHECK (
    "requestedQuantity" > 0
    AND "approvedQuantity" >= 0
    AND "issuedQuantity" >= 0
    AND "returnedQuantity" >= 0
    AND "damagedQuantity" >= 0
    AND "missingQuantity" >= 0
  );
