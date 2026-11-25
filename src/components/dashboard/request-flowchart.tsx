"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

/**
 * Smooth, continuous Excalidraw-style organic squiggly vertical S-curve connector.
 * Flows flush from box edge to box edge with matched smooth Bézier tangents and subtle anchor dot.
 */
function SquigglyConnector({
  direction = "right",
  dashed = false,
}: {
  direction?: "left" | "right";
  dashed?: boolean;
}) {
  // Smooth continuous S-curve with vertical entry/exit tangents (matching Excalidraw's spine)
  const curvePath =
    direction === "right"
      ? "M 60 2 C 60 18, 96 18, 80 30 C 64 42, 34 40, 60 56"
      : "M 60 2 C 60 18, 24 18, 40 30 C 56 42, 86 40, 60 56";

  return (
    <div
      className="flex justify-center py-0 select-none"
      aria-hidden="true"
    >
      <svg
        width="120"
        height="58"
        viewBox="0 0 120 58"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={curvePath}
          stroke="#000000"
          strokeOpacity={dashed ? 0.32 : 0.88}
          strokeWidth={dashed ? 1.9 : 2.25}
          strokeLinecap="round"
          strokeDasharray={dashed ? "5 6" : undefined}
        />
        <circle
          cx="60"
          cy="55"
          r="2.6"
          fill={dashed ? "#FFFFFF" : "#000000"}
          stroke="#000000"
          strokeOpacity={dashed ? 0.45 : 0.88}
          strokeWidth="1.6"
        />
      </svg>
    </div>
  );
}

/** Smooth dotted squiggly horizontal branch connector from Step 1 to the Parts preview box */
function SquigglyBranchConnector() {
  return (
    <svg
      width="44"
      height="28"
      viewBox="0 0 44 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="hidden 2xl:block shrink-0 self-center"
      aria-hidden="true"
    >
      <circle
        cx="4"
        cy="14"
        r="2.6"
        fill="#FFFFFF"
        stroke="#000000"
        strokeWidth="1.7"
      />
      <path
        d="M 7 14 C 15 6, 23 22, 31 12 C 35 8, 38 14, 41 14"
        stroke="#000000"
        strokeOpacity="0.65"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
    </svg>
  );
}

/** 6 distinct Landing-Page palette combinations so multiple requests each get their own color */
const FLOW_PALETTES = [
  {
    backdrop: "rgba(188, 230, 250, 0.40)", // Sky
    banner: "#F3BD77", // Apricot
    pendingBg: "#F3BD77",
  },
  {
    backdrop: "rgba(196, 240, 65, 0.24)", // Lime
    banner: "#BCE6FA", // Sky
    pendingBg: "#C4F041",
  },
  {
    backdrop: "rgba(243, 189, 119, 0.30)", // Apricot
    banner: "#AAC2AA", // Sage
    pendingBg: "#F3BD77",
  },
  {
    backdrop: "rgba(170, 194, 170, 0.34)", // Sage
    banner: "#C4F041", // Lime
    pendingBg: "#BCE6FA",
  },
  {
    backdrop: "rgba(250, 142, 102, 0.24)", // Coral
    banner: "#9EC3D5", // Steel
    pendingBg: "#FA8E66",
  },
  {
    backdrop: "rgba(158, 195, 213, 0.34)", // Steel
    banner: "#FA8E66", // Coral
    pendingBg: "#F3BD77",
  },
] as const;

interface RequestFlowchartCardProps {
  request: LabRequestDTO;
  index: number;
  compactMode?: boolean;
  defaultExpanded?: boolean;
}

/**
 * Single request rendered in Excalidraw's organic flowchart style:
 * self-contained colored backdrop (no content overflow), distinct multi-request theme colors,
 * smooth landing-page accordion expand/collapse, continuous squiggly S-curves,
 * and a right-side Clock indicator on the pending step.
 */
export function RequestFlowchartCard({
  request,
  index,
  compactMode = false,
  defaultExpanded = false,
}: RequestFlowchartCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const steps = deriveFlowchartSteps(request);
  const palette = FLOW_PALETTES[index % FLOW_PALETTES.length];

  const totalUnits = request.items.reduce(
    (sum, it) => sum + it.requestedQuantity,
    0
  );

  // Primary steps always visible: Step 1 (Request Raised) + Current Active/Pending step
  const activeStepIdx = Math.max(
    1,
    steps.findIndex((st) => st.state === "pending" || st.state === "rejected")
  );
  const primarySteps = steps.slice(0, activeStepIdx + 1);
  const extraSteps = steps.slice(activeStepIdx + 1);

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

  const renderStepNode = (step: FlowchartStep, sIdx: number) => {
    const isPending = step.state === "pending";
    const isCompleted = step.state === "completed";
    const isRejected = step.state === "rejected";
    const isUpcoming = step.state === "upcoming";

    return (
      <div className="flex w-full items-center justify-center gap-0">
        <div
          className={`w-full ${
            step.showPartsBranch && !compactMode
              ? "max-w-[360px]"
              : "max-w-[440px]"
          } transition-opacity duration-300 ${
            isUpcoming ? "opacity-55" : "opacity-100"
          }`}
        >
          {/* Floating Step Title Tab */}
          <div className="mb-1.5 pl-2">
            <div
              className={`inline-block rounded-[10px] border-2 px-3.5 py-1 text-[14px] font-semibold tracking-[-0.015em] ${
                isPending
                  ? "border-black bg-[#FFF9E6] text-black shadow-[2px_2px_0px_#000000]"
                  : isCompleted
                    ? "border-black bg-[#F0F0F0] text-black shadow-[2px_2px_0px_#000000]"
                    : isRejected
                      ? "border-black bg-[#FCE4DF] text-black shadow-[2px_2px_0px_#000000]"
                      : "border-black/40 border-dashed bg-white/85 text-black/65"
              }`}
            >
              {step.title}
            </div>
          </div>

          {/* Step Body Box */}
          <div
            className={`flex items-center justify-between gap-4 rounded-[14px] border-2 px-4 py-3.5 ${
              isPending
                ? "border-black bg-[#FFFDF7] shadow-[4px_4px_0px_#000000]"
                : isCompleted
                  ? "border-black bg-white shadow-[3px_3px_0px_#000000]"
                  : isRejected
                    ? "border-black bg-[#FFF5F3] shadow-[3px_3px_0px_#000000]"
                    : "border-black/35 border-dashed bg-white/80"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug text-black">
                {step.description}
              </p>

              {/* Inline WebP Part Previews (always kept inside container bounds) */}
              {step.showPartsBranch && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 2xl:hidden">
                  {request.items.slice(0, 4).map((it) => (
                    <div
                      key={it.id}
                      className="inline-flex items-center gap-2 rounded-[10px] border border-black/15 bg-[#F5F5F3] pr-2.5 overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={it.item.imageUrl || getPartImageUrl(it.item.code)}
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

            {/* Right-Side Status Symbol (Clock on Pending Step) */}
            <div className="shrink-0">
              {isPending && (
                <div
                  title="Pending"
                  style={{ backgroundColor: palette.pendingBg }}
                  className="flex items-center gap-2 rounded-full border-2 border-black px-3 py-1.5 text-black shadow-[2px_2px_0px_#000000]"
                >
                  <Clock className="h-4 w-4 stroke-[2.3]" />
                  <span className="text-[13px] font-semibold">Pending</span>
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

        {/* Dotted Squiggly Side Branch (strictly inside padded container on 2xl+) */}
        {step.showPartsBranch && !compactMode && (
          <>
            <SquigglyBranchConnector />
            <div className="hidden 2xl:flex flex-col justify-center w-[196px] shrink-0 rounded-[14px] border-2 border-dashed border-black/55 bg-white/95 p-3">
              <p className="text-[13px] font-semibold text-black mb-2">
                Parts ({totalUnits} units)
              </p>
              <div className="space-y-2">
                {request.items.slice(0, 3).map((it) => (
                  <div key={it.id} className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.item.imageUrl || getPartImageUrl(it.item.code)}
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
    );
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: LP_EASE }}
      style={{ backgroundColor: palette.backdrop }}
      className="relative w-full overflow-hidden rounded-[36px] px-5 sm:px-8 py-7"
    >
      <div className="relative z-10 flex flex-col items-center">
        {/* Top Excalidraw Anchor Header Pill */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{ backgroundColor: palette.banner }}
          className="inline-flex items-center gap-3 rounded-[14px] border-2 border-black px-5 py-2.5 text-black shadow-[3px_3px_0px_#000000] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <span className="text-[16px] font-semibold tracking-[-0.02em]">
            Request {index + 1}
          </span>
          <span className="text-[14px] text-black/75">{formattedDate}</span>
          {extraSteps.length > 0 && (
            <span className="text-black/75">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </span>
          )}
        </button>

        {/* Initial Squiggly Connector from Header Banner */}
        <SquigglyConnector direction={index % 2 === 0 ? "left" : "right"} />

        {/* Always-Visible Primary Steps (Raised -> Active Pending Step) */}
        <div className="w-full">
          {primarySteps.map((step, sIdx) => {
            const isLastPrimary = sIdx === primarySteps.length - 1;
            const nextStep = primarySteps[sIdx + 1];
            const nextDashed =
              !nextStep ||
              nextStep.state === "upcoming" ||
              step.state === "rejected";

            return (
              <div key={step.id} className="flex flex-col items-center">
                {renderStepNode(step, sIdx)}
                {!isLastPrimary && (
                  <SquigglyConnector
                    direction={sIdx % 2 === 0 ? "right" : "left"}
                    dashed={nextDashed}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Smooth Accordion Reveal for Remaining Steps (Zero Layout Squash) */}
        {extraSteps.length > 0 && (
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="extra-steps"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.45, ease: LP_EASE }}
                className="w-full overflow-hidden"
              >
                {extraSteps.map((step, eIdx) => {
                  const globalIdx = primarySteps.length + eIdx;
                  return (
                    <div key={step.id} className="flex flex-col items-center">
                      <SquigglyConnector
                        direction={globalIdx % 2 === 0 ? "left" : "right"}
                        dashed
                      />
                      {renderStepNode(step, globalIdx)}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Clean Toggle Link */}
        {extraSteps.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-4 text-[14px] font-medium text-black/65 underline decoration-black/25 underline-offset-4 hover:text-black hover:decoration-black transition-colors cursor-pointer"
          >
            {expanded ? "Hide upcoming steps" : `Show all ${steps.length} steps`}
          </button>
        )}
      </div>
    </motion.section>
  );
}
