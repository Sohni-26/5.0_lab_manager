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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3">Request Code</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[#72736E]">
                    Loading history...
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      {req.requestCode}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-[#222321]">
                        {req.student.fullName}
                      </p>
                      <p className="text-[#72736E]">{req.student.institutionalId}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#585955]">
                      {req.items
                        .map((i) => `${i.item.name} (×${i.requestedQuantity})`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#72736E]">
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
