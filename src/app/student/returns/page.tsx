"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Minus,
  Package,
  PackageX,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import { cn, formatDate, PHOTO_ANGLE_META } from "@/lib/utils";
import {
  REQUIRED_PHOTO_ANGLES,
  type ItemPhotoDTO,
  type LabRequestDTO,
  type LabRequestItemDTO,
  type PhotoAngle,
} from "@/types/contracts";

type ReturnConditionChoice = "GOOD" | "DAMAGED" | "MISSING";
type ReturnsFilter = "ALL" | "ACTIONABLE" | "AWAITING";

const CONDITION_OPTIONS: Array<{
  value: ReturnConditionChoice;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
  dotClass: string;
}> = [
  {
    value: "GOOD",
    label: "Good",
    helper: "Working properly, all accessories included",
    icon: CheckCircle2,
    activeClass:
      "border-black bg-[#C4F041] text-black font-semibold shadow-[2px_2px_0px_#000000]",
    dotClass: "bg-[#3E6B48]",
  },
  {
    value: "DAMAGED",
    label: "Damaged",
    helper: "Physical wear, bent pins, or fault noticed",
    icon: AlertTriangle,
    activeClass:
      "border-black bg-[#F3BD77] text-black font-semibold shadow-[2px_2px_0px_#000000]",
    dotClass: "bg-[#8C5811]",
  },
  {
    value: "MISSING",
    label: "Missing",
    helper: "Part, cable, or accessory not accounted for",
    icon: PackageX,
    activeClass:
      "border-black bg-[#FA8E66] text-black font-semibold shadow-[2px_2px_0px_#000000]",
    dotClass: "bg-[#B33C17]",
  },
];

function getItemPhotos(req: LabRequestDTO, it: LabRequestItemDTO): ItemPhotoDTO[] {
  const seen = new Set<string>();
  const merged: ItemPhotoDTO[] = [];
  for (const photo of [
    ...(it.photos ?? []),
    ...(req.photos ?? []).filter((p) => p.requestItemId === it.id),
  ]) {
    if (!seen.has(photo.id)) {
      seen.add(photo.id);
      merged.push(photo);
    }
  }
  return merged;
}

function countReturnPhotos(req: LabRequestDTO, it: LabRequestItemDTO): number {
  const all = getItemPhotos(req, it);
  const angles = new Set(
    all.filter((p) => p.phase === "RETURN").map((p) => p.angle)
  );
  return REQUIRED_PHOTO_ANGLES.filter((a) => angles.has(a)).length;
}

function getStatusPillMeta(status: LabRequestDTO["status"]): {
  label: string;
  className: string;
} {
  switch (status) {
    case "RETURN_VERIFICATION_PENDING":
      return {
        label: "Awaiting Inspection",
        className: "border-black/15 bg-[#E2F3FC] text-[#1D5570]",
      };
    case "PARTIALLY_RETURNED":
      return {
        label: "Partially Returned",
        className: "border-black/15 bg-[#FBF0DC] text-[#8C5811]",
      };
    case "RETURN_PENDING":
      return {
        label: "Return Pending",
        className: "border-black/15 bg-[#FBF0DC] text-[#8C5811]",
      };
    case "PARTIALLY_ISSUED":
      return {
        label: "Partially Issued",
        className: "border-black/15 bg-[#F3FBD4] text-black",
      };
    default:
      return {
        label: "Ready to Return",
        className: "border-black/15 bg-[#F3FBD4] text-black",
      };
  }
}

interface ReturnPhotoProofGridProps {
  existingPhotos: ItemPhotoDTO[];
  disabled?: boolean;
  onUpload: (angle: PhotoAngle, file: File) => Promise<void>;
}

function ReturnPhotoProofGrid({
  existingPhotos,
  disabled = false,
  onUpload,
}: ReturnPhotoProofGridProps) {
  const [uploadingAngle, setUploadingAngle] = useState<PhotoAngle | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const photoByAngle = useMemo(() => {
    const map = new Map<PhotoAngle, ItemPhotoDTO>();
    existingPhotos
      .filter((p) => p.phase === "RETURN")
      .forEach((p) => map.set(p.angle, p));
    return map;
  }, [existingPhotos]);

  const uploadedCount = REQUIRED_PHOTO_ANGLES.filter((angle) =>
    photoByAngle.has(angle)
  ).length;
  const allReady = uploadedCount === 4;

  const handleFileChange = async (
    angle: PhotoAngle,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WEBP)");
      e.target.value = "";
      return;
    }

    setUploadingAngle(angle);
    try {
      await onUpload(angle, file);
      toast.success(`${PHOTO_ANGLE_META[angle].label} photo uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingAngle(null);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {/* Unmistakable Photo Completion Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Camera className="h-4 w-4 shrink-0 text-black" />
          <span className="text-[14px] font-semibold tracking-[-0.01em] text-black">
            4-Angle Return Photos
          </span>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold tabular-nums transition-colors",
            allReady
              ? "border-black bg-[#C4F041] text-black"
              : "border-black/14 bg-[#F5F5F3] text-black/80"
          )}
        >
          {allReady ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-black" />
          ) : (
            <Clock className="h-3.5 w-3.5 shrink-0 text-[#8C5811]" />
          )}
          {allReady ? "4 of 4 photos ready" : `${uploadedCount} of 4 photos`}
        </span>
      </div>

      {/* 4-Segment Visual Progress Bar */}
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {REQUIRED_PHOTO_ANGLES.map((angle) => {
          const done = photoByAngle.has(angle);
          return (
            <div
              key={angle}
              className={cn(
                "h-1.5 rounded-full transition-colors",
                done ? "bg-[#C4F041] ring-1 ring-black/20" : "bg-black/10"
              )}
            />
          );
        })}
      </div>

      {/* Crisp 2x2 Mobile / 4-Up Desktop Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {REQUIRED_PHOTO_ANGLES.map((angle) => {
          const photo = photoByAngle.get(angle);
          const meta = PHOTO_ANGLE_META[angle];
          const isUploading = uploadingAngle === angle;

          return (
            <div
              key={angle}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-[18px] border transition-colors",
                photo
                  ? "border-black/25 bg-white"
                  : "border-black/14 bg-[#F7F7F5]"
              )}
            >
              <input
                ref={(el) => {
                  inputRefs.current[angle] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                disabled={disabled || isUploading}
                onChange={(e) => handleFileChange(angle, e)}
              />

              <button
                type="button"
                disabled={disabled || isUploading}
                onClick={() => inputRefs.current[angle]?.click()}
                aria-label={`${photo ? "Replace" : "Upload"} ${meta.label} return photo`}
                className={cn(
                  "group relative flex w-full flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-black",
                  !disabled && "cursor-pointer"
                )}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#EAEAE6] flex items-center justify-center">
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={`${meta.label} return proof`}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-black bg-[#C4F041] text-black shadow-xs">
                        <Check className="h-4 w-4 stroke-[2.5]" />
                      </span>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-2.5 py-3 text-center">
                      <span className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-full border border-black/14 bg-white text-black transition-transform group-hover:scale-105">
                        {isUploading ? (
                          <Loader2 className="h-5 w-5 animate-spin text-black" />
                        ) : (
                          <Camera className="h-5 w-5 text-black/75" />
                        )}
                      </span>
                      <span className="text-[13px] font-medium text-black/70 leading-snug">
                        {isUploading ? "Uploading..." : "Tap to capture"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex min-h-[44px] items-center justify-between gap-1.5 border-t border-black/10 bg-white px-2.5 py-2 sm:px-3">
                  <span className="truncate text-[13px] sm:text-[14px] font-semibold text-black">
                    {meta.shortLabel}
                  </span>
                  {!disabled && (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold transition-colors",
                        photo
                          ? "bg-[#F2F2EF] text-black group-hover:bg-[#C4F041]"
                          : "bg-[#C4F041] text-black"
                      )}
                    >
                      {isUploading ? (
                        "..."
                      ) : photo ? (
                        <>
                          <RefreshCw className="h-3 w-3" />
                          <span className="hidden sm:inline">Retake</span>
                        </>
                      ) : (
                        "Add"
                      )}
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentReturnsPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReturnsFilter>("ALL");
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [conditionByItem, setConditionByItem] = useState<
    Record<string, ReturnConditionChoice>
  >({});
  const [notesByItem, setNotesByItem] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      const list = res.data.filter(
        (r) =>
          r.status === "ISSUED" ||
          r.status === "PARTIALLY_ISSUED" ||
          r.status === "RETURN_PENDING" ||
          r.status === "PARTIALLY_RETURNED" ||
          r.status === "RETURN_VERIFICATION_PENDING"
      );
      setRequests(list);

      const qInit: Record<string, number> = {};
      const cInit: Record<string, ReturnConditionChoice> = {};
      const expInit: Record<string, boolean> = {};
      list.forEach((r) => {
        const isAwaiting = r.status === "RETURN_VERIFICATION_PENDING";
        let openedOne = false;
        r.items.forEach((it) => {
          qInit[it.id] = Math.max(1, it.issuedQuantity - it.returnedQuantity);
          cInit[it.id] = "GOOD";
          if (isAwaiting) {
            expInit[it.id] = false;
          } else if (!openedOne && countReturnPhotos(r, it) < 4) {
            expInit[it.id] = true;
            openedOne = true;
          } else {
            expInit[it.id] = false;
          }
        });
        if (!isAwaiting && !openedOne && r.items[0]) {
          expInit[r.items[0].id] = true;
        }
      });

      setQtyByItem((prev) => ({ ...qInit, ...prev }));
      setConditionByItem((prev) => ({ ...cInit, ...prev }));
      setExpandedItems((prev) => ({ ...expInit, ...prev }));
    } catch {
      const demo = DEMO_REQUESTS.filter(
        (r) =>
          r.status === "ISSUED" || r.status === "RETURN_VERIFICATION_PENDING"
      );
      setRequests(demo);

      const qInit: Record<string, number> = {};
      const cInit: Record<string, ReturnConditionChoice> = {};
      const expInit: Record<string, boolean> = {};
      demo.forEach((r) => {
        const isAwaiting = r.status === "RETURN_VERIFICATION_PENDING";
        let openedOne = false;
        r.items.forEach((it) => {
          qInit[it.id] = Math.max(1, it.issuedQuantity - it.returnedQuantity);
          cInit[it.id] = "GOOD";
          if (isAwaiting) {
            expInit[it.id] = false;
          } else if (!openedOne && countReturnPhotos(r, it) < 4) {
            expInit[it.id] = true;
            openedOne = true;
          } else {
            expInit[it.id] = false;
          }
        });
        if (!isAwaiting && !openedOne && r.items[0]) {
          expInit[r.items[0].id] = true;
        }
      });

      setQtyByItem((prev) => ({ ...qInit, ...prev }));
      setConditionByItem((prev) => ({ ...cInit, ...prev }));
      setExpandedItems((prev) => ({ ...expInit, ...prev }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({
    enabled: true,
    isDemoMode,
    eventTypes: ["return.verified", "request.status_changed"],
    onEvent: () => load(),
  });

  const handleUploadReturnPhoto = async (
    requestId: string,
    requestItemId: string,
    angle: PhotoAngle,
    file: File
  ) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("requestItemId", requestItemId);
      fd.append("angle", angle);
      await apiClient.requests.uploadReturnPhoto(requestId, fd);
      await load();
    } catch (err) {
      if (isDemoMode) {
        const previewUrl = URL.createObjectURL(file);
        setRequests((prev) =>
          prev.map((req) => {
            if (req.id !== requestId) return req;
            return {
              ...req,
              items: req.items.map((it) => {
                if (it.id !== requestItemId) return it;
                const others = (it.photos ?? []).filter(
                  (p) => !(p.phase === "RETURN" && p.angle === angle)
                );
                return {
                  ...it,
                  photos: [
                    ...others,
                    {
                      id: `local-ret-${Date.now()}`,
                      requestId,
                      requestItemId,
                      borrowingRecordId: it.borrowingRecords?.[0]?.id ?? null,
                      uploadedById: "demo",
                      angle,
                      phase: "RETURN",
                      storageKey: "local-preview",
                      url: previewUrl,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                };
              }),
            };
          })
        );
      } else {
        throw err;
      }
    }
  };

  const handleSubmitReturn = async (req: LabRequestDTO) => {
    const missingAny = req.items.some((it) => countReturnPhotos(req, it) < 4);
    if (missingAny) {
      toast.error(
        "Upload all 4 mandatory return angle photos (Front/Top, Back/Bottom, Left, Right) before submitting return."
      );
      return;
    }

    setSubmittingId(req.id);
    try {
      await apiClient.requests.submitReturn(req.id, {
        items: req.items.map((it) => {
          const cond = conditionByItem[it.id] ?? "GOOD";
          const rawNotes = notesByItem[it.id]?.trim() ?? "";
          const conditionPrefix =
            cond === "DAMAGED"
              ? "[Condition: Damaged]"
              : cond === "MISSING"
                ? "[Condition: Missing]"
                : "";
          const studentComments = conditionPrefix
            ? rawNotes
              ? `${conditionPrefix} ${rawNotes}`
              : conditionPrefix
            : rawNotes || undefined;

          return {
            requestItemId: it.id,
            borrowingRecordId: it.borrowingRecords?.[0]?.id,
            returnedQuantity: qtyByItem[it.id] ?? it.issuedQuantity,
            studentComments,
          };
        }),
      });
      toast.success(
        `Return submitted for ${req.requestCode}. Awaiting physical inspection by your Instructor.`
      );
      await load();
    } catch (err) {
      if (isDemoMode) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === req.id
              ? {
                  ...r,
                  status: "RETURN_VERIFICATION_PENDING",
                  updatedAt: new Date().toISOString(),
                }
              : r
          )
        );
        setExpandedItems((prev) => {
          const next = { ...prev };
          req.items.forEach((it) => {
            next[it.id] = false;
          });
          return next;
        });
        toast.success(
          `Return submitted for ${req.requestCode}. Awaiting physical inspection by your Instructor.`
        );
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to submit return");
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aAwaiting = a.status === "RETURN_VERIFICATION_PENDING" ? 1 : 0;
      const bAwaiting = b.status === "RETURN_VERIFICATION_PENDING" ? 1 : 0;
      if (aAwaiting !== bAwaiting) return aAwaiting - bAwaiting;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [requests]);

  const counts = useMemo(() => {
    const actionable = sortedRequests.filter(
      (r) => r.status !== "RETURN_VERIFICATION_PENDING"
    ).length;
    const awaiting = sortedRequests.filter(
      (r) => r.status === "RETURN_VERIFICATION_PENDING"
    ).length;
    return {
      ALL: sortedRequests.length,
      ACTIONABLE: actionable,
      AWAITING: awaiting,
    };
  }, [sortedRequests]);

  const visibleRequests = useMemo(() => {
    if (filter === "ACTIONABLE") {
      return sortedRequests.filter(
        (r) => r.status !== "RETURN_VERIFICATION_PENDING"
      );
    }
    if (filter === "AWAITING") {
      return sortedRequests.filter(
        (r) => r.status === "RETURN_VERIFICATION_PENDING"
      );
    }
    return sortedRequests;
  }, [sortedRequests, filter]);

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const openNextItem = (req: LabRequestDTO, currentItemId: string) => {
    const nextItem =
      req.items.find(
        (it) => it.id !== currentItemId && countReturnPhotos(req, it) < 4
      ) ??
      req.items[
        (req.items.findIndex((it) => it.id === currentItemId) + 1) %
          req.items.length
      ];
    if (!nextItem) return;
    setExpandedItems((prev) => ({
      ...prev,
      [currentItemId]: false,
      [nextItem.id]: true,
    }));
  };

  return (
    <div
      className="space-y-4 sm:space-y-5 max-w-full overflow-x-hidden"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Editorial Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            Equipment Returns
          </h1>
          <p className="mt-1 text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
            Snap 4 condition photos at the bench, confirm quantity and condition, then submit for Instructor sign-off.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/student/borrowed"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-black/14 bg-white px-4 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#F5F5F3]"
          >
            <span>Borrowed Items</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Cohesive NxtWave Light Dotted-Grid Surface */}
      <DottedGridCanvas
        pannable={false}
        className="flex flex-col rounded-[22px] sm:rounded-[28px] p-3 sm:p-6 lg:p-7"
      >
        {loading ? (
          <div className="m-auto w-full max-w-[440px] rounded-[24px] border border-black/14 bg-white p-8 text-center shadow-card">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-black/60" />
            <p className="mt-3 text-[15px] font-medium text-black">
              Loading your active equipment...
            </p>
            <p className="mt-1 text-[14px] text-[#5E5E5A]">
              Fetching open borrowings ready for return.
            </p>
          </div>
        ) : sortedRequests.length === 0 ? (
          <div className="m-auto w-full max-w-[480px] rounded-[24px] sm:rounded-[28px] border border-black/14 bg-white p-6 sm:p-10 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-black/14 bg-[#F3FBD4] text-black">
              <RotateCcw className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-[22px] sm:text-[26px] font-medium tracking-[-0.03em] text-black">
              No active items to return
            </h2>
            <p className="mt-2.5 text-[14px] sm:text-[15px] leading-relaxed text-[#5E5E5A]">
              Equipment currently issued to you will appear here when you are ready to capture return photos and close out your borrowing.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <Link
                href="/student/borrowed"
                className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border-2 border-black bg-[#C4F041] px-5 text-[14px] font-semibold text-black shadow-[2px_2px_0px_#000000] transition-colors hover:bg-black hover:text-[#C4F041]"
              >
                <span>View Borrowed Items</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/student/inventory"
                className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-black/18 bg-white px-5 text-[14px] font-medium text-black transition-colors hover:border-black hover:bg-[#F5F5F3]"
              >
                <span>Browse Inventory</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 sm:gap-6">
            {/* Filter Bar (only shown when useful, thumb-friendly 44px pills) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: "ALL", label: "All Returns" },
                    { key: "ACTIONABLE", label: "Ready to Return" },
                    { key: "AWAITING", label: "Awaiting Inspection" },
                  ] as Array<{ key: ReturnsFilter; label: string }>
                ).map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilter(tab.key)}
                      className={cn(
                        "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors",
                        active
                          ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,0.18)]"
                          : "border-black/14 bg-white text-black hover:border-black/40"
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          "tabular-nums font-semibold",
                          active ? "text-[#C4F041]" : "text-black/45"
                        )}
                      >
                        {counts[tab.key]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[14px] text-[#5E5E5A]">
                All 4 photo angles are required per part before sign-off.
              </p>
            </div>

            {visibleRequests.length === 0 ? (
              <div className="mx-auto my-8 w-full max-w-[420px] rounded-[24px] border border-black/14 bg-white p-7 text-center shadow-card">
                <p className="text-[16px] font-semibold text-black">
                  Nothing in this view
                </p>
                <p className="mt-1.5 text-[14px] text-[#5E5E5A]">
                  Switch back to see all active and submitted returns.
                </p>
                <button
                  type="button"
                  onClick={() => setFilter("ALL")}
                  className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-black/15 bg-[#F5F5F3] px-5 text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041]"
                >
                  Show All Returns
                </button>
              </div>
            ) : (
              <div className="space-y-5 sm:space-y-6">
                {visibleRequests.map((req) => {
                  const awaitingCheck =
                    req.status === "RETURN_VERIFICATION_PENDING";
                  const statusMeta = getStatusPillMeta(req.status);
                  const totalItems = req.items.length;
                  const readyItemsCount = req.items.filter(
                    (it) => countReturnPhotos(req, it) === 4
                  ).length;
                  const totalPhotosUploaded = req.items.reduce(
                    (sum, it) => sum + countReturnPhotos(req, it),
                    0
                  );
                  const totalPhotosRequired = totalItems * 4;
                  const allPhotosUploaded = readyItemsCount === totalItems;
                  const isSubmitting = submittingId === req.id;

                  return (
                    <section
                      key={req.id}
                      className="overflow-hidden rounded-[24px] border border-black/14 bg-white shadow-card"
                    >
                      {/* Request Header */}
                      <div
                        className={cn(
                          "border-b border-black/10 p-4 sm:p-6",
                          awaitingCheck ? "bg-[#F7FAFC]" : "bg-[#F7F7F5]"
                        )}
                      >
                        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-mono text-[16px] sm:text-[18px] font-semibold tracking-[-0.01em] text-black tabular-nums">
                                {req.requestCode}
                              </h2>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-medium",
                                  statusMeta.className
                                )}
                              >
                                {statusMeta.label}
                              </span>
                            </div>

                            {req.purpose && (
                              <p className="text-[14px] sm:text-[15px] text-black/80 leading-snug">
                                {req.purpose}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-[#5E5E5A]">
                              <span className="inline-flex items-center gap-1.5">
                                <UserCheck className="h-4 w-4 shrink-0 text-black/60" />
                                <span>
                                  Instructor:{" "}
                                  <strong className="font-semibold text-black">
                                    {req.instructor.fullName}
                                  </strong>
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <Package className="h-4 w-4 shrink-0 text-black/60" />
                                {totalItems} part{totalItems === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>

                          {/* Desktop Primary Action OR Inspection Status */}
                          {awaitingCheck ? (
                            <div className="inline-flex items-center gap-2 rounded-2xl border border-black/12 bg-white px-4 py-2.5 text-[14px] font-medium text-black">
                              <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-[#1D5570]" />
                              <span>Submitted · Pending instructor check</span>
                            </div>
                          ) : (
                            <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-1.5 shrink-0">
                              <button
                                type="button"
                                disabled={!allPhotosUploaded || isSubmitting}
                                onClick={() => handleSubmitReturn(req)}
                                className={cn(
                                  "inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-6 text-[14px] font-semibold transition-all",
                                  allPhotosUploaded && !isSubmitting
                                    ? "cursor-pointer border-2 border-black bg-[#C4F041] text-black shadow-[3px_3px_0px_#000000] hover:bg-black hover:text-[#C4F041]"
                                    : "cursor-not-allowed border border-black/14 bg-[#EAEAE6] text-black/45"
                                )}
                              >
                                {isSubmitting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                <span>
                                  {isSubmitting
                                    ? "Submitting..."
                                    : "Submit Return"}
                                </span>
                              </button>
                              <span className="text-[13px] font-medium text-[#5E5E5A] tabular-nums">
                                {allPhotosUploaded
                                  ? `${totalPhotosUploaded} of ${totalPhotosRequired} photos ready`
                                  : `${totalPhotosUploaded} of ${totalPhotosRequired} photos captured`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Collapsible / Expandable Item Return Cards */}
                      <div className="p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
                        {req.items.map((it, itemIdx) => {
                          const photos = getItemPhotos(req, it);
                          const uploadedCount = countReturnPhotos(req, it);
                          const itemReady = uploadedCount === 4;
                          const remaining = Math.max(
                            1,
                            it.issuedQuantity - it.returnedQuantity
                          );
                          const currentQty = qtyByItem[it.id] ?? remaining;
                          const currentCondition =
                            conditionByItem[it.id] ?? "GOOD";
                          const isExpanded = Boolean(expandedItems[it.id]);
                          const partImg =
                            it.item.imageUrl || getPartImageUrl(it.item.code);
                          const latestVerification =
                            it.borrowingRecords?.[0]?.returnVerifications?.[0];
                          const dueAt = it.borrowingRecords?.[0]?.dueAt;

                          return (
                            <div
                              key={it.id}
                              className={cn(
                                "overflow-hidden rounded-[20px] border transition-colors",
                                isExpanded
                                  ? "border-black/25 bg-white shadow-xs"
                                  : "border-black/12 bg-[#FAFAF8] hover:border-black/25"
                              )}
                            >
                              {/* Accordion Toggle Header — Generous Touch Target */}
                              <button
                                type="button"
                                onClick={() => toggleItemExpanded(it.id)}
                                aria-expanded={isExpanded}
                                className="flex w-full min-h-[76px] cursor-pointer items-center gap-3 p-3.5 sm:p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
                              >
                                {/* Real WebP Hardware Photo */}
                                <div className="relative h-14 w-16 sm:h-16 sm:w-20 shrink-0 overflow-hidden rounded-[14px] border border-black/12 bg-white">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={partImg}
                                    alt={it.item.name}
                                    className="h-full w-full object-cover"
                                  />
                                  {itemReady && (
                                    <span className="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-[#C4F041] text-black">
                                      <Check className="h-3 w-3 stroke-[2.75]" />
                                    </span>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-[15px] sm:text-[16px] font-semibold leading-snug tracking-[-0.01em] text-black break-words">
                                      {it.item.name}
                                    </h3>
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-[#5E5E5A]">
                                    <span className="font-mono tabular-nums">
                                      {it.item.code}
                                    </span>
                                    <span>·</span>
                                    <span className="tabular-nums">
                                      Issued {it.issuedQuantity} {it.item.unit}
                                    </span>
                                    {dueAt && !awaitingCheck && (
                                      <>
                                        <span className="hidden sm:inline">·</span>
                                        <span className="hidden sm:inline">
                                          Due {formatDate(dueAt)}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1.5 text-[13px] font-semibold tabular-nums",
                                        itemReady
                                          ? "text-[#3E6B48]"
                                          : "text-[#8C5811]"
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "h-2 w-2 rounded-full",
                                          itemReady
                                            ? "bg-[#3E6B48]"
                                            : "bg-[#F3BD77] ring-1 ring-[#8C5811]"
                                        )}
                                      />
                                      {itemReady
                                        ? "4 of 4 photos ready"
                                        : `${uploadedCount} of 4 photos`}
                                    </span>

                                    {!awaitingCheck && !isExpanded && (
                                      <span className="text-[13px] text-[#5E5E5A] tabular-nums">
                                        · Returning {currentQty} ·{" "}
                                        {
                                          CONDITION_OPTIONS.find(
                                            (c) => c.value === currentCondition
                                          )?.label
                                        }
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <span
                                  className={cn(
                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/12 bg-white text-black transition-transform duration-200",
                                    isExpanded && "rotate-180 bg-[#F2F2EF]"
                                  )}
                                >
                                  <ChevronDown className="h-4.5 w-4.5" />
                                </span>
                              </button>

                              {/* Expanded Item Return Workbench */}
                              {isExpanded && (
                                <div className="border-t border-black/10 bg-white p-3.5 sm:p-5 space-y-5">
                                  {/* 4-Angle Return Proof Grid */}
                                  <ReturnPhotoProofGrid
                                    existingPhotos={photos}
                                    disabled={awaitingCheck}
                                    onUpload={(angle, file) =>
                                      handleUploadReturnPhoto(
                                        req.id,
                                        it.id,
                                        angle,
                                        file
                                      )
                                    }
                                  />

                                  {/* Submitted Remarks Readout when Awaiting Inspection */}
                                  {awaitingCheck ? (
                                    <div className="rounded-[18px] border border-black/10 bg-[#F7F7F5] p-4 space-y-1.5">
                                      <p className="text-[14px] font-semibold text-black">
                                        Submitted for Instructor Verification
                                      </p>
                                      <p className="text-[14px] text-[#5E5E5A]">
                                        {latestVerification?.studentComments
                                          ? `Your note: "${latestVerification.studentComments}"`
                                          : "Return photos are locked while your instructor physically inspects the equipment."}
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="space-y-4 rounded-[20px] border border-black/10 bg-[#F7F7F5] p-3.5 sm:p-5">
                                      {/* Quantity Stepper + Condition Selector */}
                                      <div className="grid gap-4 lg:grid-cols-12">
                                        {/* Thumb-friendly Quantity Stepper */}
                                        <div className="space-y-2 lg:col-span-5">
                                          <div className="flex items-center justify-between gap-2">
                                            <label
                                              htmlFor={`qty-${it.id}`}
                                              className="text-[14px] font-semibold text-black"
                                            >
                                              Return Quantity
                                            </label>
                                            <span className="text-[13px] text-[#5E5E5A] tabular-nums">
                                              Max {remaining} {it.item.unit}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              disabled={currentQty <= 1}
                                              onClick={() =>
                                                setQtyByItem((prev) => ({
                                                  ...prev,
                                                  [it.id]: Math.max(
                                                    1,
                                                    (prev[it.id] ?? remaining) -
                                                      1
                                                  ),
                                                }))
                                              }
                                              aria-label="Decrease return quantity"
                                              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/16 bg-white text-black transition-colors hover:border-black hover:bg-[#C4F041] disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                              <Minus className="h-4 w-4" />
                                            </button>

                                            <input
                                              id={`qty-${it.id}`}
                                              type="number"
                                              inputMode="numeric"
                                              min={1}
                                              max={remaining}
                                              value={currentQty}
                                              onChange={(e) =>
                                                setQtyByItem((prev) => ({
                                                  ...prev,
                                                  [it.id]: Math.max(
                                                    1,
                                                    Math.min(
                                                      remaining,
                                                      Number(e.target.value) ||
                                                        1
                                                    )
                                                  ),
                                                }))
                                              }
                                              className="h-11 min-w-0 flex-1 rounded-full border border-black/16 bg-white px-3 text-center text-[15px] font-semibold text-black tabular-nums focus:border-black focus:outline-none focus:ring-2 focus:ring-[#C4F041]"
                                            />

                                            <button
                                              type="button"
                                              disabled={currentQty >= remaining}
                                              onClick={() =>
                                                setQtyByItem((prev) => ({
                                                  ...prev,
                                                  [it.id]: Math.min(
                                                    remaining,
                                                    (prev[it.id] ?? remaining) +
                                                      1
                                                  ),
                                                }))
                                              }
                                              aria-label="Increase return quantity"
                                              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/16 bg-white text-black transition-colors hover:border-black hover:bg-[#C4F041] disabled:cursor-not-allowed disabled:opacity-35"
                                            >
                                              <Plus className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </div>

                                        {/* Tactile 44px+ Condition Pill Toggles */}
                                        <div className="space-y-2 lg:col-span-7">
                                          <span className="block text-[14px] font-semibold text-black">
                                            Equipment Condition
                                          </span>

                                          <div
                                            role="radiogroup"
                                            aria-label={`Condition for ${it.item.name}`}
                                            className="grid grid-cols-3 gap-2"
                                          >
                                            {CONDITION_OPTIONS.map((opt) => {
                                              const selected =
                                                currentCondition === opt.value;
                                              const Icon = opt.icon;
                                              return (
                                                <button
                                                  key={opt.value}
                                                  type="button"
                                                  role="radio"
                                                  aria-checked={selected}
                                                  onClick={() =>
                                                    setConditionByItem(
                                                      (prev) => ({
                                                        ...prev,
                                                        [it.id]: opt.value,
                                                      })
                                                    )
                                                  }
                                                  className={cn(
                                                    "flex min-h-[52px] sm:min-h-[44px] cursor-pointer flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-[16px] sm:rounded-full border px-2 py-2 sm:px-3 text-[14px] transition-all",
                                                    selected
                                                      ? opt.activeClass
                                                      : "border-black/14 bg-white font-medium text-black/80 hover:border-black/40"
                                                  )}
                                                >
                                                  <Icon className="h-4 w-4 shrink-0" />
                                                  <span>{opt.label}</span>
                                                </button>
                                              );
                                            })}
                                          </div>

                                          <p className="text-[13px] text-[#5E5E5A]">
                                            {
                                              CONDITION_OPTIONS.find(
                                                (o) =>
                                                  o.value === currentCondition
                                              )?.helper
                                            }
                                          </p>
                                        </div>
                                      </div>

                                      {/* Full-Width Optional Return Remarks */}
                                      <div className="space-y-2">
                                        <label
                                          htmlFor={`notes-${it.id}`}
                                          className="block text-[14px] font-semibold text-black"
                                        >
                                          Return Remarks{" "}
                                          <span className="font-normal text-[#5E5E5A]">
                                            {currentCondition === "GOOD"
                                              ? "(optional)"
                                              : "(recommended for damaged/missing)"}
                                          </span>
                                        </label>
                                        <textarea
                                          id={`notes-${it.id}`}
                                          rows={3}
                                          value={notesByItem[it.id] ?? ""}
                                          onChange={(e) =>
                                            setNotesByItem((prev) => ({
                                              ...prev,
                                              [it.id]: e.target.value,
                                            }))
                                          }
                                          placeholder={
                                            currentCondition === "GOOD"
                                              ? "Note accessories returned, calibration status, or general wear..."
                                              : "Describe any physical damage, fault, or missing accessory for your instructor..."
                                          }
                                          className="min-h-[88px] w-full rounded-[16px] border border-black/16 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-black placeholder:text-black/40 focus:border-black focus:outline-none focus:ring-2 focus:ring-[#C4F041]"
                                        />
                                      </div>

                                      {/* Multi-Item Quick Step Forward on Mobile */}
                                      {totalItems > 1 &&
                                        itemReady &&
                                        itemIdx < totalItems - 1 && (
                                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-black/12 bg-[#F3FBD4] px-3.5 py-2.5">
                                            <span className="text-[14px] font-medium text-black">
                                              Part {itemIdx + 1} photos ready!
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openNextItem(req, it.id)
                                              }
                                              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full bg-black px-3.5 text-[13px] font-semibold text-white hover:bg-black/85"
                                            >
                                              <span>Next part</span>
                                              <ArrowRight className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Card Footer — Full-Width Lime/Black Submit CTA on Mobile */}
                      {!awaitingCheck && (
                        <div className="border-t border-black/10 bg-[#F7F7F5] p-4 sm:px-6 sm:py-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                  allPhotosUploaded
                                    ? "border-black bg-[#C4F041] text-black"
                                    : "border-black/14 bg-white text-[#8C5811]"
                                )}
                              >
                                {allPhotosUploaded ? (
                                  <Check className="h-4 w-4 stroke-[2.5]" />
                                ) : (
                                  <Camera className="h-4 w-4" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[14px] font-semibold text-black tabular-nums">
                                  {allPhotosUploaded
                                    ? `${totalPhotosUploaded} of ${totalPhotosRequired} photos ready`
                                    : `${totalPhotosUploaded} of ${totalPhotosRequired} photos captured`}
                                </p>
                                <p className="text-[13px] text-[#5E5E5A]">
                                  {allPhotosUploaded
                                    ? "Ready to submit for physical instructor verification."
                                    : "Capture all 4 angles for each part to unlock submission."}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!allPhotosUploaded || isSubmitting}
                              onClick={() => handleSubmitReturn(req)}
                              className={cn(
                                "inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-all",
                                allPhotosUploaded && !isSubmitting
                                  ? "cursor-pointer border-2 border-black bg-[#C4F041] text-black shadow-[3px_3px_0px_#000000] hover:bg-black hover:text-[#C4F041] active:translate-y-[1px]"
                                  : "cursor-not-allowed border border-black/14 bg-[#E6E6E2] text-black/45"
                              )}
                            >
                              {isSubmitting ? (
                                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                              ) : (
                                <Send className="h-4.5 w-4.5" />
                              )}
                              <span>
                                {isSubmitting
                                  ? "Submitting Return..."
                                  : "Submit Return"}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DottedGridCanvas>
    </div>
  );
}
