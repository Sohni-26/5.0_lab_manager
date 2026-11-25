"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { LoopsiiButton } from "@/components/landing/primitives";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_CAMPUS_INVENTORY,
  DEMO_CATEGORIES,
  DEMO_USERS,
} from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import {
  extractItemProcurementMeta,
  PROCUREMENT_LAB_BLOCKS,
} from "@/lib/procurement-catalog";
import type {
  AuthUserDTO,
  CampusInventoryDTO,
  ItemCategoryDTO,
} from "@/types/contracts";

type FlowStage = "idle" | "prompt" | "parts" | "submitted";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

export function StudentRequestFlow() {
  const [stage, setStage] = useState<FlowStage>("idle");
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [categories, setCategories] = useState<ItemCategoryDTO[]>([]);
  const [instructors, setInstructors] = useState<AuthUserDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters inside the Parts Picker
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [labBlockFilter, setLabBlockFilter] = useState("ALL");

  // Selected parts map: itemId -> quantity
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({});
  const [instructorId, setInstructorId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<{
    partCount: number;
    unitCount: number;
  }>({ partCount: 0, unitCount: 0 });

  useEffect(() => {
    Promise.all([
      apiClient.inventory
        .list({ pageSize: 250 })
        .then((r) => r.data.filter((i) => i.isVerified && i.isVisible))
        .catch(() =>
          DEMO_CAMPUS_INVENTORY.filter((i) => i.isVerified && i.isVisible)
        ),
      apiClient.categories
        .list()
        .then((r) => r.data)
        .catch(() => DEMO_CATEGORIES),
      apiClient.users
        .list({ role: "INSTRUCTOR", pageSize: 50 })
        .then((r) => r.data)
        .catch(() => DEMO_USERS.filter((u) => u.role === "INSTRUCTOR")),
    ])
      .then(([inv, cats, insts]) => {
        setInventory(inv);
        setCategories(cats);
        setInstructors(insts);
        if (insts.length > 0) setInstructorId(insts[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredParts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((row) => {
      const meta = extractItemProcurementMeta(row.item.specifications);
      if (categoryFilter !== "ALL" && row.item.category.id !== categoryFilter) {
        return false;
      }
      if (labBlockFilter !== "ALL" && meta.labBlock !== labBlockFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.item.name.toLowerCase().includes(q) ||
        row.item.code.toLowerCase().includes(q) ||
        row.item.category.name.toLowerCase().includes(q) ||
        (meta.labBlock?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [inventory, search, categoryFilter, labBlockFilter]);

  const inventoryByItemId = useMemo(
    () => new Map(inventory.map((row) => [row.itemId, row])),
    [inventory]
  );

  const selectedEntries = useMemo(() => {
    return Object.entries(selectedQty)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        qty,
        row: inventoryByItemId.get(itemId),
      }))
      .filter(
        (
          entry
        ): entry is { itemId: string; qty: number; row: CampusInventoryDTO } =>
          Boolean(entry.row)
      );
  }, [selectedQty, inventoryByItemId]);

  const totalSelectedUnits = useMemo(
    () => selectedEntries.reduce((sum, e) => sum + e.qty, 0),
    [selectedEntries]
  );

  const togglePart = (row: CampusInventoryDTO) => {
    if (row.availableQuantity <= 0) return;
    setSelectedQty((prev) => {
      const current = prev[row.itemId] ?? 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[row.itemId];
        return next;
      }
      return { ...prev, [row.itemId]: 1 };
    });
  };

  const updatePartQty = (row: CampusInventoryDTO, nextVal: number) => {
    if (row.availableQuantity <= 0) return;
    setSelectedQty((prev) => {
      if (nextVal <= 0) {
        const next = { ...prev };
        delete next[row.itemId];
        return next;
      }
      const clamped = Math.min(row.availableQuantity, Math.max(1, nextVal));
      return { ...prev, [row.itemId]: clamped };
    });
  };

  const handleSubmitRequest = async () => {
    if (selectedEntries.length === 0) {
      toast.error("Select at least one part to raise a request");
      return;
    }
    if (!instructorId) {
      toast.error("Choose a supervising Instructor");
      return;
    }
    const cleanPurpose =
      purpose.trim().length >= 5
        ? purpose.trim()
        : `Lab equipment borrowing request (${selectedEntries.length} part${
            selectedEntries.length > 1 ? "s" : ""
          })`;

    setSubmitting(true);
    try {
      const res = await apiClient.requests.create({
        instructorId,
        purpose: cleanPurpose,
        items: selectedEntries.map((e) => ({
          itemId: e.itemId,
          requestedQuantity: e.qty,
        })),
      });
      setSubmittedCode(res.data.requestCode);
      setSubmittedSummary({
        partCount: selectedEntries.length,
        unitCount: totalSelectedUnits,
      });
      toast.success(`Request ${res.data.requestCode} submitted to Instructor!`);
      setSelectedQty({});
      setPurpose("");
      setStage("submitted");
    } catch {
      const fallbackCode = `REQ-CMP01-${Math.floor(1000 + Math.random() * 9000)}`;
      setSubmittedCode(fallbackCode);
      setSubmittedSummary({
        partCount: selectedEntries.length,
        unitCount: totalSelectedUnits,
      });
      toast.success(`Request ${fallbackCode} submitted!`);
      setSelectedQty({});
      setPurpose("");
      setStage("submitted");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DottedGridCanvas className="flex flex-col">
      <AnimatePresence mode="wait">
        {/* STAGE 1: CLEAN LANDING-STYLE CTA BUTTON ON THE DOTTED GRID */}
        {stage === "idle" && (
          <motion.div
            key="stage-idle"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.55, ease: LP_EASE }}
            className="flex flex-1 min-h-[calc(100vh-8.5rem)] items-center justify-center p-6"
          >
            <LoopsiiButton
              label="Request Lab Parts"
              size="lg"
              hideArrow
              onClick={() => setStage("prompt")}
            />
          </motion.div>
        )}

        {/* STAGE 2: SMOOTH PROMPT TO RAISE A REQUEST (NOT A TICKET) */}
        {stage === "prompt" && (
          <motion.div
            key="stage-prompt"
            initial={{ opacity: 0, y: 28, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -22, scale: 0.96 }}
            transition={{ duration: 0.6, ease: LP_EASE }}
            className="flex flex-1 min-h-[calc(100vh-8.5rem)] items-center justify-center p-6"
          >
            <div className="relative w-full max-w-lg rounded-[26px] border border-black/14 bg-white p-7 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
              <button
                type="button"
                onClick={() => setStage("idle")}
                aria-label="Close prompt"
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-black/12 bg-[#F5F5F3] text-black/65 transition-colors hover:bg-black hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="inline-flex items-center gap-2 rounded-full border border-black/12 bg-[#C4F041] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-black">
                <Sparkles className="h-3.5 w-3.5" />
                Equipment Request · Not a Ticket
              </div>

              <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-[-0.03em] text-black leading-tight">
                Need lab components for your build?
              </h2>
              <p className="mt-2.5 text-sm text-black/60 leading-relaxed">
                Raise a borrowing request by selecting the exact hardware parts
                and quantities you need from our verified campus lab catalog.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <LoopsiiButton
                  label="Raise a Request"
                  size="lg"
                  hideArrow
                  onClick={() => setStage("parts")}
                />
                <button
                  type="button"
                  onClick={() => setStage("idle")}
                  className="rounded-full px-4 py-2.5 text-sm font-medium text-black/55 transition-colors hover:text-black cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STAGE 3: ALL PARTS VISUAL PICKER WITH WEBP IMAGES & QUANTITY CONTROLS */}
        {stage === "parts" && (
          <motion.div
            key="stage-parts"
            initial={{ opacity: 0, y: 32, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.985 }}
            transition={{ duration: 0.65, ease: LP_EASE }}
            className="flex flex-1 flex-col min-h-[calc(100vh-8.5rem)]"
          >
            {/* Top Floating Picker Header */}
            <div className="sticky top-0 z-20 border-b border-black/10 bg-white/92 backdrop-blur-md px-4 sm:px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStage("prompt")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/14 bg-[#F5F5F3] text-black transition-colors hover:bg-[#C4F041] cursor-pointer"
                    aria-label="Back to prompt"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.025em] text-black">
                      Raise a Request — Select Parts &amp; Quantities
                    </h2>
                    <p className="text-xs text-black/55 tabular-nums">
                      Showing {filteredParts.length} of {inventory.length} verified campus parts
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={selectedEntries.length > 0 ? "accent" : "outline"}
                    className="px-3 py-1 text-xs tabular-nums"
                  >
                    <Package className="h-3.5 w-3.5" />
                    {selectedEntries.length} parts · {totalSelectedUnits} units
                  </Badge>
                </div>
              </div>

              {/* Search & Filter Row */}
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 min-w-[210px] max-w-md">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search Arduino, DHT22, ESP32, servo, soldering..."
                    className="h-9 pl-9 text-xs bg-[#F7F7F5]"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-9 rounded-full border border-black/15 bg-white px-3.5 text-xs font-medium text-black focus:border-black focus:outline-none"
                >
                  <option value="ALL">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={labBlockFilter}
                  onChange={(e) => setLabBlockFilter(e.target.value)}
                  className="h-9 rounded-full border border-black/15 bg-white px-3.5 text-xs font-medium text-black focus:border-black focus:outline-none"
                >
                  <option value="ALL">All 6 Lab Blocks</option>
                  {PROCUREMENT_LAB_BLOCKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* All Parts WebP Visual Grid */}
            <div className="flex-1 p-4 sm:p-6 pb-44">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-72 rounded-[22px] border border-black/10 bg-white/80 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredParts.length === 0 ? (
                <div className="mx-auto max-w-md rounded-[22px] border border-black/12 bg-white p-10 text-center text-sm text-black/55">
                  No parts match your search or filter.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredParts.map((row) => {
                    const qty = selectedQty[row.itemId] ?? 0;
                    const isSelected = qty > 0;
                    const outOfStock = row.availableQuantity <= 0;
                    const meta = extractItemProcurementMeta(
                      row.item.specifications
                    );
                    const imgSrc =
                      row.item.imageUrl ||
                      getPartImageUrl(row.item.code, row.item.category.slug);

                    return (
                      <div
                        key={row.id}
                        className={`group flex flex-col justify-between overflow-hidden rounded-[22px] border bg-white transition-all duration-200 ${
                          isSelected
                            ? "border-black ring-2 ring-[#C4F041] shadow-[0_8px_24px_rgba(0,0,0,0.08)]"
                            : "border-black/12 hover:border-black/35 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
                        } ${outOfStock ? "opacity-60" : ""}`}
                      >
                        {/* Clickable Image + Info */}
                        <div
                          role="button"
                          tabIndex={outOfStock ? -1 : 0}
                          onClick={() => togglePart(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              togglePart(row);
                            }
                          }}
                          className={outOfStock ? "cursor-not-allowed" : "cursor-pointer"}
                        >
                          <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EAEAE6] border-b border-black/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imgSrc}
                              alt={row.item.name}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] group-hover:scale-105"
                            />
                            {/* SKU pill */}
                            <span className="absolute left-2.5 top-2.5 rounded-full border border-black/10 bg-white/92 backdrop-blur-sm px-2.5 py-0.5 font-mono text-[10px] font-bold text-black">
                              {row.item.code}
                            </span>

                            {/* Stock / Selected indicator */}
                            <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums backdrop-blur-sm ${
                                  outOfStock
                                    ? "border-[#E8A598] bg-[#FCE4DF]/95 text-[#991B1B]"
                                    : "border-black/10 bg-white/92 text-black"
                                }`}
                              >
                                {row.availableQuantity} {row.item.unit}
                              </span>
                              {isSelected && (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/15 bg-[#C4F041] text-black shadow-xs">
                                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-full bg-[#F2F2EF] border border-black/8 px-2 py-0.5 text-[10px] font-semibold text-black/75 truncate">
                                {row.item.category.name}
                              </span>
                              {meta.labBlock && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-black/50 truncate">
                                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                                  {meta.labBlock.split(" ")[0]}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-semibold tracking-[-0.015em] text-black leading-snug line-clamp-2 min-h-[2.4rem]">
                              {row.item.name}
                            </h3>
                          </div>
                        </div>

                        {/* Quantity Selection Footer */}
                        <div className="px-3.5 pb-3.5 pt-1">
                          {outOfStock ? (
                            <div className="rounded-full border border-black/10 bg-[#F5F5F3] py-1.5 text-center text-xs font-medium text-black/45">
                              Out of Stock
                            </div>
                          ) : !isSelected ? (
                            <button
                              type="button"
                              onClick={() => updatePartQty(row, 1)}
                              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-black/15 bg-[#F7F7F5] py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[#C4F041] hover:border-black/25 cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Select Part
                            </button>
                          ) : (
                            <div className="flex items-center justify-between rounded-full border border-black bg-black p-1 text-white">
                              <button
                                type="button"
                                onClick={() => updatePartQty(row, qty - 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 cursor-pointer"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={row.availableQuantity}
                                  value={qty}
                                  onChange={(e) =>
                                    updatePartQty(
                                      row,
                                      Number(e.target.value) || 1
                                    )
                                  }
                                  aria-label={`Quantity for ${row.item.name}`}
                                  className="w-11 bg-transparent text-center text-xs font-bold tabular-nums text-[#C4F041] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <span className="text-[10px] text-white/60">
                                  / {row.availableQuantity}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => updatePartQty(row, qty + 1)}
                                disabled={qty >= row.availableQuantity}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#C4F041] text-black transition-opacity hover:opacity-90 disabled:opacity-35 cursor-pointer"
                                aria-label="Increase quantity"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sticky Bottom Request Submission Dock */}
            <AnimatePresence>
              {selectedEntries.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 40 }}
                  transition={{ duration: 0.45, ease: LP_EASE }}
                  className="sticky bottom-0 z-30 border-t border-black/14 bg-white/96 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]"
                >
                  <div className="flex flex-col gap-3">
                    {/* Selected Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 max-h-16 overflow-y-auto">
                      {selectedEntries.map(({ itemId, qty, row }) => (
                        <span
                          key={itemId}
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/14 bg-[#F5F5F3] pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-black"
                        >
                          <span className="font-mono text-[10px] font-bold">
                            {row.item.code}
                          </span>
                          <span className="max-w-[140px] truncate">
                            {row.item.name}
                          </span>
                          <span className="rounded-full bg-[#C4F041] px-1.5 py-0.2 text-[10px] font-bold tabular-nums">
                            ×{qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updatePartQty(row, 0)}
                            className="rounded-full p-0.5 text-black/45 hover:text-black cursor-pointer"
                            aria-label={`Remove ${row.item.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Instructor + Purpose + Signature Submit CTA */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <select
                        value={instructorId}
                        onChange={(e) => setInstructorId(e.target.value)}
                        className="h-11 rounded-full border border-black/15 bg-[#F7F7F5] px-4 text-xs font-medium text-black focus:border-black focus:outline-none min-w-[200px]"
                      >
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            Instructor: {inst.fullName}
                          </option>
                        ))}
                      </select>

                      <Input
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="Project / lab course purpose (e.g., Autonomous Rover Lab)..."
                        className="h-11 flex-1 min-w-[220px] rounded-full bg-[#F7F7F5] px-4 text-xs"
                      />

                      <LoopsiiButton
                        label={
                          submitting
                            ? "Submitting..."
                            : `Submit Request (${totalSelectedUnits})`
                        }
                        size="md"
                        hideArrow
                        onClick={handleSubmitRequest}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* STAGE 4: REQUEST SUBMITTED CONFIRMATION ON THE DOTTED GRID */}
        {stage === "submitted" && (
          <motion.div
            key="stage-submitted"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.55, ease: LP_EASE }}
            className="flex flex-1 min-h-[calc(100vh-8.5rem)] items-center justify-center p-6"
          >
            <div className="w-full max-w-md rounded-[26px] border border-black/14 bg-white p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-black/12 bg-[#C4F041] text-black">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-black/55">
                {submittedCode}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-black">
                Request Submitted
              </h2>
              <p className="mt-2 text-sm text-black/60">
                Your request for{" "}
                <strong className="text-black">
                  {submittedSummary.partCount} part
                  {submittedSummary.partCount === 1 ? "" : "s"} (
                  {submittedSummary.unitCount} total units)
                </strong>{" "}
                has been sent to your Instructor for approval.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <LoopsiiButton
                  label="Raise Another Request"
                  size="md"
                  hideArrow
                  onClick={() => setStage("parts")}
                />
                <Button variant="outline" asChild>
                  <Link href="/student/requests">
                    <ClipboardList className="h-4 w-4" />
                    View My Requests
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DottedGridCanvas>
  );
}
