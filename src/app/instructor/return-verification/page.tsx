"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  PackageX,
  RotateCcw,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { PhotoComparisonGrid } from "@/components/shared/photo-comparison-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type {
  LabRequestDTO,
  LabRequestItemDTO,
  ReturnCondition,
} from "@/types/contracts";

interface VerifyFormState {
  condition: ReturnCondition;
  returnedQuantity: number;
  damagedQuantity: number;
  missingQuantity: number;
  instructorRemarks: string;
}

export default function InstructorReturnVerificationPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, VerifyFormState>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      const pending = res.data.filter(
        (r) =>
          r.status === "RETURN_VERIFICATION_PENDING" ||
          r.status === "RETURN_SUBMITTED" ||
          r.status === "RETURN_DISPUTED" ||
          r.status === "PARTIALLY_RETURNED"
      );
      setRequests(pending);
      initForms(pending);
    } catch {
      const demo = DEMO_REQUESTS.filter(
        (r) => r.status === "RETURN_VERIFICATION_PENDING"
      );
      setRequests(demo);
      initForms(demo);
    } finally {
      setLoading(false);
    }
  }, []);

  const initForms = (list: LabRequestDTO[]) => {
    const next: Record<string, VerifyFormState> = {};
    list.forEach((req) => {
      req.items.forEach((it) => {
        const remaining = Math.max(
          0,
          it.issuedQuantity - it.returnedQuantity - it.damagedQuantity - it.missingQuantity
        );
        next[it.id] = {
          condition: "GOOD",
          returnedQuantity: remaining || it.issuedQuantity || 1,
          damagedQuantity: 0,
          missingQuantity: 0,
          instructorRemarks: "",
        };
      });
    });
    setForms(next);
  };

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: ["return.submitted", "return.verified", "request.status_changed"],
    onEvent: () => load(),
  });

  const updateItemForm = (itemId: string, patch: Partial<VerifyFormState>) => {
    setForms((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  };

  const setConditionPreset = (item: LabRequestItemDTO, condition: ReturnCondition) => {
    const outstanding = Math.max(
      1,
      item.issuedQuantity - item.returnedQuantity - item.damagedQuantity - item.missingQuantity
    );
    if (condition === "GOOD") {
      updateItemForm(item.id, {
        condition: "GOOD",
        returnedQuantity: outstanding,
        damagedQuantity: 0,
        missingQuantity: 0,
      });
    } else if (condition === "DAMAGED") {
      updateItemForm(item.id, {
        condition: "DAMAGED",
        returnedQuantity: 0,
        damagedQuantity: outstanding,
        missingQuantity: 0,
      });
    } else if (condition === "MISSING") {
      updateItemForm(item.id, {
        condition: "MISSING",
        returnedQuantity: 0,
        damagedQuantity: 0,
        missingQuantity: outstanding,
      });
    }
  };

  const handleVerifyRequest = async (req: LabRequestDTO) => {
    const payloadItems = req.items.map((it) => {
      const f = forms[it.id];
      const latestBorrow = it.borrowingRecords?.[0];
      const latestRv = latestBorrow?.returnVerifications?.[0];
      return {
        borrowingRecordId: latestBorrow?.id,
        requestItemId: it.id,
        returnVerificationId: latestRv?.id,
        condition: f.condition,
        returnedQuantity: f.returnedQuantity,
        damagedQuantity: f.damagedQuantity,
        missingQuantity: f.missingQuantity,
        instructorRemarks: f.instructorRemarks.trim() || undefined,
      };
    });

    for (const row of payloadItems) {
      if (
        (row.condition === "DAMAGED" || row.condition === "MISSING") &&
        (!row.instructorRemarks || row.instructorRemarks.length < 3)
      ) {
        toast.error("Please enter inspection remarks when reporting damage or missing items.");
        return;
      }
    }

    setSubmittingId(req.id);
    try {
      await apiClient.requests.verifyReturn(req.id, { items: payloadItems });
      toast.success(
        `Return inspection saved for ${req.requestCode}. Inventory counts updated atomically.`
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Return Verification & 4-Angle Photo Audit"
        description="Compare original Collection photos side-by-side with student Return photos before restoring equipment to available stock or logging damage/missing disputes."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-[#72736E]">
          Loading pending return inspections...
        </Card>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No returns awaiting physical inspection"
          description="When students upload all 4 return photos and submit their borrowed items, they appear here for side-by-side visual verification."
        />
      ) : (
        <div className="space-y-6">
          {requests.map((req) => (
            <Card key={req.id} className="overflow-hidden">
              <CardHeader className="bg-[#FAF9F6] border-b border-[#EFECE6]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="font-mono text-base">
                        {req.requestCode}
                      </CardTitle>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <CardDescription className="mt-1">
                      Student: <strong>{req.student.fullName}</strong> (
                      {req.student.institutionalId}) · Updated{" "}
                      {formatDateTime(req.updatedAt)}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => handleVerifyRequest(req)}
                    disabled={submittingId === req.id}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submittingId === req.id
                      ? "Finalizing..."
                      : "Submit Return Verification"}
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-5 space-y-6">
                {req.items.map((it) => {
                  const f = forms[it.id];
                  const latestRv =
                    it.borrowingRecords?.[0]?.returnVerifications?.[0];
                  const itemPhotos = [
                    ...(it.photos ?? []),
                    ...(req.photos ?? []).filter((p) => p.requestItemId === it.id),
                  ];

                  return (
                    <div
                      key={it.id}
                      className="rounded-2xl border border-[#E6E5E0] bg-white p-4 sm:p-5 space-y-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFECE6]">
                        <div>
                          <h3 className="text-base font-semibold text-[#222321]">
                            {it.item.name}
                          </h3>
                          <p className="font-mono text-xs text-[#72736E]">
                            {it.item.code} · Issued: {it.issuedQuantity}{" "}
                            {it.item.unit}
                          </p>
                        </div>
                        {latestRv?.studentComments && (
                          <Badge variant="outline" className="max-w-md truncate">
                            Student note: &ldquo;{latestRv.studentComments}&rdquo;
                          </Badge>
                        )}
                      </div>

                      {/* Side-by-side 4-Angle Photo Comparison */}
                      <PhotoComparisonGrid
                        photos={itemPhotos}
                        itemName={it.item.name}
                      />

                      {/* Condition Decision Controls */}
                      {f && (
                        <div className="rounded-2xl border border-[#E6E5E0] bg-[#FAF9F6] p-4 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[#72736E] mr-2">
                              Inspection Outcome:
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                f.condition === "GOOD" ? "success" : "outline"
                              }
                              onClick={() => setConditionPreset(it, "GOOD")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Verify Return (Good)
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                f.condition === "DAMAGED" ? "danger" : "outline"
                              }
                              onClick={() => setConditionPreset(it, "DAMAGED")}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Report Damage
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                f.condition === "MISSING" ? "danger" : "outline"
                              }
                              onClick={() => setConditionPreset(it, "MISSING")}
                            >
                              <PackageX className="h-3.5 w-3.5" />
                              Report Missing Items
                            </Button>
                          </div>

                          <div className="grid sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label>Good Returned Qty</Label>
                              <Input
                                type="number"
                                min={0}
                                max={it.issuedQuantity}
                                value={f.returnedQuantity}
                                onChange={(e) =>
                                  updateItemForm(it.id, {
                                    returnedQuantity: Math.max(
                                      0,
                                      Number(e.target.value) || 0
                                    ),
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Damaged Qty</Label>
                              <Input
                                type="number"
                                min={0}
                                max={it.issuedQuantity}
                                value={f.damagedQuantity}
                                onChange={(e) =>
                                  updateItemForm(it.id, {
                                    damagedQuantity: Math.max(
                                      0,
                                      Number(e.target.value) || 0
                                    ),
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Missing Qty</Label>
                              <Input
                                type="number"
                                min={0}
                                max={it.issuedQuantity}
                                value={f.missingQuantity}
                                onChange={(e) =>
                                  updateItemForm(it.id, {
                                    missingQuantity: Math.max(
                                      0,
                                      Number(e.target.value) || 0
                                    ),
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label>
                              Instructor Verification Remarks{" "}
                              {(f.condition === "DAMAGED" ||
                                f.condition === "MISSING") &&
                                "(Required)"}
                            </Label>
                            <Textarea
                              value={f.instructorRemarks}
                              onChange={(e) =>
                                updateItemForm(it.id, {
                                  instructorRemarks: e.target.value,
                                })
                              }
                              placeholder="Document physical inspection findings, accessories checked, or damage details..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
