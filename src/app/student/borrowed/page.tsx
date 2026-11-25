"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { PhotoUploaderGrid } from "@/components/shared/photo-uploader-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { LabRequestDTO, PhotoAngle } from "@/types/contracts";

export default function StudentBorrowedCollectionPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      setRequests(
        res.data.filter(
          (r) =>
            r.status === "APPROVED" ||
            r.status === "PARTIALLY_ISSUED" ||
            r.status === "ISSUED"
        )
      );
    } catch {
      setRequests(
        DEMO_REQUESTS.filter(
          (r) => r.status === "APPROVED" || r.status === "ISSUED"
        )
      );
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
    eventTypes: ["request.status_changed", "borrowing.issued"],
    onEvent: () => load(),
  });

  const handleUploadCollectionPhoto = async (
    requestId: string,
    requestItemId: string,
    angle: PhotoAngle,
    file: File
  ) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestItemId", requestItemId);
      fd.append("angle", angle);
      await apiClient.requests.uploadCollectionPhoto(requestId, fd);
      await load();
    } catch (err) {
      if (isDemoMode) {
        const previewUrl = URL.createObjectURL(file);
        setRequests((prev) =>
          prev.map((req) => {
            if (req.id !== requestId) return req;
            return {
              ...req,
              items: req.items.map((it) => {
                if (it.id !== requestItemId) return it;
                const others = (it.photos ?? []).filter(
                  (p) => !(p.phase === "COLLECTION" && p.angle === angle)
                );
                return {
                  ...it,
                  photos: [
                    ...others,
                    {
                      id: `local-${Date.now()}`,
                      requestId,
                      requestItemId,
                      borrowingRecordId: null,
                      uploadedById: "demo",
                      angle,
                      phase: "COLLECTION",
                      storageKey: "local-preview",
                      url: previewUrl,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                };
              }),
            };
          })
        );
      } else {
        throw err;
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approved & Borrowed Equipment"
        description="Upload all 4 mandatory collection angle photos (Front/Top, Back/Bottom, Left, Right) for each approved item so your Instructor can confirm physical handover."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-black/55">
          Loading approved and borrowed items...
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No approved or active borrowed items"
          description="Once both your Instructor and Campus Lab Manager approve a request, it will appear here for 4-angle collection photo capture."
          action={
            <Button asChild>
              <Link href="/student/new-request">Create New Request</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {requests.map((req) => {
            const isIssued = req.status === "ISSUED";
            return (
              <Card key={req.id} className="overflow-hidden">
                <CardHeader className="bg-[#F5F5F3] border-b border-black/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="font-mono text-base text-black">
                          {req.requestCode}
                        </CardTitle>
                        <RequestStatusBadge status={req.status} />
                      </div>
                      <CardDescription className="mt-1 text-black/55">
                        Instructor:{" "}
                        <strong className="font-semibold text-black">
                          {req.instructor.fullName}
                        </strong>{" "}
                        ·{" "}
                        {isIssued
                          ? "Items issued — original collection photos locked as immutable evidence."
                          : "Stock reserved! Upload 4 photos per item, then meet your Instructor for handover."}
                      </CardDescription>
                    </div>
                    {isIssued && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/student/returns">Go to Return Portal</Link>
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-6">
                  {req.items.map((it) => {
                    const photos = [
                      ...(it.photos ?? []),
                      ...(req.photos ?? []).filter(
                        (p) => p.requestItemId === it.id
                      ),
                    ];
                    return (
                      <div
                        key={it.id}
                        className="rounded-[22px] border border-black/12 bg-white p-4 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-black/10">
                          <div>
                            <h3 className="text-base font-semibold text-black">
                              {it.item.name}
                            </h3>
                            <p className="font-mono text-xs text-black/55 tabular-nums">
                              {it.item.code} · Approved Qty:{" "}
                              {it.approvedQuantity || it.requestedQuantity}
                              {isIssued && it.borrowingRecords?.[0]?.issuedAt
                                ? ` · Issued ${formatDateTime(
                                    it.borrowingRecords[0].issuedAt
                                  )}`
                                : ""}
                            </p>
                          </div>
                          {isIssued && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AAC2AA]/40 border border-black/10 px-3 py-1 text-xs font-semibold text-black">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Handover Confirmed
                            </span>
                          )}
                        </div>

                        <PhotoUploaderGrid
                          phase="COLLECTION"
                          existingPhotos={photos}
                          disabled={isIssued}
                          onUpload={(angle, file) =>
                            handleUploadCollectionPhoto(
                              req.id,
                              it.id,
                              angle,
                              file
                            )
                          }
                        />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
