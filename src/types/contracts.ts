// ============================================================================
// CampusLab — Shared Domain Types & API Contracts
// Single source of truth shared by Backend Architect and UI Engineer agents.
// ============================================================================

export type UserRole =
  | "CENTRAL_LAB_MANAGER"
  | "LAB_MANAGER"
  | "INSTRUCTOR"
  | "STUDENT";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type CampusStatus = "ACTIVE" | "INACTIVE";

export type AllocationStatus =
  | "DRAFT"
  | "DISPATCHED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "DISCREPANCY_REPORTED"
  | "CANCELLED";

export type InventoryTransactionType =
  | "STOCK_ALLOCATED"
  | "STOCK_DISPATCHED"
  | "STOCK_RECEIVED"
  | "MISSING_REPORTED"
  | "DAMAGED_REPORTED"
  | "STOCK_RESERVED"
  | "RESERVATION_RELEASED"
  | "ITEM_ISSUED"
  | "ITEM_RETURNED"
  | "ITEM_MARKED_DAMAGED"
  | "ITEM_MARKED_MISSING"
  | "INVENTORY_ADJUSTMENT";

export type LabRequestStatus =
  | "PENDING_INSTRUCTOR"
  | "REJECTED_BY_INSTRUCTOR"
  | "PENDING_LAB_MANAGER"
  | "REJECTED_BY_LAB_MANAGER"
  | "APPROVED"
  | "PARTIALLY_ISSUED"
  | "ISSUED"
  | "RETURN_PENDING"
  | "RETURN_SUBMITTED"
  | "RETURN_VERIFICATION_PENDING"
  | "RETURN_DISPUTED"
  | "PARTIALLY_RETURNED"
  | "CLOSED"
  | "CANCELLED";

export type ApprovalStage = "INSTRUCTOR_REVIEW" | "LAB_MANAGER_FINAL";
export type ApprovalDecision = "APPROVED" | "REJECTED";

export type PhotoAngle =
  | "FRONT_TOP"
  | "BACK_BOTTOM"
  | "LEFT_SIDE"
  | "RIGHT_SIDE";

export type PhotoPhase = "COLLECTION" | "RETURN";

export type ReturnCondition = "GOOD" | "DAMAGED" | "MISSING" | "PARTIAL";

export type ReturnVerificationStatus =
  | "PENDING"
  | "VERIFIED_GOOD"
  | "DISPUTED_DAMAGED"
  | "DISPUTED_MISSING"
  | "RESOLVED";

export type IssueCategory =
  | "DAMAGED_EQUIPMENT"
  | "MISSING_EQUIPMENT"
  | "MALFUNCTIONING_EQUIPMENT"
  | "INVENTORY_DISCREPANCY"
  | "INCORRECT_ALLOCATION"
  | "MAINTENANCE_REQUEST";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type TicketStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED";

export const REQUIRED_PHOTO_ANGLES: readonly PhotoAngle[] = [
  "FRONT_TOP",
  "BACK_BOTTOM",
  "LEFT_SIDE",
  "RIGHT_SIDE",
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  CENTRAL_LAB_MANAGER: "Central Lab Manager",
  LAB_MANAGER: "Lab Manager",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
};

export const ROLE_DASHBOARD_ROUTES: Record<UserRole, string> = {
  CENTRAL_LAB_MANAGER: "/central/dashboard",
  LAB_MANAGER: "/lab-manager/dashboard",
  INSTRUCTOR: "/instructor/dashboard",
  STUDENT: "/student/dashboard",
};

// ============================================================================
// Standard API Response Envelopes
// ============================================================================

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]> | unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

// ============================================================================
// Core DTOs
// ============================================================================

export interface AuthUserDTO {
  id: string;
  fullName: string;
  email: string;
  institutionalId: string;
  role: UserRole;
  status: UserStatus;
  campusId: string | null;
  campus: {
    id: string;
    code: string;
    name: string;
    city: string | null;
  } | null;
}

export interface MockUserOptionDTO {
  id: string;
  fullName: string;
  email: string;
  institutionalId: string;
  role: UserRole;
  campusId: string | null;
  campusCode: string | null;
  campusName: string | null;
}

export interface CampusDTO {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  status: CampusStatus;
  createdAt: string;
  updatedAt: string;
  stats?: {
    labManagerCount: number;
    instructorCount: number;
    studentCount: number;
    totalStockUnits: number;
    availableUnits: number;
    borrowedUnits: number;
    pendingAllocations: number;
    openTickets: number;
  };
}

export interface ItemCategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  itemCount?: number;
}

export interface MasterItemDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  brand: string | null;
  specifications: Record<string, unknown> | null;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  summary?: {
    totalAllocated: number;
    totalReceived: number;
    totalAvailable: number;
    totalBorrowed: number;
    campusCount: number;
  };
}

export interface CampusInventoryDTO {
  id: string;
  campusId: string;
  itemId: string;
  allocatedQuantity: number;
  receivedQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  borrowedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  isVisible: boolean;
  isVerified: boolean;
  lastVerifiedAt: string | null;
  updatedAt: string;
  campus?: {
    id: string;
    code: string;
    name: string;
  };
  item: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    brand: string | null;
    unit: string;
    imageUrl: string | null;
    specifications: Record<string, unknown> | null;
    isActive: boolean;
    category: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

export interface InventoryTransactionDTO {
  id: string;
  campusId: string;
  itemId: string;
  type: InventoryTransactionType;
  quantity: number;
  previousQuantity: number;
  updatedQuantity: number;
  referenceType: string | null;
  referenceId: string | null;
  remarks: string | null;
  createdAt: string;
  campus?: { id: string; code: string; name: string };
  item?: { id: string; code: string; name: string };
  performedBy?: { id: string; fullName: string; role: UserRole };
}

export interface StockAllocationItemDTO {
  id: string;
  allocationId: string;
  itemId: string;
  allocatedQuantity: number;
  receivedQuantity: number;
  missingQuantity: number;
  damagedQuantity: number;
  isVerified: boolean;
  verificationNotes: string | null;
  verifiedAt: string | null;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
    category?: { id: string; name: string };
  };
}

export interface StockAllocationDTO {
  id: string;
  referenceCode: string;
  source: string;
  destinationCampusId: string;
  createdById: string;
  status: AllocationStatus;
  notes: string | null;
  dispatchedAt: string | null;
  verifiedAt: string | null;
  verifiedById: string | null;
  createdAt: string;
  updatedAt: string;
  destinationCampus: { id: string; code: string; name: string };
  createdBy: { id: string; fullName: string; email: string };
  verifiedBy?: { id: string; fullName: string } | null;
  items: StockAllocationItemDTO[];
}

export interface ItemPhotoDTO {
  id: string;
  requestId: string;
  requestItemId: string;
  borrowingRecordId: string | null;
  uploadedById: string;
  angle: PhotoAngle;
  phase: PhotoPhase;
  storageKey: string;
  url: string;
  createdAt: string;
}

export interface ReturnVerificationDTO {
  id: string;
  borrowingRecordId: string;
  requestItemId: string;
  verifiedById: string | null;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  condition: ReturnCondition;
  status: ReturnVerificationStatus;
  studentComments: string | null;
  instructorRemarks: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  verifiedBy?: { id: string; fullName: string } | null;
}

export interface BorrowingRecordDTO {
  id: string;
  requestId: string;
  requestItemId: string;
  campusId: string;
  itemId: string;
  studentId: string;
  issuedByInstructorId: string;
  issuedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  issuedAt: string;
  dueAt: string | null;
  closedAt: string | null;
  item?: { id: string; code: string; name: string; unit: string };
  photos?: ItemPhotoDTO[];
  returnVerifications?: ReturnVerificationDTO[];
}

export interface LabRequestItemDTO {
  id: string;
  requestId: string;
  itemId: string;
  requestedQuantity: number;
  approvedQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  item: {
    id: string;
    code: string;
    name: string;
    unit: string;
    imageUrl: string | null;
    category?: { id: string; name: string };
  };
  photos?: ItemPhotoDTO[];
  borrowingRecords?: BorrowingRecordDTO[];
}

export interface RequestApprovalDTO {
  id: string;
  requestId: string;
  stage: ApprovalStage;
  decision: ApprovalDecision;
  approverId: string;
  comments: string | null;
  createdAt: string;
  approver: {
    id: string;
    fullName: string;
    role: UserRole;
  };
}

export interface LabRequestDTO {
  id: string;
  requestCode: string;
  campusId: string;
  studentId: string;
  instructorId: string;
  purpose: string;
  status: LabRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  campus: { id: string; code: string; name: string };
  student: { id: string; fullName: string; email: string; institutionalId: string };
  instructor: { id: string; fullName: string; email: string; institutionalId: string };
  items: LabRequestItemDTO[];
  approvals: RequestApprovalDTO[];
  photos?: ItemPhotoDTO[];
  borrowingRecords?: BorrowingRecordDTO[];
}

export interface TicketCommentDTO {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  attachmentUrls: string[];
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    role: UserRole;
  };
}

export interface IssueTicketDTO {
  id: string;
  ticketCode: string;
  campusId: string;
  createdById: string;
  assignedToId: string | null;
  itemId: string | null;
  category: IssueCategory;
  priority: TicketPriority;
  status: TicketStatus;
  title: string;
  description: string;
  attachmentUrls: string[];
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  campus: { id: string; code: string; name: string };
  createdBy: { id: string; fullName: string; email: string; role: UserRole };
  assignedTo?: { id: string; fullName: string; email: string } | null;
  item?: { id: string; code: string; name: string } | null;
  comments?: TicketCommentDTO[];
}

export interface AuditLogDTO {
  id: string;
  actorId: string | null;
  actorRole: UserRole | null;
  campusId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
  campus?: { id: string; code: string; name: string } | null;
}

// ============================================================================
// Dashboard Analytics DTOs
// ============================================================================

export interface CentralDashboardDTO {
  kpis: {
    totalCampuses: number;
    activeCampuses: number;
    totalMasterItems: number;
    totalAllocatedUnits: number;
    pendingVerifications: number;
    activeUsers: number;
    pendingRequests: number;
    openTickets: number;
  };
  campusInventoryChart: Array<{
    campusCode: string;
    campusName: string;
    available: number;
    borrowed: number;
    reserved: number;
    damaged: number;
  }>;
  allocationActivityChart: Array<{
    month: string;
    dispatched: number;
    received: number;
    discrepancies: number;
  }>;
  pendingAllocations: StockAllocationDTO[];
  recentAuditLogs: AuditLogDTO[];
}

export interface LabManagerDashboardDTO {
  campus: { id: string; code: string; name: string };
  kpis: {
    totalCampusUnits: number;
    availableUnits: number;
    borrowedUnits: number;
    reservedUnits: number;
    damagedUnits: number;
    missingUnits: number;
    incomingAllocations: number;
    pendingStudentRequests: number;
    openTickets: number;
  };
  recentTransactions: InventoryTransactionDTO[];
  pendingRequests: LabRequestDTO[];
  incomingAllocationsList: StockAllocationDTO[];
}

export interface InstructorDashboardDTO {
  campus: { id: string; code: string; name: string };
  kpis: {
    pendingStudentRequests: number;
    approvedRequests: number;
    activeBorrowings: number;
    pendingReturnVerifications: number;
    openIssueTickets: number;
  };
  pendingRequestsList: LabRequestDTO[];
  pendingReturnsList: LabRequestDTO[];
}

export interface StudentDashboardDTO {
  campus: { id: string; code: string; name: string };
  kpis: {
    availableItemsCount: number;
    myPendingRequests: number;
    myApprovedRequests: number;
    currentlyBorrowedItems: number;
    itemsAwaitingReturn: number;
  };
  recentRequests: LabRequestDTO[];
}

// ============================================================================
// Realtime Event Stream Payload (SSE & Supabase Realtime compatible)
// ============================================================================

export type RealtimeEventType =
  | "inventory.updated"
  | "inventory.visibility_changed"
  | "allocation.created"
  | "allocation.status_changed"
  | "allocation.verified"
  | "request.created"
  | "request.status_changed"
  | "borrowing.issued"
  | "return.submitted"
  | "return.verified"
  | "ticket.created"
  | "ticket.updated"
  | "heartbeat";

export interface RealtimeEventPayload {
  id: string;
  type: RealtimeEventType;
  campusId: string | null; // null = global-only; string = scoped to campus + Central Lab Manager
  entityType: string;
  entityId: string;
  actorId: string | null;
  summary: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
