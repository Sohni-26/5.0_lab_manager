"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  GitBranch,
  Lock,
  MessageSquareWarning,
  Package,
  Radio,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const CHAOS_BUBBLES = [
  {
    quote: "“Wait… did Campus 14 ever receive those 50 Arduinos?”",
    tag: "Disconnected inventories",
    icon: FileSpreadsheet,
    rotate: "-rotate-2",
    tone: "bg-white",
  },
  {
    quote: "“Who approved 6 oscilloscopes when only 4 were left?”",
    tag: "Double-booked stock",
    icon: GitBranch,
    rotate: "rotate-1",
    tone: "bg-[#FFF0E9]/70 border-[#F26943]/25",
  },
  {
    quote: "“This soldering station came back broken — who had it last?”",
    tag: "Zero photo proof",
    icon: Camera,
    rotate: "-rotate-1",
    tone: "bg-white",
  },
  {
    quote: "“Let me cross-check 4 spreadsheets and a WhatsApp group…”",
    tag: "Manual verification",
    icon: AlertTriangle,
    rotate: "rotate-2",
    tone: "bg-white",
  },
  {
    quote: "“Where did 12 Raspberry Pi kits disappear last semester?”",
    tag: "Missing audit history",
    icon: Lock,
    rotate: "-rotate-1",
    tone: "bg-[#FAF9F6]",
  },
];

export function FeatureBento() {
  const [selectedCampusCode, setSelectedCampusCode] = useState("CMP-04");
  const [demoPhotoCompare, setDemoPhotoCompare] = useState<"before" | "after">("before");

  return (
    <>
      {/* SECTION 2: Loopsii-style Conversational Pain-Point Agitation */}
      <section className="relative py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E5E0] bg-white px-3.5 py-1 text-xs font-medium text-[#72736E]">
              <MessageSquareWarning className="h-3.5 w-3.5 text-[#F26943]" />
              Sound familiar?
            </span>
            <h2 className="mt-5 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#222321] leading-[1.06] font-display">
              Managing 40 campuses shouldn&apos;t mean managing 40 different systems.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#72736E] leading-relaxed">
              Spreadsheets drift, deliveries go unverified, and lab kits vanish between benches.
              CampusLab replaces every scattered tool with one calm, connected loop.
            </p>
          </div>

          {/* Playful Tilted Tactile Chaos Cards (straighten cleanly on hover) */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
            {CHAOS_BUBBLES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.tag}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.4, delay: idx * 0.06 }}
                  whileHover={{ rotate: 0, y: -4, scale: 1.02 }}
                  className={`w-full sm:w-[310px] rounded-[24px] border border-[#E6E5E0] p-5 shadow-card transition-shadow hover:shadow-card-hover ${item.rotate} ${item.tone}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F2F1ED] px-2.5 py-1 text-[11px] font-semibold text-[#72736E]">
                      <Icon className="h-3 w-3 text-[#F26943]" />
                      {item.tag}
                    </span>
                    <span className="h-2 w-2 rounded-full bg-[#D9534F]/70" />
                  </div>
                  <p className="mt-3.5 text-[15px] font-medium leading-snug text-[#222321]">
                    {item.quote}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-12 flex justify-center">
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-[#E6E5E0] bg-white px-4 py-2 text-xs font-semibold text-[#222321] shadow-xs hover:border-[#F26943]/40 transition-colors"
            >
              <span>See how CampusLab closes the loop</span>
              <ArrowDown className="h-3.5 w-3.5 text-[#F26943]" />
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 3: Alternating Editorial Feature Showcase ("Everything connected. Nothing lost.") */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E9] px-3.5 py-1 text-xs font-semibold text-[#DA5835]">
              <Sparkles className="h-3.5 w-3.5" />
              Everything connected. Nothing lost.
            </span>
            <h2 className="mt-5 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#222321] leading-[1.06] font-display">
              Four core engines. Built to move in lockstep.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#72736E]">
              Every inventory change writes an immutable ledger entry and broadcasts live to the
              exact campus — never leaking across boundaries.
            </p>
          </div>

          {/* Loopsii-Inspired Editorial Bento Grid (asymmetric 12-col rhythm) */}
          <div className="mt-16 grid gap-6 lg:grid-cols-12">
            {/* Feature 1 (7 cols): Centralised Inventory & Allocation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-7 rounded-[30px] border border-[#E6E5E0] bg-white p-7 sm:p-8 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF0E9] px-3 py-1 text-xs font-semibold text-[#DA5835]">
                    <Package className="h-3.5 w-3.5" />
                    01 · Centralised Inventory
                  </span>
                  <span className="font-mono text-[11px] text-[#72736E]">1 Master Catalog</span>
                </div>
                <h3 className="mt-5 text-2xl sm:text-[1.75rem] font-bold tracking-tight text-[#222321] font-display">
                  Allocate to any of 40 campuses in three clicks.
                </h3>
                <p className="mt-2.5 text-sm sm:text-[15px] text-[#72736E] leading-relaxed">
                  A single Central Lab Manager maintains master items and dispatches multi-item
                  allocations. Stock never hits student shelves until the campus verifies arrival.
                </p>
              </div>

              {/* Interactive Mini Allocation Preview */}
              <div className="mt-7 rounded-[22px] border border-[#E6E5E0] bg-[#F2F1ED]/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                  <span className="text-xs font-semibold text-[#222321]">
                    Quick Dispatch Preview
                  </span>
                  <div className="flex items-center gap-1.5">
                    {["CMP-01", "CMP-04", "CMP-19", "CMP-40"].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setSelectedCampusCode(code)}
                        className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold transition-all cursor-pointer ${
                          selectedCampusCode === code
                            ? "bg-[#222321] text-white"
                            : "bg-white text-[#72736E] border border-[#E6E5E0]"
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-2.5">
                  {[
                    { name: "Arduino Uno R4", qty: "50 pcs", badge: "Verify req." },
                    { name: "830-Pt Breadboard", qty: "30 pcs", badge: "Verify req." },
                    { name: "Jumper Wire Sets", qty: "100 sets", badge: "Verify req." },
                  ].map((it) => (
                    <div
                      key={it.name}
                      className="rounded-2xl border border-[#E6E5E0] bg-white p-3"
                    >
                      <p className="text-xs font-semibold text-[#222321]">{it.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-[#F26943]">{it.qty}</span>
                        <span className="rounded-full bg-[#FDF6E7] px-2 py-0.5 text-[10px] font-medium text-[#D69A35]">
                          {it.badge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3.5 py-2 text-xs border border-[#E6E5E0]">
                  <span className="text-[#72736E]">
                    Destination: <strong className="text-[#222321]">{selectedCampusCode}</strong>
                  </span>
                  <span className="font-semibold text-[#288568]">
                    Status: DISPATCHED → Awaiting Campus ✓/✗
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Feature 2 (5 cols): Campus Stock Management */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="lg:col-span-5 rounded-[30px] border border-[#E6E5E0] bg-white p-7 sm:p-8 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#EDF4FA] px-3 py-1 text-xs font-semibold text-[#4D83B5]">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    02 · Campus Sheets
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#288568]">
                    <Radio className="h-3 w-3 animate-pulse" /> Live
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-[#222321] font-display">
                  Google Sheets speed. Database integrity.
                </h3>
                <p className="mt-2.5 text-sm text-[#72736E] leading-relaxed">
                  Hide or reveal campus equipment instantly, export CSVs, and watch Available,
                  Reserved, Borrowed, and Damaged columns stay mathematically locked.
                </p>
              </div>

              <div className="mt-6 space-y-2 rounded-[22px] border border-[#E6E5E0] bg-[#F2F1ED]/70 p-4">
                {[
                  { name: "Fluke 117 Meter", avail: 42, out: 18, on: true },
                  { name: "Korad Bench PSU", avail: 24, out: 8, on: true },
                  { name: "6-DOF Robot Arm", avail: 6, out: 2, on: false },
                ].map((row) => (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-xl border border-[#E6E5E0] bg-white px-3.5 py-2.5 text-xs"
                  >
                    <span className="font-semibold text-[#222321]">{row.name}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-md bg-[#EAF6F1] px-2 py-0.5 font-semibold text-[#288568]">
                        {row.avail} avail
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.on
                            ? "bg-[#222321] text-white"
                            : "bg-[#EAE9E4] text-[#72736E]"
                        }`}
                      >
                        {row.on ? "Visible" : "Hidden"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Feature 3 (5 cols): Smart Request Workflow */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-5 rounded-[30px] border border-[#E6E5E0] bg-white p-7 sm:p-8 shadow-card flex flex-col justify-between"
            >
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF6F1] px-3 py-1 text-xs font-semibold text-[#288568]">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  03 · Smart Approvals
                </span>
                <h3 className="mt-5 text-2xl font-bold tracking-tight text-[#222321] font-display">
                  Two approvals. Zero double-bookings.
                </h3>
                <p className="mt-2.5 text-sm text-[#72736E] leading-relaxed">
                  Students select their campus Instructor first. Only after academic sign-off can
                  the Lab Manager grant final approval and reserve stock atomically.
                </p>
              </div>

              <div className="mt-6 rounded-[22px] border border-[#E6E5E0] bg-[#F2F1ED]/70 p-4 space-y-2.5">
                {[
                  { label: "Student Submitted", meta: "2x Oscilloscope · Embedded Lab", done: true },
                  { label: "Instructor Approved", meta: "Dr. Meera Iyer · Forwarded", done: true },
                  { label: "Lab Manager Reserved", meta: "Atomic lock · Ready to collect", active: true },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${
                      s.active
                        ? "border-[#F26943]/40 bg-[#FFF0E9]/70"
                        : "border-[#E6E5E0] bg-white"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#222321]">{s.label}</p>
                      <p className="text-[11px] text-[#72736E]">{s.meta}</p>
                    </div>
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        s.active ? "text-[#F26943]" : "text-[#288568]"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Feature 4 (7 cols): 4-Angle Equipment Photo Tracking */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="lg:col-span-7 rounded-[30px] border border-[#E6E5E0] bg-white p-7 sm:p-8 shadow-card flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#FDF6E7] px-3 py-1 text-xs font-semibold text-[#D69A35]">
                    <Camera className="h-3.5 w-3.5" />
                    04 · 4-Angle Visual Proof
                  </span>
                  <div className="inline-flex rounded-full bg-[#F2F1ED] p-1">
                    {(["before", "after"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDemoPhotoCompare(mode)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                          demoPhotoCompare === mode
                            ? "bg-[#222321] text-white"
                            : "text-[#72736E]"
                        }`}
                      >
                        {mode === "before" ? "Collection Baseline" : "Return Inspection"}
                      </button>
                    ))}
                  </div>
                </div>
                <h3 className="mt-5 text-2xl sm:text-[1.75rem] font-bold tracking-tight text-[#222321] font-display">
                  No 4 photos, no handover. Side-by-side return checks.
                </h3>
                <p className="mt-2.5 text-sm sm:text-[15px] text-[#72736E] leading-relaxed">
                  Original collection photos (Front/Top, Back/Bottom, Left, Right) stay permanently
                  immutable. Tickets close only after an Instructor verifies every returned angle.
                </p>
              </div>

              <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-[22px] border border-[#E6E5E0] bg-[#F2F1ED]/70 p-4">
                {[
                  { title: "Front / Top", code: "01", note: "Serial legible" },
                  { title: "Back / Bottom", code: "02", note: "Ports intact" },
                  { title: "Left Side", code: "03", note: "Casing clean" },
                  {
                    title: "Right Side",
                    code: "04",
                    note: demoPhotoCompare === "before" ? "Baseline saved" : "Verified GOOD ✓",
                  },
                ].map((angle) => (
                  <div
                    key={angle.code}
                    className="rounded-2xl border border-[#E6E5E0] bg-white p-3"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#72736E]">
                      <span>ANGLE {angle.code}</span>
                      <span className="h-2 w-2 rounded-full bg-[#288568]" />
                    </div>
                    <p className="mt-3 text-xs font-semibold text-[#222321]">{angle.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#288568] font-medium">{angle.note}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-10 text-center">
            <Button variant="outline" size="lg" className="rounded-full" asChild>
              <Link href="/login">
                Open any of the 4 live workspaces
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
