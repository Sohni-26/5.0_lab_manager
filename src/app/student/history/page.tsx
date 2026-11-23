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
              <tr className="text-left">
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
                  <td colSpan={6} className="p-8 text-center text-[#72736E]">
                    Loading borrowing history...
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      {req.requestCode}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {req.items
                        .map((i) => `${i.item.name} (×${i.requestedQuantity})`)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#72736E]">
                      {req.instructor.fullName}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#72736E]">
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
        <DialogContent className="max-w-3xl">
          {photoModalReq && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">
                  {photoModalReq.requestCode} · Photo Evidence Archive
                </DialogTitle>
                <DialogDescription>
                  Preserved 4-angle collection and return photos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {photoModalReq.items.map((it) => (
                  <div key={it.id} className="space-y-2">
                    <p className="text-sm font-semibold text-[#222321]">
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
