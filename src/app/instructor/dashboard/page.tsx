"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  RotateCcw,
  Search,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import {
  ActionLaneCard,
  GridTile,
  SpatialCanvas,
  type TileDotTone,
} from "@/components/dashboard/spatial-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_CAMPUS_INVENTORY,
  DEMO_REQUESTS,
  DEMO_TICKETS,
} from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import { formatDateTime } from "@/lib/utils";
import type {
  CampusInventoryDTO,
  IssueTicketDTO,
  LabRequestDTO,
} from "@/types/contracts";

type FilterMode = "ALL" | "PENDING" | "ALERT" | "HEALTHY";

export default function InstructorDashboardPage() {
  const { isDemoMode } = useAuth();
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [activeTarget, setActiveTarget] = useState<
    | { kind: "ITEM"; id: string }
    | { kind: "QUEUE" }
    | null
  >(null);

  const [liveFlash, setLiveFlash] = useState(false);
  const [lastEventText, setLastEventText] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const [invRes, reqRes, tktRes] = await Promise.all([
        apiClient.inventory.list({ pageSize: 250 }),
        apiClient.requests.list({ pageSize: 50 }),
        apiClient.tickets.list({ pageSize: 50 }),
      ]);
      setInventory(invRes.data.filter((i) => i.isVerified && i.isVisible));
      setRequests(reqRes.data);
      setTickets(tktRes.data);
    } catch {
      setInventory(
        DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible)
      );
      setRequests(DEMO_REQUESTS);
      setTickets(DEMO_TICKETS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useRealtime({
    enabled: true,
    isDemoMode,
    onEvent: (ev) => {
      setLiveFlash(true);
      setLastEventText(ev.summary);
      loadBoard();
      setTimeout(() => setLiveFlash(false), 2000);
    },
  });

  const pendingStudentRequests = useMemo(
    () => requests.filter((r) => r.status === "PENDING_INSTRUCTOR"),
    [requests]
  );

  const pendingReturns = useMemo(
    () => requests.filter((r) => r.status === "RETURN_VERIFICATION_PENDING"),
    [requests]
  );

  const openTickets = useMemo(
    () => tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)),
    [tickets]
  );

  const itemModels = useMemo(() => {
    return inventory.map((row) => {
      const meta = extractItemProcurementMeta(row.item.specifications);
      const itemRequests = pendingStudentRequests.filter((r) =>
        r.items.some((i) => i.itemId === row.itemId)
      );
      const itemReturns = pendingReturns.filter((r) =>
        r.items.some((i) => i.itemId === row.itemId)
      );
      const itemTickets = openTickets.filter((t) => t.itemId === row.itemId);

      let tone: TileDotTone = "healthy";
      if (itemTickets.length > 0 || row.availableQuantity === 0) {
        tone = "alert";
      } else if (itemRequests.length > 0 || itemReturns.length > 0) {
        tone = "pending";
      }

      return {
        row,
        meta,
        itemRequests,
        itemReturns,
        itemTickets,
        tone,
      };
    });
  }, [inventory, pendingStudentRequests, pendingReturns, openTickets]);

  const counts = useMemo(() => {
    let alert = 0;
    let pending = 0;
    let healthy = 0;
    for (const m of itemModels) {
      if (m.tone === "alert") alert += 1;
      else if (m.tone === "pending") pending += 1;
      else if (m.tone === "healthy") healthy += 1;
    }
    return { total: itemModels.length, alert, pending, healthy };
  }, [itemModels]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemModels.filter((m) => {
      if (filterMode === "ALERT" && m.tone !== "alert") return false;
      if (filterMode === "PENDING" && m.tone !== "pending") return false;
      if (filterMode === "HEALTHY" && m.tone !== "healthy") return false;
      if (labBlockFilter !== "ALL" && m.meta.labBlock !== labBlockFilter) {
        return false;
      }
      if (!q) return true;
      return (
        m.row.item.code.toLowerCase().includes(q) ||
        m.row.item.name.toLowerCase().includes(q) ||
        (m.meta.labBlock?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [itemModels, filterMode, labBlockFilter, search]);

  const selectedItemModel = useMemo(() => {
    if (!activeTarget || activeTarget.kind !== "ITEM") return null;
    return itemModels.find((m) => m.row.id === activeTarget.id) ?? null;
  }, [activeTarget, itemModels]);

  const handleInstructorDecision = async (
    req: LabRequestDTO,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setBusyId(req.id);
    try {
      const res = await apiClient.requests.instructorApproval(req.id, {
        decision,
        comments:
          decision === "APPROVED"
            ? "Verified & approved from Instructor live board."
            : "Rejected from Instructor live board.",
      });
      setRequests((prev) => prev.map((r) => (r.id === req.id ? res.data : r)));
      setLastEventText(`${req.requestCode} ${decision.toLowerCase()}`);
      toast.success(`Request ${req.requestCode} ${decision.toLowerCase()}`);
    } catch {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? {
                ...r,
                status:
                  decision === "APPROVED"
                    ? "PENDING_LAB_MANAGER"
                    : "REJECTED_BY_INSTRUCTOR",
              }
            : r
        )
      );
      setLastEventText(`${req.requestCode} ${decision.toLowerCase()}`);
      toast.success(`Request ${req.requestCode} ${decision.toLowerCase()}`);
    } finally {
      setBusyId(null);
    }
  };

  const laneRequests = selectedItemModel
    ? selectedItemModel.itemRequests
    : pendingStudentRequests;
  const laneTickets = selectedItemModel
    ? selectedItemModel.itemTickets
    : openTickets;
  const laneReturns = selectedItemModel
    ? selectedItemModel.itemReturns
    : pendingReturns;

  const activeViewLabel = selectedItemModel
    ? `${selectedItemModel.row.item.code} · ${selectedItemModel.row.item.name}`
    : activeTarget?.kind === "QUEUE"
      ? "Pending Student Reviews & Tickets"
      : null;

  return (
    <SpatialCanvas
      title="Instructor Live Review Board"
      subtitle="Visual campus lab grid — see student borrowing requests, return checks, and active equipment tickets in real time."
      activeViewLabel={activeViewLabel}
      onBack={activeTarget ? () => setActiveTarget(null) : undefined}
      liveFlash={liveFlash}
      lastEventText={lastEventText}
      legend={[
        { tone: "alert", label: "Ticket / Out", count: counts.alert },
        { tone: "pending", label: "Review Needed", count: counts.pending },
        { tone: "healthy", label: "In Stock", count: counts.healthy },
      ]}
      headerActions={
        <>
          <Button
            size="sm"
            variant={activeTarget?.kind === "QUEUE" ? "default" : "outline"}
            onClick={() => setActiveTarget({ kind: "QUEUE" })}
          >
            <ClipboardCheck className="h-4 w-4" />
            Action Queue ({pendingStudentRequests.length + pendingReturns.length})
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/instructor/tickets">
              <ShieldAlert className="h-4 w-4" />
              Raise Ticket
            </Link>
          </Button>
        </>
      }
      toolbar={
        !activeTarget ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "ALL", label: `All Equipment (${counts.total})` },
                  { key: "PENDING", label: `Needs Review (${counts.pending})` },
                  { key: "ALERT", label: `Tickets / Out (${counts.alert})` },
                  { key: "HEALTHY", label: `Available (${counts.healthy})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterMode(tab.key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    filterMode === tab.key
                      ? "bg-black text-[#C4F041]"
                      : "bg-white border border-black/12 text-black/70 hover:text-black"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={labBlockFilter}
                onChange={(e) => setLabBlockFilter(e.target.value)}
                className="h-8 rounded-full border border-black/15 bg-white px-3 text-xs text-black focus:outline-none focus:border-black"
              >
                <option value="ALL">All 6 Lab Blocks</option>
                {PROCUREMENT_LAB_BLOCKS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <div className="relative w-48 sm:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/45" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search SKU or equipment..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/65">
            <span>
              {selectedItemModel
                ? `${selectedItemModel.row.item.code} · ${selectedItemModel.meta.labBlock ?? "Campus Lab"} · ${selectedItemModel.row.availableQuantity} available`
                : "Approve or reject waiting student requests and inspect return verifications"}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/instructor/return-verification">
                <RotateCcw className="h-3 w-3" />
                Return Verification
              </Link>
            </Button>
          </div>
        )
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-[20px] border border-black/8 bg-white/70 animate-pulse"
            />
          ))}
        </div>
      ) : !activeTarget ? (
        <div className="space-y-4">
          {(pendingStudentRequests.length > 0 || pendingReturns.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {pendingStudentRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "QUEUE" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E5C185] bg-[#FDF0D8] px-3.5 py-1.5 text-xs font-semibold text-[#92400E] hover:brightness-95 transition cursor-pointer"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {pendingStudentRequests.length} Student Request{pendingStudentRequests.length > 1 ? "s" : ""} Waiting Review
                </button>
              )}
              {pendingReturns.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "QUEUE" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#9EC3D5] bg-[#E3F3FC] px-3.5 py-1.5 text-xs font-semibold text-[#075985] hover:brightness-95 transition cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {pendingReturns.length} Return{pendingReturns.length > 1 ? "s" : ""} Pending Verification
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
            {filteredItems.map((m) => {
              const badges: Array<{ text: string; tone?: TileDotTone }> = [];
              if (m.itemRequests.length > 0) {
                badges.push({ text: `${m.itemRequests.length} REQ`, tone: "pending" });
              }
              if (m.itemReturns.length > 0) {
                badges.push({ text: "RET", tone: "transit" });
              }
              if (m.itemTickets.length > 0) {
                badges.push({ text: `${m.itemTickets.length} TKT`, tone: "alert" });
              }
              return (
                <GridTile
                  key={m.row.id}
                  code={m.row.item.code}
                  label={m.row.item.name}
                  sublabel={`${m.row.availableQuantity} avail · ${m.meta.labBlock?.split(" ")[0] ?? "Lab"}`}
                  tone={m.tone}
                  pulse={m.tone === "pending" || m.tone === "alert"}
                  badges={badges}
                  onClick={() => setActiveTarget({ kind: "ITEM", id: m.row.id })}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Lane 1: Tickets & Return Checks */}
          <ActionLaneCard
            title="Tickets & Return Checks"
            subtitle="Equipment issues & inspections"
            count={laneTickets.length + laneReturns.length}
            tone="danger"
          >
            {laneReturns.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-black">
                    {req.requestCode}
                  </span>
                  <Badge variant="warning">Return Pending</Badge>
                </div>
                <p className="text-xs font-semibold text-black">
                  {req.student.fullName}
                </p>
                <Button size="sm" variant="outline" className="w-full h-8 text-xs" asChild>
                  <Link href="/instructor/return-verification">
                    Inspect 4-Angle Return
                  </Link>
                </Button>
              </div>
            ))}
            {laneTickets.map((tkt) => (
              <div
                key={tkt.id}
                className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-black">
                    {tkt.ticketCode}
                  </span>
                  <Badge variant="danger">{tkt.priority}</Badge>
                </div>
                <p className="text-xs font-semibold text-black">{tkt.title}</p>
                <p className="text-[11px] text-black/55 line-clamp-2">
                  {tkt.description}
                </p>
              </div>
            ))}
            {laneReturns.length === 0 && laneTickets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                No active tickets or return checks here.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 2: Student Requests Awaiting Approval */}
          <ActionLaneCard
            title="Student Requests"
            subtitle="Stage 1 Instructor verification"
            count={laneRequests.length}
            tone="warning"
          >
            {laneRequests.length > 0 ? (
              laneRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-black">
                      {req.requestCode}
                    </span>
                    <span className="text-[10px] text-black/50 tabular-nums">
                      {formatDateTime(req.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-black">
                    {req.student.fullName} ({req.student.institutionalId})
                  </p>
                  <p className="text-[11px] text-black/55 line-clamp-2">
                    {req.purpose}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {req.items.map((it) => (
                      <span
                        key={it.id}
                        className="rounded-full bg-[#F5F5F3] border border-black/10 px-2 py-0.5 text-[10px] font-medium text-black"
                      >
                        {it.item.code} ×{it.requestedQuantity}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      disabled={busyId === req.id}
                      onClick={() => handleInstructorDecision(req, "APPROVED")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      disabled={busyId === req.id}
                      onClick={() => handleInstructorDecision(req, "REJECTED")}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                <CheckCircle2 className="mx-auto h-5 w-5 text-[#1F8A3B] mb-1.5" />
                All student requests verified.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 3: Equipment & Lab Block Status */}
          <ActionLaneCard
            title="Live Shelf Status"
            subtitle={selectedItemModel?.meta.labBlock ?? "Campus Lab Blocks"}
            count={selectedItemModel?.row.availableQuantity ?? counts.healthy}
            tone="success"
          >
            {selectedItemModel ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] text-black/50">Available</p>
                    <p className="mt-1 text-xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.availableQuantity}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] text-black/50">Reserved</p>
                    <p className="mt-1 text-xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.reservedQuantity}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] text-black/50">Borrowed</p>
                    <p className="mt-1 text-xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.borrowedQuantity}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white p-3.5 space-y-1.5 text-xs">
                  <p className="font-semibold text-black flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#1F8A3B]" />
                    {selectedItemModel.meta.labBlock ?? "Lab Zone"}
                  </p>
                  <p className="text-black/55">
                    Category: {selectedItemModel.row.item.category.name}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/instructor/tickets">
                    Report Issue for {selectedItemModel.row.item.code}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {PROCUREMENT_LAB_BLOCKS.map((block) => {
                  const blockRows = itemModels.filter(
                    (m) => m.meta.labBlock === block
                  );
                  return (
                    <button
                      key={block}
                      type="button"
                      onClick={() => {
                        setLabBlockFilter(block);
                        setActiveTarget(null);
                      }}
                      className="w-full rounded-2xl border border-black/10 bg-white p-3 flex items-center justify-between text-left hover:border-black/35 transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-black">
                        <MapPin className="h-3.5 w-3.5 text-[#1F8A3B]" />
                        {block}
                      </span>
                      <span className="font-mono text-xs font-bold text-black tabular-nums">
                        {blockRows.length} SKUs
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ActionLaneCard>
        </div>
      )}
    </SpatialCanvas>
  );
}
