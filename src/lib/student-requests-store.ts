import { getPartImageUrl } from "@/lib/part-images";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  LabRequestDTO,
} from "@/types/contracts";

export const STUDENT_REQUESTS_STORAGE_KEY = "campuslab_student_flowcharts_v1";

export function readLocalStudentRequests(): LabRequestDTO[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STUDENT_REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LabRequestDTO[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalStudentRequests(requests: LabRequestDTO[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STUDENT_REQUESTS_STORAGE_KEY,
      JSON.stringify(requests)
    );
  } catch {
    // ignore storage quota errors
  }
}

export function prependLocalStudentRequest(req: LabRequestDTO): LabRequestDTO[] {
  const existing = readLocalStudentRequests();
  const next = [req, ...existing.filter((r) => r.id !== req.id)];
  saveLocalStudentRequests(next);
  return next;
}

/** Merge locally-created/updated demo requests over static DEMO_REQUESTS (newest first) */
export function readMergedDemoRequests(
  fallback: LabRequestDTO[]
): LabRequestDTO[] {
  const local = readLocalStudentRequests();
  const localIds = new Set(local.map((r) => r.id));
  return [...local, ...fallback.filter((d) => !localIds.has(d.id))];
}

/** Persist an updated request (e.g. approved, rejected, issued, verified) into local demo store */
export function upsertLocalStudentRequest(req: LabRequestDTO): LabRequestDTO[] {
  const existing = readLocalStudentRequests();
  const idx = existing.findIndex((r) => r.id === req.id);
  const next =
    idx >= 0
      ? existing.map((r, i) => (i === idx ? req : r))
      : [req, ...existing];
  saveLocalStudentRequests(next);
  return next;
}

export function buildLocalLabRequestDTO(params: {
  user: AuthUserDTO | null;
  instructor: AuthUserDTO | undefined;
  instructorId: string;
  purpose: string;
  entries: Array<{ itemId: string; qty: number; row: CampusInventoryDTO }>;
}): LabRequestDTO {
  const { user, instructor, instructorId, purpose, entries } = params;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const reqId = `req-local-${now}`;

  return {
    id: reqId,
    requestCode: `REQ-${now.toString(36).toUpperCase()}`,
    campusId: user?.campusId ?? "demo-campus-01",
    studentId: user?.id ?? "demo-user-stu-01",
    instructorId: instructor?.id ?? instructorId,
    purpose,
    status: "PENDING_INSTRUCTOR",
    rejectionReason: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    campus: {
      id: user?.campusId ?? "demo-campus-01",
      code: user?.campus?.code ?? "CMP-01",
      name: user?.campus?.name ?? "Bengaluru North Campus",
    },
    student: {
      id: user?.id ?? "demo-user-stu-01",
      fullName: user?.fullName ?? "Aarav Nair",
      email: user?.email ?? "student1.cmp01@campuslab.edu",
      institutionalId: user?.institutionalId ?? "STU-0101",
    },
    instructor: {
      id: instructor?.id ?? "demo-user-inst-01",
      fullName: instructor?.fullName ?? "Prof. Ananya Deshmukh",
      email: instructor?.email ?? "instructor1.cmp01@campuslab.edu",
      institutionalId: instructor?.institutionalId ?? "INS-0101",
    },
    items: entries.map(({ itemId, qty, row }, idx) => ({
      id: `req-item-${now}-${idx}`,
      requestId: reqId,
      itemId,
      requestedQuantity: qty,
      approvedQuantity: 0,
      issuedQuantity: 0,
      returnedQuantity: 0,
      damagedQuantity: 0,
      missingQuantity: 0,
      item: {
        id: row.item.id,
        code: row.item.code,
        name: row.item.name,
        unit: row.item.unit,
        imageUrl:
          row.item.imageUrl ||
          getPartImageUrl(row.item.code, row.item.category.slug),
      },
      photos: [],
    })),
    approvals: [],
  };
}
