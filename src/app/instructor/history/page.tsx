"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { LabRequestDTO } from "@/types/contracts";

export default function InstructorHistoryPage() {
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.requests
      .list({ pageSize: 80 })
      .then((res) => setRequests(res.data))
      .catch(() => setRequests(DEMO_REQUESTS))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Borrowing & Verification History"
        description="Complete record of student requests you reviewed, items you issued, and return inspections completed."
      />

      <Card className="overflow-hidden rounded-[22px] border-black/12 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="border-b border-black/10 bg-[#F5F5F3] text-left">
                <th className="px-4 py-3 text-black/55">Request Code</th>
                <th className="px-4 py-3 text-black/55">Student</th>
                <th className="px-4 py-3 text-black/55">Items</th>
                <th className="px-4 py-3 text-black/55">Status</th>
                <th className="px-4 py-3 text-black/55">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-sm text-black/55">
                    Loading history...
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-black/10 last:border-b-0 transition-colors duration-150 hover:bg-[#F5F5F3]"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-black">
                        {req.requestCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-black">
                        {req.student.fullName}
                      </p>
                      <p className="font-mono text-black/55 tabular-nums">
                        {req.student.institutionalId}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-black/75 tabular-nums">
                      {req.items
                        .map((i) => `${i.item.name} (×${i.requestedQuantity})`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55 tabular-nums">
                      {formatDateTime(req.updatedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
