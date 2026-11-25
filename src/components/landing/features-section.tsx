"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface FeatureCardData {
  title: string;
  desc: string;
  bg: string;
  upNext?: boolean;
  icon: "users" | "doc" | "pen" | "portal" | "video" | "spark" | "mic" | "clock" | "gantt" | "wave" | "diff" | "chart" | "invoice" | "layers" | "brief" | "funnel" | "target" | "bars";
}

interface PhaseData {
  badge: string;
  title: string;
  cards: FeatureCardData[];
}

const PHASES: PhaseData[] = [
  {
    badge: "ALLOCATION",
    title: "Move stock from central to every campus",
    cards: [
      {
        title: "Master catalog",
        desc: "Global item definitions, categories and specs owned centrally.",
        bg: "#BCE6FA",
        icon: "users",
      },
      {
        title: "Campus dispatches",
        desc: "Allocate equipment batches to all 40 campuses with reference codes.",
        bg: "#9EC3D5",
        icon: "doc",
      },
      {
        title: "Incoming verification",
        desc: "Lab managers verify received, missing and damaged units on arrival.",
        bg: "#FA8E66",
        icon: "pen",
      },
      {
        title: "Auto-replenishment",
        desc: "Automatic restock drafts triggered when campus stock dips low.",
        bg: "#C4F041",
        upNext: true,
        icon: "portal",
      },
    ],
  },
  {
    badge: "BORROWING",
    title: "Keep every student request moving",
    cards: [
      {
        title: "4-angle photo proof",
        desc: "Mandatory front, back, left and right proofs locked before pickup.",
        bg: "#E0F661",
        icon: "video",
      },
      {
        title: "2-stage approvals",
        desc: "Instructor syllabus review followed by Lab Manager final sign-off.",
        bg: "#9EC3D5",
        icon: "spark",
      },
      {
        title: "Atomic reservations",
        desc: "Database-locked stock moves prevent double-booking the last kit.",
        bg: "#AAC2AA",
        icon: "mic",
      },
      {
        title: "Due-date tracking",
        desc: "Active borrowing records tied to students, instructors and benches.",
        bg: "#BCE6FA",
        icon: "clock",
      },
      {
        title: "Visibility controls",
        desc: "Toggle which verified items students and instructors can browse.",
        bg: "#FA8E66",
        icon: "gantt",
      },
      {
        title: "Realtime SSE feed",
        desc: "Live status updates streamed across every role without page reloads.",
        bg: "#C4F041",
        icon: "wave",
      },
      {
        title: "QR bench checkouts",
        desc: "Scan equipment tags right at the counter to speed up lab handoffs.",
        bg: "#F3BD77",
        upNext: true,
        icon: "diff",
      },
    ],
  },
  {
    badge: "RETURNS",
    title: "Inspect gear, close loops, log damage",
    cards: [
      {
        title: "Return verification",
        desc: "Side-by-side comparison of collection vs return 4-angle photos.",
        bg: "#FA8E66",
        icon: "chart",
      },
      {
        title: "Damage & missing logs",
        desc: "Flag partial, damaged or missing returns into tracked disputes.",
        bg: "#9EC3D5",
        icon: "invoice",
      },
      {
        title: "Calibration alerts",
        desc: "Schedule automatic bench recalibration after flagged returns.",
        bg: "#AAC2AA",
        upNext: true,
        icon: "layers",
      },
    ],
  },
  {
    badge: "OVERSIGHT",
    title: "Full visibility across 40+ campuses",
    cards: [
      {
        title: "Immutable audit logs",
        desc: "Every stock mutation and approval captured with before/after diffs.",
        bg: "#9EC3D5",
        icon: "brief",
      },
      {
        title: "Issue tickets",
        desc: "Threaded Instructor-to-Lab-Manager tickets tied to exact items.",
        bg: "#C4F041",
        icon: "funnel",
      },
      {
        title: "Role-scoped RBAC",
        desc: "Strict campus isolation enforced for all 4 institutional roles.",
        bg: "#FA8E66",
        icon: "target",
      },
      {
        title: "Utilization analytics",
        desc: "Cross-campus borrowing trends and semester kit demand forecasts.",
        bg: "#BCE6FA",
        upNext: true,
        icon: "bars",
      },
    ],
  },
];

function FeatureGlyph({ kind }: { kind: FeatureCardData["icon"] }) {
  switch (kind) {
    case "users":
      return (
        <svg viewBox="0 0 64 48" className="h-12 w-16" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="22" cy="18" r="9" />
          <path d="M6 42C6 33 13 28 22 28C31 28 38 33 38 42" />
          <circle cx="44" cy="20" r="7" />
          <path d="M44 29C51 29 58 33 58 42" />
        </svg>
      );
    case "doc":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10 6H36L46 16V50H10V6Z" />
          <path d="M36 6V16H46" />
          <line x1="18" y1="26" x2="38" y2="26" />
          <line x1="18" y1="34" x2="38" y2="34" />
          <line x1="18" y1="42" x2="29" y2="42" />
        </svg>
      );
    case "pen":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10 46L14 32L38 8L48 18L24 42L10 46Z" />
          <path d="M31 15L41 25" />
          <path d="M10 46H46" />
        </svg>
      );
    case "portal":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="6" y="10" width="44" height="36" rx="8" />
          <line x1="6" y1="20" x2="50" y2="20" />
          <circle cx="14" cy="15" r="1.5" fill="currentColor" />
          <circle cx="21" cy="15" r="1.5" fill="currentColor" />
          <path d="M22 33L27 38L36 28" />
        </svg>
      );
    case "video":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="6" y="12" width="44" height="32" rx="8" />
          <polygon points="24,20 38,28 24,36" fill="currentColor" stroke="none" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="currentColor">
          <path d="M28 4L33 23L52 28L33 33L28 52L23 33L4 28L23 23L28 4Z" />
        </svg>
      );
    case "mic":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="20" y="8" width="16" height="24" rx="8" />
          <path d="M12 26C12 35 19 41 28 41C37 41 44 35 44 26" />
          <line x1="28" y1="41" x2="28" y2="50" />
          <line x1="18" y1="50" x2="38" y2="50" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="28" cy="28" r="21" />
          <path d="M28 15V28L37 33" />
        </svg>
      );
    case "gantt":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="8" y="10" width="24" height="9" rx="4.5" />
          <rect x="18" y="24" width="28" height="9" rx="4.5" />
          <rect x="12" y="38" width="22" height="9" rx="4.5" />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="10" y1="22" x2="10" y2="34" />
          <line x1="19" y1="14" x2="19" y2="42" />
          <line x1="28" y1="8" x2="28" y2="48" />
          <line x1="37" y1="16" x2="37" y2="40" />
          <line x1="46" y1="22" x2="46" y2="34" />
        </svg>
      );
    case "diff":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="8" y="8" width="26" height="26" rx="6" />
          <rect x="22" y="22" width="26" height="26" rx="6" fill="currentColor" fillOpacity="0.14" />
          <path d="M35 29V41M29 35H41" />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M8 46H48" />
          <rect x="12" y="28" width="8" height="18" rx="2" />
          <rect x="24" y="18" width="8" height="28" rx="2" />
          <rect x="36" y="10" width="8" height="36" rx="2" />
        </svg>
      );
    case "invoice":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 8H44V48L38 44L32 48L28 44L24 48L18 44L12 48V8Z" />
          <line x1="20" y1="20" x2="36" y2="20" />
          <line x1="20" y1="28" x2="36" y2="28" />
          <line x1="20" y1="36" x2="29" y2="36" />
        </svg>
      );
    case "layers":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="28,8 48,19 28,30 8,19" />
          <polyline points="8,29 28,40 48,29" />
          <polyline points="8,38 28,49 48,38" />
        </svg>
      );
    case "brief":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="10" y="12" width="36" height="36" rx="6" />
          <path d="M20 8V16M36 8V16" />
          <line x1="18" y1="26" x2="38" y2="26" />
          <line x1="18" y1="34" x2="32" y2="34" />
        </svg>
      );
    case "funnel":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M8 12H48L33 30V44L23 48V30L8 12Z" />
        </svg>
      );
    case "target":
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="28" cy="28" r="20" />
          <circle cx="28" cy="28" r="11" />
          <circle cx="28" cy="28" r="3.5" fill="currentColor" />
        </svg>
      );
    case "bars":
    default:
      return (
        <svg viewBox="0 0 56 56" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="8" y="12" width="40" height="8" rx="4" />
          <rect x="8" y="25" width="28" height="8" rx="4" />
          <rect x="8" y="38" width="34" height="8" rx="4" />
        </svg>
      );
  }
}

export function FeaturesSection() {
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({
    ALLOCATION: true,
    BORROWING: true,
    RETURNS: true,
    OVERSIGHT: true,
  });

  const togglePhase = (badge: string) => {
    setOpenPhases((prev) => ({ ...prev, [badge]: !prev[badge] }));
  };

  return (
    <section id="features" className="relative z-20 bg-[#F0F0F0] px-5 py-20 sm:px-10 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1440px]">
        {/* Header */}
        <div className="mb-14 max-w-[820px] lg:mb-20">
          <p className="lp-text-note mb-3 text-black">What&rsquo;s included</p>
          <h2 className="lp-h2 text-black">Everything you need, at every lab stage.</h2>
        </div>

        {/* 4 Phase Rows */}
        <div className="divide-y divide-black/15 border-t border-black/15">
          {PHASES.map((phase) => {
            const isOpen = openPhases[phase.badge] ?? true;
            return (
              <div
                key={phase.badge}
                className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-12 lg:gap-10 lg:py-16"
              >
                {/* Left Phase Pill + Subtitle */}
                <div className="flex items-start justify-between lg:col-span-4 lg:flex-col lg:justify-start">
                  <div>
                    <span className="lp-label inline-flex rounded-full border border-black px-3.5 py-1.5 text-[11px] font-medium text-black">
                      {phase.badge}
                    </span>
                    <h3 className="mt-4 max-w-[15ch] text-[24px] font-medium leading-[1.15] tracking-[-0.02em] text-black sm:text-[28px]">
                      {phase.title}
                    </h3>
                  </div>

                  {/* Mobile accordion toggle */}
                  <button
                    type="button"
                    onClick={() => togglePhase(phase.badge)}
                    aria-label={`Toggle ${phase.badge}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/20 text-lg text-black lg:hidden"
                  >
                    {isOpen ? "−" : "+"}
                  </button>
                </div>

                {/* Right Colored Square Cards Grid */}
                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8 xl:grid-cols-3">
                    {phase.cards.map((card, i) => (
                      <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 18 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.45, delay: i * 0.04 }}
                        whileHover={{ y: -5, scale: 1.015 }}
                        style={{ backgroundColor: card.bg }}
                        className="group relative flex aspect-square flex-col justify-between overflow-hidden rounded-[22px] p-6 text-black transition-shadow hover:shadow-md"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-[21px] font-semibold leading-[1.15] tracking-[-0.02em]">
                              {card.title}
                            </h4>
                            {card.upNext && (
                              <span className="lp-font-hand shrink-0 rounded-full bg-white/85 px-2.5 py-0.5 text-[17px] leading-tight text-black">
                                Up next
                              </span>
                            )}
                          </div>
                          <p className="mt-2.5 text-[14.5px] leading-snug text-black/75">
                            {card.desc}
                          </p>
                        </div>

                        <div className="mt-auto pt-4 text-black transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
                          <FeatureGlyph kind={card.icon} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
