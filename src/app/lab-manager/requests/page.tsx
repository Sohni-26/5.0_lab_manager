"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
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
import { DEMO_CAMPUS_INVENTORY, DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { CampusInventoryDTO, LabRequestDTO } from "@/types/contracts";

export default function LabManagerRequestsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<LabRequestDTO | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    try {
      const [reqRes, invRes] = await Promise.all([
        apiClient.requests.list({ pageSize: 60 }),
        apiClient.inventory.list({ pageSize: 100 }),
      ]);
      setRequests(reqRes.data);
      setInventory(invRes.data);
    } catch {
      setRequests(DEMO_REQUESTS);
      setInventory(DEMO_CAMPUS_INVENTORY);
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
    eventTypes: ["request.created", "request.status_changed", "inventory.updated"],
    onEvent: () => load(),
  });

  const stockByItemId = useMemo(
    () => new Map(inventory.map((i) => [i.itemId, i])),
    [inventory]
  );

  const pendingQueue = requests.filter(
    (r) => r.status === "PENDING_LAB_MANAGER"
  );
  const otherRequests = requests.filter(
    (r) => r.status !== "PENDING_LAB_MANAGER"
  );

  const handleApprove = async (req: LabRequestDTO) => {
    setProcessingId(req.id);
    try {
      const res = await apiClient.requests.labManagerApproval(req.id, {
        decision: "APPROVED",
        comments: "Approved and stock reserved by Lab Manager.",
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === req.id ? res.data : r))
      );
      toast.success(
        `${req.requestCode} approved — stock reserved atomically.`
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error("Please enter a mandatory rejection reason");
      return;
    }
    setProcessingId(rejectTarget.id);
    try {
      const res = await apiClient.requests.labManagerApproval(rejectTarget.id, {
        decision: "REJECTED",
        comments: rejectReason.trim(),
      });
      setRequests((prev) =>
        prev.map((r) => (r.id === rejectTarget.id ? res.data : r))
      );
      toast.success(`${rejectTarget.requestCode} rejected`);
      setRejectTarget(null);
      setRejectReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Borrowing Approvals"
        description="Review Instructor-approved borrowing requests, inspect live stock availability, and atomically reserve campus equipment."
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Final Approval ({pendingQueue.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All Campus Requests ({requests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card className="p-8 text-center text-sm text-[#72736E]">
              Loading request queue...
            </Card>
          ) : pendingQueue.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="No requests awaiting final approval"
              description="Instructor-approved student requests appear here for live stock verification and reservation."
            />
          ) : (
            pendingQueue.map((req) => {
              const allInStock = req.items.every((it) => {
                const inv = stockByItemId.get(it.itemId);
                return (inv?.availableQuantity ?? 0) >= it.requestedQuantity;
              });

              return (
                <Card key={req.id}>
                  <CardHeader className="border-b border-[#EFECE6]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="font-mono text-base">
                            {req.requestCode}
                          </CardTitle>
                          <RequestStatusBadge status={req.status} />
                          {!allInStock && (
                            <Badge variant="danger">
                              <AlertCircle className="h-3 w-3" />
                              Insufficient stock
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="mt-1">
                          Student: <strong>{req.student.fullName}</strong> (
                          {req.student.institutionalId}) · Endorsed by{" "}
                          <strong>{req.instructor.fullName}</strong> ·{" "}
                          {formatDateTime(req.createdAt)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingId === req.id}
                          onClick={() => {
                            setRejectTarget(req);
                            setRejectReason("");
                          }}
                        >
                          <XCircle className="h-4 w-4 text-[#D9534F]" />
                          Reject
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={processingId === req.id || !allInStock}
                          onClick={() => handleApprove(req)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {processingId === req.id
                            ? "Reserving..."
                            : "Approve & Reserve Stock"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    <div className="rounded-xl bg-[#FAF9F6] border border-[#EFECE6] p-3 text-sm">
                      <span className="text-xs font-semibold uppercase text-[#72736E] block mb-0.5">
                        Academic Purpose
                      </span>
                      {req.purpose}
                    </div>

                    <div className="overflow-hidden rounded-xl border border-[#E6E5E0]">
                      <table className="w-full text-xs sheet-table">
                        <thead>
                          <tr className="text-left">
                            <th className="px-3.5 py-2.5">Requested Item</th>
                            <th className="px-3.5 py-2.5 text-right">Requested Qty</th>
                            <th className="px-3.5 py-2.5 text-right">Live Available</th>
                            <th className="px-3.5 py-2.5 text-right">Stock Check</th>
                          </tr>
                        </thead>
                        <tbody>
                          {req.items.map((it) => {
                            const inv = stockByItemId.get(it.itemId);
                            const avail = inv?.availableQuantity ?? 0;
                            const ok = avail >= it.requestedQuantity;
                            return (
                              <tr key={it.id}>
                                <td className="px-3.5 py-2.5 font-medium text-[#222321]">
                                  {it.item.name}{" "}
                                  <span className="font-mono text-[#72736E] ml-1">
                                    ({it.item.code})
                                  </span>
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-semibold">
                                  {it.requestedQuantity}
                                </td>
                                <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-[#288568]">
                                  {avail}
                                </td>
                                <td className="px-3.5 py-2.5 text-right">
                                  <Badge variant={ok ? "success" : "danger"}>
                                    {ok ? "Ready to Reserve" : "Shortage"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {otherRequests.concat(pendingQueue).map((req) => (
            <Card key={req.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {req.requestCode}
                    </span>
                    <RequestStatusBadge status={req.status} />
                  </div>
                  <p className="text-xs text-[#72736E] mt-1">
                    {req.student.fullName} · Instructor: {req.instructor.fullName} ·{" "}
                    {req.purpose}
                  </p>
                </div>
                <span className="text-xs text-[#72736E]">
                  {formatDateTime(req.updatedAt)}
                </span>
              </div>
              <RequestTimeline status={req.status} />
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Reject Reason Modal */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request {rejectTarget?.requestCode}</DialogTitle>
            <DialogDescription>
              Provide a clear reason for the student and instructor.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lm-reject-reason">Mandatory Rejection Reason</Label>
              <Textarea
                id="lm-reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Reserved for upcoming accreditation lab audit this week."
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={Boolean(processingId)}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
