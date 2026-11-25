"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  XCircle,
} from "lucide-react";
import { getPartImageUrl } from "@/lib/part-images";
import type { LabRequestDTO, LabRequestStatus } from "@/types/contracts";

const LP_EASE: [number, number, number, number] = [0.76, 0, 0.24, 1];

type StepVisualState = "completed" | "pending" | "upcoming" | "rejected";

interface FlowchartStep {
  id: string;
  title: string;
  description: string;
  state: StepVisualState;
  showPartsBranch?: boolean;
}

function deriveFlowchartSteps(request: LabRequestDTO): FlowchartStep[] {
  const s: LabRequestStatus = request.status;
  const totalParts = request.items.length;
  const totalUnits = request.items.reduce(
    (sum, it) => sum + it.requestedQuantity,
    0
  );

  const instructorApproved = [
    "PENDING_LAB_MANAGER",
    "APPROVED",
    "PARTIALLY_ISSUED",
    "ISSUED",
    "RETURN_PENDING",
    "RETURN_SUBMITTED",
    "RETURN_VERIFICATION_PENDING",
    "RETURN_DISPUTED",
    "PARTIALLY_RETURNED",
    "CLOSED",
    "REJECTED_BY_LAB_MANAGER",
  ].includes(s);

  const labManagerApproved = [
    "APPROVED",
    "PARTIALLY_ISSUED",
    "ISSUED",
    "RETURN_PENDING",
    "RETURN_SUBMITTED",
    "RETURN_VERIFICATION_PENDING",
    "RETURN_DISPUTED",
    "PARTIALLY_RETURNED",
    "CLOSED",
  ].includes(s);

  const collected = [
    "PARTIALLY_ISSUED",
    "ISSUED",
    "RETURN_PENDING",
    "RETURN_SUBMITTED",
    "RETURN_VERIFICATION_PENDING",
    "RETURN_DISPUTED",
    "PARTIALLY_RETURNED",
    "CLOSED",
  ].includes(s);

  const completed = s === "CLOSED";

  const instructorState: StepVisualState =
    s === "REJECTED_BY_INSTRUCTOR"
      ? "rejected"
      : instructorApproved
        ? "completed"
        : "pending";

  const labManagerState: StepVisualState =
    s === "REJECTED_BY_LAB_MANAGER"
      ? "rejected"
      : labManagerApproved
        ? "completed"
        : s === "PENDING_LAB_MANAGER"
          ? "pending"
          : "upcoming";

  const pickupState: StepVisualState = collected
    ? "completed"
    : s === "APPROVED"
      ? "pending"
      : "upcoming";

  const returnState: StepVisualState = completed
    ? "completed"
    : [
          "PARTIALLY_ISSUED",
          "ISSUED",
          "RETURN_PENDING",
          "RETURN_SUBMITTED",
          "RETURN_VERIFICATION_PENDING",
          "RETURN_DISPUTED",
          "PARTIALLY_RETURNED",
        ].includes(s)
      ? "pending"
      : "upcoming";

  return [
    {
      id: "raised",
      title: "Request Raised",
      description: request.purpose
        ? `${totalParts} part${totalParts === 1 ? "" : "s"} (${totalUnits} unit${totalUnits === 1 ? "" : "s"}) for ${request.purpose}`
        : `${totalParts} part${totalParts === 1 ? "" : "s"} (${totalUnits} unit${totalUnits === 1 ? "" : "s"}) selected`,
      state: "completed",
      showPartsBranch: true,
    },
    {
      id: "instructor",
      title: "Instructor Approval",
      description:
        instructorState === "completed"
          ? `Approved by ${request.instructor.fullName}`
          : instructorState === "rejected"
            ? `Rejected by ${request.instructor.fullName}`
            : `Waiting for ${request.instructor.fullName} to review`,
      state: instructorState,
    },
    {
      id: "lab-manager",
      title: "Lab Manager Sign-Off",
      description:
        labManagerState === "completed"
          ? "Stock reserved by Campus Lab Manager"
          : labManagerState === "rejected"
            ? "Declined by Campus Lab Manager"
            : labManagerState === "pending"
              ? "Waiting for Campus Lab Manager to reserve stock"
              : "Final approval and stock reservation",
      state: labManagerState,
    },
    {
      id: "pickup",
      title: "4-Angle Photos & Pickup",
      description:
        pickupState === "completed"
          ? "Photos verified and parts collected"
          : pickupState === "pending"
            ? "Upload 4-angle collection photos to collect parts"
            : "Handover at your campus lab counter",
      state: pickupState,
    },
    {
      id: "return",
      title: "Return & Verification",
      description:
        returnState === "completed"
          ? "Returned and verified in good condition"
          : returnState === "pending"
            ? "Submit return photos when finished"
            : "Return parts after lab completion",
      state: returnState,
    },
  ];
}

/** Excalidraw-inspired organic squiggly S-curve vertical SVG connector */
function SquigglyConnector({
  direction = "right",
  dashed = false,
}: {
  direction?: "left" | "right";
  dashed?: boolean;
}) {
  // Gentle hand-drawn S-curve winding left or right
  const path =
    direction === "right"
      ? "M 50 2 C 50 18, 76 16, 68 30 C 60 44, 34 40, 50 56"
      : "M 50 2 C 50 18, 24 16, 32 30 C 40 44, 66 40, 50 56";

  return (
    <div className="flex justify-center -my-0.5 select-none" aria-hidden="true">
      <svg
        width="100"
        height="58"
        viewBox="0 0 100 58"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <path
          d={path}
          stroke="#000000"
          strokeOpacity={dashed ? 0.35 : 0.85}
          strokeWidth={dashed ? 2 : 2.3}
          strokeLinecap="round"
          strokeDasharray={dashed ? "5 6" : undefined}
        />
        {/* Small hand-drawn arrowhead at the bottom */}
        <path
          d="M 44 49 L 50 56 L 56 49"
          stroke="#000000"
          strokeOpacity={dashed ? 0.35 : 0.85}
          strokeWidth={dashed ? 1.8 : 2.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Dotted squiggly horizontal branch connector from a step card to its parts preview box */
function SquigglyBranchConnector() {
  return (
    <svg
      width="56"
      height="32"
      viewBox="0 0 56 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hidden 2xl:block shrink-0 self-center -mx-1"
      aria-hidden="true"
    >
      <circle cx="4" cy="16" r="3" fill="#FFFFFF" stroke="#000000" strokeWidth="1.8" />
      <path
        d="M 7 16 C 18 6, 28 26, 38 14 C 44 8, 49 16, 53 16"
        stroke="#000000"
        strokeOpacity="0.65"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

const BANNER_COLORS = ["#F3BD77", "#C4F041", "#BCE6FA", "#AAC2AA"] as const;
const BLOB_COLORS = [
  "rgba(188, 230, 250, 0.32)",
  "rgba(196, 240, 65, 0.22)",
  "rgba(243, 189, 119, 0.26)",
  "rgba(170, 194, 170, 0.28)",
] as const;

interface RequestFlowchartCardProps {
  request: LabRequestDTO;
  index: number;
  compactMode?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Single request rendered in Excalidraw's organic flowchart style:
 * pastel aura blob, ink-bordered header pill, two-tier step boxes,
 * squiggly S-curve connectors, dashed parts branch, and Clock icon on pending steps.
 */
export function RequestFlowchartCard({
  request,
  index,
  compactMode = false,
  defaultExpanded = true,
}: RequestFlowchartCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const steps = deriveFlowchartSteps(request);
  const pendingStep = steps.find((st) => st.state === "pending");
  const bannerBg = BANNER_COLORS[index % BANNER_COLORS.length];
  const blobColor = BLOB_COLORS[index % BLOB_COLORS.length];

  const totalUnits = request.items.reduce(
    (sum, it) => sum + it.requestedQuantity,
    0
  );

  // In compact cluster mode when collapsed, show Step 1 + Current Pending Step with a squiggly link
  const displayedSteps = expanded
    ? steps
    : steps.filter(
        (st, idx) => idx === 0 || st.state === "pending" || st.state === "rejected"
      );

  const formattedDate = (() => {
    try {
      return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(request.createdAt));
    } catch {
      return "Just now";
    }
  })();

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: LP_EASE }}
      className="relative py-4 px-2 sm:px-4"
    >
      {/* Excalidraw-style Soft Organic Pastel Blob Behind the Flowchart */}
      <svg
        viewBox="0 0 520 680"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M90,48 C185,6 380,12 448,88 C515,164 475,270 492,372 C508,475 456,620 340,656 C225,692 66,645 36,522 C6,399 42,306 24,200 C6,94 20,80 90,48 Z"
          fill={blobColor}
        />
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        {/* Top Excalidraw Anchor Header Pill (like "June" / "August") */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{ backgroundColor: bannerBg }}
          className="group inline-flex items-center gap-3 rounded-[14px] border-2 border-black px-5 py-2.5 text-black shadow-[3px_3px_0px_#000000] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <span className="text-[16px] font-semibold tracking-[-0.02em]">
            Request {index + 1}
          </span>
          <span className="text-[14px] text-black/70">
            {formattedDate}
          </span>
          <span className="text-black/70">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        </button>

        {/* Initial Squiggly Connector from Header Banner */}
        <SquigglyConnector direction={index % 2 === 0 ? "left" : "right"} />

        {/* Vertical Flowchart Spine */}
        <div className="w-full space-y-0">
          {displayedSteps.map((step, sIdx) => {
            const isLast = sIdx === displayedSteps.length - 1;
            const isPending = step.state === "pending";
            const isCompleted = step.state === "completed";
            const isRejected = step.state === "rejected";
            const isUpcoming = step.state === "upcoming";

            // Gentle Excalidraw alternating horizontal stagger when wide
            const staggerClass = compactMode
              ? ""
              : sIdx % 2 === 1
                ? "sm:translate-x-3"
                : "sm:-translate-x-2";

            const nextStep = displayedSteps[sIdx + 1];
            const nextConnectorDashed =
              !nextStep ||
              nextStep.state === "upcoming" ||
              step.state === "pending" ||
              step.state === "rejected";

            return (
              <div key={step.id} className="flex flex-col items-center">
                <div
                  className={`flex w-full items-stretch justify-center ${staggerClass}`}
                >
                  {/* Step Node (Excalidraw two-tier tab + description card) */}
                  <div
                    className={`w-full ${
                      step.showPartsBranch && !compactMode
                        ? "max-w-[400px]"
                        : "max-w-[460px]"
                    } transition-opacity ${isUpcoming ? "opacity-55" : "opacity-100"}`}
                  >
                    {/* Floating Step Title Header Tab (just like Excalidraw's "New landing pages" box) */}
                    <div className="mb-1.5 flex items-center justify-between gap-2 pl-2">
                      <div
                        className={`inline-block rounded-[10px] border-2 px-3.5 py-1 text-[14px] font-semibold tracking-[-0.015em] ${
                          isPending
                            ? "border-black bg-[#FFF9E6] text-black shadow-[2px_2px_0px_#000000]"
                            : isCompleted
                              ? "border-black bg-[#F0F0F0] text-black shadow-[2px_2px_0px_#000000]"
                              : isRejected
                                ? "border-black bg-[#FCE4DF] text-black shadow-[2px_2px_0px_#000000]"
                                : "border-black/40 border-dashed bg-white/80 text-black/65"
                        }`}
                      >
                        {step.title}
                      </div>
                    </div>

                    {/* Step Body Box with Clock Symbol on the Right when Pending */}
                    <div
                      className={`flex items-center justify-between gap-4 rounded-[14px] border-2 px-4 py-3.5 ${
                        isPending
                          ? "border-black bg-[#FFFDF7] shadow-[4px_4px_0px_#000000]"
                          : isCompleted
                            ? "border-black bg-white shadow-[3px_3px_0px_#000000]"
                            : isRejected
                              ? "border-black bg-[#FFF5F3] shadow-[3px_3px_0px_#000000]"
                              : "border-black/35 border-dashed bg-white/75"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] leading-snug text-black">
                          {step.description}
                        </p>
                        {step.showPartsBranch && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2 2xl:hidden">
                            {request.items.slice(0, 4).map((it) => (
                              <div
                                key={it.id}
                                className="inline-flex items-center gap-2 rounded-[10px] border border-black/15 bg-[#F5F5F3] pr-2.5 overflow-hidden"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={
                                    it.item.imageUrl ||
                                    getPartImageUrl(it.item.code)
                                  }
                                  alt={it.item.name}
                                  className="h-8 w-8 object-cover border-r border-black/10"
                                />
                                <span className="text-[13px] font-medium text-black max-w-[140px] truncate">
                                  {it.item.name} ×{it.requestedQuantity}
                                </span>
                              </div>
                            ))}
                            {request.items.length > 4 && (
                              <span className="text-[13px] text-black/60">
                                +{request.items.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right-Side Status Symbol (Clock for Pending, Check for Completed) */}
                      <div className="shrink-0">
                        {isPending && (
                          <div
                            title="Pending"
                            className="flex items-center gap-2 rounded-full border-2 border-black bg-[#F3BD77] px-3 py-1.5 text-black shadow-[2px_2px_0px_#000000]"
                          >
                            <Clock className="h-4 w-4 stroke-[2.3]" />
                            <span className="text-[13px] font-semibold">
                              Pending
                            </span>
                          </div>
                        )}
                        {isCompleted && (
                          <div
                            title="Completed"
                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-[#C4F041] text-black"
                          >
                            <Check className="h-4 w-4 stroke-[2.6]" />
                          </div>
                        )}
                        {isRejected && (
                          <div
                            title="Rejected"
                            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-[#FA8E66] text-black"
                          >
                            <XCircle className="h-4 w-4 stroke-[2.2]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Excalidraw-style Dotted Squiggly Side Callout with WebP Part Previews (on wide view) */}
                  {step.showPartsBranch && !compactMode && (
                    <>
                      <SquigglyBranchConnector />
                      <div className="hidden 2xl:flex flex-col justify-center w-[200px] shrink-0 rounded-[14px] border-2 border-dashed border-black/55 bg-white/92 p-3 shadow-[3px_3px_0px_rgba(0,0,0,0.08)]">
                        <p className="text-[13px] font-semibold text-black mb-2">
                          Parts ({totalUnits} units)
                        </p>
                        <div className="space-y-2">
                          {request.items.slice(0, 3).map((it) => (
                            <div
                              key={it.id}
                              className="flex items-center gap-2"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  it.item.imageUrl ||
                                  getPartImageUrl(it.item.code)
                                }
                                alt={it.item.name}
                                className="h-9 w-11 shrink-0 rounded-[8px] border border-black/15 object-cover"
                              />
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-black truncate">
                                  {it.item.name}
                                </p>
                                <p className="text-[12px] text-black/55 tabular-nums">
                                  Qty {it.requestedQuantity}
                                </p>
                              </div>
                            </div>
                          ))}
                          {request.items.length > 3 && (
                            <p className="text-[12px] font-medium text-black/55">
                              +{request.items.length - 3} more parts
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Squiggly Connector to Next Step */}
                {!isLast && (
                  <SquigglyConnector
                    direction={sIdx % 2 === 0 ? "right" : "left"}
                    dashed={nextConnectorDashed}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Toggle full flowchart link when collapsed */}
        {!expanded && pendingStep && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 text-[14px] font-medium text-black/65 underline decoration-black/25 underline-offset-4 hover:text-black hover:decoration-black cursor-pointer"
          >
            Show all {steps.length} steps
          </button>
        )}
      </div>
    </motion.section>
  );
}
