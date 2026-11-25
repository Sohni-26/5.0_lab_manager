"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  PackageCheck,
  XCircle,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { RequestTimeline } from "@/components/shared/request-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import {
  REQUIRED_PHOTO_ANGLES,
  type LabRequestDTO,
  type LabRequestItemDTO,
} from "@/types/contracts";

function countCollectionPhotos(item: LabRequestItemDTO): number {
  const angles = new Set(
    (item.photos ?? [])
      .filter((p) => p.phase === "COLLECTION")
      .map((p) => p.angle)
  );
  return REQUIRED_PHOTO_ANGLES.filter((a) => angles.has(a)).length;
}

export default function InstructorRequestsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsByReq, setCommentsByReq] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LabRequestDTO | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    eventTypes: ["request.created", "request.status_changed", "borrowing.issued"],
    onEvent: () => load(),
  });

  const pendingReview = requests.filter((r) => r.status === "PENDING_INSTRUCTOR");
  const readyForCollection = requests.filter(
    (r) => r.status === "APPROVED" || r.status === "PARTIALLY_ISSUED"
  );

  const handleDecision = async (
    req: LabRequestDTO,
    decision: "APPROVED" | "REJECTED",
    comments?: string
  ) => {
    setBusyId(req.id);
    try {
      const res = await apiClient.requests.instructorApproval(req.id, {
        decision,
        comments: comments?.trim() || undefined,
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? res.data : r))
      );
      toast.success(
        decision === "APPROVED"
          ? `${req.requestCode} approved & forwarded to Campus Lab Manager`
          : `${req.requestCode} rejected`
      );
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmCollection = async (req: LabRequestDTO) => {
    const missingPhotos = req.items.some((it) => countCollectionPhotos(it) < 4);
    if (missingPhotos) {
      toast.error(
        "All 4 mandatory collection angle photos (Front/Top, Back/Bottom, Left, Right) must be uploaded for every item before handover."
      );
      return;
    }
    setBusyId(req.id);
    try {
      const res = await apiClient.requests.confirmCollection(req.id);
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? res.data : r))
      );
      toast.success(
        `${req.requestCode} issued — stock moved from Reserved to Borrowed`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Handover failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assigned Student Requests & Handover"
        description="Approve or reject first-stage student borrowing requests and confirm physical equipment collection after verifying 4-angle photos."
      />

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review" className="tabular-nums">
            Pending Review ({pendingReview.length})
          </TabsTrigger>
          <TabsTrigger value="collection" className="tabular-nums">
            Confirm Collection ({readyForCollection.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="tabular-nums">
            All Assigned ({requests.length})
          </TabsTrigger>
        </TabsList>

        {/* Stage 1: Instructor Review */}
        <TabsContent value="review" className="space-y-4">
          {loading ? (
            <Card className="p-8 text-center text-sm text-black/55">
              Loading requests...
            </Card>
          ) : pendingReview.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No pending student requests"
              description="New borrowing requests assigned to you will appear here for first-stage academic approval."
            />
          ) : (
            pendingReview.map((req) => (
              <Card key={req.id}>
                <CardHeader className="border-b border-black/10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-mono text-base text-black">
                          {req.requestCode}
                        </CardTitle>
                        <RequestStatusBadge status={req.status} />
                      </div>
                      <CardDescription className="mt-1 text-black/55">
                        Student:{" "}
                        <strong className="font-semibold text-black">
                          {req.student.fullName}
                        </strong>{" "}
                        (
                        <span className="tabular-nums">
                          {req.student.institutionalId}
                        </span>
                        ) · Submitted{" "}
                        <span className="tabular-nums">
                          {formatDateTime(req.createdAt)}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => {
                          setRejectTarget(req);
                          setRejectReason("");
                        }}
                      >
                        <XCircle className="h-4 w-4 text-[#FA8E66]" />
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() =>
                          handleDecision(req, "APPROVED", commentsByReq[req.id])
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {busyId === req.id
                          ? "Forwarding..."
                          : "Approve → Lab Manager"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div className="rounded-2xl bg-[#F5F5F3] border border-black/10 p-3.5 text-sm text-black">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-black/55 block mb-1">
                      Purpose / Lab Coursework
                    </span>
                    {req.purpose}
                  </div>

                  <div className="space-y-2">
                    {req.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between rounded-2xl border border-black/10 bg-[#F5F5F3] px-3.5 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-black">
                            {it.item.name}
                          </p>
                          <p className="font-mono text-xs text-black/55">
                            {it.item.code}
                          </p>
                        </div>
                        <Badge variant="accent" className="tabular-nums">
                          Qty: {it.requestedQuantity} {it.item.unit}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-black/55">
                      Instructor Comments (optional)
                    </Label>
                    <Textarea
                      value={commentsByReq[req.id] ?? ""}
                      onChange={(e) =>
                        setCommentsByReq((prev) => ({
                          ...prev,
                          [req.id]: e.target.value,
                        }))
                      }
                      placeholder="Add endorsement notes for the Campus Lab Manager..."
                      className="min-h-[64px] rounded-2xl border-black/15 bg-white text-black placeholder:text-black/40 focus-visible:border-black focus-visible:ring-[#C4F041]/50"
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Stage 3: Confirm Item Collection (after 4 photos per item) */}
        <TabsContent value="collection" className="space-y-4">
          {readyForCollection.length === 0 ? (
            <EmptyState
              icon={PackageCheck}
              title="No approved requests awaiting handover"
              description="Once the Campus Lab Manager approves & reserves stock, students upload 4 collection photos and come to you for physical handover."
            />
          ) : (
            readyForCollection.map((req) => {
              const allPhotosReady = req.items.every(
                (it) => countCollectionPhotos(it) === 4
              );
              return (
                <Card key={req.id}>
                  <CardHeader className="border-b border-black/10">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="font-mono text-base text-black">
                            {req.requestCode}
                          </CardTitle>
                          <RequestStatusBadge status={req.status} />
                          <Badge variant={allPhotosReady ? "success" : "warning"}>
                            <Camera className="h-3 w-3" />
                            {allPhotosReady
                              ? "All 4-angle photos ready"
                              : "Waiting on student photos"}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1 text-black/55">
                          Student:{" "}
                          <strong className="font-semibold text-black">
                            {req.student.fullName}
                          </strong>{" "}
                          · Stock reserved by Lab Manager
                        </CardDescription>
                      </div>
                      <Button
                        disabled={!allPhotosReady || busyId === req.id}
                        onClick={() => handleConfirmCollection(req)}
                      >
                        <PackageCheck className="h-4 w-4" />
                        {busyId === req.id
                          ? "Issuing..."
                          : "Confirm Item Collection"}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    {req.items.map((it) => {
                      const count = countCollectionPhotos(it);
                      return (
                        <div
                          key={it.id}
                          className="rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-black">
                                {it.item.name}
                              </p>
                              <p className="font-mono text-xs text-black/55 tabular-nums">
                                {it.item.code} · Approved Qty: {it.approvedQuantity || it.requestedQuantity}
                              </p>
                            </div>
                            <Badge
                              variant={count === 4 ? "success" : "warning"}
                              className="tabular-nums"
                            >
                              {count}/4 Collection Photos
                            </Badge>
                          </div>
                          {it.photos && it.photos.length > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                              {it.photos
                                .filter((p) => p.phase === "COLLECTION")
                                .map((p) => (
                                  <div
                                    key={p.id}
                                    className="overflow-hidden rounded-xl border border-black/10 bg-white"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={p.url}
                                      alt={p.angle}
                                      className="aspect-[4/3] w-full object-cover"
                                    />
                                    <p className="px-1.5 py-1 text-[10px] text-center font-medium text-black/55 truncate">
                                      {p.angle.replace("_", " ")}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {requests.map((req) => (
            <Card key={req.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-black">
                      {req.requestCode}
                    </span>
                    <RequestStatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-black/55 mt-1">
                    <span className="font-medium text-black">
                      {req.student.fullName}
                    </span>{" "}
                    · {req.purpose}
                  </p>
                </div>
                <span className="text-xs text-black/55 tabular-nums">
                  {formatDateTime(req.updatedAt)}
                </span>
              </div>
              <RequestTimeline status={req.status} />
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent className="rounded-[22px] border-black/12 bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-black">
              Reject {rejectTarget?.requestCode}
            </DialogTitle>
            <DialogDescription className="text-black/55">
              Explain why this request is rejected so the student can revise and resubmit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="inst-rej" className="text-black/55">
              Rejection Comments
            </Label>
            <Textarea
              id="inst-rej"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Please reduce requested quantity to 1 unit per lab team."
              className="rounded-2xl border-black/15 bg-white text-black placeholder:text-black/40 focus-visible:border-black focus-visible:ring-[#C4F041]/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={Boolean(busyId) || rejectReason.trim().length < 3}
              onClick={() =>
                rejectTarget &&
                handleDecision(rejectTarget, "REJECTED", rejectReason)
              }
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
