"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  GraduationCap,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";

const ROLE_LOOP = [
  {
    step: "01",
    role: "Central Lab Manager",
    badge: "Single Global Super Admin",
    icon: Layers,
    accent: "#F26943",
    headline: "One global master catalog. 40 campuses under command.",
    description:
      "Enforced at PostgreSQL level to be unique globally. Creates master items, manages all 40 campuses and user roles, dispatches allocations, and monitors immutable audit trails.",
    canDo: [
      "Create, update & soft-deactivate master inventory items",
      "Dispatch multi-item allocations to any of 40 campuses",
      "Monitor system-wide requests, tickets & audit logs",
    ],
    guardrail: "Enforced by DB partial unique index: at most ONE Central Lab Manager can exist.",
    nextLabel: "Dispatches stock to Campus Lab Manager",
  },
  {
    step: "02",
    role: "Campus Lab Manager",
    badge: "Campus Stock Custodian",
    icon: SlidersHorizontal,
    accent: "#4D83B5",
    headline: "Verify every box on arrival. Lock stock atomically.",
    description:
      "Multiple Lab Managers can operate a campus together — strictly isolated from the other 39 campuses. Verifies shipments row-by-row, toggles visibility, and grants final borrowing approval.",
    canDo: [
      "Verify incoming stock with ✓/✗ and flag missing/damaged units",
      "Control live Google Sheets-style campus inventory visibility",
      "Grant final borrowing approval with atomic stock reservation",
    ],
    guardrail: "Strictly campus-scoped: can never read, modify, or allocate another campus’s stock.",
    nextLabel: "Publishes verified stock to Instructors & Students",
  },
  {
    step: "03",
    role: "Instructor",
    badge: "Academic & Condition Verifier",
    icon: UserCheck,
    accent: "#288568",
    headline: "Approve academic need. Inspect every return side-by-side.",
    description:
      "Acts as the academic gatekeeper and physical verifier. Reviews student requests, confirms handover after 4 collection photos, raises issue tickets, and compares return photos.",
    canDo: [
      "Review & forward student requests to the Campus Lab Manager",
      "Confirm physical handover after 4-angle collection photos",
      "Verify returns (Good / Damaged / Missing) & raise issue tickets",
    ],
    guardrail: "Cannot edit stock quantities, toggle visibility, or grant final borrowing approval.",
    nextLabel: "Verifies handover & return condition for Students",
  },
  {
    step: "04",
    role: "Student",
    badge: "Accountable Borrower",
    icon: GraduationCap,
    accent: "#D69A35",
    headline: "Browse verified kits. Prove condition with 4 angles.",
    description:
      "Sees only verified and visible stock at their own campus. Submits multi-item requests to a campus Instructor and uploads mandatory 4-angle photos at both collection and return.",
    canDo: [
      "Browse verified & visible campus equipment with live availability",
      "Submit multi-item requests & track live approval stages",
      "Upload 4-angle collection & return photos permanently linked",
    ],
    guardrail: "Uploading return photos never auto-closes a ticket — Instructor sign-off is required.",
    nextLabel: "Completes the loop back into verified campus stock",
  },
];

export function RoleLoopSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = ROLE_LOOP[activeIdx];
  const ActiveIcon = current.icon;

  return (
    <section id="how-it-works" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-[#2E2F2C] bg-[#1B1C1A] text-white shadow-2xl relative">
        {/* Subtle Dot Grid & Ambient Warm Glow (Loopsii dark showcase signature) */}
        <div className="pointer-events-none absolute inset-0 bg-dot-dark opacity-70" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-[520px] -translate-x-1/2 rounded-full bg-[#F26943]/18 blur-[110px]" />

        <div className="relative z-10 px-6 py-14 sm:px-12 sm:py-20">
          {/* Header */}
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-xs font-medium text-[#FFF0E9]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#F26943]" />
              How CampusLab Works
            </span>
            <h2 className="mt-5 text-3xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.06] font-display">
              One unbroken loop.
              <br />
              <span className="text-white/55">Four accountable roles.</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-white/65 leading-relaxed">
              Every permission is enforced server-side and at the database boundary. Click any
              role in the loop to inspect its responsibilities and hard guardrails.
            </p>
          </div>

          {/* Interactive 4-Role Pipeline Selector */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {ROLE_LOOP.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === activeIdx;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`group relative rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                    isActive
                      ? "border-[#F26943]/70 bg-white/[0.09] shadow-lg"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-bold ${
                        isActive ? "text-[#F26943]" : "text-white/45"
                      }`}
                    >
                      {item.step}
                    </span>
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: isActive ? `${item.accent}28` : "rgba(255,255,255,0.06)",
                        color: isActive ? item.accent : "rgba(255,255,255,0.65)",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{item.role}</p>
                  <p className="mt-0.5 text-[11px] text-white/50 truncate">{item.badge}</p>
                  {isActive && (
                    <motion.div
                      layoutId="role-loop-active-bar"
                      className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-[#F26943]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Interactive Role Detail Stage */}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.26 }}
              className="mt-6 rounded-[26px] border border-white/12 bg-white/[0.04] p-6 sm:p-8 backdrop-blur-xs"
            >
              <div className="grid gap-8 lg:grid-cols-12 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/85">
                    <ActiveIcon className="h-3.5 w-3.5" style={{ color: current.accent }} />
                    <span>
                      Step {current.step} · {current.role}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
                    {current.headline}
                  </h3>
                  <p className="text-sm sm:text-[15px] text-white/70 leading-relaxed">
                    {current.description}
                  </p>

                  {/* Hard Security Guardrail Box */}
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#F26943]/30 bg-[#F26943]/10 px-4 py-3.5">
                    <Ban className="h-4 w-4 text-[#F26943] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#FFB49F]">
                        Hard Backend Guardrail
                      </p>
                      <p className="mt-0.5 text-xs text-white/80">{current.guardrail}</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#141513] p-5 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    Authorised Capabilities
                  </p>
                  <ul className="space-y-3">
                    {current.canDo.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-sm text-white/90 leading-snug"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[#288568] shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-white/55">{current.nextLabel}</span>
                    <button
                      type="button"
                      onClick={() => setActiveIdx((i) => (i + 1) % ROLE_LOOP.length)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#F26943] transition-colors cursor-pointer shrink-0"
                    >
                      Next role
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#F26943] px-6 py-3 text-sm font-semibold text-white hover:bg-[#DA5835] transition-colors btn-tactile-accent"
            >
              Test all 4 roles in the interactive demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
