"use client";

import React, { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { PhotoComparisonGrid } from "@/components/shared/photo-comparison-grid";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { LabRequestDTO } from "@/types/contracts";

export default function StudentHistoryPage() {
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoModalReq, setPhotoModalReq] = useState<LabRequestDTO | null>(null);

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
        title="Borrowing History & Photo Archive"
        description="Complete log of your past equipment requests, return verifications, and preserved 4-angle photo evidence."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="border-b border-black/10 text-left">
                <th className="px-4 py-3">Request Code</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-black/55">
                    Loading borrowing history...
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-black/10 transition-colors duration-150 hover:bg-[#F5F5F3]"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-black tabular-nums whitespace-nowrap">
                      {req.requestCode}
                    </td>
                    <td className="px-4 py-3 text-xs text-black">
                      {req.items
                        .map((i) => `${i.item.name} (×${i.requestedQuantity})`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55">
                      {req.instructor.fullName}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55 tabular-nums whitespace-nowrap">
                      {formatDateTime(req.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPhotoModalReq(req)}
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Photos
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={Boolean(photoModalReq)}
        onOpenChange={(o) => !o && setPhotoModalReq(null)}
      >
        <DialogContent className="max-w-3xl rounded-[22px] border-black/12 bg-white text-black">
          {photoModalReq && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-black">
                  {photoModalReq.requestCode} · Photo Evidence Archive
                </DialogTitle>
                <DialogDescription className="text-black/55">
                  Preserved 4-angle collection and return photos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {photoModalReq.items.map((it) => (
                  <div
                    key={it.id}
                    className="space-y-2.5 border-t border-black/10 pt-5 first:border-t-0 first:pt-0"
                  >
                    <p className="text-sm font-semibold text-black">
                      {it.item.name}
                    </p>
                    <PhotoComparisonGrid
                      photos={[
                        ...(it.photos ?? []),
                        ...(photoModalReq.photos ?? []).filter(
                          (p) => p.requestItemId === it.id
                        ),
                      ]}
                      itemName={it.item.name}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
