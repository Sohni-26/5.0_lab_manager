"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Package,
  RotateCcw,
  ShieldAlert,
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
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_INSTRUCTOR_DASHBOARD } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { InstructorDashboardDTO } from "@/types/contracts";

export default function InstructorDashboardPage() {
  const { isDemoMode } = useAuth();
  const [data, setData] = useState<InstructorDashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.dashboard.get<InstructorDashboardDTO>();
      setData(res.data);
    } catch {
      setData(DEMO_INSTRUCTOR_DASHBOARD);
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
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.campus.code} · Instructor Workspace`}
        description={`Review student borrowing requests, confirm 4-angle collection handovers, and physically inspect returns for ${data.campus.name}.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/instructor/tickets">
                <ShieldAlert className="h-4 w-4" />
                Raise Issue Ticket
              </Link>
            </Button>
            <Button asChild>
              <Link href="/instructor/return-verification">
                <RotateCcw className="h-4 w-4" />
                Inspect Returns ({data.kpis.pendingReturnVerifications})
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Pending Reviews"
          value={data.kpis.pendingStudentRequests}
          subtitle="Awaiting your decision"
          icon={ClipboardCheck}
          tone="warning"
        />
        <StatCard
          title="Approved Requests"
          value={data.kpis.approvedRequests}
          subtitle="Ready for collection"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          title="Active Borrowings"
          value={data.kpis.activeBorrowings}
          subtitle="Currently with students"
          icon={Package}
          tone="info"
        />
        <StatCard
          title="Return Verifications"
          value={data.kpis.pendingReturnVerifications}
          subtitle="Compare 4-angle photos"
          icon={Camera}
          tone="accent"
        />
        <StatCard
          title="Open Issue Tickets"
          value={data.kpis.openIssueTickets}
          subtitle="Campus equipment reports"
          icon={ShieldAlert}
          tone={data.kpis.openIssueTickets > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Assigned Student Requests</CardTitle>
              <CardDescription>
                Approve academic necessity to forward to your Campus Lab Manager
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/instructor/requests">
                Open queue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingRequestsList.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#72736E]">
                No pending requests right now.
              </p>
            ) : (
              data.pendingRequestsList.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {req.requestCode}
                      </span>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#72736E] truncate">
                      {req.student.fullName} · {req.purpose}
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <Link href="/instructor/requests">Review</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Pending Return Inspections</CardTitle>
              <CardDescription>
                Inspect physical items and compare before/after 4-angle photos
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/instructor/return-verification">
                Inspect all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingReturnsList.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#72736E]">
                No submitted returns awaiting physical inspection.
              </p>
            ) : (
              data.pendingReturnsList.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {req.requestCode}
                      </span>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <p className="mt-1 text-xs text-[#72736E] truncate">
                      {req.student.fullName} · Submitted {formatDateTime(req.updatedAt)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/instructor/return-verification">Compare</Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
