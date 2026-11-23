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
        .list({ pageSize: 100 })
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
            <CardHeader>
              <CardTitle>1. Select Equipment &amp; Quantities</CardTitle>
              <CardDescription>
                Live campus availability is checked before submission.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#E6E5E0] bg-[#FAF9F6] p-4">
                <div className="flex-1 min-w-[220px] space-y-1.5">
                  <Label>Verified Campus Item</Label>
                  <Select value={pickItemId} onValueChange={setPickItemId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose equipment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory
                        .filter((i) => i.availableQuantity > 0)
                        .map((i) => (
                          <SelectItem key={i.itemId} value={i.itemId}>
                            {i.item.code} · {i.item.name} ({i.availableQuantity}{" "}
                            avail)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1.5">
                  <Label htmlFor="req-qty">Quantity</Label>
                  <Input
                    id="req-qty"
                    type="number"
                    min={1}
                    max={invMap.get(pickItemId)?.availableQuantity ?? 20}
                    value={pickQty}
                    onChange={(e) =>
                      setPickQty(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
                <Button type="button" onClick={handleAddItem}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>

              {selectedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#DAD8D0] p-6 text-center text-sm text-[#72736E]">
                  No items added yet. Pick equipment from the selector above.
                </div>
              ) : (
                <div className="divide-y divide-[#EFECE6] rounded-2xl border border-[#E6E5E0]">
                  {selectedItems.map((line) => {
                    const inv = invMap.get(line.itemId);
                    const maxAvail = inv?.availableQuantity ?? 1;
                    return (
                      <div
                        key={line.itemId}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#222321]">
                            {inv?.item.name}
                          </p>
                          <p className="text-xs text-[#72736E]">
                            <span className="font-mono">{inv?.item.code}</span> ·{" "}
                            <span className="text-[#288568] font-medium">
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
                            className="w-20 h-8 text-right"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-[#D9534F]"
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
            <CardHeader>
              <CardTitle>2. Supervising Instructor &amp; Purpose</CardTitle>
              <CardDescription>
                Only instructors assigned to your campus are listed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Select Campus Instructor</Label>
                <Select value={instructorId} onValueChange={setInstructorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose your instructor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instructors.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.fullName} ({inst.institutionalId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-purpose">Lab Course / Project Purpose</Label>
                <Textarea
                  id="req-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Describe your experiment, lab course code, or capstone project..."
                  required
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <Card className="lg:col-span-4 sticky top-24">
          <CardHeader>
            <CardTitle>Request Summary</CardTitle>
            <CardDescription>Approval workflow preview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-[#FAF9F6] border border-[#EFECE6] p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#72736E]">Selected SKUs</span>
                <strong className="text-[#222321]">{selectedItems.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#72736E]">Total Units</span>
                <strong className="text-[#222321]">
                  {selectedItems.reduce((s, l) => s + l.requestedQuantity, 0)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#72736E]">Next Stage</span>
                <Badge variant="warning">Instructor Review</Badge>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#72736E]">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#288568] shrink-0 mt-0.5" />
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
        <div className="p-8 text-center text-sm text-[#72736E]">
          Loading request builder...
        </div>
      }
    >
      <NewRequestBuilderInner />
    </Suspense>
  );
}
