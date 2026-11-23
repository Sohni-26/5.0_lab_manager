# CampusLab — Multi-Campus Lab Management System Architecture & Contract

This document defines the complete backend design and serves as the shared contract between the **Backend Architect** and **UI Engineer** agents.

---

## 1. Entity Relationship Design (17 Core Entities)

1. **Campus** (`campuses`) — Supports 40+ campuses (`id`, unique `code` e.g. `CMP-01`..`CMP-40`, `name`, `city`, `state`, `address`, `status`).
2. **User** (`users`) — Unique `email`, unique `institutionalId`, `role` (`CENTRAL_LAB_MANAGER | LAB_MANAGER | INSTRUCTOR | STUDENT`), `campusId` (nullable ONLY for `CENTRAL_LAB_MANAGER`; mandatory for all campus roles enforced via DB check constraint + partial unique index ensuring **at most ONE `CENTRAL_LAB_MANAGER` globally**).
3. **ItemCategory** (`item_categories`) — Unique `name`, unique `slug`, `description`.
4. **Item** (`items`) — Global master inventory owned by Central Lab Manager (`code` unique, `name`, `categoryId`, `brand`, `specifications` JSONB, `unit`, `imageUrl`, `isActive` soft-deactivation).
5. **CampusInventory** (`campus_inventories`) — Composite unique `(campusId, itemId)`. Tracks `allocatedQuantity`, `receivedQuantity`, `availableQuantity`, `reservedQuantity`, `borrowedQuantity`, `damagedQuantity`, `missingQuantity`, `isVisible`, `isVerified`, `lastVerifiedAt`. DB CHECK constraints guarantee all quantities `>= 0`.
6. **StockAllocation** (`stock_allocations`) — Central-to-campus dispatch (`referenceCode` unique, `source`, `destinationCampusId`, `createdById`, `status`, `dispatchedAt`, `verifiedAt`, `verifiedById`, `notes`).
7. **StockAllocationItem** (`stock_allocation_items`) — Composite unique `(allocationId, itemId)`. Tracks `allocatedQuantity`, `receivedQuantity`, `missingQuantity`, `damagedQuantity`, `isVerified`, `verificationNotes`.
8. **InventoryTransaction** (`inventory_transactions`) — Immutable append-only ledger (`campusId`, `itemId`, `type`, `quantity`, `previousQuantity`, `updatedQuantity`, `referenceType`, `referenceId`, `performedById`, `remarks`, `createdAt`). Every stock mutation MUST write a transaction inside the same Prisma DB transaction.
9. **LabRequest** (`lab_requests`) — Student borrowing request (`requestCode` unique, `campusId`, `studentId`, `instructorId`, `purpose`, `status`, `rejectionReason`).
10. **LabRequestItem** (`lab_request_items`) — Composite unique `(requestId, itemId)`. Tracks `requestedQuantity`, `approvedQuantity`, `issuedQuantity`, `returnedQuantity`, `damagedQuantity`, `missingQuantity`.
11. **RequestApproval** (`request_approvals`) — Composite unique `(requestId, stage)` to prevent duplicate approval processing (`INSTRUCTOR_REVIEW`, `LAB_MANAGER_FINAL`).
12. **BorrowingRecord** (`borrowing_records`) — Created on collection confirmation per request item (`requestId`, `requestItemId`, `campusId`, `itemId`, `studentId`, `issuedByInstructorId`, `issuedQuantity`, `returnedQuantity`, `damagedQuantity`, `missingQuantity`, `issuedAt`, `dueAt`, `closedAt`).
13. **ItemPhoto** (`item_photos`) — Stores mandatory 4-angle (`FRONT_TOP`, `BACK_BOTTOM`, `LEFT_SIDE`, `RIGHT_SIDE`) evidence for `COLLECTION` and `RETURN` phases, linked to `requestId`, `requestItemId`, and `borrowingRecordId`. Original `COLLECTION` photos are immutable.
14. **ReturnVerification** (`return_verifications`) — Records student return submission and Instructor's physical verification (`GOOD | DAMAGED | MISSING | PARTIAL`, quantities, comments, remarks, `status`).
15. **IssueTicket** (`issue_tickets`) — Instructor-to-Lab-Manager operational/equipment tickets (`ticketCode` unique, `campusId`, `createdById`, `assignedToId`, `itemId`, `category`, `priority`, `status`, `title`, `description`, `attachmentUrls`, `resolutionNotes`, `resolvedAt`).
16. **TicketComment** (`ticket_comments`) — Threaded comments on tickets (`ticketId`, `authorId`, `body`, `attachmentUrls`).
17. **AuditLog** (`audit_logs`) — Immutable system-wide audit trail (`actorId`, `actorRole`, `campusId`, `action`, `entityType`, `entityId`, `previousState` JSONB, `newState` JSONB, `metadata` JSONB, `createdAt`).

### PostgreSQL Database-Level Constraints (in Migration SQL)
- **Single Central Lab Manager**:
  `CREATE UNIQUE INDEX "users_single_central_lab_manager_idx" ON "users" ("role") WHERE "role" = 'CENTRAL_LAB_MANAGER';`
- **Role-Campus Assignment Integrity**:
  `ALTER TABLE "users" ADD CONSTRAINT "users_role_campus_check" CHECK ((role = 'CENTRAL_LAB_MANAGER' AND "campusId" IS NULL) OR (role <> 'CENTRAL_LAB_MANAGER' AND "campusId" IS NOT NULL));`
- **Non-Negative Stock Quantities**:
  `ALTER TABLE "campus_inventories" ADD CONSTRAINT "campus_inventories_non_negative_check" CHECK ("allocatedQuantity" >= 0 AND "receivedQuantity" >= 0 AND "availableQuantity" >= 0 AND "reservedQuantity" >= 0 AND "borrowedQuantity" >= 0 AND "damagedQuantity" >= 0 AND "missingQuantity" >= 0);`

---

## 2. Role-Permission Matrix

| Resource / Action | Central Lab Manager | Lab Manager | Instructor | Student |
|---|---|---|---|---|
| Campuses CRUD | Global | Read own | Read own | Read own |
| Users CRUD & Roles | Global (single CLM enforced) | Read own campus | Read own campus instructors/students | Read own campus instructors |
| Master Items & Categories CRUD | Global | Read | Read | Read |
| Campus Inventory Read | Global (all/filtered) | Own campus (all) | Own campus (verified + visible ONLY) | Own campus (verified + visible ONLY) |
| Campus Inventory Visibility / Adjustment | Read / Global monitor | Own campus ONLY | Denied | Denied |
| Allocations Create & Dispatch | Global | Denied | Denied | Denied |
| Allocations Verify Incoming Stock | Read global | Own campus ONLY | Denied | Denied |
| Student Request Create | Denied | Denied | Denied | Own campus + campus Instructor |
| Student Request Instructor Review | Read global | Read own campus | Assigned requests ONLY | Read own |
| Student Request Lab Manager Final Approval | Read global | Own campus ONLY | Denied | Denied |
| Collection Photos Upload (4 angles) | Read global | Read own campus | Read assigned | Own approved request ONLY |
| Confirm Collection (Issue Items) | Read global | Read own campus | Assigned request ONLY (after 4 photos/item) | Denied |
| Return Photos Upload (4 angles) & Submit Return | Read global | Read own campus | Read assigned | Own issued request ONLY |
| Verify Return Condition (Good/Damaged/Missing) | Read global | Read own campus | Assigned request ONLY | Denied |
| Issue Tickets Create | Denied | Denied | Own campus ONLY | Denied |
| Issue Tickets Manage / Resolve | Read global | Own campus ONLY | Own tickets + comments | Denied |
| Audit Logs Read | Global | Own campus (read-only) | Denied | Denied |
| Realtime Event Stream (`/api/events`) | Global stream | Own campus ONLY | Own campus ONLY | Own campus / own requests |

---

## 3. Request Lifecycle State Machine

```
[Student Submits Request]
        │
        ▼
PENDING_INSTRUCTOR ──(Instructor Rejects)──► REJECTED_BY_INSTRUCTOR
        │
   (Instructor Approves)
        ▼
PENDING_LAB_MANAGER ──(Lab Manager Rejects)──► REJECTED_BY_LAB_MANAGER
        │
   (Lab Manager Approves — ATOMIC stock reservation: available -= qty, reserved += qty)
        ▼
    APPROVED
        │
   (Student uploads 4 mandatory collection photos per item + Instructor confirms collection)
   (ATOMIC stock transfer: reserved -= qty, borrowed += qty; BorrowingRecord created)
        ▼
  ISSUED / PARTIALLY_ISSUED
        │
   (Student uploads 4 mandatory return photos per returned item + submits return)
        ▼
 RETURN_VERIFICATION_PENDING
        │
   (Instructor physically inspects items & compares collection vs return photos)
        ├──► All items GOOD & returned qty == issued qty ──► CLOSED (borrowed -= qty, available += qty)
        ├──► Partial qty returned in GOOD condition      ──► PARTIALLY_RETURNED (borrowed -= qty, available += qty)
        ├──► Item DAMAGED                                ──► RETURN_DISPUTED (borrowed -= dmg, damaged += dmg; stays unresolved)
        └──► Item MISSING                                ──► RETURN_DISPUTED (borrowed -= miss, missing += miss; stays unresolved)
```

---

## 4. Inventory Transaction Matrix

| Trigger Event | Transaction Type | Stock Field Deltas |
|---|---|---|
| Allocation created | `STOCK_ALLOCATED` | `allocatedQuantity += qty` |
| Allocation dispatched | `STOCK_DISPATCHED` | audit/tracking (qty unchanged) |
| Allocation verified (received) | `STOCK_RECEIVED` | `receivedQuantity += recv`, `availableQuantity += recv`, `isVerified = true` |
| Allocation verified (missing) | `MISSING_REPORTED` | `missingQuantity += miss` |
| Allocation verified (damaged) | `DAMAGED_REPORTED` | `damagedQuantity += dmg` |
| Lab Manager approves request | `STOCK_RESERVED` | `availableQuantity -= qty`, `reservedQuantity += qty` |
| Approved request cancelled | `RESERVATION_RELEASED` | `reservedQuantity -= qty`, `availableQuantity += qty` |
| Instructor confirms collection | `ITEM_ISSUED` | `reservedQuantity -= qty`, `borrowedQuantity += qty` |
| Instructor verifies GOOD return | `ITEM_RETURNED` | `borrowedQuantity -= qty`, `availableQuantity += qty` |
| Instructor reports DAMAGED return | `ITEM_MARKED_DAMAGED` | `borrowedQuantity -= qty`, `damagedQuantity += qty` |
| Instructor reports MISSING return | `ITEM_MARKED_MISSING` | `borrowedQuantity -= qty`, `missingQuantity += qty` |
| Lab Manager authorised adjustment | `INVENTORY_ADJUSTMENT` | delta applied with non-negative guard |

---

## 5. API Endpoint Specification

All endpoints return `ApiSuccess<T>` (`{ success: true, data, meta? }`) or `ApiErrorResponse` (`{ success: false, error: { code, message, details? } }`).

### Authentication
- `GET  /api/auth/mock-users` — Dev-only list of seeded mock users for role switcher (403 in production unless `ENABLE_MOCK_AUTH=true`).
- `POST /api/auth/mock-login` — Dev-only login by `{ email }` or `{ userId }`, sets HTTP-only signed session cookie.
- `POST /api/auth/logout` — Clears session cookie.
- `GET  /api/auth/me` — Returns authenticated `AuthUserDTO` from server-side session.

### Dashboard & Realtime
- `GET  /api/dashboard` — Role-scoped dashboard analytics payload (`CentralDashboardDTO | LabManagerDashboardDTO | InstructorDashboardDTO | StudentDashboardDTO`). Supports `?campusId=` for Central Lab Manager.
- `GET  /api/events` — Server-Sent Events (SSE) live stream scoped by authenticated user's role & campus.

### Campuses
- `GET    /api/campuses` — Paginated list with search, status filter, and per-campus stats.
- `POST   /api/campuses` — Create campus (Central Lab Manager).
- `GET    /api/campuses/:id` — Campus detail + stats.
- `PATCH  /api/campuses/:id` — Update campus / activate / deactivate (Central Lab Manager).
- `DELETE /api/campuses/:id` — Soft-deactivate campus (Central Lab Manager).

### Users
- `GET    /api/users` — Paginated list filtered by role, campusId, status, search (scoped by role).
- `POST   /api/users` — Create user (Central Lab Manager; enforces unique email, institutionalId, single Central Lab Manager).
- `GET    /api/users/:id` — User detail.
- `PATCH  /api/users/:id` — Update user role/campus/status (Central Lab Manager).
- `DELETE /api/users/:id` — Soft-deactivate user (Central Lab Manager).

### Master Inventory & Categories
- `GET    /api/categories` — List item categories.
- `POST   /api/categories` — Create category (Central Lab Manager).
- `GET    /api/items` — Paginated master items with search, categoryId, isActive, allocation summary.
- `POST   /api/items` — Create master item (Central Lab Manager).
- `GET    /api/items/:id` — Master item detail + campus breakdown.
- `PATCH  /api/items/:id` — Update master item (Central Lab Manager).
- `DELETE /api/items/:id` — Deactivate master item (Central Lab Manager; preserves historical records).

### Campus Inventory
- `GET   /api/inventory` — Role-scoped campus inventory (Students & Instructors ONLY receive `isVerified=true && isVisible=true && item.isActive=true`). Supports search, categoryId, campusId (Central only), visibility filter, sorting, pagination.
- `GET   /api/inventory/:id` — Single campus inventory record + recent transactions.
- `PATCH /api/inventory/:id/visibility` — Toggle `isVisible` (Lab Manager of that campus only).
- `PATCH /api/inventory/bulk-visibility` — Bulk toggle `isVisible` for `{ ids: string[], isVisible: boolean }` (Lab Manager only).
- `POST  /api/inventory/:id/adjust` — Authorised campus inventory adjustment with mandatory remarks (Lab Manager only).
- `GET   /api/inventory/transactions` — Paginated transaction ledger (role & campus scoped).

### Allocations
- `POST  /api/allocations` — Create multi-item allocation (Central Lab Manager; option `dispatchImmediately?: boolean`).
- `GET   /api/allocations` — List allocations (Central = all, Lab Manager = own campus).
- `GET   /api/allocations/:id` — Allocation detail with items.
- `PATCH /api/allocations/:id/status` — Update allocation status (`DISPATCHED`, `CANCELLED`) (Central Lab Manager).
- `POST  /api/allocations/:id/verify` — Campus Lab Manager submits item-wise `receivedQuantity`, `missingQuantity`, `damagedQuantity`, `verificationNotes`. Updates campus inventory + logs transactions atomically.

### Student Requests, Borrowing & Returns
- `POST /api/requests` — Student submits multi-item borrowing request selecting a campus Instructor & purpose.
- `GET  /api/requests` — Role-scoped request list (Central = all, Lab Manager = campus, Instructor = assigned, Student = own).
- `GET  /api/requests/:id` — Full request detail including items, approvals, photos, borrowing records, return verifications.
- `POST /api/requests/:id/instructor-approval` — Assigned Instructor approves/rejects with comments.
- `POST /api/requests/:id/lab-manager-approval` — Campus Lab Manager approves/rejects with atomic stock reservation & double-booking protection.
- `POST /api/requests/:id/collection-photos` — Upload collection photo (multipart form-data or JSON base64/URL) for `(requestItemId, angle)`.
- `POST /api/requests/:id/confirm-collection` — Assigned Instructor confirms item issue after verifying all 4 angles exist for each collected item.
- `POST /api/requests/:id/return-photos` — Student uploads return photo for `(requestItemId, angle)`.
- `POST /api/requests/:id/submit-return` — Student submits return quantities & comments (validates all 4 return angles exist per returned item; NEVER auto-closes ticket).
- `POST /api/requests/:id/verify-return` — Assigned Instructor verifies returned items (`GOOD | DAMAGED | MISSING`), updates stock atomically, and closes ticket ONLY when every issued unit is verified/resolved.

### Issue Tickets
- `POST  /api/tickets` — Instructor creates issue ticket for their campus.
- `GET   /api/tickets` — Role-scoped ticket list (Central = all, Lab Manager = campus, Instructor = own campus/created).
- `GET   /api/tickets/:id` — Ticket detail with comments.
- `PATCH /api/tickets/:id` — Update status/assignee/priority/resolutionNotes (Lab Manager of campus).
- `POST  /api/tickets/:id/comments` — Add comment to ticket (Instructor / Lab Manager of campus / Central).

### Audit Logs & Uploads
- `GET  /api/audit-logs` — Paginated audit log list (Central = global, Lab Manager = own campus). Read-only.
- `POST /api/uploads` — Authenticated image upload (Supabase Storage if configured, otherwise local `public/uploads/` fallback) returning `{ storageKey, url }`.
