"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Layers,
  PackageCheck,
  Radio,
  ShieldCheck,
} from "lucide-react";

const PREVIEW_CAMPUSES = [
  {
    code: "CMP-01",
    name: "Bengaluru North",
    available: 232,
    borrowed: 58,
    pending: 4,
    items: [
      { code: "INS-OSC-100", name: "Rigol DS1054Z Oscilloscope", avail: 14, borrowed: 6, visible: true },
      { code: "ELC-RPI-508", name: "Raspberry Pi 5 (8GB) Kit", avail: 38, borrowed: 12, visible: true },
      { code: "CMP-JET-ORIN", name: "NVIDIA Jetson Orin Nano", avail: 11, borrowed: 5, visible: true },
      { code: "ROB-LDR-A2M", name: "RPLIDAR A2M12 Scanner", avail: 8, borrowed: 3, visible: false },
    ],
  },
  {
    code: "CMP-02",
    name: "Hyderabad Central",
    available: 314,
    borrowed: 72,
    pending: 2,
    items: [
      { code: "INS-FLK-117", name: "Fluke 117 True-RMS Meter", avail: 42, borrowed: 18, visible: true },
      { code: "ELC-ARD-GIGA", name: "Arduino GIGA R1 WiFi", avail: 56, borrowed: 14, visible: true },
      { code: "INS-PSU-305", name: "Korad KA3005D Bench PSU", avail: 24, borrowed: 8, visible: true },
      { code: "ROB-ARM-6DOF", name: "6-DOF Robotic Arm Kit", avail: 9, borrowed: 4, visible: true },
    ],
  },
  {
    code: "CMP-03",
    name: "Pune Innovation",
    available: 196,
    borrowed: 41,
    pending: 3,
    items: [
      { code: "CMP-JET-ORIN", name: "NVIDIA Jetson Orin Nano", avail: 16, borrowed: 7, visible: true },
      { code: "INS-OSC-100", name: "Rigol DS1054Z Oscilloscope", avail: 12, borrowed: 4, visible: true },
      { code: "ELC-RPI-508", name: "Raspberry Pi 5 (8GB) Kit", avail: 44, borrowed: 15, visible: true },
      { code: "INS-FLK-117", name: "Fluke 117 True-RMS Meter", avail: 31, borrowed: 6, visible: true },
    ],
  },
];

export function HeroPreview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const campus = PREVIEW_CAMPUSES[activeIdx];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
      className="relative"
    >
      {/* Main SaaS App Frame */}
      <div className="rounded-3xl border border-[#E6E5E0] bg-white p-4 sm:p-5 shadow-[0_20px_60px_rgba(34,35,33,0.08)]">
        {/* Top Window Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFECE6]">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E6E5E0]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E6E5E0]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E6E5E0]" />
            <span className="ml-2 text-xs font-medium text-[#72736E]">
              CampusLab · Live Inventory Sheet
            </span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF6F1] px-2.5 py-1 text-[11px] font-semibold text-[#288568]">
            <Radio className="h-3 w-3 animate-pulse" />
            40 Campuses Synced
          </div>
        </div>

        {/* Interactive Campus Switcher Pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {PREVIEW_CAMPUSES.map((c, idx) => (
            <button
              key={c.code}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                activeIdx === idx
                  ? "bg-[#222321] text-white shadow-xs"
                  : "bg-[#F2F1ED] text-[#72736E] hover:bg-[#EAE9E4] hover:text-[#222321]"
              }`}
            >
              <span className="font-mono text-[10px] opacity-75 mr-1.5">{c.code}</span>
              {c.name}
            </button>
          ))}
        </div>

        {/* Miniature KPI Strip */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF9F6] p-3">
            <p className="text-[11px] font-medium text-[#72736E]">Available</p>
            <p className="mt-1 text-xl font-bold text-[#222321] font-display">
              {campus.available}
            </p>
            <span className="text-[10px] font-medium text-[#288568]">Verified stock</span>
          </div>
          <div className="rounded-2xl border border-[#EFECE6] bg-[#FAF9F6] p-3">
            <p className="text-[11px] font-medium text-[#72736E]">Borrowed</p>
            <p className="mt-1 text-xl font-bold text-[#222321] font-display">
              {campus.borrowed}
            </p>
            <span className="text-[10px] font-medium text-[#4D83B5]">4-photo tracked</span>
          </div>
          <div className="rounded-2xl border border-[#F26943]/20 bg-[#FFF0E9]/60 p-3">
            <p className="text-[11px] font-medium text-[#DA5835]">Action Queue</p>
            <p className="mt-1 text-xl font-bold text-[#222321] font-display">
              {campus.pending}
            </p>
            <span className="text-[10px] font-medium text-[#DA5835]">Awaiting review</span>
          </div>
        </div>

        {/* Sheet-style Inventory Rows */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#E6E5E0]">
          <div className="grid grid-cols-12 bg-[#F8F7F4] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#72736E]">
            <div className="col-span-6">Equipment</div>
            <div className="col-span-2 text-right">Avail</div>
            <div className="col-span-2 text-right">Out</div>
            <div className="col-span-2 text-right">Status</div>
          </div>
          <div className="divide-y divide-[#EFECE6]">
            {campus.items.map((row) => (
              <div
                key={row.code}
                className="grid grid-cols-12 items-center px-3 py-2.5 text-xs hover:bg-[#FAF9F6] transition-colors"
              >
                <div className="col-span-6 pr-2">
                  <p className="font-medium text-[#222321] truncate">{row.name}</p>
                  <p className="font-mono text-[10px] text-[#72736E]">{row.code}</p>
                </div>
                <div className="col-span-2 text-right font-semibold text-[#288568]">
                  {row.avail}
                </div>
                <div className="col-span-2 text-right font-medium text-[#222321]">
                  {row.borrowed}
                </div>
                <div className="col-span-2 flex justify-end">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      row.visible
                        ? "bg-[#EAF6F1] text-[#288568]"
                        : "bg-[#EAE9E4] text-[#72736E]"
                    }`}
                  >
                    {row.visible ? "Visible" : "Hidden"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Verification Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F2F1ED] px-3.5 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-[#222321]">
            <PackageCheck className="h-4 w-4 text-[#F26943]" />
            <span className="font-medium">ALLOC-2026-0142</span>
            <span className="text-[#72736E]">· 20 units awaiting verification</span>
          </div>
          <span className="font-semibold text-[#F26943]">Verify stock →</span>
        </div>
      </div>

      {/* Floating Accountability Badge (Bottom Left) */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="hidden sm:flex absolute -bottom-5 -left-6 items-center gap-3 rounded-2xl border border-[#E6E5E0] bg-white px-4 py-3 shadow-lg"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0E9] text-[#F26943]">
          <Camera className="h-4.5 w-4.5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#222321]">4-Angle Photo Audit</p>
          <p className="text-[11px] text-[#72736E]">Collection vs Return verified</p>
        </div>
        <CheckCircle2 className="h-4 w-4 text-[#288568] ml-1" />
      </motion.div>

      {/* Floating Transaction Ledger Chip (Top Right) */}
      <motion.div
        animate={{ y: [0, 5, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
        className="hidden lg:flex absolute -top-4 -right-5 items-center gap-2.5 rounded-2xl border border-[#E6E5E0] bg-white px-3.5 py-2.5 shadow-lg"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF6F1] text-[#288568]">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-semibold text-[#222321]">Atomic Stock Reserve</p>
          <p className="text-[10px] text-[#72736E]">Zero double-booking</p>
        </div>
      </motion.div>

      {/* Suppress unused icon warning by using subtle decorative metadata if needed */}
      <span className="sr-only">
        <Layers />
        <ClipboardCheck />
      </span>
    </motion.div>
  );
}
