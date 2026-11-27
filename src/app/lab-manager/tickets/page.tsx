"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient, isBackendUnavailableError } from "@/lib/api-client";
import {
  addDemoTicketComment,
  loadDemoTickets,
  updateDemoTicket,
} from "@/lib/lab-manager-store";
import { getPartImageUrl } from "@/lib/part-images";
import {
  cn,
  formatDateTime,
  formatRelativeTime,
  getInitials,
  ISSUE_CATEGORY_LABELS,
} from "@/lib/utils";
import {
  ROLE_LABELS,
  type IssueTicketDTO,
  type TicketPriority,
  type TicketStatus,
} from "@/types/contracts";

type StatusFilterKey = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type EditableStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const STATUS_SELECTOR_OPTIONS: Array<{
  value: EditableStatus;
  label: string;
  dotClass: string;
  activeDotClass: string;
}> = [
  {
    value: "OPEN",
    label: "Open",
    dotClass: "bg-[#E05A2B]",
    activeDotClass: "bg-[#FF8A65]",
  },
  {
    value: "IN_PROGRESS",
    label: "In Progress",
    dotClass: "bg-[#D97706]",
    activeDotClass: "bg-[#FBBF24]",
  },
  {
    value: "RESOLVED",
    label: "Resolved",
    dotClass: "bg-[#2E7D32]",
    activeDotClass: "bg-[#C4F041]",
  },
  {
    value: "CLOSED",
    label: "Closed",
    dotClass: "bg-[#6B6B66]",
    activeDotClass: "bg-[#C8C8C2]",
  },
];

const PRIORITY_OPTIONS: Array<{
  value: TicketPriority;
  label: string;
  dotClass: string;
  activeDotClass: string;
  textClass: string;
}> = [
  {
    value: "LOW",
    label: "Low",
    dotClass: "bg-[#8C8C87]",
    activeDotClass: "bg-[#D4D4CE]",
    textClass: "text-[#5E5E5A]",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    dotClass: "bg-[#2563EB]",
    activeDotClass: "bg-[#93C5FD]",
    textClass: "text-[#1E3A5F]",
  },
  {
    value: "HIGH",
    label: "High",
    dotClass: "bg-[#D97706]",
    activeDotClass: "bg-[#FCD34D]",
    textClass: "text-[#92400E]",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    dotClass: "bg-[#DC2626]",
    activeDotClass: "bg-[#FCA5A5]",
    textClass: "text-[#991B1B]",
  },
];

const PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const ACTIVE_STATUS_SET = new Set<TicketStatus>([
  "OPEN",
  "ASSIGNED",
  "REOPENED",
  "IN_PROGRESS",
]);

function getStatusMeta(status: TicketStatus): {
  label: string;
  dotClass: string;
  pillClass: string;
} {
  switch (status) {
    case "OPEN":
      return {
        label: "Open",
        dotClass: "bg-[#E05A2B]",
        pillClass: "bg-[#FFF4EE] text-[#9A3412] ring-[#E05A2B]/15",
      };
    case "ASSIGNED":
      return {
        label: "Assigned",
        dotClass: "bg-[#2563EB]",
        pillClass: "bg-[#EFF6FF] text-[#1D4ED8] ring-[#2563EB]/15",
      };
    case "REOPENED":
      return {
        label: "Reopened",
        dotClass: "bg-[#DC2626]",
        pillClass: "bg-[#FEF2F2] text-[#991B1B] ring-[#DC2626]/15",
      };
    case "IN_PROGRESS":
      return {
        label: "In Progress",
        dotClass: "bg-[#D97706]",
        pillClass: "bg-[#FFFBEB] text-[#92400E] ring-[#D97706]/20",
      };
    case "RESOLVED":
      return {
        label: "Resolved",
        dotClass: "bg-[#2E7D32]",
        pillClass: "bg-[#F0F9F1] text-[#1B5E20] ring-[#2E7D32]/15",
      };
    case "CLOSED":
      return {
        label: "Closed",
        dotClass: "bg-[#73736E]",
        pillClass: "bg-[#F4F4F1] text-[#52524E] ring-black/[0.08]",
      };
  }
}

function getPriorityMeta(priority: TicketPriority) {
  return (
    PRIORITY_OPTIONS.find((p) => p.value === priority) ?? PRIORITY_OPTIONS[1]
  );
}

function toEditableStatus(status: TicketStatus): EditableStatus {
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "RESOLVED") return "RESOLVED";
  if (status === "CLOSED") return "CLOSED";
  return "OPEN";
}

function matchesStatusFilter(
  status: TicketStatus,
  filter: StatusFilterKey
): boolean {
  if (filter === "ALL") return true;
  if (filter === "OPEN") {
    return status === "OPEN" || status === "ASSIGNED" || status === "REOPENED";
  }
  return status === filter;
}

function formatStatusToastLabel(status: TicketStatus): string {
  return getStatusMeta(status).label;
}

export default function LabManagerTicketsPage() {
  const { user, isDemoMode } = useAuth();

  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingDemoFallback, setUsingDemoFallback] = useState(false);

  // Filters & search
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("ALL");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Quick-action loading tracker per ticket
  const [quickBusyId, setQuickBusyId] = useState<string | null>(null);

  // Detail & Discussion Modal state
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<EditableStatus>("IN_PROGRESS");
  const [draftPriority, setDraftPriority] = useState<TicketPriority>("MEDIUM");
  const [draftNotes, setDraftNotes] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);

  // Discussion composer
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  const effectiveDemo = isDemoMode || usingDemoFallback;

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      if (isDemoMode) {
        setTickets(loadDemoTickets());
        setUsingDemoFallback(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const res = await apiClient.tickets.list({ pageSize: 100 });
        setTickets(res.data);
        setUsingDemoFallback(false);
      } catch {
        setTickets(loadDemoTickets());
        setUsingDemoFallback(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isDemoMode]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const { status: realtimeStatus } = useRealtime({
    enabled: true,
    isDemoMode: effectiveDemo,
    eventTypes: ["ticket.created", "ticket.updated"],
    onEvent: () => {
      void load(true);
    },
    onReconnect: () => {
      void load(true);
    },
  });

  const activeTicket = useMemo(
    () => tickets.find((t) => t.id === activeTicketId) ?? null,
    [tickets, activeTicketId]
  );

  const openInspector = useCallback((ticket: IssueTicketDTO) => {
    setActiveTicketId(ticket.id);
    setDraftStatus(toEditableStatus(ticket.status));
    setDraftPriority(ticket.priority);
    setDraftNotes(ticket.resolutionNotes ?? "");
    setCommentBody("");
  }, []);

  const closeInspector = useCallback(() => {
    setActiveTicketId(null);
    setCommentBody("");
  }, []);

  // Aggregate counts for KPI strip & filter pills
  const counts = useMemo(() => {
    let open = 0;
    let inProgress = 0;
    let resolved = 0;
    let closed = 0;
    let criticalHighActive = 0;

    for (const t of tickets) {
      if (
        t.status === "OPEN" ||
        t.status === "ASSIGNED" ||
        t.status === "REOPENED"
      ) {
        open += 1;
      } else if (t.status === "IN_PROGRESS") {
        inProgress += 1;
      } else if (t.status === "RESOLVED") {
        resolved += 1;
      } else if (t.status === "CLOSED") {
        closed += 1;
      }

      if (
        ACTIVE_STATUS_SET.has(t.status) &&
        (t.priority === "CRITICAL" || t.priority === "HIGH")
      ) {
        criticalHighActive += 1;
      }
    }

    return {
      ALL: tickets.length,
      OPEN: open,
      IN_PROGRESS: inProgress,
      RESOLVED: resolved,
      CLOSED: closed,
      criticalHighActive,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return tickets
      .filter((t) => {
        if (!matchesStatusFilter(t.status, statusFilter)) return false;
        if (
          urgentOnly &&
          !(
            ACTIVE_STATUS_SET.has(t.status) &&
            (t.priority === "CRITICAL" || t.priority === "HIGH")
          )
        ) {
          return false;
        }
        if (!q) return true;

        const categoryLabel = ISSUE_CATEGORY_LABELS[t.category] ?? t.category;
        const haystack = [
          t.ticketCode,
          t.title,
          t.description,
          t.item?.name ?? "",
          t.item?.code ?? "",
          t.createdBy.fullName,
          t.createdBy.email,
          categoryLabel,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aActive = ACTIVE_STATUS_SET.has(a.status) ? 1 : 0;
        const bActive = ACTIVE_STATUS_SET.has(b.status) ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        if (aActive === 1) {
          const pDiff =
            PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          if (pDiff !== 0) return pDiff;
        }

        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
  }, [tickets, statusFilter, urgentOnly, searchQuery]);

  // Unified mutation helper for both inline quick actions and modal resolution save
  const applyTicketUpdate = useCallback(
    async (
      ticket: IssueTicketDTO,
      patch: {
        status?: TicketStatus;
        priority?: TicketPriority;
        resolutionNotes?: string | null;
      },
      successMessage: string
    ) => {
      if (effectiveDemo) {
        const updated = updateDemoTicket(ticket.id, patch, user);
        setTickets(updated);
        toast.success(successMessage);
        return true;
      }

      try {
        const res = await apiClient.tickets.update(ticket.id, patch);
        setTickets((prev) =>
          prev.map((row) => (row.id === ticket.id ? res.data : row))
        );
        toast.success(successMessage);
        return true;
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          setUsingDemoFallback(true);
          const updated = updateDemoTicket(ticket.id, patch, user);
          setTickets(updated);
          toast.success(successMessage);
          return true;
        }
        toast.error(
          err instanceof Error ? err.message : "Failed to update ticket"
        );
        return false;
      }
    },
    [effectiveDemo, user]
  );

  const handleQuickStatus = async (
    ticket: IssueTicketDTO,
    nextStatus: TicketStatus
  ) => {
    setQuickBusyId(ticket.id);
    try {
      const ok = await applyTicketUpdate(
        ticket,
        { status: nextStatus },
        `${ticket.ticketCode} moved to ${formatStatusToastLabel(nextStatus)}`
      );
      if (ok && activeTicketId === ticket.id) {
        setDraftStatus(toEditableStatus(nextStatus));
      }
    } finally {
      setQuickBusyId(null);
    }
  };

  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    setSavingResolution(true);
    try {
      await applyTicketUpdate(
        activeTicket,
        {
          status: draftStatus,
          priority: draftPriority,
          resolutionNotes: draftNotes.trim() || null,
        },
        `Saved ${activeTicket.ticketCode} (${formatStatusToastLabel(draftStatus)})`
      );
    } finally {
      setSavingResolution(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentBody.trim();
    if (!activeTicket || !trimmed) return;

    setSendingComment(true);
    try {
      if (effectiveDemo) {
        const updated = addDemoTicketComment(activeTicket.id, trimmed, user);
        setTickets(updated);
        setCommentBody("");
        toast.success("Reply posted");
        requestAnimationFrame(() =>
          commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
        );
        return;
      }

      try {
        const res = await apiClient.tickets.addComment(activeTicket.id, {
          body: trimmed,
        });
        setTickets((prev) =>
          prev.map((row) => (row.id === activeTicket.id ? res.data : row))
        );
        setCommentBody("");
        toast.success("Reply posted");
        requestAnimationFrame(() =>
          commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
        );
      } catch (err) {
        if (isBackendUnavailableError(err)) {
          setUsingDemoFallback(true);
          const updated = addDemoTicketComment(activeTicket.id, trimmed, user);
          setTickets(updated);
          setCommentBody("");
          toast.success("Reply posted");
          requestAnimationFrame(() =>
            commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
          );
          return;
        }
        toast.error(
          err instanceof Error ? err.message : "Failed to post reply"
        );
      }
    } finally {
      setSendingComment(false);
    }
  };

  const statusTabs: Array<{
    key: StatusFilterKey;
    label: string;
    count: number;
  }> = [
    { key: "ALL", label: "All", count: counts.ALL },
    { key: "OPEN", label: "Open", count: counts.OPEN },
    { key: "IN_PROGRESS", label: "In Progress", count: counts.IN_PROGRESS },
    { key: "RESOLVED", label: "Resolved", count: counts.RESOLVED },
    { key: "CLOSED", label: "Closed", count: counts.CLOSED },
  ];

  const hasModalChanges = Boolean(
    activeTicket &&
      (draftStatus !== toEditableStatus(activeTicket.status) ||
        draftPriority !== activeTicket.priority ||
        draftNotes.trim() !== (activeTicket.resolutionNotes ?? "").trim())
  );

  return (
    <DottedGridCanvas pannable={false} className="p-3.5 pb-16 sm:p-7 sm:pb-16">
      <div
        className="mx-auto flex w-full max-w-[1380px] min-w-0 flex-1 flex-col gap-5 sm:gap-6"
        style={{
          fontFamily:
            "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* Editorial Workbench Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[30px] font-medium leading-tight tracking-[-0.03em] text-black">
              Campus Issue Tickets
            </h1>
            <p className="mt-1 max-w-2xl text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
              Triage equipment damage, calibration requests, and stock
              discrepancies raised by campus instructors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-[#5E5E5A] ring-1 ring-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  realtimeStatus === "connected"
                    ? "bg-[#2E7D32]"
                    : realtimeStatus === "demo"
                      ? "bg-[#84B819]"
                      : "bg-[#D97706]"
                )}
              />
              <span>
                {realtimeStatus === "connected"
                  ? "Live updates"
                  : realtimeStatus === "demo"
                    ? "Campus sandbox"
                    : "Syncing"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black ring-1 ring-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all hover:bg-[#F7F7F5] disabled:opacity-60"
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* 4-Stat Summary Strip */}
        <section
          aria-label="Ticket summary"
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {/* Open */}
          <button
            type="button"
            onClick={() => {
              setUrgentOnly(false);
              setStatusFilter((prev) => (prev === "OPEN" ? "ALL" : "OPEN"));
            }}
            className={cn(
              "group flex min-w-0 cursor-pointer flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 text-left ring-1 shadow-[0_8px_28px_rgba(0,0,0,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]",
              statusFilter === "OPEN" && !urgentOnly
                ? "ring-2 ring-black"
                : "ring-black/[0.05]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5E5E5A]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#E05A2B]" />
                <span>Open</span>
              </span>
              <ShieldAlert className="h-4 w-4 shrink-0 text-black/30 transition-colors group-hover:text-black/60" />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                {counts.OPEN}
              </span>
              <span className="text-[12px] text-[#5E5E5A] truncate">
                Awaiting triage
              </span>
            </div>
          </button>

          {/* In Progress */}
          <button
            type="button"
            onClick={() => {
              setUrgentOnly(false);
              setStatusFilter((prev) =>
                prev === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS"
              );
            }}
            className={cn(
              "group flex min-w-0 cursor-pointer flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 text-left ring-1 shadow-[0_8px_28px_rgba(0,0,0,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]",
              statusFilter === "IN_PROGRESS" && !urgentOnly
                ? "ring-2 ring-black"
                : "ring-black/[0.05]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5E5E5A]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#D97706]" />
                <span>In Progress</span>
              </span>
              <Wrench className="h-4 w-4 shrink-0 text-black/30 transition-colors group-hover:text-black/60" />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                {counts.IN_PROGRESS}
              </span>
              <span className="text-[12px] text-[#5E5E5A] truncate">
                Active repair
              </span>
            </div>
          </button>

          {/* Critical / High */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ALL");
              setUrgentOnly((prev) => !prev);
            }}
            className={cn(
              "group flex min-w-0 cursor-pointer flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 text-left ring-1 shadow-[0_8px_28px_rgba(0,0,0,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]",
              urgentOnly ? "ring-2 ring-[#DC2626]" : "ring-black/[0.05]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5E5E5A]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#DC2626]" />
                <span className="truncate">Critical / High</span>
              </span>
              <Clock className="h-4 w-4 shrink-0 text-black/30 transition-colors group-hover:text-black/60" />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                {counts.criticalHighActive}
              </span>
              <span className="text-[12px] text-[#5E5E5A] truncate">
                {counts.criticalHighActive > 0 ? "Needs attention" : "All clear"}
              </span>
            </div>
          </button>

          {/* Resolved */}
          <button
            type="button"
            onClick={() => {
              setUrgentOnly(false);
              setStatusFilter((prev) =>
                prev === "RESOLVED" ? "ALL" : "RESOLVED"
              );
            }}
            className={cn(
              "group flex min-w-0 cursor-pointer flex-col justify-between rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 text-left ring-1 shadow-[0_8px_28px_rgba(0,0,0,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]",
              statusFilter === "RESOLVED" && !urgentOnly
                ? "ring-2 ring-black"
                : "ring-black/[0.05]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5E5E5A]">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2E7D32]" />
                <span>Resolved</span>
              </span>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-black/30 transition-colors group-hover:text-black/60" />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <span className="text-[28px] sm:text-[32px] font-semibold leading-none tracking-[-0.03em] text-black tabular-nums">
                {counts.RESOLVED}
              </span>
              <span className="text-[12px] text-[#5E5E5A] truncate tabular-nums">
                {counts.CLOSED > 0
                  ? `${counts.CLOSED} closed`
                  : "Completed"}
              </span>
            </div>
          </button>
        </section>

        {/* Filter Pills + Search Toolbar */}
        <section
          aria-label="Filter and search tickets"
          className="flex flex-col gap-3 rounded-[24px] sm:rounded-[28px] bg-white p-3 sm:p-3.5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] lg:flex-row lg:items-center lg:justify-between"
        >
          {/* Horizontally Scrollable Status Filter Pills */}
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.key && !urgentOnly;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.key);
                    setUrgentOnly(false);
                  }}
                  className={cn(
                    "inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-all",
                    active
                      ? "bg-black text-white shadow-[0_6px_18px_rgba(0,0,0,0.14)]"
                      : "bg-[#F5F5F2] text-black/80 hover:bg-[#EBEBE6] hover:text-black"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "tabular-nums font-semibold",
                      active ? "text-[#C4F041]" : "text-black/45"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {urgentOnly && (
              <button
                type="button"
                onClick={() => setUrgentOnly(false)}
                className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#FEF2F2] px-4 text-[13px] font-medium text-[#991B1B] ring-1 ring-[#DC2626]/20 transition-colors hover:bg-[#FEE2E2]"
              >
                <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
                <span>Critical & High</span>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative w-full min-w-0 lg:w-80 xl:w-96 shrink-0">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5E5E5A]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, title, equipment, reporter..."
              aria-label="Search issue tickets"
              className="min-h-[44px] w-full rounded-full bg-[#F5F5F2] pl-10 pr-10 text-[16px] sm:text-[14px] text-black placeholder:text-[#7A7A74] outline-none ring-1 ring-transparent transition-all focus:bg-white focus:ring-black/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#5E5E5A] transition-colors hover:bg-black/5 hover:text-black"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>

        {/* Ticket Cards Feed */}
        {loading ? (
          <div className="grid gap-4">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="rounded-[24px] sm:rounded-[28px] bg-white p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] animate-pulse"
              >
                <div className="flex gap-4">
                  <div className="h-20 w-24 shrink-0 rounded-[18px] bg-[#F1F1ED]" />
                  <div className="flex-1 space-y-2.5">
                    <div className="h-4 w-48 rounded-full bg-[#F1F1ED]" />
                    <div className="h-5 w-3/4 rounded-full bg-[#F1F1ED]" />
                    <div className="h-4 w-2/3 rounded-full bg-[#F1F1ED]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[24px] sm:rounded-[28px] bg-white px-6 py-14 text-center ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F5F5F2] text-black/65">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-black">
              {tickets.length === 0
                ? "No campus issue tickets yet"
                : "No matching tickets"}
            </h2>
            <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-[#5E5E5A]">
              {tickets.length === 0
                ? "Equipment damage, calibration requests, and inventory discrepancy tickets raised by instructors will appear here."
                : "Try clearing your search term or switching back to all ticket statuses."}
            </p>
            {(statusFilter !== "ALL" || urgentOnly || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setUrgentOnly(false);
                  setSearchQuery("");
                }}
                className="mt-5 inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-black px-5 text-[13px] font-semibold text-white transition-colors hover:bg-black/85"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTickets.map((ticket) => {
              const statusMeta = getStatusMeta(ticket.status);
              const priorityMeta = getPriorityMeta(ticket.priority);
              const isBusy = quickBusyId === ticket.id;
              const commentCount = ticket.comments?.length ?? 0;

              return (
                <article
                  key={ticket.id}
                  className="group min-w-0 rounded-[24px] sm:rounded-[28px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.05] shadow-[0_8px_28px_rgba(0,0,0,0.045)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.075)]"
                >
                  {/* Top Content Row */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    {/* Framed Equipment WebP Thumbnail or Category Visual */}
                    {ticket.item ? (
                      <button
                        type="button"
                        onClick={() => openInspector(ticket)}
                        aria-label={`Inspect ${ticket.ticketCode}`}
                        className="relative h-24 w-full sm:h-24 sm:w-28 shrink-0 cursor-pointer overflow-hidden rounded-[18px] bg-[#F5F5F2] ring-1 ring-black/[0.05]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getPartImageUrl(ticket.item.code)}
                          alt={ticket.item.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2 py-0.5 text-[12px] font-semibold text-black shadow-sm ring-1 ring-black/[0.06]">
                          {ticket.item.code}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openInspector(ticket)}
                        aria-label={`Inspect ${ticket.ticketCode}`}
                        className="flex h-16 w-16 sm:h-24 sm:w-28 shrink-0 cursor-pointer items-center justify-center rounded-[18px] bg-[#F5F5F2] text-[#5E5E5A] ring-1 ring-black/[0.05]"
                      >
                        <Wrench className="h-6 w-6" />
                      </button>
                    )}

                    {/* Ticket Core Info */}
                    <div className="min-w-0 flex-1">
                      {/* Meta strip: Ticket code, Status pill, Priority dot, Category */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-[13px] font-semibold tracking-tight text-black">
                          {ticket.ticketCode}
                        </span>

                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium ring-1",
                            statusMeta.pillClass
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              statusMeta.dotClass
                            )}
                          />
                          <span>{statusMeta.label}</span>
                        </span>

                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[13px] font-medium",
                            priorityMeta.textClass
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              priorityMeta.dotClass
                            )}
                          />
                          <span>{priorityMeta.label} priority</span>
                        </span>

                        <span className="text-[13px] text-[#5E5E5A]">
                          {ISSUE_CATEGORY_LABELS[ticket.category]}
                        </span>
                      </div>

                      {/* Title */}
                      <h2 className="mt-2 min-w-0 text-[16px] sm:text-[18px] font-semibold leading-snug tracking-[-0.02em] text-black break-words">
                        <button
                          type="button"
                          onClick={() => openInspector(ticket)}
                          className="cursor-pointer text-left hover:underline decoration-black/30 underline-offset-4"
                        >
                          {ticket.title}
                        </button>
                      </h2>

                      {/* Description */}
                      <p className="mt-1 text-[14px] leading-relaxed text-[#5E5E5A] line-clamp-2 break-words">
                        {ticket.description}
                      </p>

                      {/* Equipment & Reporter Metadata */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#5E5E5A]">
                        {ticket.item && (
                          <span className="min-w-0 truncate">
                            Equipment:{" "}
                            <strong className="font-medium text-black">
                              {ticket.item.name}
                            </strong>
                          </span>
                        )}
                        <span className="min-w-0 truncate">
                          Raised by{" "}
                          <strong className="font-medium text-black">
                            {ticket.createdBy.fullName}
                          </strong>
                        </span>
                        <span
                          className="tabular-nums"
                          title={formatDateTime(ticket.updatedAt)}
                        >
                          Updated {formatRelativeTime(ticket.updatedAt)}
                        </span>
                      </div>

                      {/* Resolution Notes Preview when present */}
                      {ticket.resolutionNotes && (
                        <div className="mt-3 flex items-start gap-2 rounded-[16px] bg-[#F4F9E3] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#2C3E11] ring-1 ring-[#C4F041]/50">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#4B6B16]" />
                          <p className="min-w-0 line-clamp-2 break-words">
                            <span className="font-semibold">Resolution:</span>{" "}
                            {ticket.resolutionNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Bar: Inline Quick-Status Controls + Inspector Trigger */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-black/[0.06] pt-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {(ticket.status === "OPEN" ||
                        ticket.status === "ASSIGNED" ||
                        ticket.status === "REOPENED") && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickStatus(ticket, "IN_PROGRESS")
                            }
                            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-black px-4 text-[13px] font-semibold text-white transition-all hover:bg-black/85 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                            <span>Start Work</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickStatus(ticket, "RESOLVED")
                            }
                            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#C4F041] px-4 text-[13px] font-semibold text-black transition-all hover:bg-[#b8e532] disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Mark Resolved</span>
                          </button>
                        </>
                      )}

                      {ticket.status === "IN_PROGRESS" && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickStatus(ticket, "RESOLVED")
                            }
                            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#C4F041] px-4 text-[13px] font-semibold text-black transition-all hover:bg-[#b8e532] disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span>Mark Resolved</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickStatus(ticket, "CLOSED")
                            }
                            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#F5F5F2] px-4 text-[13px] font-semibold text-black transition-all hover:bg-[#EAEAE4] disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4 text-[#5E5E5A]" />
                            <span>Close</span>
                          </button>
                        </>
                      )}

                      {ticket.status === "RESOLVED" && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickStatus(ticket, "CLOSED")
                            }
                            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-black px-4 text-[13px] font-semibold text-white transition-all hover:bg-black/85 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            <span>Close</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              void handleQuickStatus(ticket, "OPEN")
                            }
                            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#F5F5F2] px-4 text-[13px] font-semibold text-black transition-all hover:bg-[#EAEAE4] disabled:opacity-50"
                          >
                            <RotateCcw className="h-4 w-4 text-[#5E5E5A]" />
                            <span>Reopen</span>
                          </button>
                        </>
                      )}

                      {ticket.status === "CLOSED" && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleQuickStatus(ticket, "OPEN")}
                          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#F5F5F2] px-4 text-[13px] font-semibold text-black transition-all hover:bg-[#EAEAE4] disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4 text-[#5E5E5A]" />
                          )}
                          <span>Reopen</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openInspector(ticket)}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full bg-[#F5F5F2] px-4 text-[13px] font-semibold text-black ring-1 ring-black/[0.05] transition-colors hover:bg-[#EAEAE4]"
                    >
                      <MessageSquare className="h-4 w-4 text-[#5E5E5A]" />
                      <span>Inspect & Discuss</span>
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[12px] font-semibold text-black tabular-nums ring-1 ring-black/[0.06]">
                        {commentCount}
                      </span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Detail, Resolution & Live Discussion Modal */}
      <Dialog
        open={Boolean(activeTicket)}
        onOpenChange={(open) => {
          if (!open) closeInspector();
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-[28px] border-0 bg-white p-0 shadow-[0_24px_64px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.06]"
          style={{
            fontFamily:
              "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {activeTicket && (
            <>
              {/* Sticky Modal Header */}
              <DialogHeader className="border-b border-black/[0.06] px-5 py-4 sm:px-6 sm:py-5 pr-12">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="text-[13px] font-semibold text-black">
                    {activeTicket.ticketCode}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-medium ring-1",
                      getStatusMeta(activeTicket.status).pillClass
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getStatusMeta(activeTicket.status).dotClass
                      )}
                    />
                    <span>{getStatusMeta(activeTicket.status).label}</span>
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[13px] font-medium",
                      getPriorityMeta(activeTicket.priority).textClass
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getPriorityMeta(activeTicket.priority).dotClass
                      )}
                    />
                    <span>{getPriorityMeta(activeTicket.priority).label}</span>
                  </span>
                  <span className="text-[13px] text-[#5E5E5A]">
                    {ISSUE_CATEGORY_LABELS[activeTicket.category]}
                  </span>
                </div>

                <DialogTitle className="mt-2 text-[19px] sm:text-[21px] font-semibold leading-snug tracking-[-0.02em] text-black">
                  {activeTicket.title}
                </DialogTitle>

                <DialogDescription className="mt-1 text-[13px] leading-relaxed text-[#5E5E5A]">
                  Raised by{" "}
                  <span className="font-medium text-black">
                    {activeTicket.createdBy.fullName}
                  </span>{" "}
                  ({ROLE_LABELS[activeTicket.createdBy.role]}) · Opened{" "}
                  {formatDateTime(activeTicket.createdAt)} · Updated{" "}
                  {formatRelativeTime(activeTicket.updatedAt)}
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable Inspector Body */}
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {/* Full Description */}
                <div className="rounded-[20px] bg-[#F7F7F5] p-4 ring-1 ring-black/[0.04]">
                  <p className="text-[13px] font-medium text-[#5E5E5A]">
                    Issue Description
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-black/85">
                    {activeTicket.description}
                  </p>
                </div>

                {/* Referenced Equipment Card with WebP Photo */}
                {activeTicket.item && (
                  <div className="flex items-center gap-3.5 rounded-[20px] bg-[#F7F7F5] p-3 ring-1 ring-black/[0.04]">
                    <div className="h-16 w-20 sm:h-20 sm:w-24 shrink-0 overflow-hidden rounded-[14px] bg-white ring-1 ring-black/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getPartImageUrl(activeTicket.item.code)}
                        alt={activeTicket.item.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[#5E5E5A]">
                        Referenced Equipment
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-semibold text-black">
                        {activeTicket.item.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#5E5E5A]">
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-semibold text-black ring-1 ring-black/[0.06]">
                          {activeTicket.item.code}
                        </span>
                        <span className="truncate">
                          {activeTicket.campus.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attachments (if any) */}
                {activeTicket.attachmentUrls &&
                  activeTicket.attachmentUrls.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[13px] font-medium text-[#5E5E5A]">
                        Attached Photos ({activeTicket.attachmentUrls.length})
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        {activeTicket.attachmentUrls.map((url, idx) => (
                          <a
                            key={`${url}-${idx}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-[16px] bg-[#F7F7F5] ring-1 ring-black/[0.06]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Ticket attachment ${idx + 1}`}
                              className="h-24 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Resolution & Triage Control Form */}
                <form
                  onSubmit={handleSaveResolution}
                  className="space-y-4 rounded-[22px] bg-white p-4 sm:p-5 ring-1 ring-black/[0.07] shadow-[0_6px_20px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-black">
                      Triage & Resolution
                    </h3>
                    {activeTicket.resolvedAt && (
                      <span className="text-[12px] text-[#2E7D32] tabular-nums">
                        Resolved {formatDateTime(activeTicket.resolvedAt)}
                      </span>
                    )}
                  </div>

                  {/* Tactile Status Pill Selector */}
                  <div className="space-y-2">
                    <span className="block text-[13px] font-medium text-[#5E5E5A]">
                      Status
                    </span>
                    <div
                      role="radiogroup"
                      aria-label="Ticket status"
                      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                    >
                      {STATUS_SELECTOR_OPTIONS.map((opt) => {
                        const selected = draftStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setDraftStatus(opt.value)}
                            className={cn(
                              "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[13px] font-medium transition-all",
                              selected
                                ? "bg-black text-white shadow-[0_6px_16px_rgba(0,0,0,0.14)]"
                                : "bg-[#F5F5F2] text-black/80 hover:bg-[#EAEAE4] hover:text-black"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                selected ? opt.activeDotClass : opt.dotClass
                              )}
                            />
                            <span className="truncate">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tactile Priority Pill Selector */}
                  <div className="space-y-2">
                    <span className="block text-[13px] font-medium text-[#5E5E5A]">
                      Priority
                    </span>
                    <div
                      role="radiogroup"
                      aria-label="Ticket priority"
                      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                    >
                      {PRIORITY_OPTIONS.map((opt) => {
                        const selected = draftPriority === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setDraftPriority(opt.value)}
                            className={cn(
                              "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full px-3 text-[13px] font-medium transition-all",
                              selected
                                ? "bg-black text-white shadow-[0_6px_16px_rgba(0,0,0,0.14)]"
                                : "bg-[#F5F5F2] text-black/80 hover:bg-[#EAEAE4] hover:text-black"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                selected ? opt.activeDotClass : opt.dotClass
                              )}
                            />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resolution Notes */}
                  <div className="space-y-2">
                    <label
                      htmlFor="lm-resolution-notes"
                      className="block text-[13px] font-medium text-[#5E5E5A]"
                    >
                      Resolution Notes
                    </label>
                    <Textarea
                      id="lm-resolution-notes"
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Document repair action, replacement serial number, vendor RMA, or stock adjustment..."
                      className="min-h-[96px] rounded-[18px] border-0 bg-[#F7F7F5] px-4 py-3 text-[16px] sm:text-[14px] text-black placeholder:text-[#7A7A74] ring-1 ring-black/[0.08] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-black/25"
                    />
                  </div>

                  {/* Lime Save Resolution CTA */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[13px] text-[#5E5E5A]">
                      {hasModalChanges
                        ? "Unsaved triage changes"
                        : "All changes synced"}
                    </span>
                    <button
                      type="submit"
                      disabled={savingResolution}
                      className="inline-flex min-h-[46px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-full bg-[#C4F041] px-6 text-[14px] font-semibold text-black shadow-[0_6px_18px_rgba(196,240,65,0.35)] transition-all hover:bg-[#b8e532] disabled:opacity-60"
                    >
                      {savingResolution ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Save Resolution</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Live Discussion Thread */}
                <section
                  aria-label="Discussion thread"
                  className="space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-black">
                      Discussion Thread
                    </h3>
                    <span className="rounded-full bg-[#F5F5F2] px-2.5 py-0.5 text-[12px] font-semibold text-[#5E5E5A] tabular-nums">
                      {activeTicket.comments?.length ?? 0}{" "}
                      {(activeTicket.comments?.length ?? 0) === 1
                        ? "message"
                        : "messages"}
                    </span>
                  </div>

                  <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
                    {activeTicket.comments &&
                    activeTicket.comments.length > 0 ? (
                      activeTicket.comments.map((comment) => {
                        const isLabTeam =
                          comment.author.role === "LAB_MANAGER" ||
                          comment.author.role === "CENTRAL_LAB_MANAGER";
                        return (
                          <div
                            key={comment.id}
                            className={cn(
                              "rounded-[18px] p-3.5 ring-1",
                              isLabTeam
                                ? "bg-[#F4F9E3]/70 ring-[#C4F041]/45"
                                : "bg-[#F7F7F5] ring-black/[0.05]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                  className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                                    isLabTeam
                                      ? "bg-black text-[#C4F041]"
                                      : "bg-white text-black ring-1 ring-black/[0.08]"
                                  )}
                                >
                                  {getInitials(comment.author.fullName)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-[13px] font-semibold text-black">
                                    {comment.author.fullName}
                                  </p>
                                  <p className="text-[12px] text-[#5E5E5A]">
                                    {ROLE_LABELS[comment.author.role]}
                                  </p>
                                </div>
                              </div>
                              <span
                                className="shrink-0 text-[12px] text-[#5E5E5A] tabular-nums"
                                title={formatDateTime(comment.createdAt)}
                              >
                                {formatRelativeTime(comment.createdAt)}
                              </span>
                            </div>
                            <p className="mt-2.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-black/85">
                              {comment.body}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-[18px] bg-[#F7F7F5] px-4 py-6 text-center text-[13px] text-[#5E5E5A] ring-1 ring-black/[0.04]">
                        No replies yet. Post an update below for the reporting
                        instructor.
                      </div>
                    )}
                    <div ref={commentsEndRef} />
                  </div>

                  {/* Inline Reply Composer */}
                  <form
                    onSubmit={handleAddComment}
                    className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
                  >
                    <Textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          (e.metaKey || e.ctrlKey) &&
                          e.key === "Enter" &&
                          commentBody.trim() &&
                          !sendingComment
                        ) {
                          e.preventDefault();
                          void handleAddComment(e);
                        }
                      }}
                      placeholder="Reply to instructor with diagnostic findings or ETA..."
                      aria-label="Reply to ticket"
                      className="min-h-[48px] flex-1 resize-none rounded-[18px] border-0 bg-[#F7F7F5] px-4 py-3 text-[16px] sm:text-[14px] text-black placeholder:text-[#7A7A74] ring-1 ring-black/[0.08] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-black/25"
                    />
                    <button
                      type="submit"
                      disabled={sendingComment || !commentBody.trim()}
                      className="inline-flex min-h-[46px] shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-black px-5 text-[13px] font-semibold text-white transition-all hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {sendingComment ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>Send Reply</span>
                    </button>
                  </form>
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DottedGridCanvas>
  );
}
