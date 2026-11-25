"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { LoopsiiButton, LoopsiiMark } from "./primitives";

const STACK_APPS = [
  { name: "Excel Sheets", role: "Campus stock lists", price: "40 files", bg: "#AAC2AA", glyph: "⊞" },
  { name: "Paper Logbooks", role: "Student sign-outs", price: "0 proof", bg: "#9EC3D5", glyph: "✎" },
  { name: "WhatsApp Groups", role: "Damage photo drops", price: "Buried", bg: "#C4F041", glyph: "◉" },
  { name: "Email Threads", role: "Multi-stage approvals", price: "3-day lag", bg: "#FA8E66", glyph: "✉" },
  { name: "Google Forms", role: "Borrowing requests", price: "No lock", bg: "#F3BD77", glyph: "▤" },
  { name: "Sticky Notes", role: "Missing gear tracking", price: "Lost", bg: "#BCE6FA", glyph: "❏" },
];

const FRICTION_NOTES = [
  "re-count the same shelf twice",
  "argue over pre-existing damage",
  "approve kits already out of stock",
  "reconcile missing gear at semester end",
];

const HUB_NODES = [
  { label: "Catalog", angle: -90 },
  { label: "Dispatch", angle: -30 },
  { label: "Approval", angle: 30 },
  { label: "4-Angle Proof", angle: 90 },
  { label: "Return", angle: 150 },
  { label: "Audit Log", angle: 210 },
];

export function StackSection() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <section
      id="why-loopsii"
      className="relative z-20 bg-[#F0F0F0] px-5 pb-20 pt-24 sm:px-10 lg:px-12 lg:pt-32"
    >
      <div className="mx-auto max-w-[1440px]">
        {/* Section Header */}
        <div className="mb-14 max-w-[780px]">
          <p className="lp-text-note mb-3 text-black">the clipboard tax</p>
          <h2 className="lp-h2 text-black">Running 40 campus labs shouldn&rsquo;t break like this</h2>
        </div>

        {/* Phase 1: Fragmented 6-Tool Grid + Roll-up Stats */}
        <div className="relative rounded-[28px] border border-black/15 bg-[#EAEAE7]/70 p-6 sm:p-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
            {/* 6 Disconnected Lab Tools */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:col-span-8">
              {STACK_APPS.map((app, i) => (
                <motion.div
                  key={app.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  whileHover={{ y: -4 }}
                  className="flex min-h-[190px] flex-col justify-between rounded-[20px] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-[12px] text-[16px] font-bold text-black"
                      style={{ backgroundColor: app.bg }}
                    >
                      {app.glyph}
                    </div>
                    <span className="lp-font-mono text-[12px] text-black/45">0{i + 1}</span>
                  </div>

                  <div>
                    <p className="text-[18px] font-semibold tracking-tight text-black">{app.name}</p>
                    <p className="text-[13px] text-black/55">{app.role}</p>
                    <p className="mt-3 text-[24px] font-semibold tracking-tight text-black">
                      {app.price}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right Roll-up Stats + Handwritten Friction Callouts */}
            <div className="flex flex-col justify-between gap-8 lg:col-span-4 lg:pl-6">
              <div className="grid grid-cols-2 gap-6 border-b border-black/15 pb-6">
                <div>
                  <p className="text-[44px] font-medium leading-none tracking-tight text-black sm:text-[56px]">
                    40+
                  </p>
                  <p className="mt-1 text-[14px] text-black/60">campuses</p>
                </div>
                <div>
                  <p className="text-[44px] font-medium leading-none tracking-tight text-black sm:text-[56px]">
                    6+
                  </p>
                  <p className="mt-1 text-[14px] text-black/60">tools juggled</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {FRICTION_NOTES.map((note) => (
                  <div key={note} className="flex items-center gap-2.5">
                    <span className="text-[14px] text-black/45">↳</span>
                    <span className="lp-font-hand text-[22px] leading-tight text-black/80">
                      {note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Phase 2: Connected Loop Hub + Consolidated CampusLab Card */}
        <div className="mt-10 grid grid-cols-1 items-center gap-10 rounded-[28px] border border-black/15 bg-white p-6 sm:p-10 lg:grid-cols-12 lg:p-14">
          <div className="space-y-3 lg:col-span-4">
            <p className="lp-h3 text-black">
              Your entire lab network,
              <br />
              in one app
            </p>
            <p className="lp-text-xl text-black/65">Every campus on it, connected.</p>

            {/* Consolidated CampusLab Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.55 }}
              className="mt-8 rounded-[20px] border border-black/15 bg-[#C4F041] p-6 text-black"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <LoopsiiMark className="h-8 w-auto" />
                </div>
                <span className="rounded-full bg-black px-3 py-1 text-[12px] font-medium text-white">
                  All of the above
                </span>
              </div>
              <p className="mt-5 text-[42px] font-medium leading-none tracking-tight sm:text-[48px]">
                40+ Campuses
              </p>
            </motion.div>
          </div>

          {/* Connected Orbital Hub Diagram */}
          <div className="flex items-center justify-center lg:col-span-8">
            <div className="relative flex h-[320px] w-[320px] items-center justify-center sm:h-[400px] sm:w-[400px]">
              <svg
                viewBox="0 0 400 400"
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                <circle
                  cx="200"
                  cy="200"
                  r="142"
                  fill="none"
                  stroke="rgba(0,0,0,0.85)"
                  strokeWidth="1.5"
                />
                {HUB_NODES.map((n) => {
                  const rad = (n.angle * Math.PI) / 180;
                  const x2 = 200 + Math.cos(rad) * 142;
                  const y2 = 200 + Math.sin(rad) * 142;
                  return (
                    <line
                      key={n.label}
                      x1="200"
                      y1="200"
                      x2={x2}
                      y2={y2}
                      stroke={hoveredNode === n.label ? "#000000" : "rgba(0,0,0,0.16)"}
                      strokeWidth={hoveredNode === n.label ? "2" : "1"}
                      strokeDasharray="4 4"
                    />
                  );
                })}
              </svg>

              {/* Center Hub Pill */}
              <div className="relative z-10 flex flex-col items-center gap-1.5 rounded-full border border-black bg-black px-6 py-3.5 text-white shadow-lg">
                <LoopsiiMark inverse className="h-5 w-auto" />
                <span className="whitespace-nowrap text-[14px] font-semibold">Lab Request</span>
              </div>

              {/* 6 Connected Radial Node Pills */}
              {HUB_NODES.map((node) => {
                const rad = (node.angle * Math.PI) / 180;
                const x = 50 + Math.cos(rad) * 36;
                const y = 50 + Math.sin(rad) * 36;
                const isActive = hoveredNode === node.label;
                return (
                  <button
                    key={node.label}
                    type="button"
                    onMouseEnter={() => setHoveredNode(node.label)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-4 py-2 text-[14px] font-semibold shadow-sm transition-all sm:px-5 sm:py-2.5 sm:text-[15px] ${
                      isActive
                        ? "scale-105 border-black bg-[#C4F041] text-black"
                        : "border-black/20 bg-white text-black hover:border-black"
                    }`}
                  >
                    {node.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Rollout Callout */}
        <div className="mt-16 flex flex-col items-start justify-between gap-8 border-t border-black/15 pt-12 lg:flex-row lg:items-end">
          <div className="max-w-[660px]">
            <h3 className="lp-h3 text-black">Roll out across every campus without starting over</h3>
            <p className="mt-4 text-[17px] leading-relaxed text-black/70">
              Bring your master equipment catalog, campus rosters and opening balances with you —
              categories, serials and stock histories intact. Import twice, get zero duplicates.
            </p>
          </div>
          <LoopsiiButton label="Open lab portal" href="/login" size="md" />
        </div>
      </div>
    </section>
  );
}
