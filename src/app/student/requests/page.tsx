"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { RequestTimeline } from "@/components/shared/request-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { LabRequestDTO } from "@/types/contracts";

export default function StudentMyRequestsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      setRequests(res.data);
    } catch {
      setRequests(DEMO_REQUESTS);
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
    eventTypes: ["request.status_changed", "borrowing.issued", "return.verified"],
    onEvent: () => load(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Borrowing Requests"
        description="Track every request stage live — from submission through Instructor review, Lab Manager reservation, collection, and return closure."
        actions={
          <Button asChild>
            <Link href="/student/new-request">
              <PlusCircle className="h-4 w-4" />
              New Request
            </Link>
          </Button>
        }
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-[#72736E]">
          Loading your requests...
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No borrowing requests yet"
          description="Browse your campus lab catalog and submit your first multi-item equipment request."
          action={
            <Button asChild>
              <Link href="/student/inventory">Browse Campus Inventory</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id}>
              <CardHeader className="border-b border-[#EFECE6]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-mono text-base">
                        {req.requestCode}
                      </CardTitle>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <CardDescription className="mt-1">
                      Instructor: <strong>{req.instructor.fullName}</strong> · Submitted{" "}
                      {formatDateTime(req.createdAt)}
                    </CardDescription>
                  </div>

                  {req.status === "APPROVED" && (
                    <Button size="sm" asChild>
                      <Link href="/student/borrowed">
                        Upload 4 Collection Photos
                      </Link>
                    </Button>
                  )}
                  {(req.status === "ISSUED" || req.status === "RETURN_PENDING") && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/student/returns">Submit Return</Link>
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-4">
                <RequestTimeline status={req.status} />

                <p className="text-sm text-[#222321] bg-[#FAF9F6] border border-[#EFECE6] rounded-xl p-3">
                  {req.purpose}
                </p>

                {req.rejectionReason && (
                  <div className="rounded-xl border border-[#D9534F]/25 bg-[#FDEDEC] p-3 text-xs text-[#C23E3A]">
                    <strong>Rejection Reason:</strong> {req.rejectionReason}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {req.items.map((it) => (
                    <Badge key={it.id} variant="secondary" className="py-1 px-3">
                      {it.item.name} · ×{it.requestedQuantity}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
