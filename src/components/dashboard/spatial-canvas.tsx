"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CanvasContextValue {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  resetSignal: number;
  markMoved: () => void;
}

const CanvasContext = createContext<CanvasContextValue>({
  canvasRef: { current: null },
  resetSignal: 0,
  markMoved: () => {},
});

export function useDottedCanvas() {
  return useContext(CanvasContext);
}

interface DottedGridCanvasProps {
  className?: string;
  pannable?: boolean;
  children?: React.ReactNode;
}

const PAN_LIMIT_X = 280;
const PAN_LIMIT_Y = 260;

/**
 * Pure finite dotted-grid canvas with optional Excalidraw-style freehand panning
 * and bounded drag-and-drop for items placed inside it.
 */
export function DottedGridCanvas({
  className,
  pannable = false,
  children,
}: DottedGridCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [itemsMoved, setItemsMoved] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const dragOriginRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pannable || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      // Only start freehand canvas panning when grabbing empty grid space (not buttons/inputs/draggable items)
      if (
        target?.closest(
          "button, a, input, select, textarea, [data-canvas-draggable='true']"
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
    [pannable, pan.x, pan.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const origin = dragOriginRef.current;
      if (!origin || origin.pointerId !== e.pointerId) return;
      const nextX = Math.max(
        -PAN_LIMIT_X,
        Math.min(PAN_LIMIT_X, origin.originX + (e.clientX - origin.startX))
      );
      const nextY = Math.max(
        -PAN_LIMIT_Y,
        Math.min(PAN_LIMIT_Y, origin.originY + (e.clientY - origin.startY))
      );
      setPan({ x: nextX, y: nextY });
    },
    []
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

  const handleReset = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setItemsMoved(false);
    setResetSignal((n) => n + 1);
  }, []);

  const isOffset = pan.x !== 0 || pan.y !== 0 || itemsMoved;

  return (
    <CanvasContext.Provider value={{ canvasRef, resetSignal, markMoved }}>
      <div
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={cn(
          "relative w-full min-h-[calc(100vh-8.5rem)] rounded-[28px] border border-black/14 shadow-card overflow-hidden",
          pannable && (isPanning ? "cursor-grabbing select-none" : "cursor-grab"),
          className
        )}
        style={{
          backgroundColor: "#F2F2EF",
          backgroundImage:
            "radial-gradient(rgba(0, 0, 0, 0.16) 1.15px, transparent 1.15px)",
          backgroundSize: "20px 20px",
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className="relative flex flex-1 flex-col w-full h-full"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
            transition: isPanning
              ? "none"
              : "transform 0.45s cubic-bezier(0.76, 0, 0.24, 1)",
          }}
        >
          {children}
        </div>

        {/* Clean Reset View button only when canvas or cards have been dragged */}
        {pannable && isOffset && (
          <button
            type="button"
            onClick={handleReset}
            className="absolute bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-black/16 bg-white/95 px-4 py-2 text-[14px] font-medium text-black shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-colors hover:bg-[#C4F041] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset view
          </button>
        )}
      </div>
    </CanvasContext.Provider>
  );
}
