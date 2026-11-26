"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  Plus,
  Send,
  X,
} from "lucide-react";
import { getPartImageUrl } from "@/lib/part-images";
import type { AuthUserDTO, CampusInventoryDTO } from "@/types/contracts";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

export interface SelectedPartEntry {
  itemId: string;
  qty: number;
  row: CampusInventoryDTO;
}

interface StudentRequestDockProps {
  selectedEntries: SelectedPartEntry[];
  totalSelectedUnits: number;
  instructors: AuthUserDTO[];
  instructorId: string;
  onInstructorChange: (id: string) => void;
  purpose: string;
  onPurposeChange: (value: string) => void;
  onUpdateQty: (row: CampusInventoryDTO, nextQty: number) => void;
  onClearAll: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel?: string;
}

/**
 * Always-visible tactile bottom floating request dock that springs up the moment
 * a student selects their first component. Supports one-click submission right from
 * the pill or expanding upward to review quantities, instructor, and purpose note.
 */
export function StudentRequestDock({
  selectedEntries,
  totalSelectedUnits,
  instructors,
  instructorId,
  onInstructorChange,
  purpose,
  onPurposeChange,
  onUpdateQty,
  onClearAll,
  onSubmit,
  submitting,
  submitLabel = "Submit Request",
}: StudentRequestDockProps) {
  const [expanded, setExpanded] = useState(false);

  const hasItems = selectedEntries.length > 0;

  useEffect(() => {
    if (!hasItems) {
      setExpanded(false);
    }
  }, [hasItems]);

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  const activeInstructor =
    instructors.find((i) => i.id === instructorId) ?? instructors[0];

  return (
    <AnimatePresence>
      {hasItems && (
        <motion.div
          key="student-request-dock"
          initial={{ opacity: 0, y: 80, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 80, scale: 0.96 }}
          transition={{ duration: 0.36, ease: LP_EASE }}
          className="fixed bottom-5 left-1/2 z-50 w-[min(94vw,680px)] -translate-x-1/2"
          style={{
            fontFamily:
              "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {/* Expandable Review & Details Sheet (opens cleanly above the dock pill) */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                key="dock-review-sheet"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                transition={{ duration: 0.28, ease: LP_EASE }}
                className="mb-3 rounded-[24px] border-2 border-black bg-white p-5 text-black shadow-[6px_6px_0px_#000000]"
              >
                <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-black/10">
                  <div>
                    <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-black">
                      Request Summary ({selectedEntries.length} part
                      {selectedEntries.length === 1 ? "" : "s"} ·{" "}
                      {totalSelectedUnits} unit
                      {totalSelectedUnits === 1 ? "" : "s"})
                    </h3>
                    <p className="text-[13px] text-[#5E5E5A]">
                      Adjust quantities, choose your instructor, or add an optional note.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="cursor-pointer text-[13px] font-medium text-black/55 transition-colors hover:text-[#B33C17]"
                    >
                      Clear all
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(false)}
                      aria-label="Collapse request summary"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/14 bg-[#F5F5F3] text-black transition-colors hover:bg-[#C4F041]"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Selected Parts List with WebP Thumbnails & Quantity Steppers */}
                <div
                  data-lenis-prevent
                  className="mt-3 max-h-[220px] space-y-2 overflow-y-auto pr-1"
                >
                  {selectedEntries.map(({ itemId, qty, row }) => (
                    <div
                      key={itemId}
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-black/10 bg-[#F7F7F5] px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            row.item.imageUrl ||
                            getPartImageUrl(row.item.code, row.item.category.slug)
                          }
                          alt={row.item.name}
                          className="h-10 w-12 shrink-0 rounded-[8px] border border-black/10 bg-white object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-black">
                            {row.item.name}
                          </p>
                          <p className="text-[12px] text-[#5E5E5A] tabular-nums">
                            {row.availableQuantity} {row.item.unit} available
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="inline-flex items-center rounded-full border border-black/15 bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(row, qty - 1)}
                            aria-label={`Decrease ${row.item.name}`}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[26px] text-center text-[13px] font-semibold text-black tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            disabled={qty >= row.availableQuantity}
                            onClick={() => onUpdateQty(row, qty + 1)}
                            aria-label={`Increase ${row.item.name}`}
                            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:opacity-30"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => onUpdateQty(row, 0)}
                          aria-label={`Remove ${row.item.name}`}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/8 hover:text-black"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Instructor + Optional Project Purpose */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-black/70">
                      Supervising Instructor
                    </label>
                    <select
                      value={instructorId}
                      onChange={(e) => onInstructorChange(e.target.value)}
                      className="h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] px-4 text-[14px] font-medium text-black focus:border-black focus:bg-white focus:outline-none"
                    >
                      {instructors.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-black/70">
                      Project / Lab Note (optional)
                    </label>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => onPurposeChange(e.target.value)}
                      placeholder="e.g., IoT weather node build"
                      className="h-11 w-full rounded-full border border-black/15 bg-[#F7F7F5] px-4 text-[14px] text-black placeholder:text-black/40 focus:border-black focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compact Always-Visible Floating Bottom Dock Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-full border-2 border-black bg-white/98 px-3 py-2.5 text-black shadow-[5px_5px_0px_#000000] backdrop-blur-md sm:flex-nowrap sm:px-3.5">
            {/* Left: Clickable Stacked WebP Thumbnails + Count + Expand Toggle */}
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-full px-1.5 py-0.5 text-left transition-colors hover:bg-[#F5F5F3]"
            >
              <div className="flex shrink-0 items-center -space-x-2.5">
                {selectedEntries.slice(0, 4).map(({ itemId, row }) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={itemId}
                    src={
                      row.item.imageUrl ||
                      getPartImageUrl(row.item.code, row.item.category.slug)
                    }
                    alt={row.item.name}
                    className="h-10 w-10 rounded-full border-2 border-white bg-[#F5F5F3] object-cover shadow-xs"
                  />
                ))}
                {selectedEntries.length > 4 && (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-black text-[12px] font-semibold text-white">
                    +{selectedEntries.length - 4}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-black tabular-nums">
                  {selectedEntries.length} part
                  {selectedEntries.length === 1 ? "" : "s"} ·{" "}
                  {totalSelectedUnits} qty
                </p>
                <p className="truncate text-[13px] text-[#5E5E5A]">
                  {expanded
                    ? "Click to hide summary"
                    : activeInstructor
                      ? `${activeInstructor.fullName} · Review & edit`
                      : "Review & edit request"}
                </p>
              </div>

              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/14 bg-[#F5F5F3] text-black">
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </span>
            </button>

            {/* Right: Impossible-to-Miss High-Contrast Lime Submit Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmit}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 text-[15px] font-semibold tracking-[-0.015em] text-black transition-colors hover:bg-black hover:text-[#C4F041] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>
                    {submitLabel} ({totalSelectedUnits})
                  </span>
                  <Send className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
