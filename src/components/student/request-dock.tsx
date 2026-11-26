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

  const mobileVisibleThumbs =
    selectedEntries.length > 3
      ? selectedEntries.slice(0, 2)
      : selectedEntries.slice(0, 3);
  const mobileOverflowCount =
    selectedEntries.length > 3 ? selectedEntries.length - 2 : 0;

  return (
    <>
      {/* Mobile-only tap-outside backdrop scrim when review sheet is open */}
      <AnimatePresence>
        {hasItems && expanded && (
          <motion.div
            key="student-request-dock-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setExpanded(false)}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] sm:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasItems && (
          <motion.div
            key="student-request-dock"
            initial={{ opacity: 0, y: 80, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.96 }}
            transition={{ duration: 0.36, ease: LP_EASE }}
            className="fixed bottom-3 left-3 right-3 z-50 mb-[env(safe-area-inset-bottom)] sm:bottom-5 sm:left-1/2 sm:right-auto sm:mb-0 sm:w-[min(94vw,680px)] sm:-translate-x-1/2"
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
                  className="mb-2.5 sm:mb-3 flex max-h-[70dvh] sm:max-h-none flex-col overflow-hidden rounded-[22px] sm:rounded-[24px] border-2 border-black bg-white p-4 sm:p-5 text-black shadow-[5px_5px_0px_#000000] sm:shadow-[6px_6px_0px_#000000]"
                >
                  {/* Native-style drag indicator bar on mobile */}
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-2.5 h-1 w-10 shrink-0 rounded-full bg-black/15 sm:hidden"
                  />

                  <div className="flex shrink-0 items-start sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-3.5 border-b border-black/10">
                    <div className="min-w-0">
                      <h3 className="text-[15px] sm:text-[16px] font-semibold tracking-[-0.02em] text-black leading-snug">
                        Request Summary ({selectedEntries.length} part
                        {selectedEntries.length === 1 ? "" : "s"} ·{" "}
                        {totalSelectedUnits} unit
                        {totalSelectedUnits === 1 ? "" : "s"})
                      </h3>
                      <p className="mt-0.5 text-[12.5px] sm:text-[13px] text-[#5E5E5A]">
                        Adjust quantities, choose your instructor, or add an optional note.
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={onClearAll}
                        className="min-h-[36px] sm:min-h-0 cursor-pointer px-1 text-[13px] font-medium text-black/55 transition-colors hover:text-[#B33C17]"
                      >
                        Clear all
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpanded(false)}
                        aria-label="Collapse request summary"
                        className="flex h-9 w-9 sm:h-8 sm:w-8 cursor-pointer items-center justify-center rounded-full border border-black/14 bg-[#F5F5F3] text-black transition-colors hover:bg-[#C4F041]"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Selected Parts List with WebP Thumbnails & Quantity Steppers */}
                  <div
                    data-lenis-prevent
                    className="mt-3 max-h-[34dvh] sm:max-h-[220px] space-y-2 overflow-y-auto overscroll-contain pr-0.5 sm:pr-1"
                  >
                    {selectedEntries.map(({ itemId, qty, row }) => (
                      <div
                        key={itemId}
                        className="flex items-center justify-between gap-2 sm:gap-3 rounded-[14px] border border-black/10 bg-[#F7F7F5] px-2.5 py-2 sm:px-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={
                              row.item.imageUrl ||
                              getPartImageUrl(row.item.code, row.item.category.slug)
                            }
                            alt={row.item.name}
                            className="h-9 w-11 sm:h-10 sm:w-12 shrink-0 rounded-[8px] border border-black/10 bg-white object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] sm:text-[14px] font-medium text-black">
                              {row.item.name}
                            </p>
                            <p className="truncate text-[11.5px] sm:text-[12px] text-[#5E5E5A] tabular-nums">
                              {row.availableQuantity} {row.item.unit} available
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                          <div className="inline-flex items-center rounded-full border border-black/15 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(row, qty - 1)}
                              aria-label={`Decrease ${row.item.name}`}
                              className="flex h-8 w-8 sm:h-7 sm:w-7 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] active:bg-[#E5E5E2]"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[24px] sm:min-w-[26px] text-center text-[13px] font-semibold text-black tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              disabled={qty >= row.availableQuantity}
                              onClick={() => onUpdateQty(row, qty + 1)}
                              aria-label={`Increase ${row.item.name}`}
                              className="flex h-8 w-8 sm:h-7 sm:w-7 cursor-pointer items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] active:bg-[#E5E5E2] disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onUpdateQty(row, 0)}
                            aria-label={`Remove ${row.item.name}`}
                            className="flex h-8 w-8 sm:h-7 sm:w-7 cursor-pointer items-center justify-center rounded-full text-black/45 transition-colors hover:bg-black/8 hover:text-black"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Instructor + Optional Project Purpose */}
                  <div className="mt-3.5 sm:mt-4 grid shrink-0 grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                    <div className="space-y-1">
                      <label className="block text-[12.5px] sm:text-[13px] font-medium text-black/70">
                        Supervising Instructor
                      </label>
                      <select
                        value={instructorId}
                        onChange={(e) => onInstructorChange(e.target.value)}
                        className="min-h-[44px] h-11 w-full rounded-[14px] sm:rounded-full border border-black/15 bg-[#F7F7F5] px-3.5 sm:px-4 text-[16px] sm:text-[14px] font-medium text-black focus:border-black focus:bg-white focus:outline-none"
                      >
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[12.5px] sm:text-[13px] font-medium text-black/70">
                        Project / Lab Note (optional)
                      </label>
                      <input
                        type="text"
                        value={purpose}
                        onChange={(e) => onPurposeChange(e.target.value)}
                        placeholder="e.g., IoT weather node build"
                        className="min-h-[44px] h-11 w-full rounded-[14px] sm:rounded-full border border-black/15 bg-[#F7F7F5] px-3.5 sm:px-4 text-[16px] sm:text-[14px] text-black placeholder:text-black/40 focus:border-black focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Compact Always-Visible Floating Bottom Dock Pill */}
            <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3 rounded-[22px] sm:rounded-full border-2 border-black bg-white/98 px-2.5 py-2 sm:px-3.5 sm:py-2.5 text-black shadow-[4px_4px_0px_#000000] sm:shadow-[5px_5px_0px_#000000] backdrop-blur-md">
              {/* Left: Clickable Stacked WebP Thumbnails + Count + Expand Toggle */}
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2 sm:gap-3 rounded-[16px] sm:rounded-full px-1 py-0.5 sm:px-1.5 text-left transition-colors hover:bg-[#F5F5F3]"
              >
                {/* Mobile stacked thumbnails (up to 3 circles so 360px never clips) */}
                <div className="flex shrink-0 items-center -space-x-2.5 sm:hidden">
                  {mobileVisibleThumbs.map(({ itemId, row }) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={itemId}
                      src={
                        row.item.imageUrl ||
                        getPartImageUrl(row.item.code, row.item.category.slug)
                      }
                      alt={row.item.name}
                      className="h-7 w-7 rounded-full border-2 border-white bg-[#F5F5F3] object-cover shadow-xs"
                    />
                  ))}
                  {mobileOverflowCount > 0 && (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-black text-[10px] font-semibold text-white">
                      +{mobileOverflowCount}
                    </span>
                  )}
                </div>

                {/* Desktop stacked thumbnails (up to 4 + overflow badge) */}
                <div className="hidden shrink-0 items-center -space-x-2.5 sm:flex">
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
                  <p className="truncate text-[13.5px] sm:text-[15px] font-semibold tracking-[-0.02em] text-black tabular-nums leading-tight">
                    <span className="sm:hidden">
                      {selectedEntries.length} part
                      {selectedEntries.length === 1 ? "" : "s"}
                    </span>
                    <span className="hidden sm:inline">
                      {selectedEntries.length} part
                      {selectedEntries.length === 1 ? "" : "s"} ·{" "}
                      {totalSelectedUnits} qty
                    </span>
                  </p>
                  <p className="truncate text-[11.5px] sm:text-[13px] text-[#5E5E5A] leading-tight mt-0.5 sm:mt-0">
                    <span className="sm:hidden">
                      {expanded ? "Tap to close" : "Review & edit"}
                    </span>
                    <span className="hidden sm:inline">
                      {expanded
                        ? "Click to hide summary"
                        : activeInstructor
                          ? `${activeInstructor.fullName} · Review & edit`
                          : "Review & edit request"}
                    </span>
                  </p>
                </div>

                <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border border-black/14 bg-[#F5F5F3] text-black">
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  )}
                </span>
              </button>

              {/* Right: Impossible-to-Miss High-Contrast Lime Submit Button */}
              <button
                type="button"
                disabled={submitting}
                onClick={onSubmit}
                className="inline-flex min-h-[44px] h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 sm:gap-2 rounded-[16px] sm:rounded-full border-2 border-black bg-[#C4F041] px-3 sm:px-5 text-[13.5px] sm:text-[15px] font-semibold tracking-[-0.015em] text-black whitespace-nowrap transition-colors hover:bg-black hover:text-[#C4F041] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="sm:hidden">Sending...</span>
                    <span className="hidden sm:inline">Submitting...</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">
                      Submit ({totalSelectedUnits})
                    </span>
                    <span className="hidden sm:inline">
                      {submitLabel} ({totalSelectedUnits})
                    </span>
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
