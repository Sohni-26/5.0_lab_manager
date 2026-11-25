"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { LoopsiiButton } from "./primitives";

const FOLDER_COLORS = [
  "#BCE6FA",
  "#C4F041",
  "#FA8E66",
  "#9EC3D5",
  "#F3BD77",
  "#AAC2AA",
  "#E0F661",
  "#BCE6FA",
  "#FA8E66",
  "#9EC3D5",
  "#C4F041",
  "#F3BD77",
  "#AAC2AA",
  "#BCE6FA",
];

export function FoldersSection() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const stackY = useTransform(scrollYProgress, [0, 1], [65, -95]);

  return (
    <section ref={ref} className="relative z-20 bg-[#F0F0F0] px-4 py-16 sm:px-8 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] bg-white shadow-[0_4px_35px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Text + CTA */}
          <div className="flex flex-col justify-between p-8 sm:p-12 lg:col-span-5 lg:p-14">
            <h2 className="lp-h3 max-w-[11ch] text-black">Go back to teaching the lab</h2>

            <div className="mt-10 space-y-7 lg:mt-24">
              <p className="lp-text-xl max-w-[26ch] text-black">
                CampusLab handles the rest. Configure your master catalog once, stop rebuilding
                spreadsheets for every campus.
              </p>
              <LoopsiiButton label="Open lab portal" href="/login" size="md" />
            </div>
          </div>

          {/* Right Cascading 14-Layer Colored Manila Folder Stack */}
          <div className="relative h-[400px] overflow-hidden bg-[#F7F7F5] sm:h-[480px] lg:col-span-7 lg:h-[560px]">
            <motion.div
              style={{ y: stackY }}
              className="relative mx-auto h-[840px] w-full max-w-[760px] px-4 pt-6 sm:px-8"
            >
              {FOLDER_COLORS.map((color, idx) => {
                const flipped = idx % 2 === 1;
                return (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -14 }}
                    transition={{ duration: 0.3, ease: [0.3, 1.3, 0.4, 1] }}
                    className="absolute inset-x-4 cursor-pointer sm:inset-x-8"
                    style={{
                      top: `${idx * 54}px`,
                      zIndex: idx + 1,
                    }}
                  >
                    {/* Manila Folder SVG shape with tab */}
                    <div className="relative w-full">
                      <svg
                        viewBox="0 0 860 220"
                        className={`w-full drop-shadow-[0_-4px_12px_rgba(0,0,0,0.06)] ${
                          flipped ? "-scale-x-100" : ""
                        }`}
                        fill="none"
                      >
                        <path
                          d="M16 42C16 24 30 10 48 10H242C258 10 272 19 281 33L296 52C302 60 311 64 321 64H824C842 64 856 78 856 96V216H4V54C4 47 9 42 16 42Z"
                          fill={color}
                          stroke="rgba(0,0,0,0.14)"
                          strokeWidth="1.5"
                        />
                      </svg>
                      <span
                        className={`lp-font-hand pointer-events-none absolute top-[10px] text-[22px] text-black sm:top-[14px] sm:text-[26px] ${
                          flipped ? "right-[11%]" : "left-[11%]"
                        }`}
                      >
                        Campus {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
