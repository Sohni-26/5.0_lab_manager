"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Package,
  PlusCircle,
  RotateCcw,
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
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { RequestTimeline } from "@/components/shared/request-timeline";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_STUDENT_DASHBOARD } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { StudentDashboardDTO } from "@/types/contracts";

export default function StudentDashboardPage() {
  const { isDemoMode } = useAuth();
  const [data, setData] = useState<StudentDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.dashboard.get<StudentDashboardDTO>();
      setData(res.data);
    } catch {
      setData(DEMO_STUDENT_DASHBOARD);
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-[22px] bg-[#EAEAE6]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.campus.code} · Student Lab Portal`}
        description={`Browse verified lab hardware at ${data.campus.name}, submit borrowing requests, and upload mandatory 4-angle collection & return photos.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/student/inventory">
                <Package className="h-4 w-4" />
                Browse Catalog
              </Link>
            </Button>
            <Button asChild>
              <Link href="/student/new-request">
                <PlusCircle className="h-4 w-4" />
                New Borrowing Request
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Available SKUs"
          value={data.kpis.availableItemsCount}
          subtitle="Verified campus catalog"
          icon={Package}
          tone="success"
        />
        <StatCard
          title="Pending Requests"
          value={data.kpis.myPendingRequests}
          subtitle="In approval pipeline"
          icon={Clock}
          tone="warning"
        />
        <StatCard
          title="Approved (Ready)"
          value={data.kpis.myApprovedRequests}
          subtitle="Upload collection photos"
          icon={CheckCircle2}
          tone="info"
        />
        <StatCard
          title="Currently Borrowed"
          value={data.kpis.currentlyBorrowedItems}
          subtitle="Active lab kits"
          icon={Camera}
          tone="accent"
        />
        <StatCard
          title="Awaiting Return Check"
          value={data.kpis.itemsAwaitingReturn}
          subtitle="Instructor verifying"
          icon={RotateCcw}
          tone="default"
        />
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Borrowing Requests</CardTitle>
            <CardDescription>
              Live progress from submission through Instructor &amp; Lab Manager sign-off
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/student/requests">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.recentRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-black/55">
              <ClipboardList className="mx-auto h-7 w-7 text-black/35 mb-2" />
              You haven&apos;t submitted any borrowing requests yet.
            </div>
          ) : (
            data.recentRequests.slice(0, 4).map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-black/10 bg-[#F5F5F3] p-4 space-y-3 transition-colors duration-150 hover:border-black/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-black tabular-nums">
                      {req.requestCode}
                    </span>
                    <RequestStatusBadge status={req.status} />
                  </div>
                  <span className="text-xs text-black/55 tabular-nums">
                    {formatDateTime(req.updatedAt)}
                  </span>
                </div>
                <p className="text-sm text-black">{req.purpose}</p>
                <RequestTimeline status={req.status} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
