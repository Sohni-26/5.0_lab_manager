"use client";

import React, { useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PHOTO_ANGLE_META } from "@/lib/utils";
import {
  REQUIRED_PHOTO_ANGLES,
  type ItemPhotoDTO,
  type PhotoAngle,
  type PhotoPhase,
} from "@/types/contracts";

interface PhotoUploaderGridProps {
  phase: PhotoPhase;
  existingPhotos: ItemPhotoDTO[];
  disabled?: boolean;
  onUpload: (angle: PhotoAngle, file: File) => Promise<void>;
}

export function PhotoUploaderGrid({
  phase,
  existingPhotos,
  disabled = false,
  onUpload,
}: PhotoUploaderGridProps) {
  const [uploadingAngle, setUploadingAngle] = useState<PhotoAngle | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const phasePhotos = existingPhotos.filter((p) => p.phase === phase);
  const photoByAngle = new Map<PhotoAngle, ItemPhotoDTO>();
  phasePhotos.forEach((p) => photoByAngle.set(p.angle, p));

  const uploadedCount = REQUIRED_PHOTO_ANGLES.filter((a) =>
    photoByAngle.has(a)
  ).length;

  const handleFileChange = async (
    angle: PhotoAngle,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG, PNG, WEBP)");
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[#F26943]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[#222321]">
            {phase === "COLLECTION"
              ? "Mandatory 4-Angle Collection Evidence"
              : "Mandatory 4-Angle Return Evidence"}
          </span>
        </div>
        <Badge variant={uploadedCount === 4 ? "success" : "warning"}>
          {uploadedCount}/4 Uploaded
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REQUIRED_PHOTO_ANGLES.map((angle) => {
          const photo = photoByAngle.get(angle);
          const meta = PHOTO_ANGLE_META[angle];
          const isUploading = uploadingAngle === angle;

          return (
            <div
              key={angle}
              className="group relative overflow-hidden rounded-2xl border border-[#E6E5E0] bg-[#FAF9F6] flex flex-col"
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

              <div className="relative aspect-[4/3] w-full bg-[#EAE9E4]/60 flex items-center justify-center overflow-hidden">
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`${meta.label} ${phase}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#288568] text-white shadow-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#E6E5E0] text-[#72736E] mb-2">
                      {isUploading ? (
                        <Loader2 className="h-4.5 w-4.5 animate-spin text-[#F26943]" />
                      ) : (
                        <Upload className="h-4.5 w-4.5" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#72736E] leading-snug">
                      {meta.hint}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 p-2.5 bg-white border-t border-[#EFECE6]">
                <span className="text-xs font-semibold text-[#222321] truncate">
                  {meta.shortLabel}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => inputRefs.current[angle]?.click()}
                    className="rounded-lg bg-[#FFF0E9] px-2.5 py-1 text-[11px] font-semibold text-[#DA5835] hover:bg-[#FFE3D5] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? "Saving..." : photo ? "Replace" : "Upload"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
