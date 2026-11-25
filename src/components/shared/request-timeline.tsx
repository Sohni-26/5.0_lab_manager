import React from "react";
import { AlertTriangle, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { LabRequestStatus } from "@/types/contracts";

const STAGES = [
  { key: "SUBMITTED", label: "Submitted" },
  { key: "INSTRUCTOR", label: "Instructor" },
  { key: "LAB_MANAGER", label: "Lab Manager" },
  { key: "COLLECTION", label: "Collection" },
  { key: "RETURN", label: "Return" },
  { key: "CLOSED", label: "Closed" },
] as const;

function getStageProgress(status: LabRequestStatus): {
  currentIdx: number;
  failedIdx?: number;
  warningIdx?: number;
} {
  switch (status) {
    case "PENDING_INSTRUCTOR":
      return { currentIdx: 1 };
    case "REJECTED_BY_INSTRUCTOR":
      return { currentIdx: 1, failedIdx: 1 };
    case "PENDING_LAB_MANAGER":
      return { currentIdx: 2 };
    case "REJECTED_BY_LAB_MANAGER":
      return { currentIdx: 2, failedIdx: 2 };
    case "APPROVED":
      return { currentIdx: 3 };
    case "PARTIALLY_ISSUED":
    case "ISSUED":
    case "RETURN_PENDING":
      return { currentIdx: 4 };
    case "RETURN_SUBMITTED":
    case "RETURN_VERIFICATION_PENDING":
    case "PARTIALLY_RETURNED":
      return { currentIdx: 5 };
    case "RETURN_DISPUTED":
      return { currentIdx: 5, warningIdx: 5 };
    case "CLOSED":
      return { currentIdx: 6 };
    case "CANCELLED":
      return { currentIdx: 0, failedIdx: 0 };
    default:
      return { currentIdx: 0 };
  }
}

export function RequestTimeline({ status }: { status: LabRequestStatus }) {
  const { currentIdx, failedIdx, warningIdx } = getStageProgress(status);

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex items-center min-w-[480px]">
        {STAGES.map((stage, idx) => {
          const isCompleted = idx < currentIdx && failedIdx !== idx;
          const isFailed = failedIdx === idx;
          const isWarning = warningIdx === idx;
          const isActive = idx === currentIdx && !isFailed && !isWarning;

          return (
            <React.Fragment key={stage.key}>
              <div className="flex flex-col items-center gap-1.5 min-w-[74px]">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                    isFailed
                      ? "border-black/15 bg-[#FA8E66] text-black"
                      : isWarning
                        ? "border-black/15 bg-[#F3BD77] text-black"
                        : isCompleted
                          ? "border-black bg-black text-[#C4F041]"
                          : isActive
                            ? "border-black bg-[#C4F041] text-black"
                            : "border-black/15 bg-white text-black/35"
                  }`}
                >
                  {isFailed ? (
                    <XCircle className="h-4 w-4" />
                  ) : isWarning ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-medium whitespace-nowrap ${
                    isFailed
                      ? "text-[#B33C17]"
                      : isCompleted || isActive
                        ? "text-black"
                        : "text-black/40"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 -mt-5 mx-1 rounded-full ${
                    idx < currentIdx - 1
                      ? "bg-black"
                      : idx === currentIdx - 1 && failedIdx === undefined
                        ? "bg-black/40"
                        : "bg-black/12"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
