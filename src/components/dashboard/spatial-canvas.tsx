"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasContextValue {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  resetSignal: number;
  zoom: number;
  markMoved: () => void;
  isMobileViewport: boolean;
}

const CanvasContext = createContext<CanvasContextValue>({
  canvasRef: { current: null },
  resetSignal: 0,
  zoom: 1,
  markMoved: () => {},
  isMobileViewport: false,
});

export function useDottedCanvas() {
  return useContext(CanvasContext);
}

interface DottedGridCanvasProps {
  className?: string;
  pannable?: boolean;
  children?: React.ReactNode;
}

const PAN_LIMIT_X = 340;
const PAN_LIMIT_Y = 300;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

function clampZoom(value: number): number {
  return Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value)) * 100) / 100;
}

/**
 * Pure finite dotted-grid canvas with Excalidraw-style freehand panning,
 * bounded drag-and-drop, and smooth zoom in / zoom out controls.
 */
export function DottedGridCanvas({
  className,
  pannable = true,
  children,
}: DottedGridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [itemsMoved, setItemsMoved] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const dragOriginRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Disable canvas drag-to-pan on narrow mobile screens (< 768px) so vertical page scroll works smoothly
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobileViewport(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const canPan = pannable && !isMobileViewport;

  // Support Ctrl/Cmd + mouse wheel or trackpad pinch-zoom inside the canvas
  useEffect(() => {
    if (!pannable) return;
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setZoom((prev) => clampZoom(prev + delta));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [pannable]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !canPan ||
        e.button !== 0 ||
        (e.pointerType === "touch" && window.innerWidth < 768)
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      // Only start freehand canvas panning when grabbing empty grid space
      if (
        target?.closest(
          "button, a, input, select, textarea, [data-canvas-draggable='true'], [data-canvas-controls='true']"
        )
      ) {
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      dragOriginRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: pan.x,
        originY: pan.y,
      };
      setIsPanning(true);
    },
    [canPan, pan.x, pan.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOriginRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;
      const limitX = Math.round(PAN_LIMIT_X * Math.max(1, zoom));
      const limitY = Math.round(PAN_LIMIT_Y * Math.max(1, zoom));
      const nextX = Math.max(
        -limitX,
        Math.min(limitX, origin.originX + (e.clientX - origin.startX))
      );
      const nextY = Math.max(
        -limitY,
        Math.min(limitY, origin.originY + (e.clientY - origin.startY))
      );
      setPan({ x: nextX, y: nextY });
    },
    [zoom]
  );

  const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragOriginRef.current = null;
    setIsPanning(false);
  }, []);

  const markMoved = useCallback(() => setItemsMoved(true), []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z - ZOOM_STEP));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const handleResetAll = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setItemsMoved(false);
    setResetSignal((n) => n + 1);
  }, []);

  const isOffset = pan.x !== 0 || pan.y !== 0 || zoom !== 1 || itemsMoved;
  const dotStep = Math.max(10, Math.round(20 * zoom));

  return (
    <CanvasContext.Provider
      value={{ canvasRef, resetSignal, zoom, markMoved, isMobileViewport }}
    >
      <div
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={cn(
          "relative w-full min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100vh-8.5rem)] rounded-[20px] sm:rounded-[28px] border border-black/14 shadow-card overflow-hidden",
          pannable && "touch-pan-y md:touch-auto",
          canPan && (isPanning ? "cursor-grabbing select-none" : "cursor-grab"),
          className
        )}
        style={{
          backgroundColor: "#F2F2EF",
          backgroundImage:
            "radial-gradient(rgba(0, 0, 0, 0.16) 1.15px, transparent 1.15px)",
          backgroundSize: `${dotStep}px ${dotStep}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className="relative flex flex-1 flex-col w-full h-full origin-top md:origin-center"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transition: isPanning
              ? "none"
              : "transform 0.35s cubic-bezier(0.76, 0, 0.24, 1)",
          }}
        >
          {children}
        </div>

        {/* Excalidraw-style Zoom Controls (bottom-left) */}
        {pannable && (
          <div
            data-canvas-controls="true"
            className="absolute bottom-3 left-3 sm:bottom-5 sm:left-5 z-30 inline-flex items-center rounded-full border border-black/15 bg-white/95 p-0.5 sm:p-1 text-black shadow-[0_6px_20px_rgba(0,0,0,0.08)] backdrop-blur-md"
          >
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              title="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:opacity-35 cursor-pointer"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset zoom to 100%"
              className="min-w-[44px] sm:min-w-[54px] px-1.5 sm:px-2 text-center text-[13px] sm:text-[14px] font-medium tabular-nums text-black transition-colors hover:text-black/65 cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              title="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0] disabled:opacity-35 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Reset View Button (bottom-right when panned, zoomed, or dragged) */}
        {pannable && isOffset && (
          <button
            type="button"
            data-canvas-controls="true"
            onClick={handleResetAll}
            className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5 z-30 inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-black/16 bg-white/95 px-3 py-1.5 sm:px-4 sm:py-2 text-[13px] sm:text-[14px] font-medium text-black shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#C4F041] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset view
          </button>
        )}
      </div>
    </CanvasContext.Provider>
  );
}
