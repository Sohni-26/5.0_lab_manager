import type {
  AllocationStatus,
  ApiResponse,
  AuditLogDTO,
  AuthUserDTO,
  CampusDTO,
  CampusInventoryDTO,
  CampusStatus,
  CentralDashboardDTO,
  InstructorDashboardDTO,
  InventoryTransactionDTO,
  IssueCategory,
  IssueTicketDTO,
  ItemCategoryDTO,
  LabManagerDashboardDTO,
  LabRequestDTO,
  MasterItemDTO,
  MockUserOptionDTO,
  PaginationMeta,
  PhotoAngle,
  ReturnCondition,
  StockAllocationDTO,
  StudentDashboardDTO,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from "@/types/contracts";

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 500, code = "API_ERROR", details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta;
}

function buildQuery(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return "";
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== "") {
      sp.set(key, String(val));
    }
  });
  const str = sp.toString();
  return str ? `?${str}` : "";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      credentials: "include",
      headers,
      cache: "no-store",
    });
  } catch (err) {
    throw new ApiClientError(
      err instanceof Error ? err.message : "Network error",
      0,
      "NETWORK_ERROR"
    );
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      `Unexpected response (${res.status})`,
      res.status,
      "INVALID_JSON"
    );
  }

  if (!res.ok || !json || !json.success) {
    const errObj = json && !json.success ? json.error : undefined;
    throw new ApiClientError(
      errObj?.message || `Request failed with status ${res.status}`,
      res.status,
      errObj?.code || "REQUEST_FAILED",
      errObj?.details
    );
  }

  return { data: json.data, meta: json.meta };
}

export const apiClient = {
  // ---- Auth ----
  auth: {
    me: () => request<AuthUserDTO>("/api/auth/me"),
    mockUsers: () => request<MockUserOptionDTO[]>("/api/auth/mock-users"),
    mockLogin: (payload: { email?: string; userId?: string; password?: string }) =>
      request<AuthUserDTO>("/api/auth/mock-login", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    logout: () =>
      request<{ loggedOut: true }>("/api/auth/logout", { method: "POST" }),
  },

  // ---- Dashboard ----
  dashboard: {
    get: <
      T =
        | CentralDashboardDTO
        | LabManagerDashboardDTO
        | InstructorDashboardDTO
        | StudentDashboardDTO,
    >(
      campusId?: string
    ) => request<T>(`/api/dashboard${buildQuery({ campusId })}`),
  },

  // ---- Campuses ----
  campuses: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      status?: CampusStatus | "";
    }) => request<CampusDTO[]>(`/api/campuses${buildQuery(params)}`),
    get: (id: string) => request<CampusDTO>(`/api/campuses/${id}`),
    create: (payload: {
      code: string;
      name: string;
      city?: string;
      state?: string;
      address?: string;
      status?: CampusStatus;
    }) =>
      request<CampusDTO>("/api/campuses", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        code: string;
        name: string;
        city: string;
        state: string;
        address: string;
        status: CampusStatus;
      }>
    ) =>
      request<CampusDTO>(`/api/campuses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deactivate: (id: string) =>
      request<CampusDTO>(`/api/campuses/${id}`, { method: "DELETE" }),
  },

  // ---- Users ----
  users: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      role?: UserRole | "";
      campusId?: string;
      status?: UserStatus | "";
      search?: string;
    }) => request<AuthUserDTO[]>(`/api/users${buildQuery(params)}`),
    create: (payload: {
      fullName: string;
      email: string;
      institutionalId: string;
      role: UserRole;
      campusId?: string | null;
      status?: UserStatus;
    }) =>
      request<AuthUserDTO>("/api/users", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        fullName: string;
        email: string;
        institutionalId: string;
        role: UserRole;
        campusId: string | null;
        status: UserStatus;
      }>
    ) =>
      request<AuthUserDTO>(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deactivate: (id: string) =>
      request<AuthUserDTO>(`/api/users/${id}`, { method: "DELETE" }),
  },

  // ---- Categories & Master Items ----
  categories: {
    list: () => request<ItemCategoryDTO[]>("/api/categories"),
    create: (payload: { name: string; slug?: string; description?: string }) =>
      request<ItemCategoryDTO>("/api/categories", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  items: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      categoryId?: string;
      isActive?: boolean;
    }) => request<MasterItemDTO[]>(`/api/items${buildQuery(params)}`),
    get: (id: string) => request<MasterItemDTO>(`/api/items/${id}`),
    create: (payload: {
      code: string;
      name: string;
      description?: string;
      categoryId: string;
      brand?: string;
      specifications?: Record<string, unknown>;
      unit?: string;
      imageUrl?: string | null;
      isActive?: boolean;
    }) =>
      request<MasterItemDTO>("/api/items", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: Partial<{
        code: string;
        name: string;
        description: string;
        categoryId: string;
        brand: string;
        specifications: Record<string, unknown>;
        unit: string;
        imageUrl: string | null;
        isActive: boolean;
      }>
    ) =>
      request<MasterItemDTO>(`/api/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    deactivate: (id: string) =>
      request<MasterItemDTO>(`/api/items/${id}`, { method: "DELETE" }),
  },

  // ---- Campus Inventory ----
  inventory: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      search?: string;
      categoryId?: string;
      campusId?: string;
      isVisible?: boolean;
      isVerified?: boolean;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    }) => request<CampusInventoryDTO[]>(`/api/inventory${buildQuery(params)}`),
    get: (id: string) => request<CampusInventoryDTO>(`/api/inventory/${id}`),
    toggleVisibility: (id: string, isVisible: boolean) =>
      request<CampusInventoryDTO>(`/api/inventory/${id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ isVisible }),
      }),
    bulkVisibility: (ids: string[], isVisible: boolean) =>
      request<{ updatedCount: number }>("/api/inventory/bulk-visibility", {
        method: "PATCH",
        body: JSON.stringify({ ids, isVisible }),
      }),
    adjust: (
      id: string,
      payload: {
        field: "availableQuantity" | "damagedQuantity" | "missingQuantity";
        delta: number;
        remarks: string;
      }
    ) =>
      request<CampusInventoryDTO>(`/api/inventory/${id}/adjust`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    transactions: (params?: {
      page?: number;
      pageSize?: number;
      campusId?: string;
      itemId?: string;
      type?: string;
      search?: string;
    }) =>
      request<InventoryTransactionDTO[]>(
        `/api/inventory/transactions${buildQuery(params)}`
      ),
  },

  // ---- Stock Allocations ----
  allocations: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      campusId?: string;
      status?: AllocationStatus | "";
      search?: string;
    }) => request<StockAllocationDTO[]>(`/api/allocations${buildQuery(params)}`),
    get: (id: string) => request<StockAllocationDTO>(`/api/allocations/${id}`),
    create: (payload: {
      destinationCampusId: string;
      source?: string;
      notes?: string;
      dispatchImmediately?: boolean;
      items: Array<{ itemId: string; allocatedQuantity: number }>;
    }) =>
      request<StockAllocationDTO>("/api/allocations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateStatus: (
      id: string,
      payload: { status: "DISPATCHED" | "CANCELLED"; notes?: string }
    ) =>
      request<StockAllocationDTO>(`/api/allocations/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    verify: (
      id: string,
      payload: {
        items: Array<{
          allocationItemId?: string;
          itemId?: string;
          receivedQuantity: number;
          missingQuantity: number;
          damagedQuantity: number;
          verificationNotes?: string;
        }>;
      }
    ) =>
      request<StockAllocationDTO>(`/api/allocations/${id}/verify`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  // ---- Student Requests, Borrowing & Returns ----
  requests: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      campusId?: string;
      search?: string;
    }) => request<LabRequestDTO[]>(`/api/requests${buildQuery(params)}`),
    get: (id: string) => request<LabRequestDTO>(`/api/requests/${id}`),
    create: (payload: {
      instructorId: string;
      purpose: string;
      items: Array<{ itemId: string; requestedQuantity: number }>;
    }) =>
      request<LabRequestDTO>("/api/requests", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    instructorApproval: (
      id: string,
      payload: { decision: "APPROVED" | "REJECTED"; comments?: string }
    ) =>
      request<LabRequestDTO>(`/api/requests/${id}/instructor-approval`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    labManagerApproval: (
      id: string,
      payload: { decision: "APPROVED" | "REJECTED"; comments?: string }
    ) =>
      request<LabRequestDTO>(`/api/requests/${id}/lab-manager-approval`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    uploadCollectionPhoto: (
      id: string,
      payload:
        | FormData
        | {
            requestItemId: string;
            angle: PhotoAngle;
            storageKey?: string;
            url?: string;
            dataUrl?: string;
          }
    ) =>
      request<unknown>(`/api/requests/${id}/collection-photos`, {
        method: "POST",
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }),
    confirmCollection: (
      id: string,
      payload?: {
        items?: Array<{ requestItemId: string; issuedQuantity: number }>;
        dueAt?: string;
      }
    ) =>
      request<LabRequestDTO>(`/api/requests/${id}/confirm-collection`, {
        method: "POST",
        body: JSON.stringify(payload ?? {}),
      }),
    uploadReturnPhoto: (
      id: string,
      payload:
        | FormData
        | {
            requestItemId: string;
            angle: PhotoAngle;
            storageKey?: string;
            url?: string;
            dataUrl?: string;
          }
    ) =>
      request<unknown>(`/api/requests/${id}/return-photos`, {
        method: "POST",
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }),
    submitReturn: (
      id: string,
      payload: {
        items: Array<{
          requestItemId?: string;
          borrowingRecordId?: string;
          returnedQuantity: number;
          studentComments?: string;
        }>;
      }
    ) =>
      request<LabRequestDTO>(`/api/requests/${id}/submit-return`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    verifyReturn: (
      id: string,
      payload: {
        items: Array<{
          borrowingRecordId?: string;
          requestItemId?: string;
          returnVerificationId?: string;
          condition: ReturnCondition;
          returnedQuantity: number;
          damagedQuantity?: number;
          missingQuantity?: number;
          instructorRemarks?: string;
        }>;
      }
    ) =>
      request<LabRequestDTO>(`/api/requests/${id}/verify-return`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  // ---- Issue Tickets ----
  tickets: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      campusId?: string;
      status?: TicketStatus | "";
      priority?: TicketPriority | "";
      search?: string;
    }) => request<IssueTicketDTO[]>(`/api/tickets${buildQuery(params)}`),
    get: (id: string) => request<IssueTicketDTO>(`/api/tickets/${id}`),
    create: (payload: {
      category: IssueCategory;
      priority?: TicketPriority;
      title: string;
      description: string;
      itemId?: string | null;
      attachmentUrls?: string[];
    }) =>
      request<IssueTicketDTO>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    update: (
      id: string,
      payload: {
        status?: TicketStatus;
        assignedToId?: string | null;
        priority?: TicketPriority;
        resolutionNotes?: string | null;
      }
    ) =>
      request<IssueTicketDTO>(`/api/tickets/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    addComment: (
      id: string,
      payload: { body: string; attachmentUrls?: string[] }
    ) =>
      request<IssueTicketDTO>(`/api/tickets/${id}/comments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },

  // ---- Audit Logs & Uploads ----
  auditLogs: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      campusId?: string;
      entityType?: string;
      action?: string;
      search?: string;
    }) => request<AuditLogDTO[]>(`/api/audit-logs${buildQuery(params)}`),
  },

  uploads: {
    uploadFile: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<{ storageKey: string; url: string }>("/api/uploads", {
        method: "POST",
        body: fd,
      });
    },
    uploadDataUrl: (dataUrl: string, filename?: string) =>
      request<{ storageKey: string; url: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ dataUrl, filename }),
      }),
  },
};

export function isBackendUnavailableError(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    return err.status === 0 || err.status >= 500 || err.status === 404;
  }
  return false;
}
