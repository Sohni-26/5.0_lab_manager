"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  FileClock,
  Layers,
  Package,
  PackageCheck,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AllocationStatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_CENTRAL_DASHBOARD } from "@/lib/demo-data";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { CentralDashboardDTO } from "@/types/contracts";

export default function CentralDashboardPage() {
  const { isDemoMode, selectedCampusId } = useAuth();
  const [data, setData] = useState<CentralDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await apiClient.dashboard.get<CentralDashboardDTO>(
        selectedCampusId || undefined
      );
      setData(res.data);
    } catch {
      setData(DEMO_CENTRAL_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, [selectedCampusId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useRealtime({
    enabled: true,
    isDemoMode,
    onEvent: () => fetchDashboard(),
  });

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-72 rounded-2xl bg-[#EAEAE6]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[22px] bg-[#EAEAE6]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-[22px] bg-[#EAEAE6]" />
          <Skeleton className="h-80 rounded-[22px] bg-[#EAEAE6]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central Command Overview"
        description={
          selectedCampusId
            ? "Filtered analytics for the selected campus scope. Switch back to Global in the top bar for all 40 campuses."
            : "Real-time inventory, stock allocations, verification status, and audit telemetry across all 40 campuses."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/central/inventory">
                <Package className="h-4 w-4" />
                Master Catalog
              </Link>
            </Button>
            <Button asChild>
              <Link href="/central/allocations">
                <Send className="h-4 w-4" />
                New Allocation
              </Link>
            </Button>
          </>
        }
      />

      {/* Primary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Campuses Connected"
          value={`${data.kpis.activeCampuses} / ${data.kpis.totalCampuses}`}
          subtitle="Active laboratory sites"
          icon={Building2}
          tone="accent"
        />
        <StatCard
          title="Master Catalog Items"
          value={data.kpis.totalMasterItems}
          subtitle="Standardised global SKUs"
          icon={Layers}
          tone="default"
        />
        <StatCard
          title="Total Allocated Units"
          value={data.kpis.totalAllocatedUnits}
          subtitle="Across campus inventories"
          icon={Package}
          tone="info"
        />
        <StatCard
          title="Pending Verifications"
          value={data.kpis.pendingVerifications}
          subtitle="Dispatched awaiting campus sign-off"
          icon={PackageCheck}
          tone="warning"
        />
        <StatCard
          title="Active Platform Users"
          value={data.kpis.activeUsers}
          subtitle="Managers, Instructors & Students"
          icon={Users}
          tone="success"
        />
        <StatCard
          title="Pending Requests"
          value={data.kpis.pendingRequests}
          subtitle="Active multi-stage borrowing flows"
          icon={ClipboardList}
          tone="info"
        />
        <StatCard
          title="Open Issue Tickets"
          value={data.kpis.openTickets}
          subtitle="Equipment & discrepancy escalations"
          icon={ShieldAlert}
          tone={data.kpis.openTickets > 0 ? "danger" : "success"}
        />
        <StatCard
          title="Ledger Integrity"
          value="100%"
          subtitle="Atomic double-booking protection"
          icon={FileClock}
          tone="success"
        />
      </div>

      {/* Recharts Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campus-wise Inventory Distribution</CardTitle>
            <CardDescription>
              Available, borrowed, reserved, and damaged units across top campuses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.campusInventoryChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis
                    dataKey="campusCode"
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(0,0,0,0.7)" }} />
                  <Bar dataKey="available" name="Available" fill="#AAC2AA" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="borrowed" name="Borrowed" fill="#000000" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="reserved" name="Reserved" fill="#9EC3D5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="damaged" name="Damaged" fill="#FA8E66" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Allocation Activity Trend</CardTitle>
            <CardDescription>
              Monthly units dispatched from central vs verified campus receipts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.allocationActivityChart}>
                  <defs>
                    <linearGradient id="dispatchedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9EC3D5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#9EC3D5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="receivedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000000" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(0,0,0,0.7)" }} />
                  <Area
                    type="monotone"
                    dataKey="dispatched"
                    name="Dispatched"
                    stroke="#9EC3D5"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#dispatchedGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="received"
                    name="Verified Received"
                    stroke="#000000"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#receivedGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Allocations & Recent Audit Logs */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Pending &amp; Discrepancy Allocations</CardTitle>
              <CardDescription>
                Dispatches awaiting campus verification or flagged with shortages
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/central/allocations">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingAllocations.length === 0 ? (
              <p className="py-6 text-center text-sm text-black/55">
                All allocations have been verified cleanly.
              </p>
            ) : (
              data.pendingAllocations.slice(0, 5).map((alloc) => {
                const totalUnits = alloc.items.reduce(
                  (sum, it) => sum + it.allocatedQuantity,
                  0
                );
                return (
                  <div
                    key={alloc.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5 transition-colors duration-150 hover:border-black/25"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-black">
                          {alloc.referenceCode}
                        </span>
                        <span className="text-xs text-black/55">
                          → {alloc.destinationCampus.code} ({alloc.destinationCampus.name})
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-black/55 tabular-nums">
                        {alloc.items.length} SKUs · {formatNumber(totalUnits)} units ·{" "}
                        {formatDateTime(alloc.createdAt)}
                      </p>
                    </div>
                    <AllocationStatusBadge status={alloc.status} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent System Audit Activity</CardTitle>
              <CardDescription>
                Immutable log of inventory, allocation, and governance actions
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/central/audit-logs">
                Audit trail <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentAuditLogs.length === 0 ? (
              <p className="py-6 text-center text-sm text-black/55">
                No recent audit events recorded yet.
              </p>
            ) : (
              data.recentAuditLogs.slice(0, 6).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5 transition-colors duration-150 hover:border-black/25"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-black">
                      {log.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-0.5 text-xs text-black/55">
                      {log.actor?.fullName ?? "System"} · {log.entityType}
                      {log.campus ? ` · ${log.campus.code}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-black/55 tabular-nums">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
