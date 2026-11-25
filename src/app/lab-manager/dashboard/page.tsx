"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  Package,
  PackageCheck,
  ShieldAlert,
  TrendingUp,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AllocationStatusBadge,
  RequestStatusBadge,
} from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_LAB_MANAGER_DASHBOARD } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { LabManagerDashboardDTO } from "@/types/contracts";

export default function LabManagerDashboardPage() {
  const { isDemoMode } = useAuth();
  const [data, setData] = useState<LabManagerDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.dashboard.get<LabManagerDashboardDTO>();
      setData(res.data);
    } catch {
      setData(DEMO_LAB_MANAGER_DASHBOARD);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    isDemoMode,
    onEvent: () => load(),
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.campus.code} · Lab Operations Dashboard`}
        description={`Live stock health, incoming verification queue, and final student request approvals for ${data.campus.name}.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/lab-manager/incoming-stock">
                <PackageCheck className="h-4 w-4" />
                Verify Incoming ({data.kpis.incomingAllocations})
              </Link>
            </Button>
            <Button asChild>
              <Link href="/lab-manager/inventory">
                <FileSpreadsheet className="h-4 w-4" />
                Open Inventory Sheet
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Campus Units"
          value={data.kpis.totalCampusUnits}
          subtitle="Verified received inventory"
          icon={Package}
        />
        <StatCard
          title="Available Now"
          value={data.kpis.availableUnits}
          subtitle="Ready to reserve & issue"
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          title="Currently Borrowed"
          value={data.kpis.borrowedUnits}
          subtitle="Issued to students"
          icon={ClipboardCheck}
          tone="accent"
        />
        <StatCard
          title="Reserved Stock"
          value={data.kpis.reservedUnits}
          subtitle="Approved, awaiting handover"
          icon={Lock}
          tone="info"
        />
        <StatCard
          title="Incoming Allocations"
          value={data.kpis.incomingAllocations}
          subtitle="Awaiting row-by-row verification"
          icon={PackageCheck}
          tone={data.kpis.incomingAllocations > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Pending Student Requests"
          value={data.kpis.pendingStudentRequests}
          subtitle="Instructor-approved, needs reservation"
          icon={ClipboardCheck}
          tone={data.kpis.pendingStudentRequests > 0 ? "accent" : "default"}
        />
        <StatCard
          title="Damaged / Missing"
          value={`${data.kpis.damagedUnits} / ${data.kpis.missingUnits}`}
          subtitle="Excluded from available stock"
          icon={AlertTriangle}
          tone={data.kpis.damagedUnits + data.kpis.missingUnits > 0 ? "danger" : "success"}
        />
        <StatCard
          title="Open Issue Tickets"
          value={data.kpis.openTickets}
          subtitle="Raised by campus instructors"
          icon={ShieldAlert}
          tone={data.kpis.openTickets > 0 ? "warning" : "success"}
        />
      </div>

      {/* Action Queues */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Incoming Stock Queue</CardTitle>
              <CardDescription>
                Verify delivered quantities before items enter available campus stock
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/lab-manager/incoming-stock">
                Open sheet <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.incomingAllocationsList.length === 0 ? (
              <p className="py-6 text-center text-sm text-black/55">
                No pending deliveries to verify right now.
              </p>
            ) : (
              data.incomingAllocationsList.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5 transition-colors duration-150 hover:border-black/25"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-black">
                        {alloc.referenceCode}
                      </span>
                      <AllocationStatusBadge status={alloc.status} />
                    </div>
                    <p className="mt-1 text-xs text-black/55 tabular-nums">
                      {alloc.items.length} items · Dispatched{" "}
                      {formatDateTime(alloc.dispatchedAt ?? alloc.createdAt)}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href="/lab-manager/incoming-stock">Verify</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Requests Awaiting Final Approval</CardTitle>
              <CardDescription>
                Approving atomically reserves campus inventory to prevent double-booking
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/lab-manager/requests">
                Review all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingRequests.length === 0 ? (
              <p className="py-6 text-center text-sm text-black/55">
                No instructor-approved requests pending reservation.
              </p>
            ) : (
              data.pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5 transition-colors duration-150 hover:border-black/25"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-black">
                        {req.requestCode}
                      </span>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <p className="mt-1 text-xs text-black/55 truncate tabular-nums">
                      {req.student.fullName} · {req.items.length} item(s) · Approved by{" "}
                      {req.instructor.fullName}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/lab-manager/requests">Process</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-black/10">
          <div>
            <CardTitle>Recent Campus Inventory Ledger</CardTitle>
            <CardDescription>
              Every stock movement recorded atomically with before &amp; after counts
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lab-manager/history">
              Full ledger <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left border-b border-black/10">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Equipment</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Prev → Updated</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {data.recentTransactions.map((tx) => (
                <tr key={tx.id} className="transition-colors duration-150 hover:bg-[#F5F5F3]">
                  <td className="px-4 py-3 text-xs text-black/55 tabular-nums">
                    {formatDateTime(tx.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className="rounded-full font-mono text-[10px]">
                      {tx.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-black">
                    {tx.item?.name ?? tx.itemId}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-black tabular-nums">
                    {tx.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-black/55 tabular-nums">
                    {tx.previousQuantity} →{" "}
                    <strong className="text-black">{tx.updatedQuantity}</strong>
                  </td>
                  <td className="px-4 py-3 text-xs text-black/55">
                    {tx.performedBy?.fullName ?? "System"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
