"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoopsiiMark } from "./primitives";

export function LoaderOverlay({ onComplete }: { onComplete?: () => void }) {
  const [percent, setPercent] = useState(0);
  const [phase, setPhase] = useState<"drawing" | "counting" | "exit" | "done">("drawing");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const startTimer = setTimeout(() => setPhase("counting"), 260);

    let frameId = 0;
    const startTime = performance.now() + 220;
    const duration = 1250;

    const tick = (now: number) => {
      const elapsed = Math.max(0, now - startTime);
      const t = Math.min(1, elapsed / duration);
      // Smooth ease-out-quart progression
      const eased = 1 - Math.pow(1 - t, 3);
      const nextVal = Math.round(eased * 100);
      setPercent(nextVal);
      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setPhase("exit");
          document.body.style.overflow = "";
          onComplete?.();
        }, 180);
        setTimeout(() => {
          setPhase("done");
        }, 1050);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(frameId);
      document.body.style.overflow = "";
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="loopsii-loader"
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-auto"
          initial={{ opacity: 1 }}
          animate={
            phase === "exit"
              ? { y: "-100%", transition: { duration: 0.85, ease: [0.84, 0, 0.16, 1] } }
              : { y: "0%" }
          }
          exit={{ opacity: 0 }}
        >
          {/* Full-screen signature Lime sheet */}
          <div className="absolute inset-0 bg-[#C4F041]" />

          {/* Centered architectural square box with extending crosshair hairlines & flying corner dots */}
          <motion.div
            className="relative h-[180px] w-[180px] sm:h-[208px] sm:w-[208px]"
            animate={
              phase === "exit"
                ? { scale: 1.45, opacity: 0, transition: { duration: 0.55, ease: [0.84, 0, 0.16, 1] } }
                : { scale: 1, opacity: 1 }
            }
          >
            {/* Horizontal full-bleed hairlines */}
            <motion.div
              className="absolute -left-[100vw] -right-[100vw] -top-px h-px bg-black/20"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.75, ease: [0.84, 0, 0.16, 1] }}
            />
            <motion.div
              className="absolute -left-[100vw] -right-[100vw] -bottom-px h-px bg-black/20"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.75, ease: [0.84, 0, 0.16, 1] }}
            />
            {/* Vertical full-bleed hairlines */}
            <motion.div
              className="absolute -top-[100vh] -bottom-[100vh] -left-px w-px bg-black/20"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.75, ease: [0.84, 0, 0.16, 1] }}
            />
            <motion.div
              className="absolute -top-[100vh] -bottom-[100vh] -right-px w-px bg-black/20"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.75, ease: [0.84, 0, 0.16, 1] }}
            />

            {/* Crisp square border */}
            <motion.div
              className="absolute -inset-px border border-black"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.3 }}
            />

            {/* Four 8x8 corner registration dots converging from viewport corners */}
            <motion.div
              className="absolute -left-[4px] -top-[4px] h-[8px] w-[8px] bg-black"
              initial={{ x: -320, y: -220 }}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0.72, ease: [0.84, 0, 0.16, 1] }}
            />
            <motion.div
              className="absolute -right-[4px] -top-[4px] h-[8px] w-[8px] bg-black"
              initial={{ x: 320, y: -220 }}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0.72, ease: [0.84, 0, 0.16, 1] }}
            />
            <motion.div
              className="absolute -right-[4px] -bottom-[4px] h-[8px] w-[8px] bg-black"
              initial={{ x: 320, y: 220 }}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0.72, ease: [0.84, 0, 0.16, 1] }}
            />
            <motion.div
              className="absolute -left-[4px] -bottom-[4px] h-[8px] w-[8px] bg-black"
              initial={{ x: -320, y: 220 }}
              animate={{ x: 0, y: 0 }}
              transition={{ duration: 0.72, ease: [0.84, 0, 0.16, 1] }}
            />

            {/* Centered interlocking Loopsii mark */}
            <motion.div
              className="flex h-full w-full items-center justify-center text-black"
              initial={{ scale: 0.55, opacity: 0, rotate: -14 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.65, delay: 0.2, ease: [0.3, 1.3, 0.4, 1] }}
            >
              <LoopsiiMark className="h-[52px] w-auto" />
            </motion.div>
          </motion.div>

          {/* Bottom handwritten Caveat tabular percentage counter */}
          <motion.div
            className="lp-text-note absolute bottom-10 left-1/2 -translate-x-1/2 tabular-nums text-black"
            initial={{ opacity: 0, y: 12 }}
            animate={
              phase === "exit"
                ? { opacity: 0, y: -12, transition: { duration: 0.3 } }
                : { opacity: 1, y: 0 }
            }
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            {String(percent).padStart(3, "0")} %
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
