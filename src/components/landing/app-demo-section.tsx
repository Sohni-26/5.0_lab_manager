"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { LoopsiiButton, LoopsiiMark } from "./primitives";

type SidebarTab =
  | "Dashboard"
  | "Allocations"
  | "Requests"
  | "Inventory"
  | "Campuses"
  | "Returns"
  | "Tickets";

const SIDEBAR_ITEMS: { id: SidebarTab; icon: string }[] = [
  { id: "Dashboard", icon: "⌂" },
  { id: "Allocations", icon: "◌" },
  { id: "Requests", icon: "☑" },
  { id: "Inventory", icon: "◫" },
  { id: "Campuses", icon: "◎" },
  { id: "Returns", icon: "↺" },
  { id: "Tickets", icon: "▤" },
];

const SUGGESTED_TASKS = [
  {
    id: "t1",
    title: "Verify CMP-14 incoming dispatch",
    desc: "Confirm 24 received Robotics Kits and log 1 damaged unit before publishing to campus inventory.",
    priority: "Medium",
    priorityBg: "#FDF2DC",
    priorityColor: "#865318",
  },
  {
    id: "t2",
    title: "Inspect returned Oscilloscope #04",
    desc: "Compare 4-angle return photos against immutable collection proofs to close REQ-2026-0418.",
    priority: "High",
    priorityBg: "#FEE7E2",
    priorityColor: "#A6341E",
  },
  {
    id: "t3",
    title: "Approve Lab 302 stock reservation",
    desc: "Final Lab Manager sign-off atomically moves 4 Arduino Mega Kits from Available to Reserved.",
    priority: "Medium",
    priorityBg: "#FDF2DC",
    priorityColor: "#865318",
  },
];

export function AppDemoSection() {
  const trackRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start end", "end end"],
  });

  const sheetRadius = useTransform(scrollYProgress, [0.05, 0.3], ["28px", "0px"]);
  const headingScale = useTransform(scrollYProgress, [0.18, 0.55], [1.38, 1]);
  const headingY = useTransform(scrollYProgress, [0.18, 0.55], [70, 0]);
  const appScale = useTransform(scrollYProgress, [0.24, 0.68], [0.88, 1]);
  const appOpacity = useTransform(scrollYProgress, [0.22, 0.5], [0.45, 1]);
  const plateSpread = useTransform(scrollYProgress, [0.3, 0.78], [0, 1]);

  const plateLeftX = useTransform(plateSpread, [0, 1], [0, -28]);
  const plateRightX = useTransform(plateSpread, [0, 1], [0, 28]);
  const plateTopY = useTransform(plateSpread, [0, 1], [0, -18]);
  const plateBottomY = useTransform(plateSpread, [0, 1], [0, 18]);

  const [activeTab, setActiveTab] = useState<SidebarTab>("Requests");
  const [liveSync, setLiveSync] = useState(true);
  const [eventsCount, setEventsCount] = useState(418);
  const [confirmedTasks, setConfirmedTasks] = useState<Record<string, boolean>>({ t1: true });
  const [activeAngle, setActiveAngle] = useState<string>("FRONT_TOP");

  useEffect(() => {
    if (!liveSync) return;
    const id = setInterval(() => setEventsCount((s) => s + 1), 3500);
    return () => clearInterval(id);
  }, [liveSync]);

  return (
    <section
      ref={trackRef}
      className="relative z-30 -mt-[100vh] min-h-[225vh] lg:h-[245vh]"
    >
      <motion.div
        style={{
          borderTopLeftRadius: sheetRadius,
          borderTopRightRadius: sheetRadius,
        }}
        className="sticky top-0 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F0F0F0] px-4 py-12 shadow-[0_-24px_80px_rgba(0,0,0,0.18)] sm:px-8 lg:px-12"
      >
        {/* Kinetic scaling title */}
        <motion.div
          style={{ scale: headingScale, y: headingY }}
          className="mb-6 text-center sm:mb-8"
        >
          <h2 className="lp-h2 text-black">That&rsquo;s why CampusLab exists</h2>
        </motion.div>

        {/* Interactive Workspace Stage + 5 Pastel Backdrop Plates */}
        <motion.div
          style={{ scale: appScale, opacity: appOpacity }}
          className="relative mx-auto w-full max-w-[1160px]"
        >
          {/* 5 signature pastel backdrop plates */}
          <motion.div
            style={{ x: plateLeftX, y: plateTopY }}
            className="pointer-events-none absolute -left-5 -top-4 hidden h-36 w-52 rounded-[22px] bg-[#BCE6FA] lg:block"
          />
          <motion.div
            style={{ x: plateRightX, y: plateTopY }}
            className="pointer-events-none absolute -right-5 -top-5 hidden h-40 w-56 rounded-[22px] bg-[#C4F041] lg:block"
          />
          <motion.div
            style={{ x: plateLeftX, y: plateBottomY }}
            className="pointer-events-none absolute -bottom-5 -left-6 hidden h-36 w-60 rounded-[22px] bg-[#FA8E66] lg:block"
          />
          <motion.div
            style={{ x: plateRightX, y: plateBottomY }}
            className="pointer-events-none absolute -bottom-4 -right-6 hidden h-36 w-52 rounded-[22px] bg-[#AAC2AA] lg:block"
          />
          <motion.div
            style={{ y: plateBottomY }}
            className="pointer-events-none absolute -bottom-6 left-1/2 hidden h-20 w-72 -translate-x-1/2 rounded-[22px] bg-[#F3BD77] lg:block"
          />

          {/* Main App Window Frame */}
          <div className="relative z-10 flex min-h-[540px] overflow-hidden rounded-[22px] border border-black/15 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.12)] lg:h-[600px]">
            {/* Left Sidebar */}
            <aside className="hidden w-[215px] shrink-0 flex-col justify-between border-r border-black/10 bg-[#F4F4F2] p-3.5 md:flex">
              <div>
                {/* Sidebar Logo */}
                <div className="mb-3 flex items-center justify-between px-2 py-1">
                  <div className="flex items-center gap-2 text-black">
                    <LoopsiiMark className="h-[18px] w-auto" />
                    <span className="text-[14px] font-semibold tracking-tight">CampusLab</span>
                  </div>
                  <span className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] text-black/50">
                    ⌘K
                  </span>
                </div>

                {/* Search pill */}
                <div className="mb-3 flex items-center justify-between rounded-[10px] border border-black/10 bg-white px-2.5 py-1.5 text-[12px] text-black/50">
                  <span>Search kits, campuses</span>
                  <span className="lp-font-mono text-[10px]">⌘K</span>
                </div>

                {/* Nav Links */}
                <div className="flex flex-col gap-0.5">
                  {SIDEBAR_ITEMS.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                          active
                            ? "bg-white font-semibold text-black shadow-xs"
                            : "text-black/65 hover:bg-black/5 hover:text-black"
                        }`}
                      >
                        <span className="text-[12px] opacity-70">{item.icon}</span>
                        <span>{item.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Footer Row */}
              <div className="flex items-center justify-between border-t border-black/10 pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#AAC2AA] text-[11px] font-semibold text-black">
                    EV
                  </div>
                  <div className="leading-tight">
                    <p className="text-[12px] font-medium text-black">Dr. Elena Vance</p>
                    <p className="text-[10px] text-black/50">Central Lab Mgr</p>
                  </div>
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5 text-[11px]">
                  🔔
                </span>
              </div>
            </aside>

            {/* Right Main App Canvas */}
            <div className="relative flex flex-1 flex-col bg-[#FAFAFA]">
              {/* App Topbar */}
              <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-2.5 sm:px-5">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-black/45">Central</span>
                  <span className="text-black/30">/</span>
                  <span className="font-medium text-black">{activeTab}</span>
                  {activeTab === "Requests" && (
                    <>
                      <span className="hidden text-black/30 sm:inline">/</span>
                      <span className="hidden truncate text-black/65 sm:inline">
                        REQ-2026-0418 · North Campus (CMP-07)
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLiveSync((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                      liveSync
                        ? "border-black bg-[#C4F041] text-black"
                        : "border-black/15 bg-white text-black hover:bg-black/5"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        liveSync ? "animate-pulse bg-black" : "bg-[#FA8E66]"
                      }`}
                    />
                    <span className="tabular-nums">
                      {liveSync ? `Live · ${eventsCount} logs` : "Paused"}
                    </span>
                  </button>
                  <span className="rounded-full bg-black px-3 py-1 text-[12px] font-medium text-white">
                    + Allocate
                  </span>
                </div>
              </div>

              {/* Workspace Body */}
              <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
                {/* Left Request & Verification Details Pane */}
                <div className="border-b border-black/10 bg-white p-5 sm:p-6 lg:col-span-7 lg:border-b-0 lg:border-r">
                  {/* Status Pill */}
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#F4F4F2] px-3 py-1 text-[12px]">
                    <span className="h-2 w-2 rounded-full bg-[#C4F041]" />
                    <span className="font-medium text-black">4-angle proof verified</span>
                    <span className="text-black/45">· Immutable lock</span>
                  </div>

                  <h3 className="text-[20px] font-semibold tracking-tight text-black sm:text-[22px]">
                    Robotics Lab Kit — Campus 07 (North)
                  </h3>
                  <p className="mt-1 text-[12px] text-black/50">
                    Nov 25, 2026 · REQ-2026-0418 · Lab 302 · Active angle: {activeAngle}
                  </p>

                  <p className="mt-4 text-[13.5px] leading-relaxed text-black/75">
                    Arjun Mehta requested 4× Arduino Mega Kits and 2× Digital Oscilloscopes for
                    Embedded Systems Lab 302. Stock was atomically reserved and issued after
                    mandatory 4-angle collection verification.
                  </p>

                  <div className="mt-5">
                    <p className="mb-2.5 text-[13px] font-semibold text-black">Verification trail</p>
                    <ul className="space-y-2.5 text-[13px] leading-relaxed text-black/70">
                      <li className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                        <span>
                          Instructor Prof. Kavita Rao reviewed the lab syllabus match and approved
                          Stage 1.
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                        <span>
                          Campus Lab Manager granted final sign-off, atomically reserving 6 units
                          with zero race conditions.
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                        <span>
                          Student uploaded FRONT_TOP, BACK_BOTTOM, LEFT_SIDE and RIGHT_SIDE photos
                          before pickup.
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                        <span>
                          Collection confirmed — reserved stock moved to borrowed and ledger entry
                          written.
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/50" />
                        <span>
                          Return inspection compares new 4-angle photos side-by-side before closing
                          the loop.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Right Live Audit + Verification Queue Pane */}
                <div className="flex flex-col justify-between bg-[#F7F7F5] p-4 sm:p-5 lg:col-span-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-black">Evidence & Queue</span>
                      <span className="rounded-full bg-[#C4F041] px-2 py-0.5 text-[10px] font-semibold text-black">
                        Live Ledger
                      </span>
                    </div>

                    {/* Check 1 */}
                    <div className="ml-auto max-w-[85%] rounded-[12px] bg-[#E8E8E5] px-3 py-2 text-[12.5px] text-black">
                      Were all 4 collection angles locked?
                    </div>

                    {/* Answer with clickable 4-angle chips */}
                    <div className="rounded-[12px] border border-black/10 bg-white p-3 text-[12.5px] leading-relaxed text-black/75">
                      Yes — all 4 mandatory collection photos are hashed and immutable on{" "}
                      {["FRONT_TOP", "BACK_BOTTOM", "LEFT_SIDE", "RIGHT_SIDE"].map((angle) => (
                        <button
                          key={angle}
                          type="button"
                          onClick={() => setActiveAngle(angle)}
                          className={`mx-0.5 my-0.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            activeAngle === angle
                              ? "bg-[#C4F041] text-black"
                              : "bg-[#EFEFED] text-black/80 hover:bg-black/15"
                          }`}
                        >
                          {angle}
                        </button>
                      ))}
                      .
                    </div>

                    {/* Check 2 */}
                    <div className="ml-auto max-w-[85%] rounded-[12px] bg-[#E8E8E5] px-3 py-2 text-[12.5px] text-black">
                      What needs action across campuses?
                    </div>

                    {/* Actionable Lab Queue */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-black/50">
                        3 pending lab verifications to confirm.
                      </p>
                      {SUGGESTED_TASKS.map((t) => {
                        const checked = !!confirmedTasks[t.id];
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() =>
                              setConfirmedTasks((prev) => ({ ...prev, [t.id]: !prev[t.id] }))
                            }
                            className="flex w-full items-start gap-2.5 rounded-[12px] border border-black/10 bg-white p-2.5 text-left transition-all hover:border-black/30"
                          >
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                                checked
                                  ? "border-black bg-[#C4F041] text-black"
                                  : "border-black/25 bg-white"
                              }`}
                            >
                              {checked ? "✓" : ""}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[12px] font-semibold text-black">
                                  {t.title}
                                </span>
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  style={{
                                    backgroundColor: t.priorityBg,
                                    color: t.priorityColor,
                                  }}
                                >
                                  {t.priority}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[11px] text-black/55">
                                {t.desc}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Glowing Conic Ring FAB */}
              <div className="pointer-events-none absolute bottom-4 right-4 z-20">
                <div className="relative h-11 w-11 rounded-full p-[2.5px] shadow-lg">
                  <div className="lp-conic-ring absolute inset-0 rounded-full" />
                  <div className="relative flex h-full w-full items-center justify-center rounded-full bg-black text-white">
                    <LoopsiiMark className="h-3.5 w-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <div className="mt-10">
          <LoopsiiButton label="Open lab portal" href="/login" size="md" />
        </div>
      </motion.div>
    </section>
  );
}
