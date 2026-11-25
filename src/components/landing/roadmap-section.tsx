"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

interface RoadmapCardItem {
  numA: string;
  numB: string;
  bg: string;
  badge: string;
  badgeColor: string;
  items: string[];
}

const ROADMAP_CARDS: RoadmapCardItem[] = [
  {
    numA: "0",
    numB: "1",
    bg: "#9EC3D5",
    badge: "Live",
    badgeColor: "#4C7D96",
    items: [
      "Master catalog & 40-campus stock allocations.",
      "2-stage borrowing approvals & atomic reservations.",
      "Mandatory 4-angle collection & return photo proofs.",
      "Issue tickets, realtime SSE & immutable audit ledger.",
    ],
  },
  {
    numA: "0",
    numB: "2",
    bg: "#F3BD77",
    badge: "Up Next",
    badgeColor: "#A86E22",
    items: [
      "QR & barcode bench checkouts at the lab counter.",
      "Automated low-stock replenishment alerts.",
    ],
  },
  {
    numA: "0",
    numB: "3",
    bg: "#AAC2AA",
    badge: "Up Next",
    badgeColor: "#4B6B4B",
    items: [
      "Preventive calibration & bench maintenance logs.",
      "Cross-campus semester utilization heatmaps.",
    ],
  },
  {
    numA: "0",
    numB: "4",
    bg: "#FA8E66",
    badge: "Up Next",
    badgeColor: "#B2451D",
    items: [
      "Native mobile companion app for lab technicians.",
      "Offline bench verification with auto-sync.",
      "ERP procurement & LMS course roster webhooks.",
    ],
  },
];

function RoadmapWheelCard({
  card,
  index,
  wheelProgress,
}: {
  card: RoadmapCardItem;
  index: number;
  wheelProgress: MotionValue<number>;
}) {
  // Each card sits 34deg apart around a huge pivot far below the viewport
  const stepDeg = 34;
  const angle = useTransform(wheelProgress, (p) => (index - p * 3) * stepDeg);
  const digitY = useTransform(wheelProgress, (p) => {
    const delta = index - p * 3;
    const clamped = Math.max(-1, Math.min(1, delta));
    return `${clamped * 32}px`;
  });

  return (
    <motion.div
      style={{
        rotate: angle,
        transformOrigin: "50% 1320px",
      }}
      className="absolute left-1/2 top-4 w-[310px] -translate-x-1/2 sm:w-[410px] lg:w-[450px]"
    >
      <div
        style={{ backgroundColor: card.bg }}
        className="overflow-hidden rounded-[24px] p-6 text-black shadow-[0_18px_50px_rgba(0,0,0,0.08)] sm:p-8"
      >
        {/* Top oversized rolling white numeral header */}
        <div className="relative h-[170px] overflow-hidden rounded-[18px] bg-black/5 sm:h-[200px]">
          <motion.div
            style={{ y: digitY }}
            className="pointer-events-none absolute -top-10 left-2 flex select-none font-semibold leading-none tracking-[-0.04em] text-white tabular-nums"
          >
            <span className="text-[190px] sm:text-[230px]">{card.numA}</span>
            <span className="text-[190px] sm:text-[230px]">{card.numB}</span>
          </motion.div>

          {/* LOOP label + Handwritten Badge */}
          <div className="relative z-10 flex h-full items-center justify-between px-6">
            <span className="text-[20px] font-semibold tracking-tight text-black">LOOP</span>
            <span
              style={{ color: card.badgeColor }}
              className="lp-font-hand rounded-full bg-white px-4 py-0.5 text-[24px] leading-tight shadow-xs"
            >
              {card.badge}
            </span>
          </div>
        </div>

        {/* Hairline-divided milestone items */}
        <ul className="mt-6 divide-y divide-black/15">
          {card.items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 py-3.5 text-[15px] font-medium leading-snug text-black"
            >
              <span className="mt-1.5 h-[6px] w-[6px] shrink-0 bg-black" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export function RoadmapSection() {
  const trackRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  return (
    <section ref={trackRef} className="relative z-20 h-[270vh] bg-[#F0F0F0]">
      <div className="lp-grid-lines sticky top-0 flex h-screen flex-col overflow-hidden bg-[#F0F0F0] pt-24 sm:pt-28">
        {/* Header */}
        <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-10 lg:px-12">
          <p className="lp-text-note text-black">The roadmap</p>
          <h2 className="lp-h2 mt-2 max-w-[16ch] text-black">
            No fake launch dates. Just the actual plan.
          </h2>
        </div>

        {/* Giant Rotating Arc-Wheel Stage */}
        <div className="relative mt-8 flex-1 overflow-hidden">
          {/* Dashed Giant Circular Track Ring */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-[120px] h-[2400px] w-[2400px] -translate-x-1/2 rounded-full border border-dashed border-black/20"
          />

          {ROADMAP_CARDS.map((card, i) => (
            <RoadmapWheelCard
              key={card.numA + card.numB}
              card={card}
              index={i}
              wheelProgress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
