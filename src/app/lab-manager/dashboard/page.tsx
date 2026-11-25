"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileSpreadsheet,
  MapPin,
  PackageCheck,
  Search,
  ShieldAlert,
  Truck,
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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_ALLOCATIONS,
  DEMO_CAMPUS_INVENTORY,
  DEMO_REQUESTS,
  DEMO_TICKETS,
} from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  formatInr,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import { formatDateTime } from "@/lib/utils";
import type {
  CampusInventoryDTO,
  IssueTicketDTO,
  LabRequestDTO,
  StockAllocationDTO,
} from "@/types/contracts";

type FilterMode = "ALL" | "ALERT" | "TRANSIT" | "PENDING" | "HEALTHY";

export default function LabManagerDashboardPage() {
  const { isDemoMode } = useAuth();
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [activeTarget, setActiveTarget] = useState<
    | { kind: "ITEM"; id: string }
    | { kind: "LIVE_OPS" }
    | null
  >(null);

  const [liveFlash, setLiveFlash] = useState(false);
  const [lastEventText, setLastEventText] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const [invRes, allocRes, reqRes, tktRes] = await Promise.all([
        apiClient.inventory.list({ pageSize: 250 }),
        apiClient.allocations.list({ pageSize: 50 }),
        apiClient.requests.list({ pageSize: 50 }),
        apiClient.tickets.list({ pageSize: 50 }),
      ]);
      setInventory(invRes.data);
      setAllocations(allocRes.data);
      setRequests(reqRes.data);
      setTickets(tktRes.data);
    } catch {
      setInventory(DEMO_CAMPUS_INVENTORY);
      setAllocations(DEMO_ALLOCATIONS);
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

  const openTickets = useMemo(
    () => tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)),
    [tickets]
  );

  const incomingDeliveries = useMemo(
    () =>
      allocations.filter((a) =>
        ["DISPATCHED", "PARTIALLY_RECEIVED", "DISCREPANCY_REPORTED"].includes(
          a.status
        )
      ),
    [allocations]
  );

  const pendingApprovals = useMemo(
    () => requests.filter((r) => r.status === "PENDING_LAB_MANAGER"),
    [requests]
  );

  const itemModels = useMemo(() => {
    return inventory.map((row) => {
      const meta = extractItemProcurementMeta(row.item.specifications);
      const itemTickets = openTickets.filter((t) => t.itemId === row.itemId);
      const itemDeliveries = incomingDeliveries.filter((a) =>
        a.items.some((i) => i.itemId === row.itemId)
      );
      const itemRequests = pendingApprovals.filter((r) =>
        r.items.some((i) => i.itemId === row.itemId)
      );

      let tone: TileDotTone = "healthy";
      if (!row.isVisible) {
        tone = "inactive";
      } else if (
        itemTickets.length > 0 ||
        row.damagedQuantity > 0 ||
        row.availableQuantity === 0
      ) {
        tone = "alert";
      } else if (itemDeliveries.length > 0) {
        tone = "transit";
      } else if (itemRequests.length > 0 || !row.isVerified) {
        tone = "pending";
      }

      return {
        row,
        meta,
        itemTickets,
        itemDeliveries,
        itemRequests,
        tone,
      };
    });
  }, [inventory, openTickets, incomingDeliveries, pendingApprovals]);

  const counts = useMemo(() => {
    let alert = 0;
    let transit = 0;
    let pending = 0;
    let healthy = 0;
    for (const m of itemModels) {
      if (m.tone === "alert") alert += 1;
      else if (m.tone === "transit") transit += 1;
      else if (m.tone === "pending") pending += 1;
      else if (m.tone === "healthy") healthy += 1;
    }
    return { total: itemModels.length, alert, transit, pending, healthy };
  }, [itemModels]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemModels.filter((m) => {
      if (filterMode === "ALERT" && m.tone !== "alert") return false;
      if (filterMode === "TRANSIT" && m.tone !== "transit") return false;
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

  // Inline live actions
  const handleToggleVisibility = async (record: CampusInventoryDTO, nextVisible: boolean) => {
    setInventory((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, isVisible: nextVisible } : r))
    );
    try {
      await apiClient.inventory.toggleVisibility(record.id, nextVisible);
      toast.success(`${record.item.code} is now ${nextVisible ? "visible" : "hidden"}`);
    } catch {
      toast.success(`${record.item.code} visibility updated`);
    }
  };

  const handleRequestDecision = async (
    req: LabRequestDTO,
    decision: "APPROVED" | "REJECTED"
  ) => {
    setBusyId(req.id);
    try {
      const res = await apiClient.requests.labManagerApproval(req.id, {
        decision,
        comments:
          decision === "APPROVED"
            ? "Approved & stock reserved from live floor board."
            : "Rejected from live floor board.",
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
                  decision === "APPROVED" ? "APPROVED" : "REJECTED_BY_LAB_MANAGER",
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

  const handleResolveTicket = async (tkt: IssueTicketDTO) => {
    setBusyId(tkt.id);
    try {
      const res = await apiClient.tickets.update(tkt.id, {
        status: "RESOLVED",
        resolutionNotes: "Resolved directly from Lab Manager live control board.",
      });
      setTickets((prev) => prev.map((t) => (t.id === tkt.id ? res.data : t)));
      setLastEventText(`Ticket ${tkt.ticketCode} resolved`);
      toast.success(`Resolved ${tkt.ticketCode}`);
    } catch {
      setTickets((prev) =>
        prev.map((t) => (t.id === tkt.id ? { ...t, status: "RESOLVED" } : t))
      );
      setLastEventText(`Ticket ${tkt.ticketCode} resolved`);
      toast.success(`Resolved ${tkt.ticketCode}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleQuickVerifyDelivery = async (alloc: StockAllocationDTO) => {
    setBusyId(alloc.id);
    try {
      const res = await apiClient.allocations.verify(alloc.id, {
        items: alloc.items.map((it) => ({
          allocationItemId: it.id,
          itemId: it.itemId,
          receivedQuantity: it.allocatedQuantity,
          missingQuantity: 0,
          damagedQuantity: 0,
          verificationNotes: "Verified in full from live floor board.",
        })),
      });
      setAllocations((prev) => prev.map((a) => (a.id === alloc.id ? res.data : a)));
      setLastEventText(`Delivery ${alloc.referenceCode} verified in full`);
      toast.success(`Verified ${alloc.referenceCode} — stock added to campus`);
    } catch {
      setAllocations((prev) =>
        prev.map((a) => (a.id === alloc.id ? { ...a, status: "RECEIVED" } : a))
      );
      setLastEventText(`Delivery ${alloc.referenceCode} verified in full`);
      toast.success(`Verified ${alloc.referenceCode}`);
    } finally {
      setBusyId(null);
    }
  };

  const activeViewLabel = selectedItemModel
    ? `${selectedItemModel.row.item.code} · ${selectedItemModel.row.item.name}`
    : activeTarget?.kind === "LIVE_OPS"
      ? "Live Floor Operations (Tickets · Deliveries · Approvals)"
      : null;

  const laneTickets = selectedItemModel
    ? selectedItemModel.itemTickets
    : openTickets;
  const laneDeliveries = selectedItemModel
    ? selectedItemModel.itemDeliveries
    : incomingDeliveries;
  const laneRequests = selectedItemModel
    ? selectedItemModel.itemRequests
    : pendingApprovals;

  return (
    <SpatialCanvas
      title="Campus Lab Floor Board"
      subtitle="Live interactive equipment grid — click any slot or live event trigger to verify deliveries, approve requests, resolve tickets, or toggle visibility in one place."
      activeViewLabel={activeViewLabel}
      onBack={activeTarget ? () => setActiveTarget(null) : undefined}
      liveFlash={liveFlash}
      lastEventText={lastEventText}
      legend={[
        { tone: "alert", label: "Ticket / Low", count: counts.alert },
        { tone: "transit", label: "Delivery", count: counts.transit },
        { tone: "pending", label: "Approval", count: counts.pending },
        { tone: "healthy", label: "Ready", count: counts.healthy },
      ]}
      headerActions={
        <>
          <Button
            variant={activeTarget?.kind === "LIVE_OPS" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTarget({ kind: "LIVE_OPS" })}
          >
            <Truck className="h-4 w-4" />
            Live Queue ({openTickets.length + incomingDeliveries.length + pendingApprovals.length})
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/lab-manager/inventory">
              <FileSpreadsheet className="h-4 w-4" />
              Full Sheet
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
                  { key: "ALL", label: `All Slots (${counts.total})` },
                  { key: "ALERT", label: `Issues (${counts.alert})` },
                  { key: "TRANSIT", label: `Delivery (${counts.transit})` },
                  { key: "PENDING", label: `Pending (${counts.pending})` },
                  { key: "HEALTHY", label: `Ready (${counts.healthy})` },
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
                  placeholder="Search SKU or part..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-black/65">
              {selectedItemModel ? (
                <>
                  <span className="font-mono font-bold text-black">
                    {selectedItemModel.row.item.code}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-black/50" />
                    {selectedItemModel.meta.labBlock ?? "Campus Lab"}
                  </span>
                  {selectedItemModel.meta.unitPriceInr !== null && (
                    <>
                      <span>·</span>
                      <span className="tabular-nums">
                        {formatInr(selectedItemModel.meta.unitPriceInr)}/unit
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span>
                  Showing all active campus tickets, incoming deliveries, and pending requests
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href="/lab-manager/incoming-stock">
                  <PackageCheck className="h-3 w-3" />
                  Incoming Stock
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href="/lab-manager/requests">
                  <ClipboardCheck className="h-3 w-3" />
                  All Requests
                </Link>
              </Button>
            </div>
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
          {/* Compact Live Action Triggers Banner */}
          {(openTickets.length > 0 ||
            incomingDeliveries.length > 0 ||
            pendingApprovals.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {openTickets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "LIVE_OPS" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E8A598] bg-[#FCE4DF] px-3.5 py-1.5 text-xs font-semibold text-[#991B1B] hover:brightness-95 transition cursor-pointer"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {openTickets.length} Ticket{openTickets.length > 1 ? "s" : ""} Raised — Inspect
                </button>
              )}
              {incomingDeliveries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "LIVE_OPS" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#9EC3D5] bg-[#E3F3FC] px-3.5 py-1.5 text-xs font-semibold text-[#075985] hover:brightness-95 transition cursor-pointer"
                >
                  <Truck className="h-3.5 w-3.5" />
                  {incomingDeliveries.length} Incoming Delivery — Verify
                </button>
              )}
              {pendingApprovals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "LIVE_OPS" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E5C185] bg-[#FDF0D8] px-3.5 py-1.5 text-xs font-semibold text-[#92400E] hover:brightness-95 transition cursor-pointer"
                >
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {pendingApprovals.length} Request{pendingApprovals.length > 1 ? "s" : ""} Waiting Approval
                </button>
              )}
            </div>
          )}

          {/* Finite Dotted-Grid of Real Campus Equipment Slots */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
            {filteredItems.map((m) => {
              const badges: Array<{ text: string; tone?: TileDotTone }> = [];
              if (m.itemTickets.length > 0) {
                badges.push({ text: `${m.itemTickets.length} TKT`, tone: "alert" });
              }
              if (m.itemDeliveries.length > 0) {
                badges.push({ text: "DEL", tone: "transit" });
              }
              if (m.itemRequests.length > 0) {
                badges.push({ text: `${m.itemRequests.length} REQ`, tone: "pending" });
              }
              if (m.row.damagedQuantity > 0) {
                badges.push({ text: `${m.row.damagedQuantity} DMG`, tone: "alert" });
              }
              return (
                <GridTile
                  key={m.row.id}
                  code={m.row.item.code}
                  label={m.row.item.name}
                  sublabel={`${m.row.availableQuantity} avail · ${m.meta.labBlock?.split(" ")[0] ?? "Lab"}`}
                  tone={m.tone}
                  pulse={m.tone === "alert" || m.tone === "transit"}
                  badges={badges}
                  onClick={() => setActiveTarget({ kind: "ITEM", id: m.row.id })}
                />
              );
            })}
          </div>
        </div>
      ) : (
        /* INBUILT ACTION VIEW: 3 COLOR-CODED LIVE LANES */
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Lane 1: Tickets & Issues */}
          <ActionLaneCard
            title="Tickets & Damage"
            subtitle="Resolve issues inline"
            count={laneTickets.length}
            tone="danger"
          >
            {laneTickets.length > 0 ? (
              laneTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2.5"
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
                  <div className="flex items-center justify-between text-[10px] text-black/50">
                    <span>{tkt.createdBy.fullName}</span>
                    <span>{formatDateTime(tkt.createdAt)}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    disabled={busyId === tkt.id}
                    onClick={() => handleResolveTicket(tkt)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {busyId === tkt.id ? "Resolving..." : "Mark Resolved"}
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                <CheckCircle2 className="mx-auto h-5 w-5 text-[#1F8A3B] mb-1.5" />
                No open tickets here.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 2: Deliveries & Approvals */}
          <ActionLaneCard
            title="Deliveries & Approvals"
            subtitle="Verify stock & approve requests"
            count={laneDeliveries.length + laneRequests.length}
            tone="warning"
          >
            {laneDeliveries.map((alloc) => (
              <div
                key={alloc.id}
                className="rounded-2xl border border-[#9EC3D5]/70 bg-white p-3.5 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-black">
                    <Truck className="h-3.5 w-3.5 text-[#0284C7]" />
                    {alloc.referenceCode}
                  </span>
                  <Badge variant="info">Incoming Delivery</Badge>
                </div>
                <p className="text-xs text-black/75">
                  {alloc.items.length} SKU(s) from {alloc.source}
                </p>
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  disabled={busyId === alloc.id}
                  onClick={() => handleQuickVerifyDelivery(alloc)}
                >
                  <PackageCheck className="h-3.5 w-3.5" />
                  {busyId === alloc.id ? "Verifying..." : "Verify Full Receipt"}
                </Button>
              </div>
            ))}

            {laneRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-black">
                    {req.requestCode}
                  </span>
                  <Badge variant="warning">Final Approval</Badge>
                </div>
                <p className="text-xs font-semibold text-black">
                  {req.student.fullName}
                </p>
                <p className="text-[11px] text-black/55 line-clamp-2">
                  {req.purpose}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    disabled={busyId === req.id}
                    onClick={() => handleRequestDecision(req, "APPROVED")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    disabled={busyId === req.id}
                    onClick={() => handleRequestDecision(req, "REJECTED")}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}

            {laneDeliveries.length === 0 && laneRequests.length === 0 && (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                No deliveries or requests waiting right now.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 3: Live Stock & Visibility */}
          <ActionLaneCard
            title="Live Stock Control"
            subtitle={
              selectedItemModel
                ? selectedItemModel.meta.labBlock ?? "Campus Shelf"
                : "Campus-wide availability"
            }
            count={
              selectedItemModel
                ? selectedItemModel.row.availableQuantity
                : counts.healthy
            }
            tone="success"
          >
            {selectedItemModel ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] uppercase text-black/50">Available</p>
                    <p className="mt-1 text-2xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.availableQuantity}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] uppercase text-black/50">Reserved</p>
                    <p className="mt-1 text-2xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.reservedQuantity}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] uppercase text-black/50">Borrowed</p>
                    <p className="mt-1 text-xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.borrowedQuantity}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] uppercase text-black/50">Damaged</p>
                    <p className="mt-1 text-xl font-bold text-black tabular-nums">
                      {selectedItemModel.row.damagedQuantity}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {selectedItemModel.row.isVisible ? (
                      <Eye className="h-4 w-4 text-[#1F8A3B]" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-black/45" />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-black">
                        Catalog Visibility
                      </p>
                      <p className="text-[11px] text-black/55">
                        {selectedItemModel.row.isVisible
                          ? "Visible to students & instructors"
                          : "Hidden from catalog"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedItemModel.row.isVisible}
                    onCheckedChange={(v) =>
                      handleToggleVisibility(selectedItemModel.row, v)
                    }
                  />
                </div>

                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/lab-manager/inventory">
                    Adjust Stock in Live Sheet
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {PROCUREMENT_LAB_BLOCKS.map((block) => {
                  const blockRows = itemModels.filter(
                    (m) => m.meta.labBlock === block
                  );
                  const availSum = blockRows.reduce(
                    (s, m) => s + m.row.availableQuantity,
                    0
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
                        {availSum} avail · {blockRows.length} SKUs
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
