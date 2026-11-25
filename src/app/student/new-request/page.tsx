"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plus, Send, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_USERS } from "@/lib/demo-data";
import type { AuthUserDTO, CampusInventoryDTO } from "@/types/contracts";

function NewRequestBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectItemId = searchParams.get("itemId");

  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [instructors, setInstructors] = useState<AuthUserDTO[]>([]);
  const [selectedItems, setSelectedItems] = useState<
    Array<{ itemId: string; requestedQuantity: number }>
  >([]);
  const [pickItemId, setPickItemId] = useState("");
  const [pickQty, setPickQty] = useState(1);
  const [instructorId, setInstructorId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.inventory
        .list({ pageSize: 250 })
        .then((r) => r.data.filter((i) => i.isVerified && i.isVisible))
        .catch(() =>
          DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible)
        ),
      apiClient.users
        .list({ role: "INSTRUCTOR", pageSize: 50 })
        .then((r) => r.data)
        .catch(() => DEMO_USERS.filter((u) => u.role === "INSTRUCTOR")),
    ]).then(([inv, inst]) => {
      setInventory(inv);
      setInstructors(inst);
      if (inst.length > 0) setInstructorId(inst[0].id);
      if (preselectItemId && inv.some((i) => i.itemId === preselectItemId)) {
        setSelectedItems([{ itemId: preselectItemId, requestedQuantity: 1 }]);
      }
    });
  }, [preselectItemId]);

  const invMap = useMemo(
    () => new Map(inventory.map((i) => [i.itemId, i])),
    [inventory]
  );

  const handleAddItem = () => {
    if (!pickItemId) {
      toast.error("Choose an equipment item first");
      return;
    }
    const stock = invMap.get(pickItemId);
    if (!stock || stock.availableQuantity < pickQty) {
      toast.error("Requested quantity exceeds live campus availability");
      return;
    }
    setSelectedItems((prev) => {
      const exists = prev.find((l) => l.itemId === pickItemId);
      if (exists) {
        const merged = Math.min(
          stock.availableQuantity,
          exists.requestedQuantity + pickQty
        );
        return prev.map((l) =>
          l.itemId === pickItemId ? { ...l, requestedQuantity: merged } : l
        );
      }
      return [...prev, { itemId: pickItemId, requestedQuantity: pickQty }];
    });
    setPickItemId("");
    setPickQty(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      toast.error("Add at least one item to your request");
      return;
    }
    if (!instructorId) {
      toast.error("Select a campus Instructor to review your request");
      return;
    }
    if (purpose.trim().length < 5) {
      toast.error("Please describe your academic or lab project purpose");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.requests.create({
        instructorId,
        purpose: purpose.trim(),
        items: selectedItems,
      });
      toast.success(
        `Request ${res.data.requestCode} submitted to your Instructor!`
      );
      router.push("/student/requests");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Multi-Item Borrowing Request"
        description="Select one or more verified campus items, choose your supervising Instructor, and submit for two-stage approval."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* Item Picker */}
          <Card>
            <CardHeader className="border-b border-black/10">
              <CardTitle>1. Select Equipment &amp; Quantities</CardTitle>
              <CardDescription>
                Live campus availability is checked before submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-black/10 bg-[#F5F5F3] p-4">
                <div className="flex-1 min-w-[220px] space-y-1.5">
                  <Label className="text-black/55">Verified Campus Item</Label>
                  <Select value={pickItemId} onValueChange={setPickItemId}>
                    <SelectTrigger className="border-black/15 bg-white text-black focus:border-black focus:ring-[#C4F041]/50">
                      <SelectValue placeholder="Choose equipment..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-black/12 bg-white text-black">
                      {inventory
                        .filter((i) => i.availableQuantity > 0)
                        .map((i) => (
                          <SelectItem
                            key={i.itemId}
                            value={i.itemId}
                            className="focus:bg-[#F5F5F3] focus:text-black"
                          >
                            {i.item.code} · {i.item.name} ({i.availableQuantity}{" "}
                            avail)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1.5">
                  <Label htmlFor="req-qty" className="text-black/55">
                    Quantity
                  </Label>
                  <Input
                    id="req-qty"
                    type="number"
                    min={1}
                    max={invMap.get(pickItemId)?.availableQuantity ?? 20}
                    value={pickQty}
                    onChange={(e) =>
                      setPickQty(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="tabular-nums"
                  />
                </div>
                <Button type="button" onClick={handleAddItem}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {selectedItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/15 bg-[#F5F5F3]/60 p-6 text-center text-sm text-black/55">
                  No items added yet. Pick equipment from the selector above.
                </div>
              ) : (
                <div className="divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/12 bg-white">
                  {selectedItems.map((line) => {
                    const inv = invMap.get(line.itemId);
                    const maxAvail = inv?.availableQuantity ?? 1;
                    return (
                      <div
                        key={line.itemId}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5 transition-colors hover:bg-[#F5F5F3]/60"
                      >
                        <div>
                          <p className="text-sm font-semibold text-black">
                            {inv?.item.name}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55">
                            <span className="font-mono text-black/65">
                              {inv?.item.code}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-black/10 bg-[#AAC2AA]/45 px-2.5 py-0.5 text-[11px] font-semibold text-black tabular-nums">
                              {maxAvail} available now
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={maxAvail}
                            value={line.requestedQuantity}
                            onChange={(e) => {
                              const v = Math.max(
                                1,
                                Math.min(maxAvail, Number(e.target.value) || 1)
                              );
                              setSelectedItems((prev) =>
                                prev.map((l) =>
                                  l.itemId === line.itemId
                                    ? { ...l, requestedQuantity: v }
                                    : l
                                )
                              );
                            }}
                            className="w-20 h-8 text-right tabular-nums"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-black/60 hover:bg-[#FA8E66]/35 hover:text-black"
                            onClick={() =>
                              setSelectedItems((prev) =>
                                prev.filter((l) => l.itemId !== line.itemId)
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructor & Purpose */}
          <Card>
            <CardHeader className="border-b border-black/10">
              <CardTitle>2. Supervising Instructor &amp; Purpose</CardTitle>
              <CardDescription>
                Only instructors assigned to your campus are listed.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-black/55">Select Campus Instructor</Label>
                <Select value={instructorId} onValueChange={setInstructorId}>
                  <SelectTrigger className="border-black/15 bg-white text-black focus:border-black focus:ring-[#C4F041]/50">
                    <SelectValue placeholder="Choose your instructor..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-black/12 bg-white text-black">
                    {instructors.map((inst) => (
                      <SelectItem
                        key={inst.id}
                        value={inst.id}
                        className="focus:bg-[#F5F5F3] focus:text-black"
                      >
                        {inst.fullName} ({inst.institutionalId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-purpose" className="text-black/55">
                  Lab Course / Project Purpose
                </Label>
                <Textarea
                  id="req-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Describe your experiment, lab course code, or capstone project..."
                  className="rounded-2xl border-black/15 bg-white text-black placeholder:text-black/40 focus-visible:border-black focus-visible:ring-[#C4F041]/50"
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <Card className="lg:col-span-4 sticky top-24">
          <CardHeader className="border-b border-black/10">
            <CardTitle>Request Summary</CardTitle>
            <CardDescription>Approval workflow preview</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="rounded-2xl bg-[#F5F5F3] border border-black/10 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-black/55">Selected SKUs</span>
                <strong className="font-semibold text-black tabular-nums">
                  {selectedItems.length}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-black/55">Total Units</span>
                <strong className="font-semibold text-black tabular-nums">
                  {selectedItems.reduce((s, l) => s + l.requestedQuantity, 0)}
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-black/10">
                <span className="text-black/55">Next Stage</span>
                <Badge variant="warning">Instructor Review</Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-black/10 bg-[#AAC2AA]/25 p-3.5 text-xs text-black/75">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-black shrink-0 mt-0.5" />
                <span>
                  After Instructor &amp; Lab Manager approval, upload 4 collection
                  angle photos to collect your items.
                </span>
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || selectedItems.length === 0}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Submitting..." : "Submit Borrowing Request"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

export default function StudentNewRequestPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-black/55">
          Loading request builder...
        </div>
      }
    >
      <NewRequestBuilderInner />
    </Suspense>
  );
}
