"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface TestimonialItem {
  title: string;
  quote: string;
  name: string;
  role: string;
  initials: string;
  avatarBg: string;
}

const TESTIMONIALS: TestimonialItem[] = [
  {
    title: "Zero missing kits this semester.",
    quote:
      "Managing equipment across 18 engineering campuses used to mean reconciling spreadsheets for two weeks after finals. With CampusLab, every dispatch, student checkout and 4-angle return proof lives in one immutable ledger.",
    name: "Dr. Elena Vance",
    role: "CENTRAL LAB MANAGER",
    initials: "EV",
    avatarBg: "#9EC3D5",
  },
  {
    title: "4-angle proofs ended damage disputes.",
    quote:
      "Students upload four crisp angles before pickup and again at return. When a probe or casing comes back cracked, the side-by-side comparison takes ten seconds — no awkward arguments at the lab counter.",
    name: "Prof. Kavita Rao",
    role: "EMBEDDED LAB INSTRUCTOR",
    initials: "KR",
    avatarBg: "#FA8E66",
  },
  {
    title: "Atomic reservations just work.",
    quote:
      "During capstone week, 60 students request oscilloscopes at once. CampusLab locks available stock atomically on approval so we never over-promise kits that are already checked out.",
    name: "Marcus Chen",
    role: "CAMPUS LAB MANAGER · CMP-07",
    initials: "MC",
    avatarBg: "#C4F041",
  },
  {
    title: "Incoming stock checks in minutes.",
    quote:
      "Whenever Central dispatches a new robotics batch, I verify received, missing and damaged quantities right from the incoming screen and publish verified items to students in one click.",
    name: "Sonia Delgado",
    role: "LAB OPERATIONS LEAD · CMP-14",
    initials: "SD",
    avatarBg: "#F3BD77",
  },
  {
    title: "One portal instead of five spreadsheets.",
    quote:
      "Instructors log faulty bench gear straight to our ticket board with photos attached, and our dean gets instant cross-campus audit logs anytime accreditation asks for equipment history.",
    name: "Dr. Rohan Kapoor",
    role: "DEAN OF ENGINEERING LABS",
    initials: "RK",
    avatarBg: "#AAC2AA",
  },
];

function WireframeCard({ item, onClick }: { item: TestimonialItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lp-wire-grid hidden h-[360px] w-[320px] shrink-0 flex-col justify-between rounded-[22px] border border-black/25 bg-[#F0F0F0]/50 p-6 text-left opacity-65 transition-opacity hover:opacity-90 xl:flex"
    >
      <div className="flex items-start gap-4">
        <div className="h-24 w-24 shrink-0 rounded-[18px] rounded-br-none border border-black/45" />
        <div className="flex-1 space-y-2.5 pt-2">
          <div className="h-3 w-4/5 rounded bg-black/10" />
          <div className="h-2.5 w-full rounded bg-black/8" />
          <div className="h-2.5 w-5/6 rounded bg-black/8" />
          <div className="h-2.5 w-2/3 rounded bg-black/8" />
        </div>
      </div>

      <div>
        <div className="mb-3 h-px w-full bg-black/30" />
        <div className="flex items-baseline justify-between gap-2">
          <span className="lp-font-hand text-[24px] text-black/70">{item.name}</span>
          <span className="lp-label text-[10px] text-black/55">{item.role}</span>
        </div>
      </div>
    </button>
  );
}

export function TestimonialsSection() {
  const [index, setIndex] = useState(0);
  const total = TESTIMONIALS.length;

  const prevIdx = (index - 1 + total) % total;
  const nextIdx = (index + 1) % total;
  const active = TESTIMONIALS[index];

  const handlePrev = () => setIndex(prevIdx);
  const handleNext = () => setIndex(nextIdx);

  return (
    <section
      id="testimonials"
      className="relative z-20 overflow-x-clip bg-[#F0F0F0] py-20 lg:py-28"
    >
      <div className="mx-auto max-w-[1440px] px-5 sm:px-10 lg:px-12">
        <h2 className="lp-h2 mx-auto max-w-[15ch] text-center text-black">
          Heard from the lab teams.
        </h2>
      </div>

      {/* Architectural Hairline Stage */}
      <div className="relative mt-14 px-5 sm:px-10">
        {/* Extending Top & Bottom Horizontal Hairlines */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-black/15" />
        <div className="pointer-events-none absolute inset-x-0 bottom-[26px] h-px bg-black/15" />

        <div className="relative mx-auto flex max-w-[1440px] items-center justify-center gap-8 py-8">
          {/* Left Wireframe Blueprint Card */}
          <WireframeCard item={TESTIMONIALS[prevIdx]} onClick={handlePrev} />

          {/* Center Active Crisp Graph-Paper Card inside vertical hairlines + corner dots */}
          <div className="relative w-full max-w-[760px] shrink-0">
            {/* Inner vertical hairlines + 8x8 registration dots */}
            <div className="pointer-events-none absolute -bottom-[58px] -top-8 -left-4 hidden w-px bg-black/20 sm:block">
              <span className="absolute -left-[3.5px] top-0 h-[8px] w-[8px] bg-black" />
              <span className="absolute -left-[3.5px] bottom-0 h-[8px] w-[8px] bg-black" />
            </div>
            <div className="pointer-events-none absolute -bottom-[58px] -top-8 -right-4 hidden w-px bg-black/20 sm:block">
              <span className="absolute -left-[3.5px] top-0 h-[8px] w-[8px] bg-black" />
              <span className="absolute -left-[3.5px] bottom-0 h-[8px] w-[8px] bg-black" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active.name}
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.985 }}
                transition={{ duration: 0.4, ease: [0.76, 0, 0.24, 1] }}
                className="lp-paper-grid overflow-hidden rounded-[26px] border border-black/12 bg-white p-6 shadow-[0_12px_45px_rgba(0,0,0,0.06)] sm:p-8"
              >
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-12">
                  {/* Left Portrait Plate */}
                  <div className="sm:col-span-4">
                    <div
                      style={{ backgroundColor: active.avatarBg }}
                      className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[22px] rounded-br-none border border-black/10"
                    >
                      {/* Subtle editorial portrait illustration */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/85 text-[28px] font-semibold tracking-tight text-black shadow-sm">
                        {active.initials}
                      </div>
                      <span className="mt-3 rounded-full bg-black/85 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                        Verified campus
                      </span>
                    </div>
                  </div>

                  {/* Right Quote + Handwritten Signature Plate */}
                  <div className="flex flex-col justify-between sm:col-span-8">
                    <div>
                      <p className="text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-black sm:text-[26px]">
                        {active.title}
                      </p>
                      <p className="mt-4 text-[15.5px] leading-[1.55] text-black/80 sm:text-[16.5px]">
                        {active.quote}
                      </p>
                    </div>

                    <div className="mt-8">
                      <div className="h-px w-full bg-black" />
                      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
                        <span className="lp-font-hand text-[32px] leading-none text-black">
                          {active.name}
                        </span>
                        <span className="lp-label text-[11px] text-black/75">{active.role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Wireframe Blueprint Card */}
          <WireframeCard item={TESTIMONIALS[nextIdx]} onClick={handleNext} />
        </div>

        {/* Bottom Oval Prev/Next Arrows + Rolling 01 / 05 Counter */}
        <div className="relative z-10 mt-6 flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous testimonial"
            className="lp-btn group h-[46px] w-[72px] justify-center overflow-hidden rounded-full bg-black text-white"
          >
            <span className="lp-btn_layer lp-btn_layer--sage" />
            <span className="lp-btn_layer lp-btn_layer--sky" />
            <span className="lp-btn_layer lp-btn_layer--apricot" />
            <span className="lp-btn_layer lp-btn_layer--main" />
            <span className="lp-btn_content text-[18px]">←</span>
          </button>

          <div className="lp-label flex items-center gap-1.5 text-[13px] tabular-nums text-black">
            <span className="font-semibold">{String(index + 1).padStart(2, "0")}</span>
            <span className="text-black/40">/</span>
            <span className="text-black/60">{String(total).padStart(2, "0")}</span>
          </div>

          <button
            type="button"
            onClick={handleNext}
            aria-label="Next testimonial"
            className="lp-btn group h-[46px] w-[72px] justify-center overflow-hidden rounded-full bg-black text-white"
          >
            <span className="lp-btn_layer lp-btn_layer--sage" />
            <span className="lp-btn_layer lp-btn_layer--sky" />
            <span className="lp-btn_layer lp-btn_layer--apricot" />
            <span className="lp-btn_layer lp-btn_layer--main" />
            <span className="lp-btn_content text-[18px]">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
