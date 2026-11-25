"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

const PILL_ROWS: string[][] = [
  ["Who borrowed the oscilloscope?", "Where's that kit?"],
  ["Was it damaged before?", "Did CMP-14 verify stock?"],
  ["Which bench is it on?", "Chasing overdue returns."],
  ["Is stock actually available?", '"I returned it yesterday"'],
  ["Where's that approval?", "Lost paper sign-out sheet"],
  ["Did we log that shortage?"],
];

const TOTAL_PILLS = PILL_ROWS.reduce((acc, row) => acc + row.length, 0);

function DistractionPill({
  label,
  globalIndex,
  scrollYProgress,
}: {
  label: string;
  globalIndex: number;
  scrollYProgress: MotionValue<number>;
}) {
  const start = 0.28 + (globalIndex / TOTAL_PILLS) * 0.36;
  const end = Math.min(0.72, start + 0.075);
  const opacity = useTransform(scrollYProgress, [start, end], [0, 1]);
  const scale = useTransform(scrollYProgress, [start, end], [0.76, 1]);
  const y = useTransform(scrollYProgress, [start, end], [14, 0]);

  return (
    <motion.span
      style={{ opacity, scale, y }}
      className="inline-flex h-[40px] items-center justify-center whitespace-nowrap rounded-full border border-black bg-[#F0F0F0] px-5 text-[13.5px] font-semibold tracking-[-0.01em] text-black shadow-md sm:h-[46px] sm:px-6 sm:text-[15px]"
    >
      {label}
    </motion.span>
  );
}

export function DistractionSection() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end end"],
  });

  // Panel enters slightly inset like a sleek dark curtain rising over the blurred light Intro, then locks full-bleed
  const sheetInset = useTransform(scrollYProgress, [0.02, 0.24], ["18px", "0px"]);
  const sheetRadius = useTransform(scrollYProgress, [0.02, 0.24], ["14px", "0px"]);

  // Architectural hairline box expands vertically from compact horizontal entry band -> full spacious frame
  const frameHeight = useTransform(scrollYProgress, [0.18, 0.38], ["28vh", "68vh"]);

  // Closed `( )` visible during initial entry band, fades smoothly as the expanded pill cluster opens
  const closedParensOpacity = useTransform(scrollYProgress, [0.22, 0.3], [1, 0]);
  const closedParensScale = useTransform(scrollYProgress, [0.22, 0.3], [1, 1.35]);

  // Expanded pill cluster with opening `(` on row 1 and closing `)` on row 6
  const openClusterOpacity = useTransform(scrollYProgress, [0.26, 0.34], [0, 1]);
  const openClusterScale = useTransform(scrollYProgress, [0.26, 0.4], [0.88, 1]);

  // Subtle exit defocus as AppDemo (-mt-[100vh]) glides right over Distraction
  const exitBlur = useTransform(scrollYProgress, [0.78, 0.98], ["blur(0px)", "blur(14px)"]);
  const exitScale = useTransform(scrollYProgress, [0.78, 0.98], [1, 0.965]);

  let runningIndex = 0;

  return (
    <section
      ref={sectionRef}
      data-nav-dark=""
      className="relative z-20 -mt-[100vh] h-[340vh]"
    >
      <div className="sticky top-0 flex h-screen w-full items-stretch justify-center overflow-hidden">
        <motion.div
          style={{
            marginLeft: sheetInset,
            marginRight: sheetInset,
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
          }}
          className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#1D1D1C] pt-10 text-[#F0F0F0] shadow-[0_-24px_80px_rgba(0,0,0,0.22)] will-change-transform"
        >
          {/* Atmospheric blurred portrait silhouette backdrop */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_65%_at_50%_50%,rgba(128,100,78,0.34)_0%,rgba(34,34,33,0.92)_58%,#1A1A19_100%)]" />
            <div className="absolute left-1/2 top-[44%] h-[320px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/75 blur-[48px]" />
            <div className="absolute left-1/2 top-[78%] h-[380px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/80 blur-[55px]" />
            <div className="absolute left-[46%] top-[46%] h-[150px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#C99B7B]/25 blur-[42px]" />
          </div>

          {/* Architectural hairline box: headlines stay cleanly pinned inside top-left & bottom-right */}
          <motion.div
            style={{
              height: frameHeight,
              filter: exitBlur,
              scale: exitScale,
            }}
            className="relative mx-6 flex w-full max-w-[1360px] flex-col justify-between px-6 py-7 sm:mx-10 sm:px-10 sm:py-9 lg:mx-12 lg:px-12 lg:py-10 will-change-transform"
          >
            {/* Extending horizontal & vertical hairline rules + 4 crisp white 8x8 corner registration dots */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -left-[100vw] -right-[100vw] top-0 h-px bg-white/20" />
              <div className="absolute -left-[100vw] -right-[100vw] bottom-0 h-px bg-white/20" />
              <div className="absolute -top-[100vh] -bottom-[100vh] left-0 w-px bg-white/20" />
              <div className="absolute -top-[100vh] -bottom-[100vh] right-0 w-px bg-white/20" />
              <div className="absolute -left-[4px] -top-[4px] h-[8px] w-[8px] bg-white" />
              <div className="absolute -right-[4px] -top-[4px] h-[8px] w-[8px] bg-white" />
              <div className="absolute -left-[4px] -bottom-[4px] h-[8px] w-[8px] bg-white" />
              <div className="absolute -right-[4px] -bottom-[4px] h-[8px] w-[8px] bg-white" />
            </div>

            {/* Top-left headline: tight 3-line editorial lockup */}
            <p className="relative z-10 max-w-[9.5ch] self-start text-[clamp(1.75rem,3.3vw,3.35rem)] font-medium leading-[1.04] tracking-[-0.025em] text-[#F0F0F0]">
              Too many things pulling you away
            </p>

            {/* Bottom-right headline: tight 3-line editorial lockup */}
            <p className="relative z-10 max-w-[10.5ch] self-end text-right text-[clamp(1.75rem,3.3vw,3.35rem)] font-medium leading-[1.04] tracking-[-0.025em] text-[#F0F0F0]">
              from the labs that actually matter
            </p>

            {/* Initial closed `( )` dead-center between the two headlines during entry */}
            <motion.div
              style={{ opacity: closedParensOpacity, scale: closedParensScale }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 select-none text-[clamp(2rem,3.6vw,3.4rem)] font-light leading-none text-white/95"
              aria-hidden="true"
            >
              <span>(</span>
              <span>)</span>
            </motion.div>

            {/* Absolutely centered 6-row pill cluster with `(` flanking Row 1 left and `)` flanking Row 6 right */}
            <motion.div
              style={{ opacity: openClusterOpacity, scale: openClusterScale }}
              className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex w-[92%] max-w-[620px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 sm:gap-2.5"
            >
              {PILL_ROWS.map((row, rowIdx) => {
                const isFirstRow = rowIdx === 0;
                const isLastRow = rowIdx === PILL_ROWS.length - 1;
                return (
                  <div
                    key={rowIdx}
                    className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
                  >
                    {isFirstRow && (
                      <span
                        aria-hidden="true"
                        className="mr-1 select-none text-[36px] font-light leading-none text-white/95 sm:mr-2 sm:text-[46px]"
                      >
                        (
                      </span>
                    )}

                    {row.map((tag) => {
                      const idx = runningIndex++;
                      return (
                        <DistractionPill
                          key={tag}
                          label={tag}
                          globalIndex={idx}
                          scrollYProgress={scrollYProgress}
                        />
                      );
                    })}

                    {isLastRow && (
                      <span
                        aria-hidden="true"
                        className="ml-1 select-none text-[36px] font-light leading-none text-white/95 sm:ml-2 sm:text-[46px]"
                      >
                        )
                      </span>
                    )}
                  </div>
                );
              })}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
