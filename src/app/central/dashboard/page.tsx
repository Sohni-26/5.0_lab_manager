"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { FLOW_PALETTES } from "@/components/dashboard/request-flowchart";
import { LoopsiiButton } from "@/components/landing/primitives";
import { useAuth } from "@/hooks/use-auth";
import { useMultiPinSelection } from "@/hooks/use-multi-pin";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUSES } from "@/lib/demo-data";
import type { CampusDTO } from "@/types/contracts";

const PAGE_SIZE = 4;

export default function CentralDashboardPage() {
  const { isDemoMode } = useAuth();
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setCampuses(DEMO_CAMPUSES);
      setLoading(false);
      return;
    }
    try {
      const res = await apiClient.campuses.list({ pageSize: 50 });
      setCampuses(res.data);
    } catch {
      setCampuses(DEMO_CAMPUSES);
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: [
      "allocation.created",
      "allocation.verified",
      "inventory.updated",
      "ticket.created",
    ],
    onEvent: () => {
      void load();
    },
    onReconnect: () => {
      void load();
    },
  });

  const filteredCampuses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return campuses;
    return campuses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.city?.toLowerCase().includes(q) ?? false)
    );
  }, [campuses, search]);

  const getCampusId = useCallback((c: CampusDTO) => c.id, []);
  const {
    selectedItems: pinnedCampuses,
    isMultiMode,
    isSelected,
    handleSelect,
    unpin,
    collapseToPrimary,
  } = useMultiPinSelection(filteredCampuses, getCampusId, 6);

  const totalPages = Math.max(1, Math.ceil(filteredCampuses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleCampuses = useMemo(
    () =>
      filteredCampuses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCampuses, safePage]
  );

  return (
    <div
      className="w-full min-w-0 space-y-4"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] sm:text-[28px] font-medium tracking-[-0.03em] text-black">
            Multi-Campus Network Board
          </h1>
          <p className="mt-0.5 text-[13.5px] sm:text-[14px] text-[#5E5E5A]">
            Monitor campus stock health live — Ctrl+Click campuses to compare multiple side-by-side.
          </p>
        </div>

        <LoopsiiButton
          label="Dispatch Stock"
          href="/central/allocations"
          size="sm"
          hideArrow
        />
      </div>

      <DottedGridCanvas pannable className="flex flex-col p-4 pb-20 sm:p-6 sm:pb-20">
        <div className="flex flex-1 flex-col gap-5">
          {/* Search + Multi-Pin Status Bar */}
          <div
            data-canvas-controls="true"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="relative w-full sm:w-[300px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search campus name, code, city..."
                className="h-10 w-full rounded-full bg-white/95 pl-10 pr-4 text-[14px] text-black ring-1 ring-black/[0.06] placeholder:text-black/40 focus:ring-black/25 focus:outline-none"
              />
            </div>

            {isMultiMode ? (
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-[#C4F041] px-3 py-1 text-[13px] font-semibold text-black tabular-nums">
                  {pinnedCampuses.length} campuses pinned
                </span>
                <button
                  type="button"
                  onClick={collapseToPrimary}
                  className="text-[13px] font-medium text-[#5E5E5A] hover:text-black underline decoration-black/25 underline-offset-4 cursor-pointer"
                >
                  Single view
                </button>
              </div>
            ) : (
              <span className="hidden md:inline text-[13px] text-[#5E5E5A]">
                Ctrl+Click campuses to compare side-by-side
              </span>
            )}
          </div>

          <div className="grid flex-1 grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Campus Deck */}
            <div data-canvas-controls="true" className="xl:col-span-4 space-y-3 min-w-0">
              {loading ? (
                <div className="rounded-[24px] bg-white p-6 text-center text-[14px] text-[#5E5E5A]">
                  Loading campuses...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3">
                    {visibleCampuses.map((campus, idx) => {
                      const palette = FLOW_PALETTES[idx % FLOW_PALETTES.length];
                      const active = isSelected(campus.id);
                      return (
                        <button
                          key={campus.id}
                          type="button"
                          onClick={(e) => handleSelect(campus.id, e)}
                          title="Click to inspect, Ctrl+Click to compare multiple campuses"
                          style={active ? { backgroundColor: palette.banner } : undefined}
                          className={`w-full min-w-0 rounded-[22px] p-4 text-left transition-all cursor-pointer ${
                            active
                              ? "ring-2 ring-black/85 shadow-[0_12px_28px_rgba(0,0,0,0.09)]"
                              : "bg-white/95 ring-1 ring-black/[0.05] shadow-[0_6px_22px_rgba(0,0,0,0.04)] hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[15.5px] font-semibold tracking-[-0.02em] text-black truncate">
                              {campus.name}
                            </p>
                            <span className="font-mono text-[12.5px] text-black/60 shrink-0">
                              {campus.code}
                            </span>
                          </div>
                          <p className="mt-1 text-[13px] text-black/65">
                            {campus.city}, {campus.state}
                          </p>
                          <p className="mt-2.5 text-[12.5px] font-medium text-black/75 tabular-nums">
                            {campus.stats?.availableUnits ?? 0} available ·{" "}
                            {campus.stats?.borrowedUnits ?? 0} borrowed
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 rounded-full bg-white/95 px-2.5 py-1.5 ring-1 ring-black/[0.05]">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F2F2EE] disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                        Page {safePage} of {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F2F2EE] disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Multi-Campus Comparison Workspace */}
            <div
              data-canvas-controls="true"
              className={`xl:col-span-8 min-w-0 grid gap-5 ${
                isMultiMode ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
              }`}
            >
              {pinnedCampuses.map((campus) => {
                const total = campus.stats?.totalStockUnits ?? 0;
                const avail = campus.stats?.availableUnits ?? 0;
                const borrowed = campus.stats?.borrowedUnits ?? 0;
                const utilPct =
                  total > 0 ? Math.min(100, Math.round((borrowed / total) * 100)) : 0;

                return (
                  <div
                    key={campus.id}
                    className="relative rounded-[28px] bg-white p-6 ring-1 ring-black/[0.05] shadow-[0_12px_36px_rgba(0,0,0,0.055)] space-y-5"
                  >
                    {isMultiMode && (
                      <button
                        type="button"
                        onClick={() => unpin(campus.id)}
                        aria-label={`Unpin ${campus.name}`}
                        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F2] text-black hover:bg-black hover:text-[#C4F041] cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    <div className="flex items-start gap-3 pr-8">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F3FBD4] text-black">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-[13px] text-[#5E5E5A]">
                          {campus.code} · {campus.status}
                        </p>
                        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-black">
                          {campus.name}
                        </h2>
                        <p className="text-[13.5px] text-[#5E5E5A]">
                          {campus.city}, {campus.state}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-[18px] bg-[#F5F5F2] p-3.5">
                        <p className="text-[12px] text-[#5E5E5A]">Total Stock</p>
                        <p className="mt-1 text-[22px] font-semibold text-black tabular-nums">
                          {total}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#F5F5F2] p-3.5">
                        <p className="text-[12px] text-[#5E5E5A]">Available</p>
                        <p className="mt-1 text-[22px] font-semibold text-black tabular-nums">
                          {avail}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#F5F5F2] p-3.5">
                        <p className="text-[12px] text-[#5E5E5A]">Borrowed</p>
                        <p className="mt-1 text-[22px] font-semibold text-black tabular-nums">
                          {borrowed}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-[#5E5E5A]">Lab utilization</span>
                        <span className="font-semibold text-black tabular-nums">
                          {utilPct}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0F0EC]">
                        <div
                          className="h-full rounded-full bg-[#C4F041]"
                          style={{ width: `${utilPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-[#5E5E5A]">
                      <span className="tabular-nums">
                        {campus.stats?.instructorCount ?? 0} Instructors ·{" "}
                        {campus.stats?.studentCount ?? 0} Students
                      </span>
                      <span className="tabular-nums">
                        {campus.stats?.openTickets ?? 0} open tickets
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <Link
                        href="/central/allocations"
                        className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#C4F041] px-5 text-[14px] font-semibold text-black transition-colors hover:bg-black hover:text-[#C4F041]"
                      >
                        Allocate Stock
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/central/campuses"
                        className="text-[13.5px] font-medium text-[#5E5E5A] hover:text-black"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DottedGridCanvas>
    </div>
  );
}
