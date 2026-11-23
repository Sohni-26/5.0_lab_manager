"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  Lock,
  PackageCheck,
  Radio,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type StageTab = "sheet" | "verify" | "approvals" | "photos";

const STAGE_TABS: Array<{
  id: StageTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "sheet", label: "Live Campus Sheet", shortLabel: "Inventory", icon: FileSpreadsheet },
  { id: "verify", label: "Incoming Stock ✓/✗", shortLabel: "Verify", icon: PackageCheck },
  { id: "approvals", label: "Request Pipeline", shortLabel: "Approvals", icon: ClipboardCheck },
  { id: "photos", label: "4-Angle Photo Audit", shortLabel: "4-Angle", icon: Camera },
];

const INITIAL_SHEET_ROWS = [
  {
    id: "1",
    code: "ELC-ARD-UNO",
    name: "Arduino Uno R4 WiFi",
    category: "Microcontrollers",
    allocated: 50,
    received: 48,
    available: 34,
    reserved: 4,
    borrowed: 10,
    visible: true,
  },
  {
    id: "2",
    code: "INS-OSC-100",
    name: "Rigol DS1054Z Oscilloscope",
    category: "Test & Measure",
    allocated: 24,
    received: 24,
    available: 15,
    reserved: 3,
    borrowed: 6,
    visible: true,
  },
  {
    id: "3",
    code: "CMP-JET-ORIN",
    name: "NVIDIA Jetson Orin Nano",
    category: "Edge AI Kits",
    allocated: 18,
    received: 18,
    available: 11,
    reserved: 2,
    borrowed: 5,
    visible: true,
  },
  {
    id: "4",
    code: "ROB-LDR-A2M",
    name: "RPLIDAR A2M12 Scanner",
    category: "Robotics",
    allocated: 12,
    received: 12,
    available: 8,
    reserved: 1,
    borrowed: 3,
    visible: false,
  },
];

const INITIAL_VERIFY_ROWS = [
  {
    id: "v1",
    code: "ELC-ARD-UNO",
    name: "Arduino Uno R4 WiFi",
    expected: 50,
    received: 48,
    status: "discrepancy" as "pending" | "verified" | "discrepancy",
    note: "2 units missing from sealed tray #2",
  },
  {
    id: "v2",
    code: "ELC-BRD-830",
    name: "830-Point Breadboard",
    expected: 30,
    received: 30,
    status: "verified" as "pending" | "verified" | "discrepancy",
    note: "Count confirmed on arrival",
  },
  {
    id: "v3",
    code: "ELC-JMP-120",
    name: "Jumper Wire Set (120pc)",
    expected: 100,
    received: 100,
    status: "pending" as "pending" | "verified" | "discrepancy",
    note: "Click ✓ or ✗ to test live verification",
  },
];

export function HeroStage() {
  const [activeTab, setActiveTab] = useState<StageTab>("sheet");
  const [activeCampus, setActiveCampus] = useState("CMP-01 · Bengaluru North");
  const [sheetRows, setSheetRows] = useState(INITIAL_SHEET_ROWS);
  const [verifyRows, setVerifyRows] = useState(INITIAL_VERIFY_ROWS);
  const [approvalStep, setApprovalStep] = useState<1 | 2 | 3>(2);
  const [photoPhase, setPhotoPhase] = useState<"COLLECTION" | "RETURN">("COLLECTION");

  const toggleVisibility = (id: string) => {
    setSheetRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r))
    );
  };

  const setVerifyStatus = (id: string, status: "verified" | "discrepancy") => {
    setVerifyRows((rows) =>
      rows.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              received: status === "verified" ? r.expected : Math.max(0, r.expected - 2),
              note:
                status === "verified"
                  ? "Verified & added to campus stock"
                  : "2 units flagged as missing discrepancy",
            }
          : r
      )
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto max-w-5xl"
    >
      {/* Interactive Module Pill Switcher Above Frame (Loopsii signature) */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
        {STAGE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-[#222321] text-white shadow-sm"
                  : "bg-white/90 text-[#72736E] border border-[#E6E5E0] hover:border-[#222321]/25 hover:text-[#222321]"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#F26943]" : ""}`} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Double-Bezel Warm SaaS Product Frame */}
      <div className="rounded-[28px] border border-[#E2E0D8] bg-[#EAE9E4]/80 p-2 sm:p-3 shadow-stage">
        <div className="overflow-hidden rounded-[22px] border border-[#E6E5E0] bg-white">
          {/* App Window Chrome */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE6] bg-[#FAF9F6] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E3DED5]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E3DED5]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E3DED5]" />
              </div>
              <div className="h-4 w-px bg-[#E6E5E0]" />
              <div className="flex items-center gap-1.5 rounded-full border border-[#E6E5E0] bg-white px-3 py-1 text-[11px] font-medium text-[#222321]">
                <Building2 className="h-3 w-3 text-[#F26943]" />
                <select
                  aria-label="Preview campus switcher"
                  value={activeCampus}
                  onChange={(e) => setActiveCampus(e.target.value)}
                  className="bg-transparent text-[11px] font-medium text-[#222321] focus:outline-none cursor-pointer"
                >
                  <option>CMP-01 · Bengaluru North</option>
                  <option>CMP-02 · Hyderabad Central</option>
                  <option>CMP-03 · Pune Innovation</option>
                  <option>CMP-14 · Chennai Tech Hub</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#F2F1ED] px-2.5 py-1 text-[11px] text-[#72736E]">
                <Search className="h-3 w-3" />
                <span>Interactive preview — try clicking rows</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6F1] px-2.5 py-1 text-[11px] font-semibold text-[#288568]">
                <Radio className="h-3 w-3 animate-pulse" />
                Live Sync
              </div>
            </div>
          </div>

          {/* App Body: Mini Sidebar + Active Stage */}
          <div className="grid md:grid-cols-12 min-h-[370px]">
            {/* Mini Left Rail */}
            <div className="hidden md:flex md:col-span-3 flex-col justify-between border-r border-[#EFECE6] bg-[#FAF9F6]/70 p-4">
              <div className="space-y-1">
                <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#72736E]">
                  Workspace
                </p>
                {STAGE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? "bg-[#FFF0E9] text-[#DA5835]"
                          : "text-[#72736E] hover:bg-[#F2F1ED] hover:text-[#222321]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-[#E6E5E0] bg-white p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-[#72736E]">Network Health</span>
                  <span className="font-semibold text-[#288568]">40 / 40</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#EAE9E4]">
                  <div className="h-full w-[94%] rounded-full bg-[#F26943]" />
                </div>
                <p className="mt-1.5 text-[10px] text-[#72736E]">
                  Zero negative-stock violations
                </p>
              </div>
            </div>

            {/* Active Interactive Workspace Panel */}
            <div className="md:col-span-9 p-4 sm:p-6">
              <AnimatePresence mode="wait">
                {activeTab === "sheet" && (
                  <motion.div
                    key="sheet"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#222321]">
                          Dynamic Campus Inventory Sheet
                        </h3>
                        <p className="text-xs text-[#72736E]">
                          Toggle visibility switches to control what Students &amp; Instructors see in real time.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F2F1ED] px-2.5 py-1 font-mono text-[11px] font-medium text-[#222321]">
                        {sheetRows.filter((r) => r.visible).length} of {sheetRows.length} visible
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-[#E6E5E0]">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#EFECE6] bg-[#FAF9F6] text-[10px] font-semibold uppercase tracking-wider text-[#72736E]">
                            <th className="px-3.5 py-2.5">Item</th>
                            <th className="px-2.5 py-2.5 text-right">Recv</th>
                            <th className="px-2.5 py-2.5 text-right">Avail</th>
                            <th className="px-2.5 py-2.5 text-right">Resv</th>
                            <th className="px-2.5 py-2.5 text-right">Out</th>
                            <th className="px-3.5 py-2.5 text-right">Visibility</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFECE6]">
                          {sheetRows.map((row) => (
                            <tr
                              key={row.id}
                              className="hover:bg-[#FAF9F6] transition-colors"
                            >
                              <td className="px-3.5 py-2.5">
                                <p className="font-medium text-[#222321]">{row.name}</p>
                                <p className="font-mono text-[10px] text-[#72736E]">
                                  {row.code} · {row.category}
                                </p>
                              </td>
                              <td className="px-2.5 py-2.5 text-right text-[#72736E]">
                                {row.received}
                              </td>
                              <td className="px-2.5 py-2.5 text-right font-semibold text-[#288568]">
                                {row.available}
                              </td>
                              <td className="px-2.5 py-2.5 text-right text-[#D69A35] font-medium">
                                {row.reserved}
                              </td>
                              <td className="px-2.5 py-2.5 text-right text-[#4D83B5] font-medium">
                                {row.borrowed}
                              </td>
                              <td className="px-3.5 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => toggleVisibility(row.id)}
                                  className="inline-flex items-center gap-2 cursor-pointer"
                                  aria-label={`Toggle visibility for ${row.name}`}
                                >
                                  <span
                                    className={`text-[11px] font-medium ${
                                      row.visible ? "text-[#288568]" : "text-[#72736E]"
                                    }`}
                                  >
                                    {row.visible ? "Shown" : "Hidden"}
                                  </span>
                                  <span
                                    className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                                      row.visible ? "bg-[#288568]" : "bg-[#D6D4CC]"
                                    }`}
                                  >
                                    <span
                                      className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                                        row.visible ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {activeTab === "verify" && (
                  <motion.div
                    key="verify"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#222321]">
                          Incoming Shipment · ALLOC-2026-0142
                        </h3>
                        <p className="text-xs text-[#72736E]">
                          Expected quantities are never auto-trusted. Click ✓ or ✗ on any line item.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#FFF0E9] px-2.5 py-1 text-[11px] font-semibold text-[#DA5835]">
                        Discrepancy Guard Active
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {verifyRows.map((row) => (
                        <div
                          key={row.id}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors ${
                            row.status === "discrepancy"
                              ? "border-[#D9534F]/35 bg-[#FDEDEC]/55"
                              : row.status === "verified"
                                ? "border-[#288568]/30 bg-[#EAF6F1]/55"
                                : "border-[#E6E5E0] bg-[#FAF9F6]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-semibold text-[#72736E]">
                                {row.code}
                              </span>
                              <span className="text-xs font-semibold text-[#222321]">
                                {row.name}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-[#72736E]">{row.note}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right text-xs">
                              <span className="text-[#72736E]">Expected </span>
                              <strong className="text-[#222321]">{row.expected}</strong>
                              <span className="mx-1.5 text-[#D6D4CC]">|</span>
                              <span className="text-[#72736E]">Recv </span>
                              <strong
                                className={
                                  row.received < row.expected
                                    ? "text-[#D9534F]"
                                    : "text-[#288568]"
                                }
                              >
                                {row.received}
                              </strong>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setVerifyStatus(row.id, "verified")}
                                className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                                  row.status === "verified"
                                    ? "border-[#288568] bg-[#288568] text-white"
                                    : "border-[#E6E5E0] bg-white text-[#288568] hover:bg-[#EAF6F1]"
                                }`}
                                title="Confirm full receipt"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setVerifyStatus(row.id, "discrepancy")}
                                className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                                  row.status === "discrepancy"
                                    ? "border-[#D9534F] bg-[#D9534F] text-white"
                                    : "border-[#E6E5E0] bg-white text-[#D9534F] hover:bg-[#FDEDEC]"
                                }`}
                                title="Flag discrepancy"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "approvals" && (
                  <motion.div
                    key="approvals"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#222321]">
                          Two-Stage Approval &amp; Atomic Stock Reservation
                        </h3>
                        <p className="text-xs text-[#72736E]">
                          Click a stage to inspect how stock locks atomically with zero double-booking.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6F1] px-2.5 py-1 text-[11px] font-semibold text-[#288568]">
                        <Lock className="h-3 w-3" />
                        PostgreSQL Row Lock
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          step: 1 as const,
                          role: "Stage 1 · Student",
                          status: "PENDING_INSTRUCTOR",
                          desc: "Requests 2x Rigol Oscilloscope for Embedded Lab.",
                        },
                        {
                          step: 2 as const,
                          role: "Stage 2 · Instructor",
                          status: "PENDING_LAB_MANAGER",
                          desc: "Prof. Nair verifies academic need & forwards.",
                        },
                        {
                          step: 3 as const,
                          role: "Stage 3 · Lab Manager",
                          status: "APPROVED (RESERVED)",
                          desc: "Atomically moves 2 units: Available → Reserved.",
                        },
                      ].map((s) => (
                        <button
                          key={s.step}
                          type="button"
                          onClick={() => setApprovalStep(s.step)}
                          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                            approvalStep === s.step
                              ? "border-[#F26943] bg-[#FFF0E9]/60 shadow-xs"
                              : "border-[#E6E5E0] bg-[#FAF9F6] hover:border-[#222321]/20"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-[#222321]">
                              {s.role}
                            </span>
                            {approvalStep >= s.step && (
                              <CheckCircle2 className="h-4 w-4 text-[#288568]" />
                            )}
                          </div>
                          <p className="mt-1.5 font-mono text-[10px] font-semibold text-[#DA5835]">
                            {s.status}
                          </p>
                          <p className="mt-1.5 text-[11px] text-[#72736E] leading-relaxed">
                            {s.desc}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-[#E6E5E0] bg-[#FAF9F6] p-4 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#72736E]">
                          Live Stock Snapshot · Rigol DS1054Z
                        </p>
                        <p className="mt-1 text-xs text-[#222321]">
                          {approvalStep < 3
                            ? "Stock remains available until Campus Lab Manager grants final approval."
                            : "2 units atomically reserved — concurrent requests cannot oversell this stock."}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-white border border-[#E6E5E0] px-3 py-2 text-center">
                          <span className="block text-[10px] text-[#72736E]">Available</span>
                          <span className="text-base font-bold text-[#288568]">
                            {approvalStep === 3 ? 13 : 15}
                          </span>
                        </div>
                        <div className="rounded-xl bg-white border border-[#F26943]/30 px-3 py-2 text-center">
                          <span className="block text-[10px] text-[#DA5835]">Reserved</span>
                          <span className="text-base font-bold text-[#F26943]">
                            {approvalStep === 3 ? 5 : 3}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "photos" && (
                  <motion.div
                    key="photos"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#222321]">
                          Mandatory 4-Angle Visual Accountability
                        </h3>
                        <p className="text-xs text-[#72736E]">
                          Collection &amp; return both require 4 immutable angles compared side-by-side.
                        </p>
                      </div>
                      <div className="inline-flex rounded-full bg-[#F2F1ED] p-1">
                        {(["COLLECTION", "RETURN"] as const).map((phase) => (
                          <button
                            key={phase}
                            type="button"
                            onClick={() => setPhotoPhase(phase)}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                              photoPhase === phase
                                ? "bg-white text-[#222321] shadow-xs"
                                : "text-[#72736E]"
                            }`}
                          >
                            {phase === "COLLECTION" ? "Collection (4/4)" : "Return Check (4/4)"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { angle: "Front / Top", tag: "FRONT_TOP", ok: true },
                        { angle: "Back / Bottom", tag: "BACK_BOTTOM", ok: true },
                        { angle: "Left Side", tag: "LEFT_SIDE", ok: true },
                        {
                          angle: "Right Side",
                          tag: "RIGHT_SIDE",
                          ok: photoPhase === "COLLECTION",
                        },
                      ].map((slot) => (
                        <div
                          key={slot.tag}
                          className={`rounded-2xl border p-3 ${
                            slot.ok
                              ? "border-[#E6E5E0] bg-[#FAF9F6]"
                              : "border-[#D69A35]/40 bg-[#FDF6E7]/70"
                          }`}
                        >
                          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#D6D4CC] bg-white">
                            <div className="text-center">
                              {slot.ok ? (
                                <ShieldCheck className="mx-auto h-6 w-6 text-[#288568]" />
                              ) : (
                                <AlertTriangle className="mx-auto h-6 w-6 text-[#D69A35]" />
                              )}
                              <span className="mt-1 block font-mono text-[9px] text-[#72736E]">
                                {slot.tag}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2.5 text-xs font-semibold text-[#222321]">
                            {slot.angle}
                          </p>
                          <p
                            className={`text-[10px] font-medium ${
                              slot.ok ? "text-[#288568]" : "text-[#D69A35]"
                            }`}
                          >
                            {slot.ok
                              ? photoPhase === "COLLECTION"
                                ? "Locked immutable"
                                : "Matches baseline"
                              : "Scuff noted · review"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
