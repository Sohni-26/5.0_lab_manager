"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { RequestTimeline } from "@/components/shared/request-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { readMergedDemoRequests } from "@/lib/student-requests-store";
import { formatDateTime } from "@/lib/utils";
import type { LabRequestDTO } from "@/types/contracts";

/**
 * Read-only Campus Borrowing Monitor for Lab Managers.
 * Student borrowing requests are approved directly by their assigned Instructor.
 */
export default function LabManagerRequestsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setRequests(readMergedDemoRequests(DEMO_REQUESTS));
      setLoading(false);
      return;
    }
    try {
      const reqRes = await apiClient.requests.list({ pageSize: 60 });
      setRequests(reqRes.data);
    } catch {
      setRequests(readMergedDemoRequests(DEMO_REQUESTS));
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
    eventTypes: ["request.created", "request.status_changed", "inventory.updated"],
    onEvent: () => load(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Borrowing Activity"
        description="Read-only overview of student borrowing requests across your campus. Requests are approved directly by the assigned Instructor."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-black/55">
          Loading campus requests...
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No campus requests yet"
          description="Student borrowing requests approved by Instructors will appear here for stock visibility."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-black">
                      {req.requestCode}
                    </span>
                    <RequestStatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-black/55 mt-1">
                    Student:{" "}
                    <strong className="text-black">{req.student.fullName}</strong>{" "}
                    · Instructor:{" "}
                    <strong className="text-black">
                      {req.instructor.fullName}
                    </strong>
                  </p>
                </div>
                <span className="text-xs text-black/55 tabular-nums">
                  {formatDateTime(req.updatedAt)}
                </span>
              </div>
              <RequestTimeline status={req.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
