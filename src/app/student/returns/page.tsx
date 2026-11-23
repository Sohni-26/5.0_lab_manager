"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { PhotoUploaderGrid } from "@/components/shared/photo-uploader-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import {
  REQUIRED_PHOTO_ANGLES,
  type LabRequestDTO,
  type LabRequestItemDTO,
  type PhotoAngle,
} from "@/types/contracts";

function countReturnPhotos(req: LabRequestDTO, it: LabRequestItemDTO): number {
  const all = [
    ...(it.photos ?? []),
    ...(req.photos ?? []).filter((p) => p.requestItemId === it.id),
  ];
  const angles = new Set(
    all.filter((p) => p.phase === "RETURN").map((p) => p.angle)
  );
  return REQUIRED_PHOTO_ANGLES.filter((a) => angles.has(a)).length;
}

export default function StudentReturnsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      const list = res.data.filter(
        (r) =>
          r.status === "ISSUED" ||
          r.status === "PARTIALLY_ISSUED" ||
          r.status === "RETURN_PENDING" ||
          r.status === "PARTIALLY_RETURNED" ||
          r.status === "RETURN_VERIFICATION_PENDING"
      );
      setRequests(list);
      const qInit: Record<string, number> = {};
      list.forEach((r) =>
        r.items.forEach((it) => {
          qInit[it.id] = Math.max(1, it.issuedQuantity - it.returnedQuantity);
        })
      );
      setQtyByItem((prev) => ({ ...qInit, ...prev }));
    } catch {
      const demo = DEMO_REQUESTS.filter(
        (r) =>
          r.status === "ISSUED" || r.status === "RETURN_VERIFICATION_PENDING"
      );
      setRequests(demo);
      const qInit: Record<string, number> = {};
      demo.forEach((r) =>
        r.items.forEach((it) => {
          qInit[it.id] = Math.max(1, it.issuedQuantity - it.returnedQuantity);
        })
      );
      setQtyByItem((prev) => ({ ...qInit, ...prev }));
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
    eventTypes: ["return.verified", "request.status_changed"],
    onEvent: () => load(),
  });

  const handleUploadReturnPhoto = async (
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
      await apiClient.requests.uploadReturnPhoto(requestId, fd);
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
                  (p) => !(p.phase === "RETURN" && p.angle === angle)
                );
                return {
                  ...it,
                  photos: [
                    ...others,
                    {
                      id: `local-ret-${Date.now()}`,
                      requestId,
                      requestItemId,
                      borrowingRecordId: it.borrowingRecords?.[0]?.id ?? null,
                      uploadedById: "demo",
                      angle,
                      phase: "RETURN",
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

  const handleSubmitReturn = async (req: LabRequestDTO) => {
    const missingAny = req.items.some((it) => countReturnPhotos(req, it) < 4);
    if (missingAny) {
      toast.error(
        "Upload all 4 mandatory return angle photos (Front/Top, Back/Bottom, Left, Right) before submitting return."
      );
      return;
    }

    setSubmittingId(req.id);
    try {
      await apiClient.requests.submitReturn(req.id, {
        items: req.items.map((it) => ({
          requestItemId: it.id,
          borrowingRecordId: it.borrowingRecords?.[0]?.id,
          returnedQuantity: qtyByItem[it.id] ?? it.issuedQuantity,
          studentComments: notesByItem[it.id]?.trim() || undefined,
        })),
      });
      toast.success(
        `Return submitted for ${req.requestCode}. Awaiting physical inspection by your Instructor.`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit return");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment Return Submission"
        description="Capture 4 return condition photos for every borrowed item and submit for physical Instructor inspection. Borrowing closes only after verification."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-[#72736E]">
          Loading open borrowings...
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No active items to return"
          description="Issued lab items currently in your possession will appear here when ready to return."
        />
      ) : (
        <div className="space-y-6">
          {requests.map((req) => {
            const awaitingCheck = req.status === "RETURN_VERIFICATION_PENDING";
            const allPhotosUploaded = req.items.every(
              (it) => countReturnPhotos(req, it) === 4
            );

            return (
              <Card key={req.id}>
                <CardHeader className="bg-[#FAF9F6] border-b border-[#EFECE6]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="font-mono text-base">
                          {req.requestCode}
                        </CardTitle>
                        <RequestStatusBadge status={req.status} />
                      </div>
                      <CardDescription className="mt-1">
                        Verifying Instructor:{" "}
                        <strong>{req.instructor.fullName}</strong>
                      </CardDescription>
                    </div>

                    {!awaitingCheck && (
                      <Button
                        disabled={!allPhotosUploaded || submittingId === req.id}
                        onClick={() => handleSubmitReturn(req)}
                      >
                        <Send className="h-4 w-4" />
                        {submittingId === req.id
                          ? "Submitting..."
                          : "Submit Return for Verification"}
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
                    const remaining = Math.max(
                      1,
                      it.issuedQuantity - it.returnedQuantity
                    );

                    return (
                      <div
                        key={it.id}
                        className="rounded-2xl border border-[#E6E5E0] bg-white p-4 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFECE6]">
                          <div>
                            <h3 className="text-base font-semibold text-[#222321]">
                              {it.item.name}
                            </h3>
                            <p className="font-mono text-xs text-[#72736E]">
                              {it.item.code} · Issued Qty: {it.issuedQuantity}
                            </p>
                          </div>
                        </div>

                        <PhotoUploaderGrid
                          phase="RETURN"
                          existingPhotos={photos}
                          disabled={awaitingCheck}
                          onUpload={(angle, file) =>
                            handleUploadReturnPhoto(req.id, it.id, angle, file)
                          }
                        />

                        {!awaitingCheck && (
                          <div className="grid sm:grid-cols-3 gap-3 pt-2">
                            <div className="space-y-1.5">
                              <Label>Return Quantity</Label>
                              <Input
                                type="number"
                                min={1}
                                max={remaining}
                                value={qtyByItem[it.id] ?? remaining}
                                onChange={(e) =>
                                  setQtyByItem((prev) => ({
                                    ...prev,
                                    [it.id]: Math.max(
                                      1,
                                      Math.min(
                                        remaining,
                                        Number(e.target.value) || 1
                                      )
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                              <Label>Student Return Notes (optional)</Label>
                              <Textarea
                                value={notesByItem[it.id] ?? ""}
                                onChange={(e) =>
                                  setNotesByItem((prev) => ({
                                    ...prev,
                                    [it.id]: e.target.value,
                                  }))
                                }
                                placeholder="Note any accessories returned, calibration status, or wear..."
                                className="min-h-[42px]"
                              />
                            </div>
                          </div>
                        )}
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
