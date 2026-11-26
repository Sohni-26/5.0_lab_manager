"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { LoopsiiMark } from "./primitives";

const ORBIT_ITEMS = [
  {
    bg: "#9EC3D5",
    round: true,
    angle: 0,
    svg: (
      <svg viewBox="0 0 13 16" className="h-4 w-4" fill="currentColor">
        <path
          d="M0 0H8V5H13V16H0ZM10 0L13 3H10ZM3 8H10V10H3ZM3 12H8V14H3Z"
          fillRule="evenodd"
        />
      </svg>
    ),
  },
  {
    bg: "#E0F661",
    round: true,
    angle: 45,
    svg: (
      <svg viewBox="0 0 14 16" className="h-4 w-4" fill="currentColor">
        <path d="M2 0H12V3H2ZM0 5H14V7L7.75 15.04V10.8A1.5 1.5 0 1 0 6.25 10.8V15.04L0 7Z" />
      </svg>
    ),
  },
  {
    bg: "#F3BD77",
    round: false,
    angle: 90,
    svg: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path
          d="M0 2H3V0H5V2H11V0H13V2H16V16H0ZM2 7H14V14H2ZM4 9H7V12H4Z"
          fillRule="evenodd"
        />
      </svg>
    ),
  },
  {
    bg: "#BCE6FA",
    round: false,
    angle: 135,
    svg: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path d="M0 9.38C0.7 13.09 3.96 15.9 7.88 15.9C12.31 15.9 15.9 12.31 15.9 7.88C15.9 3.96 13.09 0.7 9.38 0V6.88C9.38 8.26 8.26 9.38 6.88 9.38H0Z" />
      </svg>
    ),
  },
  {
    bg: "#AAC2AA",
    round: false,
    angle: 180,
    svg: (
      <svg viewBox="0 0 12 20" className="h-4 w-4" fill="currentColor">
        <path d="M0 0L0.01 6L4 10L0.01 14.01L0 20H12V14L8 10L12 6.01V0H0ZM10 14.5V18H2V14.5L6 10.5L10 14.5Z" />
      </svg>
    ),
  },
  {
    bg: "#C4F041",
    round: true,
    angle: 225,
    svg: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path
          d="M8 0A8 8 0 0 1 16 8A8 8 0 0 1 8 16H0V8A8 8 0 0 1 8 0ZM4 6.75A1.25 1.25 0 1 0 4 9.25A1.25 1.25 0 1 0 4 6.75ZM8 6.75A1.25 1.25 0 1 0 8 9.25A1.25 1.25 0 1 0 8 6.75ZM12 6.75A1.25 1.25 0 1 0 12 9.25A1.25 1.25 0 1 0 12 6.75Z"
          fillRule="evenodd"
        />
      </svg>
    ),
  },
  {
    bg: "#F3BD77",
    round: false,
    angle: 270,
    svg: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
        <path d="M9.6 16L16 0L0 6.4L3.73 10.13L12.8 3.2L5.87 12.27Z" />
      </svg>
    ),
  },
  {
    bg: "#BCE6FA",
    round: false,
    angle: 315,
    svg: (
      <svg viewBox="0 0 16 10" className="h-4 w-4" fill="currentColor">
        <path
          d="M0 0H16V10H0ZM5.5 5A2.5 2.5 0 1 0 10.5 5A2.5 2.5 0 1 0 5.5 5ZM2 5A1 1 0 1 0 4 5A1 1 0 1 0 2 5ZM12 5A1 1 0 1 0 14 5A1 1 0 1 0 12 5Z"
          fillRule="evenodd"
        />
      </svg>
    ),
  },
];

export function IntroSection() {
  const trackRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  // Stay crisp while reading, then softly defocus in pure #F0F0F0 light grey as Distraction glides up over it
  const contentBlur = useTransform(scrollYProgress, [0.35, 0.85], ["blur(0px)", "blur(18px)"]);
  const contentScale = useTransform(scrollYProgress, [0.35, 0.95], [1, 0.965]);
  const contentOpacity = useTransform(scrollYProgress, [0.45, 0.95], [1, 0.65]);
  const orbitScale = useTransform(scrollYProgress, [0, 0.45, 0.95], [0.94, 1.03, 0.95]);
  const textY = useTransform(scrollYProgress, [0, 0.6], [14, -10]);

  return (
    <section ref={trackRef} className="relative z-10 h-[215vh] bg-[#F0F0F0]">
      <div className="sticky top-0 flex h-screen flex-col justify-between overflow-hidden bg-[#F0F0F0] px-5 pb-12 pt-28 sm:px-10 lg:px-12 lg:pt-32">
        <motion.div
          style={{
            filter: contentBlur,
            scale: contentScale,
            opacity: contentOpacity,
          }}
          className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-between will-change-transform"
        >
          {/* Top 12-col editorial statement */}
          <div className="grid grid-cols-12 gap-y-5 lg:gap-x-6">
            <div className="col-span-12 lg:col-span-3">
              <p className="lp-text-note text-black">What is CampusLab</p>
            </div>
            <div className="col-span-12 lg:col-span-8 lg:col-start-5">
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.75, ease: [0.76, 0, 0.24, 1] }}
                className="lp-h3 text-black"
              >
                CampusLab helps universities and lab teams manage every campus lab in one app.
                There&rsquo;s less chasing spreadsheets and more time for hands-on learning.
              </motion.h2>
            </div>
          </div>

          {/* Bottom stage: Orbiting Loop Emblem + Right Loop Note */}
          <div className="my-auto grid grid-cols-12 items-center gap-y-10 py-10 lg:gap-x-6">
            <div className="col-span-12 flex items-center justify-center lg:col-span-6 lg:col-start-2">
              <motion.div
                style={{ scale: orbitScale }}
                className="relative flex h-[280px] w-[280px] items-center justify-center sm:h-[340px] sm:w-[340px]"
              >
                <div className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-black/15" />

                {/* Orbiting 8 geometric icon shapes */}
                <div className="lp-orbit-ring absolute inset-0">
                  {ORBIT_ITEMS.map((item, idx) => {
                    const rad = (item.angle * Math.PI) / 180;
                    const radiusPct = 44;
                    const x = 50 + Math.cos(rad) * radiusPct;
                    const y = 50 + Math.sin(rad) * radiusPct;
                    return (
                      <div
                        key={idx}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div
                          className={`lp-orbit-counter flex h-11 w-11 items-center justify-center text-black shadow-sm sm:h-12 sm:w-12 ${
                            item.round ? "rounded-full" : "rounded-[12px]"
                          }`}
                          style={{ backgroundColor: item.bg }}
                        >
                          {item.svg}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Central NxtWave Circle + Mark */}
                <div className="relative z-10 flex h-[116px] w-[116px] items-center justify-center rounded-full bg-[#DCEEFF] p-4 text-[#052647] ring-1 ring-[#0066CC]/20 shadow-md sm:h-[136px] sm:w-[136px]">
                  <LoopsiiMark className="h-auto w-[82%]" />
                </div>
              </motion.div>
            </div>

            <motion.div
              style={{ y: textY }}
              className="col-span-12 lg:col-span-4 lg:col-start-9"
            >
              <p className="lp-text-xl max-w-[26ch] text-black">
                Every lab kit follows a familiar loop. CampusLab keeps it moving, so nothing goes
                missing between benches.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
