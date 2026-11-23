# CampusLab — Production REST & Realtime API Specification

All endpoints live under `/api/**`, authenticate via the HTTP-only HMAC-SHA256 signed session cookie (`campuslab_session`), and resolve user identity, role, and campus strictly from the server-side PostgreSQL database.

## Standard Response Envelopes

### Success (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 40,
    "totalPages": 2
  }
}
```

### Error (`4xx` / `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN | CONFLICT | VALIDATION_ERROR | NOT_FOUND | BAD_REQUEST | UNAUTHORIZED",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

---

## 1. Authentication (Mock Development Auth Provider)

Gated behind `NODE_ENV !== 'production' || process.env.ENABLE_MOCK_AUTH === 'true'`.

| Method | Path | Access | Request Body / Query | Response |
|---|---|---|---|---|
| `GET` | `/api/auth/mock-users` | Dev Only | — | `MockUserOptionDTO[]` |
| `POST` | `/api/auth/mock-login` | Dev Only | `{ email?: string, userId?: string }` | `AuthUserDTO` + sets `campuslab_session` cookie |
| `POST` | `/api/auth/logout` | Any | — | `{ loggedOut: true }` |
| `GET` | `/api/auth/me` | Authenticated | — | `AuthUserDTO` |

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/auth/mock-login \
  -H "Content-Type: application/json" \
  -d '{"email":"central@campuslab.edu"}'
```

---

## 2. Dashboard, Realtime Stream & Media Uploads

| Method | Path | Access | Query / Body | Response |
|---|---|---|---|---|
| `GET` | `/api/dashboard` | Authenticated | `?campusId=` (Central Lab Manager only) | Role-specific `CentralDashboardDTO \| LabManagerDashboardDTO \| InstructorDashboardDTO \| StudentDashboardDTO` |
| `GET` | `/api/events` | Authenticated | — | `text/event-stream` SSE delivering campus-isolated `RealtimeEventPayload` JSON frames |
| `POST` | `/api/uploads` | Authenticated | `multipart/form-data` (`file`, `folder?`) OR JSON `{ dataUrl, filename?, folder? }` | `{ storageKey, url }` (max 5MB, image MIME types only; Supabase Storage or local `public/uploads/` fallback) |

---

## 3. Campuses (40+ Campuses)

| Method | Path | Allowed Roles | Body / Query |
|---|---|---|---|
| `GET` | `/api/campuses` | All (scoped to own campus for non-Central) | `?page&pageSize&search&status&includeStats&sortBy&sortOrder` |
| `POST` | `/api/campuses` | `CENTRAL_LAB_MANAGER` | `{ code, name, city?, state?, address?, status? }` |
| `GET` | `/api/campuses/:id` | Central or own campus | — |
| `PATCH` | `/api/campuses/:id` | `CENTRAL_LAB_MANAGER` | Partial `{ code?, name?, city?, state?, address?, status? }` |
| `DELETE` | `/api/campuses/:id` | `CENTRAL_LAB_MANAGER` | Soft-deactivates campus (`status = INACTIVE`) |

---

## 4. Users & Roles

Strictly enforces unique `email`, unique `institutionalId`, **at most ONE `CENTRAL_LAB_MANAGER` globally**, and role-campus integrity (`CENTRAL_LAB_MANAGER` has `campusId = null`; all other roles require an active `campusId`). Multiple `LAB_MANAGER`s per campus are supported.

| Method | Path | Allowed Roles | Body / Query |
|---|---|---|---|
| `GET` | `/api/users` | All (Students see own-campus active Instructors; Lab Managers see own campus; Central sees all) | `?page&pageSize&search&role&campusId&status&sortBy&sortOrder` |
| `POST` | `/api/users` | `CENTRAL_LAB_MANAGER` | `{ fullName, email, institutionalId, role, campusId?, status? }` |
| `GET` | `/api/users/:id` | Central, self, or same campus | — |
| `PATCH` | `/api/users/:id` | `CENTRAL_LAB_MANAGER` | Partial user update |
| `DELETE` | `/api/users/:id` | `CENTRAL_LAB_MANAGER` | Soft-deactivates user (`status = INACTIVE`), preserving audit & borrowing history |

---

## 5. Master Inventory & Categories

| Method | Path | Allowed Roles | Body / Query |
|---|---|---|---|
| `GET` | `/api/categories` | All authenticated | — |
| `POST` | `/api/categories` | `CENTRAL_LAB_MANAGER` | `{ name, slug?, description? }` |
| `GET` | `/api/items` | All authenticated | `?page&pageSize&search&categoryId&isActive&sortBy&sortOrder` |
| `POST` | `/api/items` | `CENTRAL_LAB_MANAGER` | `{ code, name, description?, categoryId, brand?, specifications?, unit?, imageUrl?, isActive? }` |
| `GET` | `/api/items/:id` | All authenticated | Returns `MasterItemDTO` + `campusBreakdown` |
| `PATCH` | `/api/items/:id` | `CENTRAL_LAB_MANAGER` | Partial master item update |
| `DELETE` | `/api/items/:id` | `CENTRAL_LAB_MANAGER` | Soft-deactivates item (`isActive = false`) |

---

## 6. Campus Inventory & Transaction Ledger

Students and Instructors **strictly** receive only records where `isVerified = true && isVisible = true && item.isActive = true` for their own campus.

| Method | Path | Allowed Roles | Body / Query |
|---|---|---|---|
| `GET` | `/api/inventory` | All authenticated (role & campus scoped) | `?page&pageSize&search&categoryId&campusId&isVisible&isVerified&sortBy&sortOrder` |
| `GET` | `/api/inventory/:id` | Role & campus scoped | Returns `CampusInventoryDTO` + `recentTransactions` |
| `PATCH` | `/api/inventory/:id/visibility` | `LAB_MANAGER` (own campus) | `{ isVisible: boolean }` |
| `PATCH` | `/api/inventory/bulk-visibility` | `LAB_MANAGER` (own campus) | `{ ids: string[], isVisible: boolean }` |
| `POST` | `/api/inventory/:id/adjust` | `LAB_MANAGER` (own campus) | `{ field: 'availableQuantity' \| 'damagedQuantity' \| 'missingQuantity', delta: number, remarks: string }` |
| `GET` | `/api/inventory/transactions` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER`, `INSTRUCTOR` | `?page&pageSize&campusId&itemId&type&search` |

---

## 7. Central Stock Allocations & Verification

| Method | Path | Allowed Roles | Body / Query |
|---|---|---|---|
| `GET` | `/api/allocations` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER` (own campus) | `?page&pageSize&campusId&status&search` |
| `POST` | `/api/allocations` | `CENTRAL_LAB_MANAGER` | `{ destinationCampusId, source?, notes?, dispatchImmediately?, items: [{ itemId, allocatedQuantity }] }` |
| `GET` | `/api/allocations/:id` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER` (own campus) | — |
| `PATCH` | `/api/allocations/:id/status` | `CENTRAL_LAB_MANAGER` | `{ status: 'DISPATCHED' \| 'CANCELLED', notes? }` |
| `POST` | `/api/allocations/:id/verify` | `LAB_MANAGER` (destination campus) | `{ items: [{ allocationItemId?, itemId?, receivedQuantity, missingQuantity, damagedQuantity, verificationNotes? }], notes? }` |

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/allocations/ALLOC_ID/verify \
  -H "Content-Type: application/json" \
  -d '{"items":[{"itemId":"ITEM_ID","receivedQuantity":48,"missingQuantity":2,"damagedQuantity":0,"verificationNotes":"2 missing in box 3"}]}'
```

---

## 8. Student Requests, 4-Angle Photo Proof, Borrowing & Return Verification

| Method | Path | Allowed Roles | Body |
|---|---|---|---|
| `GET` | `/api/requests` | All (Central = all, LM = campus, Instructor = assigned, Student = own) | `?page&pageSize&status&campusId&search` |
| `POST` | `/api/requests` | `STUDENT` | `{ instructorId, purpose, items: [{ itemId, requestedQuantity }] }` |
| `GET` | `/api/requests/:id` | Scoped by role/campus/assignment | Full request with items, approvals, photos, borrowing records, return verifications |
| `POST` | `/api/requests/:id/instructor-approval` | Assigned `INSTRUCTOR` | `{ decision: 'APPROVED' \| 'REJECTED', comments? }` |
| `POST` | `/api/requests/:id/lab-manager-approval` | Campus `LAB_MANAGER` | `{ decision: 'APPROVED' \| 'REJECTED', comments? }` (atomically reserves stock with concurrency guard) |
| `POST` | `/api/requests/:id/collection-photos` | Requesting `STUDENT` or assigned `INSTRUCTOR` | Multipart (`file`, `requestItemId`, `angle`) OR JSON `{ requestItemId, angle, storageKey?, url?, dataUrl? }`. Immutable once collected. |
| `POST` | `/api/requests/:id/confirm-collection` | Assigned `INSTRUCTOR` | `{ items?: [{ requestItemId, issuedQuantity }], dueAt? }` (requires all 4 angles `FRONT_TOP`, `BACK_BOTTOM`, `LEFT_SIDE`, `RIGHT_SIDE` per item) |
| `POST` | `/api/requests/:id/return-photos` | Requesting `STUDENT` | Multipart (`file`, `requestItemId`, `angle`) OR JSON `{ requestItemId, angle, storageKey?, url?, dataUrl? }` |
| `POST` | `/api/requests/:id/submit-return` | Requesting `STUDENT` | `{ items: [{ requestItemId?, borrowingRecordId?, returnedQuantity, studentComments? }] }` (requires all 4 return angles; never auto-closes) |
| `POST` | `/api/requests/:id/verify-return` | Assigned `INSTRUCTOR` | `{ items: [{ returnVerificationId?, borrowingRecordId?, requestItemId?, condition: 'GOOD'\|'DAMAGED'\|'MISSING'\|'PARTIAL', returnedQuantity, damagedQuantity?, missingQuantity?, instructorRemarks? }] }` |

---

## 9. Operational Issue Tickets & Audit Logs

| Method | Path | Allowed Roles | Body / Query |
|---|---|---|---|
| `GET` | `/api/tickets` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER`, `INSTRUCTOR` (Students denied) | `?page&pageSize&campusId&status&priority&category&search` |
| `POST` | `/api/tickets` | `INSTRUCTOR` | `{ category, priority?, title, description, itemId?, attachmentUrls? }` |
| `GET` | `/api/tickets/:id` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER`, `INSTRUCTOR` (campus-scoped) | — |
| `PATCH` | `/api/tickets/:id` | `LAB_MANAGER` (own campus) | `{ status?, assignedToId?, priority?, resolutionNotes? }` |
| `POST` | `/api/tickets/:id/comments` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER`, `INSTRUCTOR` (campus-scoped) | `{ body, attachmentUrls? }` |
| `GET` | `/api/audit-logs` | `CENTRAL_LAB_MANAGER`, `LAB_MANAGER` (own campus) | `?page&pageSize&campusId&entityType&action&search` |
