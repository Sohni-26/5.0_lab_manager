"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  PackageCheck,
  X,
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
import { Badge } from "@/components/ui/badge";
import { AllocationStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient } from "@/lib/api-client";
import { DEMO_ALLOCATIONS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { StockAllocationDTO } from "@/types/contracts";

interface RowVerifyState {
  allocationItemId: string;
  itemId: string;
  expected: number;
  receivedQuantity: number;
  missingQuantity: number;
  damagedQuantity: number;
  verificationNotes: string;
  decision: "UNSET" | "MATCHED" | "DISCREPANCY";
}

export default function LabManagerIncomingStockPage() {
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsState, setRowsState] = useState<Record<string, RowVerifyState>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const initVerificationState = (list: StockAllocationDTO[]) => {
    const next: Record<string, RowVerifyState> = {};
    list.forEach((alloc) => {
      alloc.items.forEach((it) => {
        // NEVER auto-mark as received — starts explicitly UNSET with 0 received until Lab Manager verifies!
        next[it.id] = {
          allocationItemId: it.id,
          itemId: it.itemId,
          expected: it.allocatedQuantity,
          receivedQuantity: it.isVerified ? it.receivedQuantity : 0,
          missingQuantity: it.isVerified ? it.missingQuantity : 0,
          damagedQuantity: it.isVerified ? it.damagedQuantity : 0,
          verificationNotes: it.verificationNotes ?? "",
          decision: it.isVerified
            ? it.missingQuantity > 0 || it.damagedQuantity > 0
              ? "DISCREPANCY"
              : "MATCHED"
            : "UNSET",
        };
      });
    });
    setRowsState(next);
  };

  const load = useCallback(async () => {
    try {
      const res = await apiClient.allocations.list({ pageSize: 50 });
      setAllocations(res.data);
      initVerificationState(res.data);
    } catch {
      const demoCampusAllocs = DEMO_ALLOCATIONS.filter(
        (a) => a.destinationCampusId === "demo-campus-01"
      );
      setAllocations(demoCampusAllocs);
      initVerificationState(demoCampusAllocs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (id: string, patch: Partial<RowVerifyState>) => {
    setRowsState((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const markExactMatch = (id: string, expected: number) => {
    updateRow(id, {
      receivedQuantity: expected,
      missingQuantity: 0,
      damagedQuantity: 0,
      decision: "MATCHED",
    });
  };

  const markDiscrepancy = (id: string, expected: number) => {
    const current = rowsState[id];
    const recv = current && current.receivedQuantity < expected ? current.receivedQuantity : Math.max(0, expected - 1);
    updateRow(id, {
      receivedQuantity: recv,
      missingQuantity: Math.max(0, expected - recv),
      damagedQuantity: 0,
      decision: "DISCREPANCY",
    });
  };

  const handleSubmitVerification = async (alloc: StockAllocationDTO) => {
    const itemsPayload = alloc.items.map((it) => rowsState[it.id]);

    for (const row of itemsPayload) {
      if (!row || row.decision === "UNSET") {
        toast.error(
          "Please verify every row explicitly using ✓ (Received Exact) or ✗ (Report Discrepancy) before submitting."
        );
        return;
      }
      const total =
        row.receivedQuantity + row.missingQuantity + row.damagedQuantity;
      if (total > row.expected) {
        toast.error(
          `Received + Missing + Damaged (${total}) cannot exceed expected quantity (${row.expected}).`
        );
        return;
      }
      if (
        (row.missingQuantity > 0 || row.damagedQuantity > 0) &&
        row.verificationNotes.trim().length < 3
      ) {
        toast.error("Please add remarks explaining missing or damaged units.");
        return;
      }
    }

    setSubmittingId(alloc.id);
    try {
      const res = await apiClient.allocations.verify(alloc.id, {
        items: itemsPayload.map((r) => ({
          allocationItemId: r.allocationItemId,
          itemId: r.itemId,
          receivedQuantity: r.receivedQuantity,
          missingQuantity: r.missingQuantity,
          damagedQuantity: r.damagedQuantity,
          verificationNotes: r.verificationNotes.trim() || undefined,
        })),
      });
      setAllocations((prev) =>
        prev.map((a) => (a.id === alloc.id ? res.data : a))
      );
      toast.success(
        `Verification submitted for ${alloc.referenceCode}. Campus inventory updated atomically.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit verification"
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const pendingAllocations = allocations.filter(
    (a) => a.status === "DISPATCHED" || a.status === "PARTIALLY_RECEIVED"
  );
  const completedAllocations = allocations.filter(
    (a) => a.status === "RECEIVED" || a.status === "DISCREPANCY_REPORTED"
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming Stock Verification Sheet"
        description="Inspect every dispatched batch row-by-row. Click ✓ to confirm exact receipt or ✗ to record missing/damaged discrepancies. Items enter available stock only upon submission."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-[#72736E]">
          Loading incoming shipments...
        </Card>
      ) : pendingAllocations.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="All incoming shipments verified"
          description="When the Central Lab Manager dispatches new equipment batches to your campus, they will appear here for row-by-row inspection."
        />
      ) : (
        <div className="space-y-6">
          {pendingAllocations.map((alloc) => {
            const verifiedRowsCount = alloc.items.filter(
              (it) => rowsState[it.id]?.decision !== "UNSET"
            ).length;
            return (
              <Card key={alloc.id} className="overflow-hidden">
                <CardHeader className="bg-[#FAF9F6] border-b border-[#EFECE6]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <CardTitle className="font-mono text-base">
                          {alloc.referenceCode}
                        </CardTitle>
                        <AllocationStatusBadge status={alloc.status} />
                        <Badge variant="outline">
                          {verifiedRowsCount}/{alloc.items.length} rows checked
                        </Badge>
                      </div>
                      <CardDescription className="mt-1">
                        From {alloc.source} · Dispatched{" "}
                        {formatDateTime(alloc.dispatchedAt ?? alloc.createdAt)}
                        {alloc.notes ? ` · ${alloc.notes}` : ""}
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => handleSubmitVerification(alloc)}
                      disabled={submittingId === alloc.id}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {submittingId === alloc.id
                        ? "Submitting..."
                        : "Submit Verification"}
                    </Button>
                  </div>
                </CardHeader>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm sheet-table">
                    <thead>
                      <tr className="text-left">
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3">Code</th>
                        <th className="px-4 py-3 text-right">Expected</th>
                        <th className="px-4 py-3 text-center">Verify (✓ / ✗)</th>
                        <th className="px-4 py-3 text-right">Actual Received</th>
                        <th className="px-4 py-3 text-right">Missing</th>
                        <th className="px-4 py-3 text-right">Damaged</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alloc.items.map((it) => {
                        const r = rowsState[it.id];
                        if (!r) return null;
                        const hasDiscrepancy =
                          r.missingQuantity > 0 ||
                          r.damagedQuantity > 0 ||
                          r.decision === "DISCREPANCY";

                        return (
                          <tr
                            key={it.id}
                            className={
                              hasDiscrepancy
                                ? "bg-[#FDEDEC]/55"
                                : r.decision === "MATCHED"
                                  ? "bg-[#EAF6F1]/45"
                                  : "bg-white"
                            }
                          >
                            <td className="px-4 py-3 font-medium text-[#222321] min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <span>{it.item.name}</span>
                                {hasDiscrepancy && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-[#D9534F] shrink-0" />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[#72736E]">
                              {it.item.code}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-[#222321]">
                              {it.allocatedQuantity}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  title="Received exact expected quantity"
                                  onClick={() =>
                                    markExactMatch(it.id, it.allocatedQuantity)
                                  }
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                                    r.decision === "MATCHED"
                                      ? "border-[#288568] bg-[#288568] text-white shadow-xs"
                                      : "border-[#E6E5E0] bg-white text-[#288568] hover:bg-[#EAF6F1]"
                                  }`}
                                >
                                  <Check className="h-4 w-4 stroke-[2.5]" />
                                </button>
                                <button
                                  type="button"
                                  title="Report shortage or damage"
                                  onClick={() =>
                                    markDiscrepancy(it.id, it.allocatedQuantity)
                                  }
                                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                                    r.decision === "DISCREPANCY"
                                      ? "border-[#D9534F] bg-[#D9534F] text-white shadow-xs"
                                      : "border-[#E6E5E0] bg-white text-[#D9534F] hover:bg-[#FDEDEC]"
                                  }`}
                                >
                                  <X className="h-4 w-4 stroke-[2.5]" />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={it.allocatedQuantity}
                                value={r.receivedQuantity}
                                onChange={(e) => {
                                  const val = Math.max(
                                    0,
                                    Math.min(
                                      it.allocatedQuantity,
                                      Number(e.target.value) || 0
                                    )
                                  );
                                  updateRow(it.id, {
                                    receivedQuantity: val,
                                    decision:
                                      val === it.allocatedQuantity &&
                                      r.missingQuantity === 0 &&
                                      r.damagedQuantity === 0
                                        ? "MATCHED"
                                        : "DISCREPANCY",
                                  });
                                }}
                                className="w-20 ml-auto h-8 text-right font-mono"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={it.allocatedQuantity}
                                value={r.missingQuantity}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  updateRow(it.id, {
                                    missingQuantity: val,
                                    decision: val > 0 ? "DISCREPANCY" : r.decision,
                                  });
                                }}
                                className="w-20 ml-auto h-8 text-right font-mono"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Input
                                type="number"
                                min={0}
                                max={it.allocatedQuantity}
                                value={r.damagedQuantity}
                                onChange={(e) => {
                                  const val = Math.max(0, Number(e.target.value) || 0);
                                  updateRow(it.id, {
                                    damagedQuantity: val,
                                    decision: val > 0 ? "DISCREPANCY" : r.decision,
                                  });
                                }}
                                className="w-20 ml-auto h-8 text-right font-mono"
                              />
                            </td>
                            <td className="px-4 py-3 min-w-[200px]">
                              <Input
                                value={r.verificationNotes}
                                onChange={(e) =>
                                  updateRow(it.id, {
                                    verificationNotes: e.target.value,
                                  })
                                }
                                placeholder={
                                  hasDiscrepancy
                                    ? "Required: describe shortage/damage..."
                                    : "Optional seal / condition note"
                                }
                                className="h-8 text-xs"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recently Verified Shipments */}
      {completedAllocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recently Verified Receipts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {completedAllocations.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-3.5 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[#222321] mr-2">
                    {a.referenceCode}
                  </span>
                  <span className="text-[#72736E]">
                    Verified {formatDateTime(a.verifiedAt)} · {a.items.length} SKU(s)
                  </span>
                </div>
                <AllocationStatusBadge status={a.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
