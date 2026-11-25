"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Package,
  Search,
  Send,
  ShieldAlert,
  Truck,
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
  DEMO_ALLOCATIONS,
  DEMO_CAMPUSES,
  DEMO_TICKETS,
} from "@/lib/demo-data";
import {
  formatInr,
  PROCUREMENT_LAB_BLOCKS,
  PROCUREMENT_TOTAL_VALUE_INR,
} from "@/lib/procurement-catalog";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  CampusDTO,
  IssueTicketDTO,
  StockAllocationDTO,
} from "@/types/contracts";

type FilterMode = "ALL" | "ALERT" | "TRANSIT" | "HEALTHY";

export default function CentralDashboardPage() {
  const { isDemoMode, selectedCampusId } = useAuth();
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [search, setSearch] = useState("");
  const [activeCampusId, setActiveCampusId] = useState<string | null>(null);
  const [liveFlash, setLiveFlash] = useState(false);
  const [lastEventText, setLastEventText] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const [campRes, allocRes, tickRes] = await Promise.all([
        apiClient.campuses.list({ pageSize: 50 }),
        apiClient.allocations.list({ pageSize: 50 }),
        apiClient.tickets.list({ pageSize: 50 }),
      ]);
      setCampuses(campRes.data);
      setAllocations(allocRes.data);
      setTickets(tickRes.data);
    } catch {
      setCampuses(DEMO_CAMPUSES);
      setAllocations(DEMO_ALLOCATIONS);
      setTickets(DEMO_TICKETS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // If user selects a campus from top global dropdown, bring its inbuilt action view into play
  useEffect(() => {
    if (selectedCampusId) {
      setActiveCampusId(selectedCampusId);
    }
  }, [selectedCampusId]);

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

  // Compute live operational state per campus
  const campusModels = useMemo(() => {
    return campuses.map((campus) => {
      const campusTickets = tickets.filter(
        (t) =>
          t.campusId === campus.id &&
          !["RESOLVED", "CLOSED"].includes(t.status)
      );
      const campusDeliveries = allocations.filter(
        (a) =>
          a.destinationCampusId === campus.id &&
          ["DRAFT", "DISPATCHED", "PARTIALLY_RECEIVED", "DISCREPANCY_REPORTED"].includes(
            a.status
          )
      );
      const openTicketCount = Math.max(
        campusTickets.length,
        campus.stats?.openTickets ?? 0
      );
      const deliveryCount = Math.max(
        campusDeliveries.length,
        campus.stats?.pendingAllocations ?? 0
      );
      const hasDiscrepancy = campusDeliveries.some(
        (a) => a.status === "DISCREPANCY_REPORTED"
      );

      let tone: TileDotTone = "healthy";
      if (campus.status !== "ACTIVE") {
        tone = "inactive";
      } else if (openTicketCount > 0 || hasDiscrepancy) {
        tone = "alert";
      } else if (deliveryCount > 0) {
        tone = "transit";
      }

      return {
        campus,
        campusTickets,
        campusDeliveries,
        openTicketCount,
        deliveryCount,
        tone,
      };
    });
  }, [campuses, tickets, allocations]);

  const counts = useMemo(() => {
    let alert = 0;
    let transit = 0;
    let healthy = 0;
    for (const m of campusModels) {
      if (m.tone === "alert") alert += 1;
      else if (m.tone === "transit") transit += 1;
      else if (m.tone === "healthy") healthy += 1;
    }
    return { total: campusModels.length, alert, transit, healthy };
  }, [campusModels]);

  const filteredCampuses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campusModels.filter((m) => {
      if (filterMode === "ALERT" && m.tone !== "alert") return false;
      if (filterMode === "TRANSIT" && m.tone !== "transit") return false;
      if (filterMode === "HEALTHY" && m.tone !== "healthy") return false;
      if (!q) return true;
      return (
        m.campus.code.toLowerCase().includes(q) ||
        m.campus.name.toLowerCase().includes(q) ||
        (m.campus.city?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [campusModels, filterMode, search]);

  const selectedModel = useMemo(
    () => campusModels.find((m) => m.campus.id === activeCampusId) ?? null,
    [campusModels, activeCampusId]
  );

  const handleDispatchDraft = async (alloc: StockAllocationDTO) => {
    setActionBusyId(alloc.id);
    try {
      const res = await apiClient.allocations.updateStatus(alloc.id, {
        status: "DISPATCHED",
      });
      setAllocations((prev) =>
        prev.map((a) => (a.id === alloc.id ? res.data : a))
      );
      setLastEventText(`Dispatched ${alloc.referenceCode} → ${alloc.destinationCampus.code}`);
      toast.success(`${alloc.referenceCode} dispatched`);
    } catch {
      setAllocations((prev) =>
        prev.map((a) =>
          a.id === alloc.id ? { ...a, status: "DISPATCHED" } : a
        )
      );
      setLastEventText(`Dispatched ${alloc.referenceCode} → ${alloc.destinationCampus.code}`);
      toast.success(`${alloc.referenceCode} marked dispatched`);
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <SpatialCanvas
      title="Central Network Control Board"
      subtitle={`Interactive 40-campus spatial status grid · ${formatInr(PROCUREMENT_TOTAL_VALUE_INR)} real procurement catalog across ${PROCUREMENT_LAB_BLOCKS.length} lab blocks.`}
      activeViewLabel={
        selectedModel
          ? `${selectedModel.campus.code} · ${selectedModel.campus.name}`
          : null
      }
      onBack={selectedModel ? () => setActiveCampusId(null) : undefined}
      liveFlash={liveFlash}
      lastEventText={lastEventText}
      legend={[
        { tone: "alert", label: "Ticket / Discrepancy", count: counts.alert },
        { tone: "transit", label: "Delivery Active", count: counts.transit },
        { tone: "healthy", label: "Healthy", count: counts.healthy },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" asChild>
            <Link href="/central/inventory">
              <Package className="h-4 w-4" />
              Master Catalog
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/central/allocations">
              <Send className="h-4 w-4" />
              Dispatch Stock
            </Link>
          </Button>
        </>
      }
      toolbar={
        !selectedModel ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: "ALL", label: `All Campuses (${counts.total})` },
                  { key: "ALERT", label: `Tickets Raised (${counts.alert})` },
                  { key: "TRANSIT", label: `Deliveries Active (${counts.transit})` },
                  { key: "HEALTHY", label: `Healthy (${counts.healthy})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterMode(tab.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                    filterMode === tab.key
                      ? "bg-black text-[#C4F041]"
                      : "bg-white border border-black/12 text-black/70 hover:text-black"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/45" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter campus code or city..."
                className="h-8 pl-8 text-xs bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-black/70">
              <Building2 className="h-3.5 w-3.5 text-black" />
              <span className="font-semibold text-black">
                {selectedModel.campus.name}
              </span>
              <span>·</span>
              <span>
                {selectedModel.campus.city}, {selectedModel.campus.state}
              </span>
              <span>·</span>
              <span className="tabular-nums">
                {formatNumber(selectedModel.campus.stats?.availableUnits ?? 0)} available /{" "}
                {formatNumber(selectedModel.campus.stats?.totalStockUnits ?? 0)} total units
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href="/central/allocations">
                  <Truck className="h-3 w-3" />
                  New Dispatch
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href="/central/tickets">
                  <ShieldAlert className="h-3 w-3" />
                  All Tickets
                </Link>
              </Button>
            </div>
          </div>
        )
      }
    >
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3.5">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-[20px] border border-black/8 bg-white/70 animate-pulse"
            />
          ))}
        </div>
      ) : !selectedModel ? (
        /* DEFAULT FINITE DOTTED-GRID VIEW: 40 CAMPUSES */
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3.5">
          {filteredCampuses.map((m) => {
            const badges: Array<{ text: string; tone?: TileDotTone }> = [];
            if (m.openTicketCount > 0) {
              badges.push({ text: `${m.openTicketCount} TKT`, tone: "alert" });
            }
            if (m.deliveryCount > 0) {
              badges.push({ text: `${m.deliveryCount} DEL`, tone: "transit" });
            }
            return (
              <GridTile
                key={m.campus.id}
                code={m.campus.code}
                label={m.campus.city ?? m.campus.name}
                sublabel={`${formatNumber(m.campus.stats?.availableUnits ?? 0)} avail`}
                tone={m.tone}
                pulse={m.tone === "alert" || m.tone === "transit"}
                badges={badges}
                onClick={() => setActiveCampusId(m.campus.id)}
              />
            );
          })}
        </div>
      ) : (
        /* INBUILT ACTION VIEW: 3 COLOR-CODED LIVE LANES */
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Lane 1: Open Tickets & Alerts */}
          <ActionLaneCard
            title="Tickets & Escalations"
            subtitle="Live campus issues raised"
            count={selectedModel.openTicketCount}
            tone="danger"
            headerAction={
              <Link
                href="/central/tickets"
                className="text-[11px] font-semibold text-black/60 hover:text-black inline-flex items-center gap-1"
              >
                Open <ExternalLink className="h-3 w-3" />
              </Link>
            }
          >
            {selectedModel.campusTickets.length > 0 ? (
              selectedModel.campusTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-black">
                      {tkt.ticketCode}
                    </span>
                    <Badge variant={tkt.priority === "CRITICAL" || tkt.priority === "HIGH" ? "danger" : "warning"}>
                      {tkt.priority}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-black leading-snug">
                    {tkt.title}
                  </p>
                  <p className="text-[11px] text-black/55 line-clamp-2">
                    {tkt.description}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-black/50">
                    <span>{tkt.createdBy.fullName}</span>
                    <span className="tabular-nums">{formatDateTime(tkt.createdAt)}</span>
                  </div>
                </div>
              ))
            ) : selectedModel.openTicketCount > 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-black">
                  <AlertTriangle className="h-4 w-4 text-[#E11D2E]" />
                  <span>
                    {selectedModel.openTicketCount} active campus ticket(s) reported
                  </span>
                </div>
                <p className="text-black/55">
                  Open the Tickets console to review full comments and campus escalation trail.
                </p>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href="/central/tickets">Review Tickets</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                <CheckCircle2 className="mx-auto h-5 w-5 text-[#1F8A3B] mb-1.5" />
                No open issue tickets at {selectedModel.campus.code}.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 2: Deliveries & Allocations */}
          <ActionLaneCard
            title="Live Deliveries & Dispatch"
            subtitle="In-transit batches & receipts"
            count={selectedModel.deliveryCount}
            tone="transit"
            headerAction={
              <Link
                href="/central/allocations"
                className="text-[11px] font-semibold text-black/60 hover:text-black inline-flex items-center gap-1"
              >
                Dispatch <ExternalLink className="h-3 w-3" />
              </Link>
            }
          >
            {selectedModel.campusDeliveries.length > 0 ? (
              selectedModel.campusDeliveries.map((alloc) => {
                const totalUnits = alloc.items.reduce(
                  (s, it) => s + it.allocatedQuantity,
                  0
                );
                return (
                  <div
                    key={alloc.id}
                    className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-black">
                        {alloc.referenceCode}
                      </span>
                      <Badge
                        variant={
                          alloc.status === "DISCREPANCY_REPORTED"
                            ? "danger"
                            : alloc.status === "DISPATCHED"
                              ? "info"
                              : "warning"
                        }
                      >
                        {alloc.status.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-black/75 tabular-nums">
                      <strong>{alloc.items.length} SKUs</strong> ·{" "}
                      {formatNumber(totalUnits)} units from {alloc.source}
                    </p>
                    <div className="space-y-1">
                      {alloc.items.slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between text-[11px] text-black/60"
                        >
                          <span className="truncate pr-2">{it.item.name}</span>
                          <span className="font-mono font-semibold text-black tabular-nums">
                            ×{it.allocatedQuantity}
                          </span>
                        </div>
                      ))}
                    </div>
                    {alloc.status === "DRAFT" && (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs"
                        disabled={actionBusyId === alloc.id}
                        onClick={() => handleDispatchDraft(alloc)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {actionBusyId === alloc.id
                          ? "Dispatching..."
                          : "Dispatch Delivery Now"}
                      </Button>
                    )}
                  </div>
                );
              })
            ) : selectedModel.deliveryCount > 0 ? (
              <div className="rounded-2xl border border-black/10 bg-white p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-black">
                  <Truck className="h-4 w-4 text-[#0284C7]" />
                  <span>
                    {selectedModel.deliveryCount} allocation(s) awaiting campus verification
                  </span>
                </div>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href="/central/allocations">Open Allocations</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                <Truck className="mx-auto h-5 w-5 text-black/35 mb-1.5" />
                No active deliveries in transit to {selectedModel.campus.code}.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 3: Ready Stock & Lab Blocks */}
          <ActionLaneCard
            title="Lab Blocks & Live Stock"
            subtitle="Ready campus capacity"
            count={PROCUREMENT_LAB_BLOCKS.length}
            tone="success"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-black/50">
                  Available
                </p>
                <p className="mt-1 text-xl font-bold text-black tabular-nums">
                  {formatNumber(selectedModel.campus.stats?.availableUnits ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-black/50">
                  Borrowed
                </p>
                <p className="mt-1 text-xl font-bold text-black tabular-nums">
                  {formatNumber(selectedModel.campus.stats?.borrowedUnits ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-black/50">
                  Instructors
                </p>
                <p className="mt-1 text-lg font-bold text-black tabular-nums">
                  {formatNumber(selectedModel.campus.stats?.instructorCount ?? 0)}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-[10px] uppercase tracking-wider text-black/50">
                  Students
                </p>
                <p className="mt-1 text-lg font-bold text-black tabular-nums">
                  {formatNumber(selectedModel.campus.stats?.studentCount ?? 0)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-3.5 space-y-2">
              <p className="text-[11px] font-semibold text-black">
                Configured 5.0 Lab Blocks
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PROCUREMENT_LAB_BLOCKS.map((block) => (
                  <span
                    key={block}
                    className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-1 text-[11px] font-medium text-black"
                  >
                    <MapPin className="h-3 w-3 text-[#1F8A3B]" />
                    {block}
                  </span>
                ))}
              </div>
            </div>
          </ActionLaneCard>
        </div>
      )}
    </SpatialCanvas>
  );
}
