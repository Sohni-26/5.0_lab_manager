"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  MapPin,
  PlusCircle,
  RotateCcw,
  Search,
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
import { DEMO_CAMPUS_INVENTORY, DEMO_REQUESTS } from "@/lib/demo-data";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import type { CampusInventoryDTO, LabRequestDTO } from "@/types/contracts";

type FilterMode = "ALL" | "HEALTHY" | "PENDING" | "ALERT";

export default function StudentDashboardPage() {
  const { isDemoMode } = useAuth();
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterMode, setFilterMode] = useState<FilterMode>("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [activeTarget, setActiveTarget] = useState<
    | { kind: "ITEM"; id: string }
    | { kind: "MY_ACTIVITY" }
    | null
  >(null);

  const [liveFlash, setLiveFlash] = useState(false);
  const [lastEventText, setLastEventText] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    try {
      const [invRes, reqRes] = await Promise.all([
        apiClient.inventory.list({ pageSize: 250 }),
        apiClient.requests.list({ pageSize: 50 }),
      ]);
      setInventory(invRes.data.filter((i) => i.isVerified && i.isVisible));
      setRequests(reqRes.data);
    } catch {
      setInventory(
        DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible)
      );
      setRequests(DEMO_REQUESTS);
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

  const activeRequests = useMemo(
    () =>
      requests.filter((r) =>
        ["PENDING_INSTRUCTOR", "PENDING_LAB_MANAGER", "APPROVED"].includes(
          r.status
        )
      ),
    [requests]
  );

  const borrowedOrReturning = useMemo(
    () =>
      requests.filter((r) =>
        ["ISSUED", "PARTIALLY_ISSUED", "RETURN_VERIFICATION_PENDING"].includes(
          r.status
        )
      ),
    [requests]
  );

  const itemModels = useMemo(() => {
    return inventory.map((row) => {
      const meta = extractItemProcurementMeta(row.item.specifications);
      const myItemRequests = activeRequests.filter((r) =>
        r.items.some((i) => i.itemId === row.itemId)
      );
      const myBorrowed = borrowedOrReturning.filter((r) =>
        r.items.some((i) => i.itemId === row.itemId)
      );

      let tone: TileDotTone = "healthy";
      if (row.availableQuantity === 0) {
        tone = "alert";
      } else if (myItemRequests.length > 0 || myBorrowed.length > 0) {
        tone = "pending";
      }

      return {
        row,
        meta,
        myItemRequests,
        myBorrowed,
        tone,
      };
    });
  }, [inventory, activeRequests, borrowedOrReturning]);

  const counts = useMemo(() => {
    let healthy = 0;
    let pending = 0;
    let alert = 0;
    for (const m of itemModels) {
      if (m.tone === "healthy") healthy += 1;
      else if (m.tone === "pending") pending += 1;
      else if (m.tone === "alert") alert += 1;
    }
    return { total: itemModels.length, healthy, pending, alert };
  }, [itemModels]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return itemModels.filter((m) => {
      if (filterMode === "HEALTHY" && m.tone !== "healthy") return false;
      if (filterMode === "PENDING" && m.tone !== "pending") return false;
      if (filterMode === "ALERT" && m.tone !== "alert") return false;
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

  const laneBorrowed = selectedItemModel
    ? selectedItemModel.myBorrowed
    : borrowedOrReturning;
  const laneInFlight = selectedItemModel
    ? selectedItemModel.myItemRequests
    : activeRequests;

  const activeViewLabel = selectedItemModel
    ? `${selectedItemModel.row.item.code} · ${selectedItemModel.row.item.name}`
    : activeTarget?.kind === "MY_ACTIVITY"
      ? "My Requests & Active Borrows"
      : null;

  return (
    <SpatialCanvas
      title="Student Lab Equipment Board"
      subtitle="Interactive shelf status grid across all 6 campus lab blocks — click any slot to inspect live availability or start a borrowing request."
      activeViewLabel={activeViewLabel}
      onBack={activeTarget ? () => setActiveTarget(null) : undefined}
      liveFlash={liveFlash}
      lastEventText={lastEventText}
      legend={[
        { tone: "healthy", label: "Available", count: counts.healthy },
        { tone: "pending", label: "My Active", count: counts.pending },
        { tone: "alert", label: "Out of Stock", count: counts.alert },
      ]}
      headerActions={
        <>
          <Button
            size="sm"
            variant={activeTarget?.kind === "MY_ACTIVITY" ? "default" : "outline"}
            onClick={() => setActiveTarget({ kind: "MY_ACTIVITY" })}
          >
            <ClipboardList className="h-4 w-4" />
            My Activity ({activeRequests.length + borrowedOrReturning.length})
          </Button>
          <Button size="sm" asChild>
            <Link href="/student/new-request">
              <PlusCircle className="h-4 w-4" />
              New Request
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
                  { key: "HEALTHY", label: `Available (${counts.healthy})` },
                  { key: "PENDING", label: `My Active (${counts.pending})` },
                  { key: "ALERT", label: `Out of Stock (${counts.alert})` },
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
                  placeholder="Search sensors, boards, kits..."
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black/65">
            <span>
              {selectedItemModel
                ? `${selectedItemModel.row.item.code} · ${selectedItemModel.meta.labBlock ?? "Campus Lab"}`
                : "Track your in-flight requests, collection photos, and active returns"}
            </span>
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <Link href="/student/returns">
                <RotateCcw className="h-3 w-3" />
                Returns Console
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
          {(activeRequests.length > 0 || borrowedOrReturning.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              {activeRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "MY_ACTIVITY" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E5C185] bg-[#FDF0D8] px-3.5 py-1.5 text-xs font-semibold text-[#92400E] hover:brightness-95 transition cursor-pointer"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  {activeRequests.length} Active Request{activeRequests.length > 1 ? "s" : ""} in Progress
                </button>
              )}
              {borrowedOrReturning.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTarget({ kind: "MY_ACTIVITY" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#9EC3D5] bg-[#E3F3FC] px-3.5 py-1.5 text-xs font-semibold text-[#075985] hover:brightness-95 transition cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {borrowedOrReturning.length} Borrowed / Return Pending
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5">
            {filteredItems.map((m) => {
              const badges: Array<{ text: string; tone?: TileDotTone }> = [];
              if (m.myItemRequests.length > 0) {
                badges.push({ text: "MY REQ", tone: "pending" });
              }
              if (m.myBorrowed.length > 0) {
                badges.push({ text: "BORROWED", tone: "transit" });
              }
              return (
                <GridTile
                  key={m.row.id}
                  code={m.row.item.code}
                  label={m.row.item.name}
                  sublabel={`${m.row.availableQuantity} ${m.row.item.unit} avail`}
                  tone={m.tone}
                  pulse={m.tone === "pending"}
                  badges={badges}
                  onClick={() => setActiveTarget({ kind: "ITEM", id: m.row.id })}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Lane 1: Borrowed & Returns */}
          <ActionLaneCard
            title="Borrowed & Returns"
            subtitle="Active handovers & return photos"
            count={laneBorrowed.length}
            tone="danger"
          >
            {laneBorrowed.length > 0 ? (
              laneBorrowed.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-black">
                      {req.requestCode}
                    </span>
                    <Badge variant="warning">
                      {req.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-black/70 line-clamp-2">{req.purpose}</p>
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs" asChild>
                    <Link href="/student/returns">Open Return Checklist</Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                No active borrowed items pending return here.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 2: In-Flight Requests */}
          <ActionLaneCard
            title="In-Flight Requests"
            subtitle="Approval & collection status"
            count={laneInFlight.length}
            tone="warning"
          >
            {laneInFlight.length > 0 ? (
              laneInFlight.map((req) => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-black/10 bg-white p-3.5 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold text-black">
                      {req.requestCode}
                    </span>
                    <Badge variant={req.status === "APPROVED" ? "accent" : "info"}>
                      {req.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-black/75 line-clamp-2">{req.purpose}</p>
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs" asChild>
                    <Link
                      href={
                        req.status === "APPROVED"
                          ? "/student/borrowed"
                          : "/student/requests"
                      }
                    >
                      {req.status === "APPROVED"
                        ? "Upload 4-Angle Collection Photos"
                        : "View Request Status"}
                    </Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-white/75 p-6 text-center text-xs text-black/55">
                No pending requests for this slot.
              </div>
            )}
          </ActionLaneCard>

          {/* Lane 3: Ready to Borrow */}
          <ActionLaneCard
            title="Ready to Borrow"
            subtitle={selectedItemModel?.meta.labBlock ?? "Browse Lab Blocks"}
            count={selectedItemModel?.row.availableQuantity ?? counts.healthy}
            tone="success"
          >
            {selectedItemModel ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">
                      {selectedItemModel.row.item.category.name}
                    </Badge>
                    <span className="font-mono text-xs font-bold text-[#1F8A3B] tabular-nums">
                      {selectedItemModel.row.availableQuantity}{" "}
                      {selectedItemModel.row.item.unit} available
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-black">
                    {selectedItemModel.row.item.name}
                  </h4>
                  {selectedItemModel.row.item.description && (
                    <p className="text-xs text-black/55 leading-relaxed">
                      {selectedItemModel.row.item.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedItemModel.meta.labBlock && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 text-[11px] text-black/75">
                        <MapPin className="h-3 w-3 text-[#1F8A3B]" />
                        {selectedItemModel.meta.labBlock}
                      </span>
                    )}
                    {selectedItemModel.meta.allocationScope === "ALL_40_LABS" && (
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-[#C4F041]/55 px-2.5 py-0.5 text-[11px] font-semibold text-black">
                        Innovators Kit V1
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={selectedItemModel.row.availableQuantity <= 0}
                  asChild={selectedItemModel.row.availableQuantity > 0}
                >
                  {selectedItemModel.row.availableQuantity > 0 ? (
                    <Link
                      href={`/student/new-request?itemId=${selectedItemModel.row.item.id}`}
                    >
                      <PlusCircle className="h-4 w-4" />
                      Request {selectedItemModel.row.item.code}
                    </Link>
                  ) : (
                    <span>Currently Out of Stock</span>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {PROCUREMENT_LAB_BLOCKS.map((block) => {
                  const blockAvail = itemModels.filter(
                    (m) =>
                      m.meta.labBlock === block && m.row.availableQuantity > 0
                  ).length;
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
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#1F8A3B]" />
                        {block}
                      </span>
                      <span className="font-mono text-xs font-bold text-black tabular-nums">
                        {blockAvail} ready
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
