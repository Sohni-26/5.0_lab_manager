import React from "react";
import { Badge, type BadgeProps } from "./badge";
import type {
  AllocationStatus,
  CampusStatus,
  LabRequestStatus,
  ReturnVerificationStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from "@/types/contracts";

type Variant = NonNullable<BadgeProps["variant"]>;

const ALLOCATION_MAP: Record<AllocationStatus, { label: string; variant: Variant }> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  DISPATCHED: { label: "Dispatched", variant: "info" },
  PARTIALLY_RECEIVED: { label: "Partially Received", variant: "warning" },
  RECEIVED: { label: "Received", variant: "success" },
  DISCREPANCY_REPORTED: { label: "Discrepancy Reported", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

const REQUEST_MAP: Record<LabRequestStatus, { label: string; variant: Variant }> = {
  PENDING_INSTRUCTOR: { label: "Pending Instructor", variant: "warning" },
  REJECTED_BY_INSTRUCTOR: { label: "Rejected by Instructor", variant: "danger" },
  PENDING_LAB_MANAGER: { label: "Pending Lab Manager", variant: "info" },
  REJECTED_BY_LAB_MANAGER: { label: "Rejected by Lab Manager", variant: "danger" },
  APPROVED: { label: "Approved", variant: "success" },
  PARTIALLY_ISSUED: { label: "Partially Issued", variant: "info" },
  ISSUED: { label: "Issued / Borrowed", variant: "accent" },
  RETURN_PENDING: { label: "Return Pending", variant: "warning" },
  RETURN_SUBMITTED: { label: "Return Submitted", variant: "info" },
  RETURN_VERIFICATION_PENDING: { label: "Awaiting Verification", variant: "warning" },
  RETURN_DISPUTED: { label: "Return Disputed", variant: "danger" },
  PARTIALLY_RETURNED: { label: "Partially Returned", variant: "warning" },
  CLOSED: { label: "Closed", variant: "success" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

const TICKET_MAP: Record<TicketStatus, { label: string; variant: Variant }> = {
  OPEN: { label: "Open", variant: "danger" },
  ASSIGNED: { label: "Assigned", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "secondary" },
  REOPENED: { label: "Reopened", variant: "danger" },
};

const PRIORITY_MAP: Record<TicketPriority, { label: string; variant: Variant }> = {
  LOW: { label: "Low", variant: "secondary" },
  MEDIUM: { label: "Medium", variant: "info" },
  HIGH: { label: "High", variant: "warning" },
  CRITICAL: { label: "Critical", variant: "danger" },
};

const ROLE_MAP: Record<UserRole, { label: string; variant: Variant }> = {
  CENTRAL_LAB_MANAGER: { label: "Central Lab Manager", variant: "accent" },
  LAB_MANAGER: { label: "Lab Manager", variant: "info" },
  INSTRUCTOR: { label: "Instructor", variant: "success" },
  STUDENT: { label: "Student", variant: "secondary" },
};

const USER_STATUS_MAP: Record<UserStatus, { label: string; variant: Variant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "outline" },
  SUSPENDED: { label: "Suspended", variant: "danger" },
};

const CAMPUS_STATUS_MAP: Record<CampusStatus, { label: string; variant: Variant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  INACTIVE: { label: "Inactive", variant: "outline" },
};

const RETURN_VERIFY_MAP: Record<ReturnVerificationStatus, { label: string; variant: Variant }> = {
  PENDING: { label: "Pending Inspection", variant: "warning" },
  VERIFIED_GOOD: { label: "Verified Good", variant: "success" },
  DISPUTED_DAMAGED: { label: "Damaged", variant: "danger" },
  DISPUTED_MISSING: { label: "Missing", variant: "danger" },
  RESOLVED: { label: "Resolved", variant: "success" },
};

export function AllocationStatusBadge({ status }: { status: AllocationStatus }) {
  const cfg = ALLOCATION_MAP[status] ?? { label: status, variant: "secondary" };
  return (
    <Badge variant={cfg.variant}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </Badge>
  );
}

export function RequestStatusBadge({ status }: { status: LabRequestStatus }) {
  const cfg = REQUEST_MAP[status] ?? { label: status, variant: "secondary" };
  return (
    <Badge variant={cfg.variant}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </Badge>
  );
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const cfg = TICKET_MAP[status] ?? { label: status, variant: "secondary" };
  return (
    <Badge variant={cfg.variant}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const cfg = PRIORITY_MAP[priority] ?? { label: priority, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const cfg = ROLE_MAP[role] ?? { label: role, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  const cfg = USER_STATUS_MAP[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function CampusStatusBadge({ status }: { status: CampusStatus }) {
  const cfg = CAMPUS_STATUS_MAP[status] ?? { label: status, variant: "secondary" };
  return (
    <Badge variant={cfg.variant}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </Badge>
  );
}

export function ReturnVerificationBadge({
  status,
}: {
  status: ReturnVerificationStatus;
}) {
  const cfg = RETURN_VERIFY_MAP[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
