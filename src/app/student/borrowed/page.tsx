"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Expand,
  Loader2,
  Lock,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { DottedGridCanvas } from "@/components/dashboard/spatial-canvas";
import { LoopsiiButton } from "@/components/landing/primitives";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { getPartImageUrl } from "@/lib/part-images";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  REQUIRED_PHOTO_ANGLES,
  type ItemPhotoDTO,
  type LabRequestDTO,
  type LabRequestItemDTO,
  type PhotoAngle,
} from "@/types/contracts";

type BorrowedFilter = "ALL" | "PICKUP" | "BORROWED";

const ANGLE_CONFIG: Record<
  PhotoAngle,
  { title: string; fullTitle: string; hint: string }
> = {
  FRONT_TOP: {
    title: "Front",
    fullTitle: "Front / Top",
    hint: "Top face & ports",
  },
  BACK_BOTTOM: {
    title: "Back",
    fullTitle: "Back / Bottom",
    hint: "Serial & underside",
  },
  LEFT_SIDE: {
    title: "Left",
    fullTitle: "Left Side",
    hint: "Left edge & pins",
  },
  RIGHT_SIDE: {
    title: "Right",
    fullTitle: "Right Side",
    hint: "Right edge & casing",
  },
};

function getCollectionPhotoMap(
  req: LabRequestDTO,
  item: LabRequestItemDTO
): Map<PhotoAngle, ItemPhotoDTO> {
  const map = new Map<PhotoAngle, ItemPhotoDTO>();
  // Request-level photos first, then item-level photos so local optimistic uploads win
  const merged = [
    ...(req.photos ?? []).filter((p) => p.requestItemId === item.id),
    ...(item.photos ?? []),
  ];
  merged
    .filter((p) => p.phase === "COLLECTION")
    .forEach((p) => {
      map.set(p.angle, p);
    });
  return map;
}

function countCapturedPhotos(
  req: LabRequestDTO,
  item: LabRequestItemDTO
): number {
  const map = getCollectionPhotoMap(req, item);
  return REQUIRED_PHOTO_ANGLES.filter((angle) => map.has(angle)).length;
}

interface CollectionPhotoGridProps {
  itemName: string;
  photoByAngle: Map<PhotoAngle, ItemPhotoDTO>;
  disabled: boolean;
  onUpload: (angle: PhotoAngle, file: File) => Promise<void>;
  onPreview: (preview: {
    url: string;
    angleLabel: string;
    itemName: string;
    angle: PhotoAngle;
    canRetake: boolean;
    triggerRetake: () => void;
  }) => void;
}

function CollectionPhotoGrid({
  itemName,
  photoByAngle,
  disabled,
  onUpload,
  onPreview,
}: CollectionPhotoGridProps) {
  const [uploadingAngle, setUploadingAngle] = useState<PhotoAngle | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const capturedCount = REQUIRED_PHOTO_ANGLES.filter((a) =>
    photoByAngle.has(a)
  ).length;
  const isComplete = capturedCount === REQUIRED_PHOTO_ANGLES.length;

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
      toast.success(`${ANGLE_CONFIG[angle].fullTitle} photo saved`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload photo"
      );
    } finally {
      setUploadingAngle(null);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Completion Counter + Visual 4-Step Progress Bar */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[14px] font-medium text-black">
            {disabled ? (
              <Lock className="h-4 w-4 text-black/60 shrink-0" />
            ) : (
              <Camera className="h-4 w-4 text-black shrink-0" />
            )}
            <span>
              {disabled
                ? "Locked Handover Evidence"
                : "4-Angle Collection Photos"}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold tabular-nums ${
              isComplete
                ? "bg-[#C4F041] text-black border border-black/15"
                : "bg-[#F5F5F3] text-black border border-black/12"
            }`}
          >
            {isComplete && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
            {capturedCount} of 4 photos captured
          </span>
        </div>

        <div
          className="grid grid-cols-4 gap-1.5"
          role="progressbar"
          aria-valuenow={capturedCount}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label={`${capturedCount} of 4 collection photos captured`}
        >
          {REQUIRED_PHOTO_ANGLES.map((angle) => {
            const hasPhoto = photoByAngle.has(angle);
            return (
              <div
                key={angle}
                className={`h-2 rounded-full transition-colors duration-300 ${
                  hasPhoto
                    ? "bg-[#C4F041] border border-black/15"
                    : "bg-black/[0.08]"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 2x2 Mobile / 4-Column Desktop Capture Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REQUIRED_PHOTO_ANGLES.map((angle) => {
          const photo = photoByAngle.get(angle);
          const meta = ANGLE_CONFIG[angle];
          const isUploading = uploadingAngle === angle;

          const openPicker = () => {
            if (disabled || isUploading) return;
            inputRefs.current[angle]?.click();
          };

          return (
            <div
              key={angle}
              className={`group flex flex-col overflow-hidden rounded-[20px] border transition-colors ${
                photo
                  ? "border-black/20 bg-white"
                  : disabled
                  ? "border-black/12 bg-[#F7F7F5]"
                  : "border-dashed border-black/25 bg-[#F7F7F5] hover:border-black/45"
              }`}
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

              {/* Photo / Direct Tap Capture Area */}
              <div className="relative aspect-[4/3] w-full bg-[#ECECE8] overflow-hidden">
                {photo ? (
                  <button
                    type="button"
                    onClick={() =>
                      onPreview({
                        url: photo.url,
                        angleLabel: meta.fullTitle,
                        itemName,
                        angle,
                        canRetake: !disabled,
                        triggerRetake: openPicker,
                      })
                    }
                    className="relative block h-full w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
                    aria-label={`Inspect ${meta.fullTitle} photo of ${itemName}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`${meta.fullTitle} collection photo of ${itemName}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-black/15 bg-[#C4F041] text-black shadow-xs">
                      <CheckCircle2 className="h-4 w-4 stroke-[2.4]" />
                    </span>
                    <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <Expand className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled || isUploading}
                    onClick={openPicker}
                    className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-3 text-center transition-colors hover:bg-black/[0.03] disabled:cursor-default cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
                    aria-label={`Upload ${meta.fullTitle} photo for ${itemName}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-black/14 bg-white text-black shadow-xs">
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-black" />
                      ) : (
                        <Camera className="h-5 w-5 text-black/75" />
                      )}
                    </span>
                    <span className="text-[13px] text-black/60 leading-tight line-clamp-2">
                      {isUploading ? "Uploading..." : meta.hint}
                    </span>
                  </button>
                )}
              </div>

              {/* Thumb-Friendly Angle Footer */}
              <div className="flex flex-col gap-2 border-t border-black/10 bg-white p-2.5 sm:p-3">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[14px] font-semibold text-black truncate">
                    {meta.title}
                  </span>
                  <span className="text-[13px] text-black/50 truncate">
                    {photo ? "Done" : disabled ? "Locked" : "Required"}
                  </span>
                </div>

                {!disabled ? (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={openPicker}
                    className={`flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border px-3 text-[14px] font-medium transition-colors cursor-pointer disabled:opacity-55 ${
                      photo
                        ? "border-black/15 bg-[#F5F5F3] text-black hover:bg-[#C4F041] hover:border-black/25"
                        : "border-black/15 bg-[#C4F041] text-black hover:bg-[#B8E635]"
                    }`}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span>Saving...</span>
                      </>
                    ) : photo ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                        <span>Retake</span>
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 shrink-0" />
                        <span>Add Photo</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex min-h-[36px] items-center gap-1.5 text-[13px] text-black/55">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Immutable proof</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StudentBorrowedCollectionPage() {
  const { isDemoMode } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BorrowedFilter>("ALL");
  const [lightbox, setLightbox] = useState<{
    url: string;
    angleLabel: string;
    itemName: string;
    angle: PhotoAngle;
    canRetake: boolean;
    triggerRetake: () => void;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({ pageSize: 60 });
      setRequests(
        res.data.filter(
          (r) =>
            r.status === "APPROVED" ||
            r.status === "PARTIALLY_ISSUED" ||
            r.status === "ISSUED"
        )
      );
    } catch {
      setRequests(
        DEMO_REQUESTS.filter(
          (r) =>
            r.status === "APPROVED" ||
            r.status === "PARTIALLY_ISSUED" ||
            r.status === "ISSUED"
        )
      );
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
    eventTypes: ["request.status_changed", "borrowing.issued"],
    onEvent: () => load(),
  });

  const handleUploadCollectionPhoto = async (
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
      await apiClient.requests.uploadCollectionPhoto(requestId, fd);
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
                  (p) => !(p.phase === "COLLECTION" && p.angle === angle)
                );
                return {
                  ...it,
                  photos: [
                    ...others,
                    {
                      id: `local-${Date.now()}`,
                      requestId,
                      requestItemId,
                      borrowingRecordId: null,
                      uploadedById: "demo",
                      angle,
                      phase: "COLLECTION",
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

  // Sort pickup-ready requests first so students at the lab counter see photo tasks immediately
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aScore = a.status === "ISSUED" ? 1 : 0;
      const bScore = b.status === "ISSUED" ? 1 : 0;
      if (aScore !== bScore) return aScore - bScore;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [requests]);

  const metrics = useMemo(() => {
    const readyForPickup = sortedRequests.filter(
      (r) => r.status === "APPROVED" || r.status === "PARTIALLY_ISSUED"
    ).length;
    const currentlyBorrowed = sortedRequests.filter(
      (r) => r.status === "ISSUED"
    ).length;
    const totalUnits = sortedRequests.reduce(
      (sum, req) =>
        sum +
        req.items.reduce(
          (itemSum, it) =>
            itemSum +
            (req.status === "ISSUED"
              ? it.issuedQuantity || it.approvedQuantity || it.requestedQuantity
              : it.approvedQuantity || it.requestedQuantity),
          0
        ),
      0
    );
    return { readyForPickup, currentlyBorrowed, totalUnits };
  }, [sortedRequests]);

  const visibleRequests = useMemo(() => {
    if (filter === "PICKUP") {
      return sortedRequests.filter(
        (r) => r.status === "APPROVED" || r.status === "PARTIALLY_ISSUED"
      );
    }
    if (filter === "BORROWED") {
      return sortedRequests.filter((r) => r.status === "ISSUED");
    }
    return sortedRequests;
  }, [sortedRequests, filter]);

  return (
    <div
      className="space-y-4 min-w-0"
      style={{
        fontFamily:
          "var(--font-saans), var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Clean Editorial Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] sm:text-[28px] font-medium leading-tight tracking-[-0.03em] text-black">
            Borrowed &amp; Pickup
          </h1>
          <p className="mt-1 text-[14px] sm:text-[15px] text-[#5E5E5A] leading-relaxed">
            Capture 4-angle collection photos at the lab counter for approved
            parts, and track equipment currently issued to you.
          </p>
        </div>

        <div className="w-full sm:w-auto shrink-0">
          <Link
            href="/student/returns"
            className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 text-[14px] font-medium text-black transition-colors hover:bg-[#C4F041] hover:border-black/25"
          >
            <span>Return Portal</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>

      {/* Cohesive NxtWave Light Dotted-Grid Surface (native mobile scroll) */}
      <DottedGridCanvas
        pannable={false}
        className="flex flex-col p-3.5 sm:p-6 lg:p-7"
      >
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-[24px] border border-black/14 bg-white p-4 sm:p-5">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="lp-shimmer h-3.5 w-20 rounded-md" />
                  <div className="lp-shimmer h-7 w-12 rounded-md" />
                </div>
              ))}
            </div>
            <div className="rounded-[24px] border border-black/14 bg-white p-5 sm:p-6 space-y-5">
              <div className="space-y-2">
                <div className="lp-shimmer h-5 w-44 rounded-md" />
                <div className="lp-shimmer h-4 w-72 max-w-full rounded-md" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="lp-shimmer aspect-[4/3] w-full rounded-[18px]"
                  />
                ))}
              </div>
            </div>
          </div>
        ) : sortedRequests.length === 0 ? (
          /* Empty State matching Student Dashboard prompt card aesthetic */
          <div className="m-auto w-full max-w-[460px] rounded-[24px] border border-black/14 bg-white p-7 sm:p-10 text-center shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-black/12 bg-[#F5F5F3] text-black">
              <Camera className="h-6 w-6" />
            </div>
            <h2 className="text-[24px] sm:text-[28px] font-medium leading-[1.12] tracking-[-0.03em] text-black">
              No approved or borrowed items yet
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5E5E5A]">
              Once your Instructor and Campus Lab Manager approve a request, it
              will appear here for 4-angle collection photo capture and
              handover.
            </p>
            <div className="mt-7 flex justify-center">
              <LoopsiiButton
                label="Browse Inventory"
                href="/student/inventory"
                size="md"
                hideArrow
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Clean Mobile Summary Metrics Bar */}
            <div className="rounded-[24px] border border-black/14 bg-white shadow-[0_12px_32px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-black/10">
                <div className="p-3.5 sm:p-5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {metrics.readyForPickup > 0 && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#C4F041] border border-black/25"
                        aria-hidden="true"
                      />
                    )}
                    <p className="text-[13px] sm:text-[14px] font-medium text-[#5E5E5A] truncate">
                      Ready for Pickup
                    </p>
                  </div>
                  <p className="mt-1 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
                    {metrics.readyForPickup}
                  </p>
                </div>

                <div className="p-3.5 sm:p-5 min-w-0">
                  <p className="text-[13px] sm:text-[14px] font-medium text-[#5E5E5A] truncate">
                    Borrowed
                  </p>
                  <p className="mt-1 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
                    {metrics.currentlyBorrowed}
                  </p>
                </div>

                <div className="p-3.5 sm:p-5 min-w-0">
                  <p className="text-[13px] sm:text-[14px] font-medium text-[#5E5E5A] truncate">
                    Total Units
                  </p>
                  <p className="mt-1 text-[24px] sm:text-[28px] font-semibold tracking-[-0.03em] text-black tabular-nums leading-none">
                    {metrics.totalUnits}
                  </p>
                </div>
              </div>
            </div>

            {/* Touch-Friendly Filter Tabs */}
            {metrics.readyForPickup > 0 && metrics.currentlyBorrowed > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    {
                      key: "ALL",
                      label: "All",
                      count: sortedRequests.length,
                    },
                    {
                      key: "PICKUP",
                      label: "Ready for Pickup",
                      count: metrics.readyForPickup,
                    },
                    {
                      key: "BORROWED",
                      label: "Currently Borrowed",
                      count: metrics.currentlyBorrowed,
                    },
                  ] as Array<{
                    key: BorrowedFilter;
                    label: string;
                    count: number;
                  }>
                ).map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilter(tab.key)}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-[14px] font-medium transition-colors cursor-pointer ${
                        active
                          ? "border-black bg-black text-white shadow-[2px_2px_0px_rgba(0,0,0,0.16)]"
                          : "border-black/14 bg-white text-black hover:border-black/35"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`tabular-nums ${
                          active ? "text-[#C4F041]" : "text-black/45"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Borrowed / Pickup Request Cards */}
            <div className="space-y-5">
              {visibleRequests.map((req) => {
                const isIssued = req.status === "ISSUED";
                const isPartiallyIssued = req.status === "PARTIALLY_ISSUED";
                const allItemsPhotographed =
                  req.items.length > 0 &&
                  req.items.every(
                    (it) =>
                      countCapturedPhotos(req, it) ===
                      REQUIRED_PHOTO_ANGLES.length
                  );

                return (
                  <article
                    key={req.id}
                    className="overflow-hidden rounded-[24px] border border-black/14 bg-white shadow-[0_14px_38px_rgba(0,0,0,0.05)]"
                  >
                    {/* Request Card Header */}
                    <div className="border-b border-black/10 bg-[#F7F7F5] p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="font-mono text-[15px] sm:text-[16px] font-semibold text-black tabular-nums">
                              {req.requestCode}
                            </h2>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${
                                isIssued
                                  ? "border-black/12 bg-[#DCEAD9] text-black"
                                  : "border-black/15 bg-[#C4F041] text-black"
                              }`}
                            >
                              {isIssued ? (
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <Clock className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {isIssued
                                ? "Currently Borrowed"
                                : isPartiallyIssued
                                ? "Partially Issued"
                                : "Ready for Pickup"}
                            </span>
                          </div>

                          {req.purpose && (
                            <p className="text-[15px] font-medium text-black leading-snug break-words">
                              {req.purpose}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-[#5E5E5A]">
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-4 w-4 text-black/50 shrink-0" />
                              <span>
                                Instructor:{" "}
                                <strong className="font-semibold text-black">
                                  {req.instructor.fullName}
                                </strong>
                              </span>
                            </span>
                          </div>

                          {/* Clear Next-Step Guidance Banner */}
                          <p
                            className={`mt-2 rounded-[16px] border px-3.5 py-2.5 text-[14px] leading-relaxed ${
                              isIssued
                                ? "border-black/10 bg-white text-black/70"
                                : allItemsPhotographed
                                ? "border-black/15 bg-[#C4F041]/35 text-black font-medium"
                                : "border-black/10 bg-white text-black/75"
                            }`}
                          >
                            {isIssued
                              ? "Handover complete. Original collection photos are locked as immutable condition evidence."
                              : allItemsPhotographed
                              ? "All 4 collection angles captured! Show this screen to your Instructor at the lab counter to receive your items."
                              : "Stock reserved for you. Capture all 4 angle photos per component below, then meet your Instructor for handover."}
                          </p>
                        </div>

                        {isIssued && (
                          <div className="w-full sm:w-auto shrink-0">
                            <Link
                              href="/student/returns"
                              className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-black px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#C4F041] hover:text-black"
                            >
                              <span>Go to Return Portal</span>
                              <ArrowRight className="h-4 w-4 shrink-0" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Component Items & 4-Angle Photo Capture Sections */}
                    <div className="divide-y divide-black/10">
                      {req.items.map((it) => {
                        const photoByAngle = getCollectionPhotoMap(req, it);
                        const partImgSrc =
                          it.item.imageUrl || getPartImageUrl(it.item.code);
                        const qty = isIssued
                          ? it.issuedQuantity ||
                            it.approvedQuantity ||
                            it.requestedQuantity
                          : it.approvedQuantity || it.requestedQuantity;
                        const activeBorrow = it.borrowingRecords?.[0];

                        return (
                          <div
                            key={it.id}
                            className="p-4 sm:p-6 space-y-5"
                          >
                            {/* Real WebP Hardware Photo + Component Identity */}
                            <div className="flex items-start gap-3.5 sm:gap-4">
                              <div className="relative h-20 w-24 sm:h-24 sm:w-32 shrink-0 overflow-hidden rounded-[16px] border border-black/12 bg-[#ECECE8]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={partImgSrc}
                                  alt={it.item.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <h3 className="text-[16px] sm:text-[18px] font-semibold tracking-[-0.02em] text-black leading-snug break-words">
                                    {it.item.name}
                                  </h3>

                                  {isIssued && (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-[#DCEAD9] px-3 py-1 text-[13px] font-medium text-black shrink-0">
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                      Handover Confirmed
                                    </span>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[14px] text-[#5E5E5A] tabular-nums">
                                  <span className="font-mono text-[13px] text-black/75">
                                    {it.item.code}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-medium text-black">
                                    {qty} {it.item.unit}
                                  </span>
                                  {isIssued && activeBorrow?.issuedAt && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>
                                        Issued{" "}
                                        {formatDateTime(activeBorrow.issuedAt)}
                                      </span>
                                    </>
                                  )}
                                  {isIssued && activeBorrow?.dueAt && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>
                                        Due {formatDate(activeBorrow.dueAt)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Mobile-First 4-Angle Collection Photo Proof Grid */}
                            <CollectionPhotoGrid
                              itemName={it.item.name}
                              photoByAngle={photoByAngle}
                              disabled={isIssued}
                              onUpload={(angle, file) =>
                                handleUploadCollectionPhoto(
                                  req.id,
                                  it.id,
                                  angle,
                                  file
                                )
                              }
                              onPreview={setLightbox}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </DottedGridCanvas>

      {/* Full-Screen Photo Inspection Lightbox (thumb-friendly for mobile review) */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightbox.angleLabel} photo preview`}
          onClick={() => setLightbox(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[24px] border border-black/20 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-black truncate">
                  {lightbox.angleLabel}
                </p>
                <p className="text-[13px] text-[#5E5E5A] truncate">
                  {lightbox.itemName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close photo preview"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/12 bg-[#F5F5F3] text-black hover:bg-[#C4F041] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-[#121210] flex items-center justify-center max-h-[65vh] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.url}
                alt={`${lightbox.angleLabel} photo of ${lightbox.itemName}`}
                className="max-h-[65vh] w-full object-contain"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 border-t border-black/10 bg-white p-4">
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center rounded-full border border-black/15 bg-[#F5F5F3] px-5 text-[14px] font-medium text-black hover:bg-black/10 cursor-pointer"
              >
                Close
              </button>
              {lightbox.canRetake && (
                <button
                  type="button"
                  onClick={() => {
                    const retake = lightbox.triggerRetake;
                    setLightbox(null);
                    retake();
                  }}
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#C4F041] border border-black/15 px-5 text-[14px] font-semibold text-black hover:bg-[#B8E635] cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Retake Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
