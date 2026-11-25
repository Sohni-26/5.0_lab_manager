"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  Package,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AllocationStatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_ALLOCATIONS,
  DEMO_CAMPUSES,
  DEMO_MASTER_ITEMS,
} from "@/lib/demo-data";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type {
  CampusDTO,
  MasterItemDTO,
  StockAllocationDTO,
} from "@/types/contracts";

interface AllocationLine {
  itemId: string;
  allocatedQuantity: number;
}

export default function CentralAllocationsPage() {
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [masterItems, setMasterItems] = useState<MasterItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // 3-step Allocation Builder state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [destinationCampusId, setDestinationCampusId] = useState("");
  const [source, setSource] = useState("Central Warehouse");
  const [notes, setNotes] = useState("");
  const [dispatchImmediately, setDispatchImmediately] = useState(true);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  const [pickItemId, setPickItemId] = useState("");
  const [pickQty, setPickQty] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [selectedAllocation, setSelectedAllocation] =
    useState<StockAllocationDTO | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [allocRes, campRes, itemRes] = await Promise.all([
        apiClient.allocations.list({ pageSize: 50 }),
        apiClient.campuses.list({ pageSize: 50 }),
        apiClient.items.list({ pageSize: 100, isActive: true }),
      ]);
      setAllocations(allocRes.data);
      setCampuses(campRes.data);
      setMasterItems(itemRes.data);
    } catch {
      setAllocations(DEMO_ALLOCATIONS);
      setCampuses(DEMO_CAMPUSES);
      setMasterItems(DEMO_MASTER_ITEMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const itemMap = useMemo(
    () => new Map(masterItems.map((i) => [i.id, i])),
    [masterItems]
  );

  const campusMap = useMemo(
    () => new Map(campuses.map((c) => [c.id, c])),
    [campuses]
  );

  const filteredHistory = useMemo(() => {
    if (statusFilter === "ALL") return allocations;
    return allocations.filter((a) => a.status === statusFilter);
  }, [allocations, statusFilter]);

  const addLine = () => {
    if (!pickItemId || pickQty < 1) {
      toast.error("Select an item and enter quantity >= 1");
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === pickItemId);
      if (existing) {
        return prev.map((l) =>
          l.itemId === pickItemId
            ? { ...l, allocatedQuantity: l.allocatedQuantity + pickQty }
            : l
        );
      }
      return [...prev, { itemId: pickItemId, allocatedQuantity: pickQty }];
    });
    setPickItemId("");
    setPickQty(5);
  };

  const removeLine = (itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const handleDispatch = async () => {
    if (!destinationCampusId || lines.length === 0) {
      toast.error("Select a campus and at least one item");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.allocations.create({
        destinationCampusId,
        source: source.trim() || "Central Warehouse",
        notes: notes.trim() || undefined,
        dispatchImmediately,
        items: lines,
      });
      setAllocations((prev) => [res.data, ...prev]);
      toast.success(
        `Allocation ${res.data.referenceCode} ${
          dispatchImmediately ? "dispatched" : "saved as draft"
        }`
      );
      setStep(1);
      setDestinationCampusId("");
      setLines([]);
      setNotes("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create allocation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDispatched = async (alloc: StockAllocationDTO) => {
    try {
      const res = await apiClient.allocations.updateStatus(alloc.id, {
        status: "DISPATCHED",
      });
      setAllocations((prev) =>
        prev.map((a) => (a.id === alloc.id ? res.data : a))
      );
      toast.success(`${alloc.referenceCode} dispatched to ${alloc.destinationCampus.code}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dispatch");
    }
  };

  const selectedCampus = campusMap.get(destinationCampusId);
  const totalUnitsDraft = lines.reduce((s, l) => s + l.allocatedQuantity, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Allocations & Dispatch"
        description="Dispatch multi-item equipment batches from Central Warehouse to any of the 40 campuses and track verification discrepancies."
      />

      <Tabs defaultValue="builder" className="w-full">
        <TabsList>
          <TabsTrigger value="builder">
            <Send className="h-3.5 w-3.5" />
            New Allocation Builder
          </TabsTrigger>
          <TabsTrigger value="history">
            <Package className="h-3.5 w-3.5" />
            Allocation History ({allocations.length})
          </TabsTrigger>
        </TabsList>

        {/* Step-based Allocation Builder */}
        <TabsContent value="builder">
          <Card className="rounded-[22px] border-black/12 bg-white">
            <CardHeader className="border-b border-black/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Dispatch New Stock Batch</CardTitle>
                  <CardDescription>
                    Allocated stock becomes available at the campus ONLY after the Lab Manager
                    verifies physical receipt.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {[
                    { num: 1, label: "Select Campus" },
                    { num: 2, label: "Add Items" },
                    { num: 3, label: "Review & Dispatch" },
                  ].map((s) => (
                    <div
                      key={s.num}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold tabular-nums ${
                        step === s.num
                          ? "border-black/12 bg-[#C4F041] text-black"
                          : step > s.num
                            ? "border-black/10 bg-[#AAC2AA]/50 text-black"
                            : "border-black/10 bg-[#F5F5F3] text-black/55"
                      }`}
                    >
                      <span>{s.num}.</span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {step === 1 && (
                <div className="max-w-xl space-y-4">
                  <div className="space-y-2">
                    <Label>Destination Campus (40 Campuses)</Label>
                    <Select
                      value={destinationCampusId}
                      onValueChange={setDestinationCampusId}
                    >
                      <SelectTrigger className="border-black/15 bg-white text-black focus:border-black focus:ring-black/15">
                        <SelectValue placeholder="Choose destination campus..." />
                      </SelectTrigger>
                      <SelectContent>
                        {campuses
                          .filter((c) => c.status === "ACTIVE")
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} · {c.name} ({c.city})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alloc-source">Dispatch Source</Label>
                    <Input
                      id="alloc-source"
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Central Warehouse Bengaluru"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alloc-notes">Shipment Notes (optional)</Label>
                    <Textarea
                      id="alloc-notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Courier details, semester refresh batch reference..."
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => setStep(2)}
                      disabled={!destinationCampusId}
                    >
                      Continue to Items
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-4">
                    <div className="flex-1 min-w-[240px] space-y-1.5">
                      <Label>Master Equipment Item</Label>
                      <Select value={pickItemId} onValueChange={setPickItemId}>
                        <SelectTrigger className="border-black/15 bg-white text-black focus:border-black focus:ring-black/15">
                          <SelectValue placeholder="Select equipment from master catalog..." />
                        </SelectTrigger>
                        <SelectContent>
                          {masterItems.map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.code} · {it.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32 space-y-1.5">
                      <Label htmlFor="pick-qty">Quantity</Label>
                      <Input
                        id="pick-qty"
                        type="number"
                        min={1}
                        value={pickQty}
                        onChange={(e) =>
                          setPickQty(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="tabular-nums"
                      />
                    </div>
                    <Button type="button" onClick={addLine}>
                      <Plus className="h-4 w-4" />
                      Add Line
                    </Button>
                  </div>

                  {lines.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/15 bg-[#F5F5F3]/60 p-8 text-center text-sm text-black/55">
                      Add one or more master items above to build this allocation manifest.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-black/12 bg-white">
                      <table className="w-full text-sm sheet-table">
                        <thead>
                          <tr className="text-left">
                            <th className="px-4 py-2.5">Code</th>
                            <th className="px-4 py-2.5">Equipment</th>
                            <th className="px-4 py-2.5 text-right">Quantity</th>
                            <th className="px-4 py-2.5 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => {
                            const item = itemMap.get(line.itemId);
                            return (
                              <tr key={line.itemId} className="hover:bg-[#F5F5F3] transition-colors">
                                <td className="px-4 py-2.5 font-mono text-xs font-semibold text-black/75">
                                  {item?.code}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-black">
                                  {item?.name}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <Input
                                    type="number"
                                    min={1}
                                    value={line.allocatedQuantity}
                                    onChange={(e) => {
                                      const val = Math.max(
                                        1,
                                        Number(e.target.value) || 1
                                      );
                                      setLines((prev) =>
                                        prev.map((l) =>
                                          l.itemId === line.itemId
                                            ? { ...l, allocatedQuantity: val }
                                            : l
                                        )
                                      );
                                    }}
                                    className="w-24 ml-auto h-8 text-right tabular-nums"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-[#B33C17] hover:bg-[#FA8E66]/25 hover:text-black"
                                    onClick={() => removeLine(line.itemId)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      disabled={lines.length === 0}
                    >
                      Review Dispatch ({lines.length} SKUs)
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-4">
                    <div>
                      <p className="text-xs text-black/55">Destination Campus</p>
                      <p className="mt-1 font-semibold text-black flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-black/70" />
                        {selectedCampus?.code} · {selectedCampus?.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-black/55">Origin Source</p>
                      <p className="mt-1 font-semibold text-black">{source}</p>
                    </div>
                    <div>
                      <p className="text-xs text-black/55">Manifest Total</p>
                      <p className="mt-1 inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/45 px-2.5 py-0.5 text-xs font-semibold text-black tabular-nums">
                        {lines.length} SKUs · {formatNumber(totalUnitsDraft)} total units
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/12 bg-white divide-y divide-black/10">
                    {lines.map((line) => {
                      const item = itemMap.get(line.itemId);
                      return (
                        <div
                          key={line.itemId}
                          className="flex items-center justify-between px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium text-black">{item?.name}</p>
                            <p className="font-mono text-xs text-black/55">
                              {item?.code}
                            </p>
                          </div>
                          <Badge variant="accent" className="tabular-nums">
                            {line.allocatedQuantity} {item?.unit ?? "units"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <label className="flex items-center gap-2 text-sm text-black cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dispatchImmediately}
                        onChange={(e) => setDispatchImmediately(e.target.checked)}
                        className="h-4 w-4 rounded border-black/25 accent-black"
                      />
                      <span>Dispatch immediately to campus Incoming Stock queue</span>
                    </label>
                    <div className="flex items-center gap-2.5">
                      <Button variant="outline" onClick={() => setStep(2)}>
                        <ArrowLeft className="h-4 w-4" />
                        Edit Items
                      </Button>
                      <Button onClick={handleDispatch} disabled={submitting}>
                        <Send className="h-4 w-4" />
                        {submitting
                          ? "Dispatching..."
                          : dispatchImmediately
                            ? "Confirm & Dispatch Stock"
                            : "Save Allocation Draft"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allocation History */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52 rounded-full border-black/15 bg-white text-black focus:border-black focus:ring-black/15">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="PARTIALLY_RECEIVED">Partially Received</SelectItem>
                <SelectItem value="DISCREPANCY_REPORTED">Discrepancy Reported</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden rounded-[22px] border-black/12 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm sheet-table">
                <thead>
                  <tr className="text-left">
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3 text-right">SKUs</th>
                    <th className="px-4 py-3 text-right">Allocated</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-black/55">
                        Loading allocations...
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((alloc) => {
                      const totalAlloc = alloc.items.reduce(
                        (s, i) => s + i.allocatedQuantity,
                        0
                      );
                      const totalRecv = alloc.items.reduce(
                        (s, i) => s + i.receivedQuantity,
                        0
                      );
                      const hasDiscrepancy = alloc.items.some(
                        (i) => i.missingQuantity > 0 || i.damagedQuantity > 0
                      );
                      return (
                        <tr key={alloc.id} className="hover:bg-[#F5F5F3] transition-colors">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-black">
                            {alloc.referenceCode}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-2 py-0.5 font-mono text-[11px] font-semibold text-black mr-2">
                              {alloc.destinationCampus.code}
                            </span>
                            <span className="text-black">{alloc.destinationCampus.name}</span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-black/75">
                            {alloc.items.length}
                          </td>
                          <td className="px-4 py-3 text-right font-medium tabular-nums text-black">
                            {formatNumber(totalAlloc)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={
                                hasDiscrepancy
                                  ? "inline-flex items-center rounded-full border border-black/10 bg-[#FA8E66]/45 px-2.5 py-0.5 text-xs font-semibold text-black tabular-nums"
                                  : "inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/45 px-2.5 py-0.5 text-xs font-semibold text-black tabular-nums"
                              }
                            >
                              {formatNumber(totalRecv)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <AllocationStatusBadge status={alloc.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-black/55 tabular-nums">
                            {formatDateTime(alloc.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            {alloc.status === "DRAFT" && (
                              <Button
                                size="sm"
                                onClick={() => handleMarkDispatched(alloc)}
                              >
                                Dispatch
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAllocation(alloc)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Allocation Detail Dialog */}
      <Dialog
        open={Boolean(selectedAllocation)}
        onOpenChange={(o) => !o && setSelectedAllocation(null)}
      >
        <DialogContent className="max-w-2xl rounded-[22px] border-black/12 bg-white text-black">
          {selectedAllocation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono">{selectedAllocation.referenceCode}</span>
                  <AllocationStatusBadge status={selectedAllocation.status} />
                </DialogTitle>
                <DialogDescription>
                  {selectedAllocation.source} → {selectedAllocation.destinationCampus.code} (
                  {selectedAllocation.destinationCampus.name})
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-hidden rounded-2xl border border-black/12 bg-white">
                <table className="w-full text-xs sheet-table">
                  <thead>
                    <tr className="text-left">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Expected</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Missing</th>
                      <th className="px-3 py-2 text-right">Damaged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAllocation.items.map((it) => (
                      <tr key={it.id} className="hover:bg-[#F5F5F3] transition-colors">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-black">{it.item.name}</p>
                          {it.verificationNotes && (
                            <p className="text-[11px] text-[#B33C17] mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              {it.verificationNotes}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-black">
                          {it.allocatedQuantity}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#3E6B48] tabular-nums">
                          {it.receivedQuantity}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={
                              it.missingQuantity > 0
                                ? "inline-flex items-center rounded-full border border-black/10 bg-[#FA8E66]/45 px-2 py-0.5 font-semibold text-black tabular-nums"
                                : "text-black/45 tabular-nums"
                            }
                          >
                            {it.missingQuantity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span
                            className={
                              it.damagedQuantity > 0
                                ? "inline-flex items-center rounded-full border border-black/10 bg-[#F3BD77]/55 px-2 py-0.5 font-semibold text-black tabular-nums"
                                : "text-black/45 tabular-nums"
                            }
                          >
                            {it.damagedQuantity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedAllocation.verifiedBy && (
                <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-[#AAC2AA]/40 px-3.5 py-2.5 text-xs text-black">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Verified by <strong>{selectedAllocation.verifiedBy.fullName}</strong> on{" "}
                    {formatDateTime(selectedAllocation.verifiedAt)}
                  </span>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
