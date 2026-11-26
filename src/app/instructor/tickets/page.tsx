"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  ChevronUp,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Wrench,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { apiClient, isBackendUnavailableError } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_TICKETS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import { cn, formatDateTime, ISSUE_CATEGORY_LABELS } from "@/lib/utils";
import {
  ROLE_LABELS,
  type CampusInventoryDTO,
  type IssueCategory,
  type IssueTicketDTO,
  type TicketCommentDTO,
  type TicketPriority,
  type TicketStatus,
} from "@/types/contracts";

type StatusFilterKey = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED";

const PRIORITY_OPTIONS: Array<{
  value: TicketPriority;
  label: string;
  dotClass: string;
  activeDotClass: string;
}> = [
  {
    value: "LOW",
    label: "Low",
    dotClass: "bg-[#3E6B48]",
    activeDotClass: "bg-[#C4F041]",
  },
  {
    value: "MEDIUM",
    label: "Medium",
    dotClass: "bg-[#D98A1C]",
    activeDotClass: "bg-[#F3BD77]",
  },
  {
    value: "HIGH",
    label: "High",
    dotClass: "bg-[#E05A2B]",
    activeDotClass: "bg-[#FA8E66]",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    dotClass: "bg-[#C92A2A]",
    activeDotClass: "bg-[#FF6B6B]",
  },
];

function getTicketStatusMeta(status: TicketStatus): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  switch (status) {
    case "OPEN":
      return {
        label: "Open",
        dotClass: "bg-[#E05A2B]",
        textClass: "text-black",
      };
    case "ASSIGNED":
      return {
        label: "Assigned",
        dotClass: "bg-[#2C7DA0]",
        textClass: "text-black",
      };
    case "IN_PROGRESS":
      return {
        label: "In Progress",
        dotClass: "bg-[#D98A1C]",
        textClass: "text-black",
      };
    case "RESOLVED":
      return {
        label: "Resolved",
        dotClass: "bg-[#3E6B48]",
        textClass: "text-black",
      };
    case "CLOSED":
      return {
        label: "Closed",
        dotClass: "bg-[#5E5E5A]",
        textClass: "text-[#5E5E5A]",
      };
    case "REOPENED":
      return {
        label: "Reopened",
        dotClass: "bg-[#C92A2A]",
        textClass: "text-black",
      };
  }
}

function getPriorityMeta(priority: TicketPriority): {
  label: string;
  dotClass: string;
  textClass: string;
} {
  switch (priority) {
    case "LOW":
      return {
        label: "Low",
        dotClass: "bg-[#3E6B48]",
        textClass: "text-[#5E5E5A]",
      };
    case "MEDIUM":
      return {
        label: "Medium",
        dotClass: "bg-[#D98A1C]",
        textClass: "text-black",
      };
    case "HIGH":
      return {
        label: "High",
        dotClass: "bg-[#E05A2B]",
        textClass: "text-black",
      };
    case "CRITICAL":
      return {
        label: "Critical",
        dotClass: "bg-[#C92A2A]",
        textClass: "text-[#9B1C1C]",
      };
  }
}

function matchesStatusFilter(
  status: TicketStatus,
  filter: StatusFilterKey
): boolean {
  if (filter === "ALL") return true;
  if (filter === "OPEN") {
    return status === "OPEN" || status === "ASSIGNED" || status === "REOPENED";
  }
  if (filter === "IN_PROGRESS") {
    return status === "IN_PROGRESS";
  }
  return status === "RESOLVED" || status === "CLOSED";
}

export default function InstructorTicketsPage() {
  const { user, isDemoMode } = useAuth();

  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDemoFallback, setUsingDemoFallback] = useState(false);

  // Mobile form toggle (collapsed by default on < lg so active tickets appear first)
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  // Filter & search state
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create ticket form
  const [category, setCategory] = useState<IssueCategory>(
    "MALFUNCTIONING_EQUIPMENT"
  );
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [itemId, setItemId] = useState<string>("NONE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Discussion modal
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tRes, invRes] = await Promise.all([
        apiClient.tickets.list({ pageSize: 50 }),
        apiClient.inventory.list({ pageSize: 100 }),
      ]);
      setTickets(tRes.data);
      setInventory(invRes.data);
      setUsingDemoFallback(false);
    } catch {
      setTickets(DEMO_TICKETS);
      setInventory(DEMO_CAMPUS_INVENTORY);
      setUsingDemoFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const inventoryById = useMemo(() => {
    const map = new Map<string, CampusInventoryDTO>();
    for (const inv of inventory) {
      map.set(inv.itemId, inv);
      map.set(inv.item.id, inv);
    }
    return map;
  }, [inventory]);

  const inventoryByCode = useMemo(() => {
    const map = new Map<string, CampusInventoryDTO>();
    for (const inv of inventory) {
      map.set(inv.item.code, inv);
    }
    return map;
  }, [inventory]);

  const selectedInventoryItem = useMemo(() => {
    if (itemId === "NONE") return null;
    return inventoryById.get(itemId) ?? null;
  }, [itemId, inventoryById]);

  const activeTicket = useMemo(() => {
    if (!activeTicketId) return null;
    return tickets.find((t) => t.id === activeTicketId) ?? null;
  }, [activeTicketId, tickets]);

  const filterCounts = useMemo(() => {
    const openCount = tickets.filter((t) =>
      matchesStatusFilter(t.status, "OPEN")
    ).length;
    const inProgressCount = tickets.filter((t) =>
      matchesStatusFilter(t.status, "IN_PROGRESS")
    ).length;
    const resolvedCount = tickets.filter((t) =>
      matchesStatusFilter(t.status, "RESOLVED")
    ).length;
    return {
      ALL: tickets.length,
      OPEN: openCount,
      IN_PROGRESS: inProgressCount,
      RESOLVED: resolvedCount,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (!matchesStatusFilter(t.status, statusFilter)) return false;
      if (!q) return true;
      return (
        t.ticketCode.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        ISSUE_CATEGORY_LABELS[t.category].toLowerCase().includes(q) ||
        (t.item?.name.toLowerCase().includes(q) ?? false) ||
        (t.item?.code.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tickets, statusFilter, searchQuery]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("Please select an image file (JPG, PNG, WEBP)");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      let usedPreview = false;
      for (const file of imageFiles) {
        try {
          const res = await apiClient.uploads.uploadFile(file);
          uploadedUrls.push(res.data.url);
        } catch {
          uploadedUrls.push(URL.createObjectURL(file));
          usedPreview = true;
        }
      }
      setAttachmentUrls((prev) => [...prev, ...uploadedUrls]);
      toast.success(
        usedPreview
          ? imageFiles.length > 1
            ? `${imageFiles.length} photos attached (preview)`
            : "Photo attached (preview)"
          : imageFiles.length > 1
            ? `${imageFiles.length} photos attached to ticket`
            : "Photo attached to ticket"
      );
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachmentUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const buildLocalDemoTicket = (): IssueTicketDTO => {
    const now = new Date().toISOString();
    const campus = user?.campus ?? {
      id: "demo-campus-01",
      code: "CMP-01",
      name: "Bengaluru North Campus",
    };
    const codePrefix = campus.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const nextNum = String(85 + tickets.length).padStart(4, "0");
    const matchedItem = selectedInventoryItem;

    return {
      id: `tkt-local-${Date.now()}`,
      ticketCode: `TKT-${codePrefix}-${nextNum}`,
      campusId: campus.id,
      createdById: user?.id ?? "demo-user-inst-01",
      assignedToId: "demo-user-lm-01",
      itemId: matchedItem ? matchedItem.item.id : null,
      category,
      priority,
      status: "OPEN",
      title: title.trim(),
      description: description.trim(),
      attachmentUrls: [...attachmentUrls],
      resolutionNotes: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      campus: {
        id: campus.id,
        code: campus.code,
        name: campus.name,
      },
      createdBy: {
        id: user?.id ?? "demo-user-inst-01",
        fullName: user?.fullName ?? "Prof. Ananya Deshmukh",
        email: user?.email ?? "instructor1.cmp01@campuslab.edu",
        role: user?.role ?? "INSTRUCTOR",
      },
      assignedTo: {
        id: "demo-user-lm-01",
        fullName: "Rajesh Kulkarni",
        email: "labmanager.cmp01@campuslab.edu",
      },
      item: matchedItem
        ? {
            id: matchedItem.item.id,
            code: matchedItem.item.code,
            name: matchedItem.item.name,
          }
        : null,
      comments: [],
    };
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setItemId("NONE");
    setPriority("MEDIUM");
    setAttachmentUrls([]);
    setMobileFormOpen(false);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Issue summary and description are required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.tickets.create({
        category,
        priority,
        itemId: itemId === "NONE" ? null : itemId,
        title: title.trim(),
        description: description.trim(),
        attachmentUrls,
      });
      setTickets((prev) => [res.data, ...prev]);
      toast.success(
        `Issue ticket ${res.data.ticketCode} raised to Campus Lab Manager`
      );
      resetForm();
    } catch (err) {
      if (isDemoMode || usingDemoFallback || isBackendUnavailableError(err)) {
        const localTicket = buildLocalDemoTicket();
        setTickets((prev) => [localTicket, ...prev]);
        setUsingDemoFallback(true);
        toast.success(
          `Issue ticket ${localTicket.ticketCode} raised to Campus Lab Manager`
        );
        resetForm();
      } else {
        toast.error(
          err instanceof Error ? err.message : "Failed to raise ticket"
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !commentBody.trim() || sendingComment) return;

    const trimmed = commentBody.trim();
    const applyLocalComment = () => {
      const newComment: TicketCommentDTO = {
        id: `cmt-local-${Date.now()}`,
        ticketId: activeTicket.id,
        authorId: user?.id ?? "demo-user-inst-01",
        body: trimmed,
        attachmentUrls: [],
        createdAt: new Date().toISOString(),
        author: {
          id: user?.id ?? "demo-user-inst-01",
          fullName: user?.fullName ?? "Prof. Ananya Deshmukh",
          role: user?.role ?? "INSTRUCTOR",
        },
      };

      setTickets((prev) =>
        prev.map((t) =>
          t.id === activeTicket.id
            ? {
                ...t,
                updatedAt: newComment.createdAt,
                comments: [...(t.comments ?? []), newComment],
              }
            : t
        )
      );
      setCommentBody("");
      toast.success("Comment added");
    };

    setSendingComment(true);
    try {
      if (activeTicket.id.startsWith("tkt-local-")) {
        applyLocalComment();
        return;
      }

      const res = await apiClient.tickets.addComment(activeTicket.id, {
        body: trimmed,
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? res.data : t))
      );
      setCommentBody("");
      toast.success("Comment added");
    } catch (err) {
      if (isDemoMode || usingDemoFallback || isBackendUnavailableError(err)) {
        setUsingDemoFallback(true);
        applyLocalComment();
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to comment");
      }
    } finally {
      setSendingComment(false);
    }
  };

  const resolveItemImage = (item: { id: string; code: string }) => {
    const matched =
      inventoryById.get(item.id) ?? inventoryByCode.get(item.code);
    return (
      matched?.item.imageUrl ||
      getPartImageUrl(item.code, matched?.item.category?.slug)
    );
  };

  const filterTabs: Array<{ key: StatusFilterKey; label: string }> = [
    { key: "ALL", label: "All" },
    { key: "OPEN", label: "Open" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "RESOLVED", label: "Resolved" },
  ];

  return (
    <DottedGridCanvas pannable={false} className="p-4 sm:p-7">
      <div className="mx-auto flex w-full max-w-[1380px] flex-1 flex-col gap-5 sm:gap-6">
        {/* Clean Editorial Header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
              Issue Tickets
            </h1>
            <p className="mt-1 max-w-2xl text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
              Report damaged, missing, or malfunctioning equipment to your Campus
              Lab Manager and follow every resolution update.
            </p>
          </div>

          {/* Desktop subtle live summary */}
          <div className="hidden lg:flex items-center gap-4 rounded-full border border-black/14 bg-white px-4 py-2.5 text-[13px] text-[#5E5E5A] shadow-card">
            <span className="inline-flex items-center gap-2 font-medium text-black tabular-nums">
              <span className="h-2 w-2 rounded-full bg-[#E05A2B]" />
              {filterCounts.OPEN} Open
            </span>
            <span className="h-3.5 w-px bg-black/12" aria-hidden="true" />
            <span className="inline-flex items-center gap-2 font-medium text-black tabular-nums">
              <span className="h-2 w-2 rounded-full bg-[#D98A1C]" />
              {filterCounts.IN_PROGRESS} In Progress
            </span>
            <span className="h-3.5 w-px bg-black/12" aria-hidden="true" />
            <span className="inline-flex items-center gap-2 font-medium text-black tabular-nums">
              <span className="h-2 w-2 rounded-full bg-[#3E6B48]" />
              {filterCounts.RESOLVED} Resolved
            </span>
          </div>

          {/* Mobile Quick-Toggle Button */}
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setMobileFormOpen((prev) => !prev)}
              aria-expanded={mobileFormOpen}
              className={cn(
                "inline-flex min-h-[44px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-colors",
                mobileFormOpen
                  ? "border border-black/16 bg-white text-black hover:border-black"
                  : "border-2 border-black bg-[#C4F041] text-black shadow-[2px_2px_0px_#000000] hover:bg-black hover:text-[#C4F041]"
              )}
            >
              {mobileFormOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 shrink-0" />
                  <span>Hide Ticket Form</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Raise New Ticket</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-6">
          {/* Raise New Ticket Card */}
          <section
            aria-label="Raise New Issue Ticket"
            className={cn(
              "min-w-0 lg:col-span-5",
              mobileFormOpen ? "block" : "hidden lg:block"
            )}
          >
            <div className="rounded-[24px] border border-black/14 bg-white p-5 sm:p-6 shadow-card">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-black/10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/15 bg-[#C4F041] text-black">
                    <Plus className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-black">
                      Raise New Ticket
                    </h2>
                    <p className="text-[13px] text-[#5E5E5A]">
                      Routed directly to your Campus Lab Manager.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFormOpen(false)}
                  aria-label="Collapse ticket form"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/12 bg-[#F7F7F5] text-black/70 transition-colors hover:border-black hover:text-black lg:hidden cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="mt-5 space-y-4">
                {/* Issue Category */}
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-black">
                    Issue Category
                  </label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as IssueCategory)}
                  >
                    <SelectTrigger className="min-h-[44px] h-auto w-full rounded-[14px] border-black/14 bg-white px-3.5 py-2.5 text-[15px] text-black focus:border-black focus:ring-2 focus:ring-[#C4F041]/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-[16px] border-black/14 bg-white text-black shadow-lg">
                      {Object.entries(ISSUE_CATEGORY_LABELS).map(
                        ([key, label]) => (
                          <SelectItem
                            key={key}
                            value={key}
                            className="min-h-[40px] rounded-[10px] text-[14px] focus:bg-[#F5F5F3] focus:text-black"
                          >
                            {label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tactile 4-Option Priority Pill Selector */}
                <div className="space-y-1.5">
                  <span className="block text-[13px] font-medium text-black">
                    Priority
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Ticket priority"
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
                  >
                    {PRIORITY_OPTIONS.map((opt) => {
                      const active = priority === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPriority(opt.value)}
                          className={cn(
                            "inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border px-3 text-[13px] font-medium transition-colors",
                            active
                              ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,0.16)]"
                              : "border-black/14 bg-[#F7F7F5] text-black hover:border-black/35 hover:bg-white"
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              active ? opt.activeDotClass : opt.dotClass
                            )}
                          />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Affected Equipment Selector + Real WebP Thumbnail Preview */}
                <div className="space-y-2">
                  <label className="block text-[13px] font-medium text-black">
                    Affected Equipment (Optional)
                  </label>
                  <Select value={itemId} onValueChange={setItemId}>
                    <SelectTrigger className="min-h-[44px] h-auto w-full rounded-[14px] border-black/14 bg-white px-3.5 py-2.5 text-[15px] text-black focus:border-black focus:ring-2 focus:ring-[#C4F041]/60">
                      <SelectValue placeholder="Select campus item..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 rounded-[16px] border-black/14 bg-white text-black shadow-lg">
                      <SelectItem
                        value="NONE"
                        className="min-h-[40px] rounded-[10px] text-[14px] focus:bg-[#F5F5F3] focus:text-black"
                      >
                        General Lab / No Specific SKU
                      </SelectItem>
                      {inventory.map((inv) => (
                        <SelectItem
                          key={inv.itemId}
                          value={inv.itemId}
                          className="min-h-[40px] rounded-[10px] text-[14px] focus:bg-[#F5F5F3] focus:text-black"
                        >
                          {inv.item.code} · {inv.item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedInventoryItem && (
                    <div className="flex items-center gap-3 rounded-[16px] border border-black/12 bg-[#F7F7F5] p-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          selectedInventoryItem.item.imageUrl ||
                          getPartImageUrl(
                            selectedInventoryItem.item.code,
                            selectedInventoryItem.item.category?.slug
                          )
                        }
                        alt={selectedInventoryItem.item.name}
                        className="h-14 w-16 shrink-0 rounded-[12px] border border-black/10 bg-white object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-black">
                          {selectedInventoryItem.item.name}
                        </p>
                        <p className="truncate text-[13px] text-[#5E5E5A]">
                          <span className="font-mono">
                            {selectedInventoryItem.item.code}
                          </span>
                          {selectedInventoryItem.item.category?.name
                            ? ` · ${selectedInventoryItem.item.category.name}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setItemId("NONE")}
                        aria-label="Clear selected equipment"
                        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/12 bg-white text-black/70 transition-colors hover:border-black hover:text-black"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Issue Summary */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="tkt-title"
                    className="block text-[13px] font-medium text-black"
                  >
                    Issue Summary
                  </label>
                  <input
                    id="tkt-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Power supply channel 2 voltage drift"
                    required
                    className="min-h-[44px] w-full rounded-[14px] border border-black/14 bg-white px-3.5 py-2.5 text-[15px] text-black placeholder:text-[#8A8A84] transition-colors focus:border-black focus:outline-none focus:ring-2 focus:ring-[#C4F041]/60"
                  />
                </div>

                {/* Detailed Description */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="tkt-desc"
                    className="block text-[13px] font-medium text-black"
                  >
                    Detailed Description
                  </label>
                  <textarea
                    id="tkt-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe symptoms, bench number, serial ID, and lab impact..."
                    rows={4}
                    required
                    className="min-h-[108px] w-full resize-y rounded-[14px] border border-black/14 bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-black placeholder:text-[#8A8A84] transition-colors focus:border-black focus:outline-none focus:ring-2 focus:ring-[#C4F041]/60"
                  />
                </div>

                {/* Touch-Friendly Photo Upload Dropzone + Thumbnail Previews */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-black">
                      Evidence Photos (Optional)
                    </span>
                    {attachmentUrls.length > 0 && (
                      <span className="text-[13px] text-[#5E5E5A] tabular-nums">
                        {attachmentUrls.length} attached
                      </span>
                    )}
                  </div>

                  <label
                    className={cn(
                      "flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[16px] border border-dashed border-black/22 bg-[#F7F7F5] px-4 py-3 text-[14px] font-medium text-black/80 transition-colors hover:border-black hover:bg-[#F3FBD4]/60 hover:text-black",
                      uploading && "pointer-events-none opacity-65"
                    )}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-black" />
                    ) : (
                      <Camera className="h-4 w-4 shrink-0 text-black" />
                    )}
                    <span>
                      {uploading
                        ? "Uploading photo..."
                        : attachmentUrls.length > 0
                          ? "Add another photo"
                          : "Tap to attach evidence photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploading}
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>

                  {attachmentUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2.5">
                      {attachmentUrls.map((url, idx) => (
                        <div
                          key={`${url}-${idx}`}
                          className="group relative aspect-[4/3] overflow-hidden rounded-[12px] border border-black/14 bg-[#F5F5F3]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Ticket evidence ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(idx)}
                            aria-label={`Remove photo ${idx + 1}`}
                            className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/80 text-white transition-colors hover:bg-black"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Primary Submit CTA */}
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 text-[15px] font-semibold text-black shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#C4F041] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )}
                  <span>
                    {submitting ? "Submitting Ticket..." : "Submit Issue Ticket"}
                  </span>
                </button>
              </form>
            </div>
          </section>

          {/* Ticket Tracker List */}
          <section
            aria-label="Campus Ticket Tracker"
            className="min-w-0 space-y-4 lg:col-span-7"
          >
            {/* Horizontally Scrollable Status Filter Strip + Search */}
            <div className="rounded-[22px] border border-black/14 bg-white p-3.5 sm:p-4 shadow-card space-y-3">
              <div
                role="tablist"
                aria-label="Filter tickets by status"
                className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {filterTabs.map((tab) => {
                  const active = statusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusFilter(tab.key)}
                      className={cn(
                        "inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
                        active
                          ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,0.16)]"
                          : "border-black/14 bg-[#F7F7F5] text-black hover:border-black/35 hover:bg-white"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          active ? "text-[#C4F041]" : "text-[#5E5E5A]"
                        )}
                      >
                        {filterCounts[tab.key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5E5E5A]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ticket code, title, equipment, or category..."
                  className="min-h-[44px] w-full rounded-[14px] border border-black/14 bg-[#F7F7F5] pl-10 pr-10 text-[15px] text-black placeholder:text-[#8A8A84] transition-colors focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C4F041]/60"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#5E5E5A] hover:bg-black/5 hover:text-black"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Ticket Feed */}
            {loading ? (
              <div className="rounded-[22px] border border-black/14 bg-white p-10 text-center shadow-card">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-black/60" />
                <p className="mt-3 text-[15px] font-medium text-black">
                  Loading issue tickets...
                </p>
                <p className="mt-1 text-[14px] text-[#5E5E5A]">
                  Syncing campus maintenance & equipment reports.
                </p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="rounded-[22px] border border-black/14 bg-white p-8 sm:p-10 text-center shadow-card">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-black/14 bg-[#F3FBD4] text-black">
                  <Wrench className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-black">
                  {tickets.length === 0
                    ? "No issue tickets yet"
                    : "No matching tickets"}
                </h3>
                <p className="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-[#5E5E5A]">
                  {tickets.length === 0
                    ? "Equipment faults, missing accessories, or calibration requests you submit will appear here."
                    : "Try switching the status filter or clearing your search query."}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  {(statusFilter !== "ALL" || searchQuery.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("ALL");
                        setSearchQuery("");
                      }}
                      className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-black/16 bg-[#F7F7F5] px-5 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041]"
                    >
                      Reset Filters
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileFormOpen(true)}
                    className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 text-[14px] font-semibold text-black shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#C4F041] lg:hidden"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Raise New Ticket</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredTickets.map((t) => {
                  const statusMeta = getTicketStatusMeta(t.status);
                  const priorityMeta = getPriorityMeta(t.priority);
                  const commentCount = t.comments?.length ?? 0;

                  return (
                    <article
                      key={t.id}
                      className="rounded-[22px] border border-black/14 bg-white p-4 sm:p-5 shadow-card transition-colors hover:border-black/28 space-y-3.5"
                    >
                      {/* Top Meta Row: Code + Status + Priority + Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 min-w-0">
                          <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-3 py-1 font-mono text-[13px] font-semibold text-black tabular-nums">
                            {t.ticketCode}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[13px] font-medium",
                              statusMeta.textClass
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                statusMeta.dotClass
                              )}
                            />
                            {statusMeta.label}
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
                            {priorityMeta.label} Priority
                          </span>
                        </div>
                        <time
                          dateTime={t.createdAt}
                          className="text-[13px] text-[#5E5E5A] tabular-nums"
                        >
                          {formatDateTime(t.createdAt)}
                        </time>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5">
                        <h3 className="text-[16px] sm:text-[17px] font-semibold leading-snug tracking-[-0.015em] text-black break-words">
                          {t.title}
                        </h3>
                        <p className="text-[14px] leading-relaxed text-[#5E5E5A] break-words">
                          {t.description}
                        </p>
                      </div>

                      {/* Linked Equipment Preview with Real WebP Thumbnail */}
                      {t.item && (
                        <div className="flex items-center gap-3 rounded-[16px] border border-black/10 bg-[#F7F7F5] p-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveItemImage(t.item)}
                            alt={t.item.name}
                            className="h-12 w-14 shrink-0 rounded-[10px] border border-black/10 bg-white object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-black">
                              {t.item.name}
                            </p>
                            <p className="font-mono text-[13px] text-[#5E5E5A]">
                              {t.item.code}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Attached Evidence Photos */}
                      {t.attachmentUrls && t.attachmentUrls.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {t.attachmentUrls.map((url, idx) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              key={`${t.id}-att-${idx}`}
                              src={url}
                              alt={`Evidence photo ${idx + 1}`}
                              className="h-14 w-16 shrink-0 rounded-[10px] border border-black/12 bg-[#F5F5F3] object-cover"
                            />
                          ))}
                        </div>
                      )}

                      {/* Footer: Category & Touch-Friendly Discussion CTA */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3">
                        <div className="min-w-0 text-[13px] text-[#5E5E5A]">
                          <span className="font-medium text-black/80">
                            {ISSUE_CATEGORY_LABELS[t.category]}
                          </span>
                          {t.assignedTo?.fullName && (
                            <span className="text-[#5E5E5A]">
                              {" "}
                              · Assigned to {t.assignedTo.fullName}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveTicketId(t.id);
                            setCommentBody("");
                          }}
                          className="inline-flex min-h-[44px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-full border border-black/16 bg-white px-4 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#C4F041]"
                        >
                          <MessageSquare className="h-4 w-4 shrink-0" />
                          <span>
                            Discussion (
                            <span className="tabular-nums">{commentCount}</span>
                            )
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Mobile-Friendly Discussion Modal */}
        <Dialog
          open={Boolean(activeTicket)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveTicketId(null);
              setCommentBody("");
            }
          }}
        >
          <DialogContent className="w-[min(94vw,560px)] max-w-[560px] rounded-[24px] border border-black/14 bg-white p-5 sm:p-6 shadow-2xl">
            {activeTicket && (
              <div className="flex flex-col gap-4">
                <DialogHeader className="space-y-2 pr-8">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-3 py-1 font-mono text-[13px] font-semibold text-black">
                      {activeTicket.ticketCode}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-black">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          getTicketStatusMeta(activeTicket.status).dotClass
                        )}
                      />
                      {getTicketStatusMeta(activeTicket.status).label}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#5E5E5A]">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          getPriorityMeta(activeTicket.priority).dotClass
                        )}
                      />
                      {getPriorityMeta(activeTicket.priority).label}
                    </span>
                  </div>
                  <DialogTitle className="text-[18px] font-semibold leading-snug tracking-[-0.02em] text-black">
                    {activeTicket.title}
                  </DialogTitle>
                  <DialogDescription className="text-[14px] leading-relaxed text-[#5E5E5A]">
                    {ISSUE_CATEGORY_LABELS[activeTicket.category]}
                    {activeTicket.item
                      ? ` · ${activeTicket.item.code} ${activeTicket.item.name}`
                      : ""}
                  </DialogDescription>
                </DialogHeader>

                {/* Scrollable Message Bubbles */}
                <div className="max-h-[42vh] min-h-[140px] space-y-2.5 overflow-y-auto rounded-[18px] border border-black/10 bg-[#F7F7F5] p-3 sm:p-4">
                  {activeTicket.comments && activeTicket.comments.length > 0 ? (
                    activeTicket.comments.map((c) => {
                      const isInstructorAuthor =
                        c.author.role === "INSTRUCTOR" ||
                        (user?.id && c.authorId === user.id);
                      return (
                        <div
                          key={c.id}
                          className={cn(
                            "rounded-[16px] border p-3.5 text-[14px]",
                            isInstructorAuthor
                              ? "ml-4 border-black/16 bg-[#F3FBD4]"
                              : "mr-4 border-black/10 bg-white"
                          )}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                            <span className="font-semibold text-black">
                              {c.author.fullName}
                              <span className="ml-1.5 font-normal text-[13px] text-[#5E5E5A]">
                                · {ROLE_LABELS[c.author.role]}
                              </span>
                            </span>
                            <span className="text-[13px] text-[#5E5E5A] tabular-nums">
                              {formatDateTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="leading-relaxed text-black/85 break-words">
                            {c.body}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex min-h-[108px] flex-col items-center justify-center text-center px-3">
                      <MessageSquare className="h-5 w-5 text-[#5E5E5A]" />
                      <p className="mt-2 text-[14px] font-medium text-black">
                        No discussion updates yet
                      </p>
                      <p className="mt-0.5 text-[13px] text-[#5E5E5A]">
                        Post a note below to coordinate directly with your
                        Campus Lab Manager.
                      </p>
                    </div>
                  )}
                </div>

                {/* Comment Composer */}
                <form
                  onSubmit={handleAddComment}
                  className="flex flex-col gap-2.5 sm:flex-row sm:items-end"
                >
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (commentBody.trim() && !sendingComment) {
                          e.currentTarget.form?.requestSubmit();
                        }
                      }
                    }}
                    placeholder="Add an update for your Lab Manager..."
                    rows={2}
                    className="min-h-[48px] flex-1 resize-none rounded-[16px] border border-black/14 bg-[#F7F7F5] px-3.5 py-2.5 text-[15px] leading-snug text-black placeholder:text-[#8A8A84] transition-colors focus:border-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C4F041]/60"
                  />
                  <button
                    type="submit"
                    disabled={!commentBody.trim() || sendingComment}
                    className="inline-flex min-h-[44px] w-full sm:w-auto shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 text-[14px] font-semibold text-black shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#C4F041] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {sendingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span>Send</span>
                  </button>
                </form>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DottedGridCanvas>
  );
}
