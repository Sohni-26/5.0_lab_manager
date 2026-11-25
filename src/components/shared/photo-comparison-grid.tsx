"use client";

import React, { useState } from "react";
import { Camera, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PHOTO_ANGLE_META } from "@/lib/utils";
import {
  REQUIRED_PHOTO_ANGLES,
  type ItemPhotoDTO,
  type PhotoAngle,
} from "@/types/contracts";

interface PhotoComparisonGridProps {
  photos: ItemPhotoDTO[];
  itemName?: string;
}

export function PhotoComparisonGrid({
  photos,
  itemName,
}: PhotoComparisonGridProps) {
  const [zoomPhoto, setZoomPhoto] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const getPhoto = (phase: "COLLECTION" | "RETURN", angle: PhotoAngle) =>
    photos.find((p) => p.phase === phase && p.angle === angle);

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {REQUIRED_PHOTO_ANGLES.map((angle) => {
          const collection = getPhoto("COLLECTION", angle);
          const returned = getPhoto("RETURN", angle);
          const meta = PHOTO_ANGLE_META[angle];

          return (
            <div
              key={angle}
              className="rounded-[20px] border border-black/12 bg-[#F5F5F3] p-3.5"
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-black">
                  {meta.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant={collection ? "secondary" : "outline"} className="text-[10px]">
                    Collection {collection ? "✓" : "—"}
                  </Badge>
                  <Badge variant={returned ? "info" : "outline"} className="text-[10px]">
                    Return {returned ? "✓" : "—"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "At Collection (Before)", photo: collection },
                  { label: "At Return (After)", photo: returned },
                ].map(({ label, photo }) => (
                  <div
                    key={label}
                    className="overflow-hidden rounded-xl border border-black/12 bg-white"
                  >
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-black/10 bg-[#F5F5F3]">
                      <span className="text-[11px] font-medium text-black/55">
                        {label}
                      </span>
                      {photo && (
                        <button
                          type="button"
                          onClick={() =>
                            setZoomPhoto({
                              url: photo.url,
                              title: `${itemName ?? "Equipment"} · ${meta.label} (${label})`,
                            })
                          }
                          className="text-black/55 hover:text-black cursor-pointer"
                          title="Inspect full size"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="aspect-[16/10] bg-[#F0F0F0] flex items-center justify-center overflow-hidden">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo.url}
                          alt={label}
                          onClick={() =>
                            setZoomPhoto({
                              url: photo.url,
                              title: `${itemName ?? "Equipment"} · ${meta.label} (${label})`,
                            })
                          }
                          className="h-full w-full object-cover cursor-zoom-in"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-black/40 text-xs gap-1">
                          <Camera className="h-5 w-5" />
                          <span>Not uploaded</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={Boolean(zoomPhoto)} onOpenChange={(o) => !o && setZoomPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{zoomPhoto?.title}</DialogTitle>
          </DialogHeader>
          {zoomPhoto && (
            <div className="overflow-hidden rounded-[20px] border border-black/12 bg-[#F0F0F0]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomPhoto.url}
                alt={zoomPhoto.title}
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
