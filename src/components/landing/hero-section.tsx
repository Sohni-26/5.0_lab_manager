"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoopsiiMark } from "./primitives";

const ROTATING_WORDS = [
  "inventory",
  "allocations",
  "lab requests",
  "borrowing",
  "photo proofs",
  "returns",
  "campus stock",
  "approvals",
  "equipment",
  "lab tickets",
  "audit logs",
];

type ShapeKind =
  | "circle"
  | "diamond"
  | "semi-l"
  | "semi-r"
  | "tri-br"
  | "tri-tl"
  | "leaf"
  | "q-bl"
  | "q-br"
  | "square"
  | "pill-h"
  | "ring";

interface GridPiece {
  id: number;
  kind: ShapeKind;
  color: string;
  /** 3 choreographed formations (col 0..10, row 0..2, rot deg, scale) */
  states: Array<{ col: number; row: number; rot: number; scale: number }>;
}

const PALETTE = {
  main: "#C4F041",
  lime: "#E0F661",
  coral: "#FA8E66",
  steel: "#9EC3D5",
  sky: "#BCE6FA",
  sage: "#AAC2AA",
  apricot: "#F3BD77",
  black: "#111111",
  white: "#FFFFFF",
};

/** 26 Bauhaus geometric cells choreographed around the central coral Loop emblem (col 5, row 1) */
const GRID_PIECES: GridPiece[] = [
  { id: 1, kind: "circle", color: PALETTE.main, states: [{ col: 0, row: 0, rot: 0, scale: 1 }, { col: 1, row: 0, rot: 90, scale: 0.92 }, { col: 0, row: 1, rot: 180, scale: 1 }] },
  { id: 2, kind: "tri-br", color: PALETTE.steel, states: [{ col: 1, row: 0, rot: 0, scale: 1 }, { col: 0, row: 0, rot: 90, scale: 1 }, { col: 2, row: 0, rot: 180, scale: 1 }] },
  { id: 3, kind: "leaf", color: PALETTE.sage, states: [{ col: 2, row: 0, rot: 0, scale: 1 }, { col: 2, row: 1, rot: 90, scale: 1 }, { col: 1, row: 0, rot: 0, scale: 0.94 }] },
  { id: 4, kind: "diamond", color: PALETTE.apricot, states: [{ col: 3, row: 0, rot: 0, scale: 1 }, { col: 4, row: 0, rot: 45, scale: 0.85 }, { col: 3, row: 1, rot: 90, scale: 1 }] },
  { id: 5, kind: "semi-l", color: PALETTE.sky, states: [{ col: 4, row: 0, rot: 0, scale: 1 }, { col: 3, row: 0, rot: 180, scale: 1 }, { col: 4, row: 0, rot: 90, scale: 1 }] },
  { id: 6, kind: "q-br", color: PALETTE.black, states: [{ col: 5, row: 0, rot: 0, scale: 1 }, { col: 5, row: 0, rot: 90, scale: 0.92 }, { col: 5, row: 0, rot: 180, scale: 1 }] },
  { id: 7, kind: "circle", color: PALETTE.lime, states: [{ col: 6, row: 0, rot: 0, scale: 1 }, { col: 7, row: 0, rot: 0, scale: 1 }, { col: 6, row: 0, rot: 0, scale: 0.88 }] },
  { id: 8, kind: "tri-tl", color: PALETTE.coral, states: [{ col: 7, row: 0, rot: 0, scale: 1 }, { col: 6, row: 0, rot: 90, scale: 1 }, { col: 8, row: 0, rot: 270, scale: 1 }] },
  { id: 9, kind: "leaf", color: PALETTE.sky, states: [{ col: 8, row: 0, rot: 90, scale: 1 }, { col: 8, row: 1, rot: 0, scale: 1 }, { col: 7, row: 0, rot: 180, scale: 1 }] },
  { id: 10, kind: "diamond", color: PALETTE.main, states: [{ col: 9, row: 0, rot: 0, scale: 1 }, { col: 10, row: 0, rot: 90, scale: 0.92 }, { col: 9, row: 1, rot: 0, scale: 1 }] },
  { id: 11, kind: "q-bl", color: PALETTE.apricot, states: [{ col: 10, row: 0, rot: 0, scale: 1 }, { col: 9, row: 0, rot: 90, scale: 1 }, { col: 10, row: 0, rot: 270, scale: 1 }] },

  { id: 12, kind: "semi-r", color: PALETTE.coral, states: [{ col: 0, row: 1, rot: 0, scale: 1 }, { col: 0, row: 2, rot: 90, scale: 1 }, { col: 1, row: 1, rot: 180, scale: 1 }] },
  { id: 13, kind: "square", color: PALETTE.white, states: [{ col: 1, row: 1, rot: 0, scale: 0.92 }, { col: 1, row: 1, rot: 45, scale: 0.72 }, { col: 0, row: 0, rot: 0, scale: 0.92 }] },
  { id: 14, kind: "circle", color: PALETTE.sky, states: [{ col: 2, row: 1, rot: 0, scale: 1 }, { col: 3, row: 1, rot: 0, scale: 0.95 }, { col: 2, row: 2, rot: 0, scale: 1 }] },
  { id: 15, kind: "tri-tl", color: PALETTE.black, states: [{ col: 3, row: 1, rot: 0, scale: 1 }, { col: 2, row: 0, rot: 180, scale: 1 }, { col: 4, row: 1, rot: 90, scale: 1 }] },
  { id: 16, kind: "leaf", color: PALETTE.main, states: [{ col: 4, row: 1, rot: 0, scale: 1 }, { col: 4, row: 1, rot: 90, scale: 1 }, { col: 3, row: 0, rot: 180, scale: 1 }] },
  // Center col 5, row 1 is the signature Coral Loop Emblem
  { id: 17, kind: "leaf", color: PALETTE.steel, states: [{ col: 6, row: 1, rot: 90, scale: 1 }, { col: 6, row: 1, rot: 0, scale: 1 }, { col: 7, row: 1, rot: 180, scale: 1 }] },
  { id: 18, kind: "tri-br", color: PALETTE.black, states: [{ col: 7, row: 1, rot: 0, scale: 1 }, { col: 7, row: 2, rot: 90, scale: 1 }, { col: 6, row: 1, rot: 270, scale: 1 }] },
  { id: 19, kind: "circle", color: PALETTE.apricot, states: [{ col: 8, row: 1, rot: 0, scale: 1 }, { col: 9, row: 1, rot: 0, scale: 0.92 }, { col: 8, row: 2, rot: 0, scale: 1 }] },
  { id: 20, kind: "ring", color: PALETTE.sage, states: [{ col: 9, row: 1, rot: 0, scale: 1 }, { col: 10, row: 1, rot: 90, scale: 1 }, { col: 10, row: 1, rot: 180, scale: 0.92 }] },
  { id: 21, kind: "semi-l", color: PALETTE.lime, states: [{ col: 10, row: 1, rot: 0, scale: 1 }, { col: 10, row: 2, rot: 90, scale: 1 }, { col: 9, row: 0, rot: 180, scale: 1 }] },

  { id: 22, kind: "q-br", color: PALETTE.steel, states: [{ col: 0, row: 2, rot: 0, scale: 1 }, { col: 1, row: 2, rot: 90, scale: 1 }, { col: 0, row: 2, rot: 270, scale: 1 }] },
  { id: 23, kind: "diamond", color: PALETTE.coral, states: [{ col: 1, row: 2, rot: 0, scale: 1 }, { col: 2, row: 2, rot: 45, scale: 0.84 }, { col: 1, row: 2, rot: 90, scale: 1 }] },
  { id: 24, kind: "semi-r", color: PALETTE.apricot, states: [{ col: 2, row: 2, rot: 0, scale: 1 }, { col: 3, row: 2, rot: 180, scale: 1 }, { col: 3, row: 2, rot: 90, scale: 1 }] },
  { id: 25, kind: "circle", color: PALETTE.sage, states: [{ col: 3, row: 2, rot: 0, scale: 1 }, { col: 4, row: 2, rot: 0, scale: 0.9 }, { col: 2, row: 1, rot: 0, scale: 1 }] },
  { id: 26, kind: "tri-br", color: PALETTE.main, states: [{ col: 4, row: 2, rot: 0, scale: 1 }, { col: 5, row: 2, rot: 90, scale: 1 }, { col: 4, row: 2, rot: 180, scale: 1 }] },
  { id: 27, kind: "circle", color: PALETTE.white, states: [{ col: 5, row: 2, rot: 0, scale: 0.88 }, { col: 4, row: 2, rot: 0, scale: 1 }, { col: 5, row: 2, rot: 0, scale: 1 }] },
  { id: 28, kind: "tri-tl", color: PALETTE.sky, states: [{ col: 6, row: 2, rot: 0, scale: 1 }, { col: 6, row: 2, rot: 90, scale: 1 }, { col: 6, row: 2, rot: 180, scale: 1 }] },
  { id: 29, kind: "leaf", color: PALETTE.coral, states: [{ col: 7, row: 2, rot: 0, scale: 1 }, { col: 8, row: 2, rot: 90, scale: 1 }, { col: 7, row: 2, rot: 270, scale: 1 }] },
  { id: 30, kind: "diamond", color: PALETTE.steel, states: [{ col: 8, row: 2, rot: 0, scale: 1 }, { col: 9, row: 2, rot: 45, scale: 0.85 }, { col: 9, row: 2, rot: 90, scale: 1 }] },
  { id: 31, kind: "q-bl", color: PALETTE.main, states: [{ col: 9, row: 2, rot: 0, scale: 1 }, { col: 8, row: 0, rot: 90, scale: 1 }, { col: 10, row: 2, rot: 180, scale: 1 }] },
  { id: 32, kind: "circle", color: PALETTE.black, states: [{ col: 10, row: 2, rot: 0, scale: 0.92 }, { col: 9, row: 2, rot: 0, scale: 1 }, { col: 8, row: 1, rot: 0, scale: 0.9 }] },
];

function renderShapeStyle(kind: ShapeKind, color: string): React.CSSProperties {
  const base: React.CSSProperties = { backgroundColor: color };
  switch (kind) {
    case "circle":
      return { ...base, borderRadius: "50%" };
    case "diamond":
      return { ...base, clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" };
    case "tri-br":
      return { ...base, clipPath: "polygon(100% 0%, 100% 100%, 0% 100%)" };
    case "tri-tl":
      return { ...base, clipPath: "polygon(0% 0%, 100% 0%, 0% 100%)" };
    case "semi-l":
      return { ...base, borderRadius: "100% 0 0 100%" };
    case "semi-r":
      return { ...base, borderRadius: "0 100% 100% 0" };
    case "leaf":
      return { ...base, borderRadius: "100% 0" };
    case "q-bl":
      return { ...base, borderBottomLeftRadius: "48%" };
    case "q-br":
      return { ...base, borderBottomRightRadius: "48%" };
    case "pill-h":
      return { ...base, borderRadius: "9999px" };
    case "ring":
      return {
        backgroundColor: "transparent",
        border: `10px solid ${color}`,
        borderRadius: "50%",
      };
    case "square":
    default:
      return { ...base, borderRadius: "14%" };
  }
}

export function HeroSection() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
    }, 2350);
    return () => clearInterval(id);
  }, []);

  const currentWord = ROTATING_WORDS[wordIndex];
  const formationIndex = wordIndex % 3;

  return (
    <header
      id="top"
      className="relative flex min-h-screen flex-col justify-between overflow-x-clip bg-[#F0F0F0] pt-24 sm:pt-28 lg:pt-32"
    >
      <h1 className="sr-only">CampusLab, the all-in-one lab manager for campuses</h1>

      {/* Top 12-column headline + subtitle row */}
      <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-8 sm:px-10 lg:px-12 lg:pb-10">
        <div className="grid grid-cols-12 items-end gap-y-6 lg:gap-x-6">
          <div className="col-span-12 lg:col-span-8">
            <div className="lp-h1 text-black">
              <span className="block">One app for</span>
              <div className="flex flex-wrap items-baseline gap-x-[0.22em]">
                <span>your</span>
                <span className="relative inline-block min-h-[1.06em] min-w-[6ch] overflow-hidden align-bottom">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={currentWord}
                      className="inline-flex whitespace-nowrap"
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      {currentWord.split("").map((ch, idx) => (
                        <motion.span
                          key={`${currentWord}-${idx}`}
                          className="inline-block will-change-transform"
                          variants={{
                            enter: {
                              y: "95%",
                              scale: 0.68,
                              rotate: idx % 2 === 0 ? -12 : 12,
                              opacity: 0,
                            },
                            center: {
                              y: "0%",
                              scale: 1,
                              rotate: 0,
                              opacity: 1,
                              transition: {
                                duration: 0.52,
                                delay: idx * 0.022,
                                ease: [0.3, 1.15, 0.4, 1],
                              },
                            },
                            exit: {
                              y: "-95%",
                              scale: 0.68,
                              rotate: idx % 2 === 0 ? 10 : -10,
                              opacity: 0,
                              transition: {
                                duration: 0.34,
                                delay: idx * 0.014,
                                ease: [0.76, 0, 0.24, 1],
                              },
                            },
                          }}
                        >
                          {ch === " " ? "\u00A0" : ch}
                        </motion.span>
                      ))}
                    </motion.span>
                  </AnimatePresence>
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 lg:pb-2">
            <h2 className="lp-text-xl max-w-[22em] text-black">
              The all-in-one lab manager for campuses. Like a central command desk, it keeps your
              stock, requests, approvals and returns connected.
            </h2>
          </div>
        </div>

        {/* Full-bleed bottom hairline divider */}
        <div className="pointer-events-none absolute -left-[100vw] -right-[100vw] bottom-0 h-px bg-black/15" />
      </div>

      {/* Bottom stage: Architectural hairline frame + 4 corner registration dots + 11x3 animated Bauhaus geometric Loop grid */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-10 lg:px-12 lg:py-12">
        <div className="relative mx-auto w-full max-w-[1260px]">
          {/* Architectural extending lines */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-[100vw] -right-[100vw] -top-px h-px bg-black/15" />
            <div className="absolute -left-[100vw] -right-[100vw] -bottom-px h-px bg-black/15" />
            <div className="absolute -top-24 -bottom-24 -left-px w-px bg-black/15" />
            <div className="absolute -top-24 -bottom-24 -right-px w-px bg-black/15" />
          </div>

          {/* 4 Corner Registration Dots + Labels */}
          <div className="pointer-events-none absolute -left-[4px] -top-[4px] z-20 flex items-center gap-2">
            <span className="block h-[8px] w-[8px] bg-black" />
            <span className="lp-label -translate-y-5 text-[10px] text-black/75 sm:text-[11px]">
              ALLOCATIONS
            </span>
          </div>
          <div className="pointer-events-none absolute -right-[4px] -top-[4px] z-20 flex items-center gap-2">
            <span className="lp-label -translate-y-5 text-[10px] text-black/75 sm:text-[11px]">
              BORROWING
            </span>
            <span className="block h-[8px] w-[8px] bg-black" />
          </div>
          <div className="pointer-events-none absolute -bottom-[4px] -right-[4px] z-20 flex items-center gap-2">
            <span className="lp-label translate-y-5 text-[10px] text-black/75 sm:text-[11px]">
              PHOTO PROOFS
            </span>
            <span className="block h-[8px] w-[8px] bg-black" />
          </div>
          <div className="pointer-events-none absolute -bottom-[4px] -left-[4px] z-20 flex items-center gap-2">
            <span className="block h-[8px] w-[8px] bg-black" />
            <span className="lp-label translate-y-5 text-[10px] text-black/75 sm:text-[11px]">
              AUDIT LOGS
            </span>
          </div>

          {/* 11 x 3 Animated Bauhaus Geometric Loop Grid */}
          <div className="relative aspect-[11/3] w-full overflow-hidden bg-[#F0F0F0] p-1 sm:p-2">
            {/* Subtle cell grid lines */}
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)",
                backgroundSize: "calc(100% / 11) calc(100% / 3)",
              }}
            />

            {/* Animated geometric cells */}
            <div className="relative h-full w-full">
              {GRID_PIECES.map((piece) => {
                const st = piece.states[formationIndex];
                return (
                  <motion.div
                    key={piece.id}
                    className="absolute p-[3px] sm:p-[5px]"
                    style={{
                      width: "calc(100% / 11)",
                      height: "calc(100% / 3)",
                    }}
                    animate={{
                      left: `${(st.col / 11) * 100}%`,
                      top: `${(st.row / 3) * 100}%`,
                      rotate: st.rot,
                      scale: st.scale,
                    }}
                    transition={{
                      duration: 0.9,
                      ease: [0.76, 0, 0.24, 1],
                    }}
                  >
                    <div
                      className="h-full w-full"
                      style={renderShapeStyle(piece.kind, piece.color)}
                    />
                  </motion.div>
                );
              })}

              {/* Centerpiece NxtWave Circle Emblem (col 5, row 1 — no rotation) */}
              <motion.div
                className="absolute z-10 flex items-center justify-center p-[3px] sm:p-[5px]"
                style={{
                  left: `${(5 / 11) * 100}%`,
                  top: `${(1 / 3) * 100}%`,
                  width: "calc(100% / 11)",
                  height: "calc(100% / 3)",
                }}
                animate={{
                  scale: [1, 1.06, 1],
                }}
                transition={{
                  scale: { duration: 0.9, ease: [0.3, 1.3, 0.4, 1] },
                }}
                key={`center-pulse-${wordIndex}`}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-3 text-[#052647] ring-1 ring-black/10 shadow-sm">
                  <LoopsiiMark className="h-auto w-[72%]" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
