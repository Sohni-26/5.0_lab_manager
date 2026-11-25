"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface HighlightItem {
  step: string;
  title: string;
  desc: string;
  points: string[];
  accentBg: string;
  visual: React.ReactNode;
}

/** 1/6: Animated Global Campus Stock Gauge */
function StockGaugeVisual() {
  const [units, setUnits] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      const eased = 1 - Math.pow(1 - t, 3);
      setUnits(Math.round(eased * 7100));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bars = [
    { label: "Available", val: "3.80k", pct: 38, color: "#1C1C1A" },
    { label: "Borrowed", val: "2.00k", pct: 20, color: "#9EC3D5" },
    { label: "Reserved", val: "1.30k", pct: 13, color: "#C4F041" },
    { label: "Transit", val: "1.15k", pct: 11.5, color: "#F3BD77" },
    { label: "Damaged", val: "0.15k", pct: 17.5, color: "#DEDED9" },
  ];

  return (
    <div className="relative flex h-[380px] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#F0F0F0] p-6 sm:h-[420px] sm:p-8">
      <div className="flex items-start justify-between">
        <p className="text-[19px] font-medium text-black/50">Active inventory</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-black/60">
          40 Campuses
        </span>
      </div>

      <div className="my-auto text-center">
        <div className="inline-flex items-baseline justify-center gap-1.5 tabular-nums text-[#1C1C1A]">
          <span className="text-[58px] font-bold leading-none tracking-tight sm:text-[68px]">
            {units.toLocaleString()}
          </span>
          <span className="text-[20px] font-bold text-black/55">units</span>
        </div>
        <p className="mt-2 text-[12px] font-medium text-[#6B6B66]">
          {Math.round((units / 10000) * 100)}% verified across 10,000 catalog items
        </p>

        {/* Segmented horizontal gauge bar */}
        <div className="mt-6 flex h-7 w-full gap-1 overflow-hidden rounded-[8px] bg-white p-1">
          {bars.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ width: 0 }}
              whileInView={{ width: `${b.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.76, 0, 0.24, 1] }}
              className="h-full rounded-[5px]"
              style={{ backgroundColor: b.color }}
            />
          ))}
        </div>
      </div>

      {/* 5 Breakdown Pills */}
      <div className="grid grid-cols-5 gap-1.5 border-t border-dashed border-black/15 pt-4 text-center">
        {bars.map((b) => (
          <div key={b.label} className="flex flex-col items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
            <span className="text-[10px] font-medium text-[#6B6B66]">{b.label}</span>
            <span className="text-[11px] font-semibold text-[#1C1C1A]">{b.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 2/6: Animated Multi-Stage Approval Kanban + Instructor / Lab Manager Cursors */
function ApprovalKanbanVisual() {
  const columns = [
    {
      title: "Requested",
      cards: [
        { tag: "Lab 302", color: "#FA8E66" },
        { tag: "CMP-07", color: "#D9D9D9" },
        { tag: "4 kits", color: "#BCE6FA" },
      ],
    },
    {
      title: "Instructor",
      cards: [
        { tag: "Reviewing", color: "#F3BD77" },
        { tag: "CMP-14", color: "#BCE6FA" },
      ],
    },
    {
      title: "Lab Manager",
      cards: [
        { tag: "Reserve", color: "#FA8E66" },
        { tag: "Atomic", color: "#F3BD77" },
      ],
    },
    {
      title: "Issued",
      cards: [
        { tag: "4-Angle ✓", color: "#C4F041" },
        { tag: "Logged", color: "#AAC2AA" },
      ],
    },
  ];

  return (
    <div className="relative flex h-[380px] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#F0F0F0] p-6 sm:h-[420px] sm:p-7">
      <div className="flex items-center justify-between">
        <p className="text-[19px] font-medium text-black/50">Requests</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-black/60">
          2-Stage Approval · Live
        </span>
      </div>

      {/* 4 Kanban Columns */}
      <div className="mt-4 grid flex-1 grid-cols-4 gap-2">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-2 rounded-[12px] bg-white/80 p-2">
            <p className="truncate text-[10px] font-semibold text-[#1C1C1A]">{col.title}</p>
            {col.cards.map((c, idx) => (
              <div
                key={idx}
                className="rounded-[9px] border border-black/8 bg-white p-2 shadow-2xs"
              >
                <div className="mb-2 h-2 w-4/5 rounded bg-black/10" />
                <div className="mb-2.5 h-1.5 w-3/5 rounded bg-black/6" />
                <span
                  className="inline-block rounded-[6px] px-1.5 py-0.5 text-[9px] font-semibold text-black/75"
                  style={{ backgroundColor: c.color }}
                >
                  {c.tag}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Animated Multiplayer Cursor: Instructor */}
      <motion.div
        animate={{ x: [20, 145, 95, 20], y: [10, -25, 35, 10] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute left-[34%] top-[52%] z-10 flex items-center gap-1"
      >
        <span className="text-[13px] text-black drop-shadow">▲</span>
        <span className="rounded-full bg-[#FA8E66] px-2.5 py-0.5 text-[10px] font-semibold text-black shadow">
          Instructor
        </span>
      </motion.div>

      {/* Animated Multiplayer Cursor: Lab Mgr */}
      <motion.div
        animate={{ x: [-15, -110, -40, -15], y: [0, 35, -30, 0] }}
        transition={{ duration: 7.2, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute right-[18%] top-[44%] z-10 flex items-center gap-1"
      >
        <span className="text-[13px] text-black drop-shadow">▲</span>
        <span className="rounded-full bg-black px-2.5 py-0.5 text-[10px] font-semibold text-[#C4F041] shadow">
          Lab Mgr
        </span>
      </motion.div>
    </div>
  );
}

/** 3/6: Animated Allocations Timeline / Gantt */
function AllocationsTimelineVisual() {
  const months = ["Jul", "Aug", "Sep", "Oct", "Nov"];
  const tracks = [
    { label: "CMP-01 · Robotics Kits", left: "4%", width: "44%", color: "#9EC3D5" },
    { label: "CMP-07 · Oscilloscopes", left: "16%", width: "38%", color: "#C4F041" },
    { label: "CMP-12 · Sensors", left: "34%", width: "24%", color: "#BCE6FA" },
    { label: "CMP-19 · Optics Lab", left: "58%", width: "30%", color: "#F3BD77" },
    { label: "CMP-34 · IoT Kits", left: "66%", width: "31%", color: "#AAC2AA" },
  ];

  return (
    <div className="relative flex h-[380px] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#F0F0F0] p-6 sm:h-[420px] sm:p-7">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[19px] font-medium leading-tight text-black/50">Allocations</p>
          <p className="text-[19px] font-medium leading-tight text-black/50">schedule</p>
        </div>

        {/* Hatched Reserve Capacity Callout */}
        <div className="lp-hatch rounded-[12px] border border-dashed border-black/25 bg-white/80 px-3.5 py-2 text-right">
          <p className="text-[11px] font-semibold text-[#1C1C1A]">Ready · ≈ 120 kits</p>
          <p className="text-[10px] text-black/55">Dispatch wave Sep 8</p>
        </div>
      </div>

      {/* Gantt Grid */}
      <div className="relative my-4 flex-1 rounded-[14px] bg-white p-4">
        <div className="pointer-events-none absolute inset-4 grid grid-cols-5">
          {months.map((m) => (
            <div key={m} className="border-r border-dashed border-black/10 last:border-r-0" />
          ))}
        </div>

        <div className="lp-hatch pointer-events-none absolute bottom-4 left-[48%] top-4 w-[18%] rounded-[8px] border border-dashed border-black/20" />

        <motion.div
          animate={{ x: [0, 8, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-3 left-[36%] top-3 z-10 w-[2px] bg-[#FA8E66]"
        >
          <span className="absolute -left-[3px] -top-1 h-2 w-2 rounded-full bg-[#FA8E66]" />
        </motion.div>

        <div className="relative z-[2] flex h-full flex-col justify-between py-2">
          {tracks.map((tr, i) => (
            <div key={tr.label} className="relative h-7 w-full">
              <motion.div
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.76, 0, 0.24, 1] }}
                style={{
                  left: tr.left,
                  width: tr.width,
                  backgroundColor: tr.color,
                  transformOrigin: "left",
                }}
                className="absolute top-0 flex h-7 items-center justify-between rounded-full px-3 text-[10.5px] font-semibold text-black shadow-2xs"
              >
                <span className="truncate">{tr.label}</span>
                <span className="ml-1 shrink-0">✓</span>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 text-center text-[11px] font-medium text-black/50">
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

/** 4/6: Animated 4-Angle Photo Return Verification Feed */
function PhotoProofsVisual() {
  const items = [
    {
      q: "Oscilloscope #04 · CMP-07",
      meta: "4/4 angles matched · Jul 1",
      pill: "verified good",
      pillBg: "#C4F041",
      pillText: "#000000",
    },
    {
      q: "Soldering Station #12 · CMP-03",
      meta: "2 of 3 units returned · Jul 2",
      pill: "partial return",
      pillBg: "#F3BD77",
      pillText: "#000000",
    },
    {
      q: "Arduino Mega Kit #09 · CMP-14",
      meta: "cracked casing · LEFT_SIDE diff · Jul 2",
      pill: "disputed · damaged",
      pillBg: "#FA8E66",
      pillText: "#000000",
    },
    {
      q: "Fluke Multimeter #22 · CMP-01",
      meta: "4/4 angles matched · Jul 3",
      pill: "verified good",
      pillBg: "#E6E6E2",
      pillText: "#1C1C1A",
    },
  ];

  return (
    <div className="relative flex h-[380px] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#F0F0F0] p-6 sm:h-[420px] sm:p-7">
      <div className="flex items-center justify-between">
        <p className="text-[19px] font-medium text-black/50">Return proofs</p>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black">
          4-angle locked
        </span>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-center gap-2.5">
        {items.map((item, idx) => (
          <motion.div
            key={item.q}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: idx * 0.1 }}
            className="flex items-center justify-between gap-3 rounded-[14px] border border-black/8 bg-white px-4 py-3 shadow-2xs"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#1C1C1A]">{item.q}</p>
              <p className="mt-0.5 text-[11px] text-black/50">{item.meta}</p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
              style={{ backgroundColor: item.pillBg, color: item.pillText }}
            >
              {item.pill}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/** 5/6: Animated Issue Ticket Resolution Widget */
function TicketResolutionVisual() {
  return (
    <div className="relative flex h-[380px] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#F0F0F0] p-6 sm:h-[420px] sm:p-7">
      <div className="flex items-center justify-between border-b border-black/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#C4F041] ring-2 ring-black/15" />
          <span className="text-[13px] font-semibold text-black">
            Ticket #TK-109 · <span className="font-normal text-black/60">CMP-07 North Campus</span>
          </span>
        </div>
        <span className="lp-font-mono rounded bg-black px-2 py-0.5 text-[10px] text-[#C4F041]">
          HIGH
        </span>
      </div>

      <div className="my-auto space-y-3 py-2">
        <div className="ml-auto max-w-[85%] rounded-[14px] bg-black px-3.5 py-2.5 text-[12.5px] text-white">
          Oscilloscope #04 channel-2 probe failed calibration during Lab 302.
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lp-font-mono inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] text-black/75"
        >
          <span>⚙ stock · flag_damaged</span>
          <span className="text-black/40">→</span>
          <span>⚙ ticket · assign_lab_mgr</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.3 }}
          className="rounded-[16px] border border-black/10 bg-white p-4 shadow-xs"
        >
          <p className="text-[13px] font-semibold text-black">
            Moved 1 unit to Damaged & queued central replacement.
          </p>
          <blockquote className="mt-2.5 rounded-[10px] border-l-2 border-[#FA8E66] bg-[#F7F7F5] p-3 text-[12px] italic leading-relaxed text-black/75">
            &ldquo;Attached LEFT_SIDE &amp; FRONT_TOP photos and isolated unit from student
            borrowing pool.&rdquo;
          </blockquote>
          <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-black/50">
            <span>Lab Manager · Resolved · Jul 2</span>
            <span className="rounded bg-[#F0F0F0] px-1.5 py-0.5 font-medium text-black/70">
              ledger synced
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/** 6/6: Animated Immutable Audit Ledger Widget */
function AuditLedgerVisual() {
  const [formatted, setFormatted] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setFormatted((v) => !v), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex h-[380px] w-full max-w-[540px] flex-col justify-between overflow-hidden rounded-[20px] bg-[#F0F0F0] p-6 sm:h-[420px] sm:p-7">
      <div className="flex items-center justify-between">
        <p className="text-[19px] font-medium text-black/50">Audit ledger</p>
        <div className="flex items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 py-1 text-[11px] font-semibold text-black">
          <span className="rounded bg-black px-1.5 py-0.5 text-[10px] text-[#C4F041]">SSE</span>
          <span>Append-only</span>
        </div>
      </div>

      {/* Ledger Entry Card */}
      <div className="my-auto rounded-[16px] border border-black/10 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between border-b border-black/10 pb-2.5 text-[12px]">
          <span className="font-semibold text-black">Ledger · CMP-07 · TXN-9482</span>
          <span className="text-[11px] text-black/45">
            {formatted ? "Atomic transaction committed" : "Streaming event..."}
          </span>
        </div>

        <div className="min-h-[110px] text-[14px] leading-relaxed text-[#1C1C1A]">
          {formatted ? (
            <motion.div
              key="clean"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1.5"
            >
              <p className="font-semibold">STOCK_ISSUED · Arduino Mega Kit</p>
              <p className="text-black/75">
                Reserved: 6 → 2 &nbsp;·&nbsp; Borrowed: 10 → 14
              </p>
              <p className="text-[12px] text-black/50">
                Actor: Prof. Kavita Rao · Proof: 4/4 angles locked
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="raw"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lp-font-mono text-[12px] text-black/50"
            >
              {`{ "tx": "TXN-9482", "campus": "CMP-07", "type": "STOCK_ISSUED", "prev": { "res": 6, "bor": 10 }, "next": { "res": 2, "bor": 14 } }`}
            </motion.p>
          )}
        </div>
      </div>

      {/* Live Stream Pulse Bar */}
      <div className="flex items-center justify-center gap-3 rounded-full bg-black px-5 py-2.5 text-white">
        <span className="h-2 w-2 rounded-full bg-[#FA8E66]" />
        <div className="flex h-5 items-center gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
            <span
              key={n}
              className="lp-wave-bar block h-full w-[3px] rounded-full bg-[#C4F041]"
              style={{ animationDelay: `${n * 90}ms` }}
            />
          ))}
        </div>
        <span className="text-[11px] font-medium text-white/75">
          {formatted ? "Immutable DB audit saved" : "Broadcasting to 40 campuses"}
        </span>
      </div>
    </div>
  );
}

const HIGHLIGHTS: HighlightItem[] = [
  {
    step: "1/6",
    title: "Know where every unit stands",
    desc: "See what’s available, reserved, borrowed, and damaged across all 40 campuses in real time.",
    points: [
      "Global master catalog",
      "Campus stock balances",
      "Atomic stock reservations",
      "Damage & shortage alerts",
    ],
    accentBg: "#9EC3D5",
    visual: <StockGaugeVisual />,
  },
  {
    step: "2/6",
    title: "Keep every role in the loop",
    desc: "Give students, instructors and lab managers one live pipeline from request to verified return.",
    points: [
      "Student request queue",
      "Instructor syllabus review",
      "Lab Manager final sign-off",
      "Real-time status updates",
    ],
    accentBg: "#C4F041",
    visual: <ApprovalKanbanVisual />,
  },
  {
    step: "3/6",
    title: "Plan dispatches across every campus",
    desc: "See stock allocations and campus capacity together, so you can spot shortages before labs begin.",
    points: [
      "Central-to-campus dispatch",
      "Incoming stock verification",
      "Shortage & damage logging",
      "Semester lab capacity",
    ],
    accentBg: "#FA8E66",
    visual: <AllocationsTimelineVisual />,
  },
  {
    step: "4/6",
    title: "Prove equipment condition every time",
    desc: "Capture mandatory 4-angle photo evidence at collection and return so damage disputes disappear.",
    points: [
      "4-angle collection photos",
      "Immutable evidence lock",
      "Side-by-side return checks",
      "Damage & missing tracking",
    ],
    accentBg: "#AAC2AA",
    visual: <PhotoProofsVisual />,
  },
  {
    step: "5/6",
    title: "Resolve lab tickets without chaos",
    desc: "Instructors log faulty or missing gear straight to their campus Lab Manager with full item history.",
    points: [
      "Item-linked issue tickets",
      "Threaded resolution notes",
      "Priority & status routing",
      "Central team visibility",
    ],
    accentBg: "#F3BD77",
    visual: <TicketResolutionVisual />,
  },
  {
    step: "6/6",
    title: "Every stock change, permanently audited",
    desc: "Every allocation, reservation, issue and adjustment writes an immutable ledger entry automatically.",
    points: [
      "Append-only stock ledger",
      "Before & after quantity diffs",
      "Role-scoped audit history",
      "Instant CSV & PDF exports",
    ],
    accentBg: "#BCE6FA",
    visual: <AuditLedgerVisual />,
  },
];

export function HighlightsSection() {
  return (
    <section className="relative z-20 bg-[#F0F0F0] px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1380px]">
        <h2 className="lp-h2 mx-auto mb-14 max-w-[15ch] text-center text-black lg:mb-20">
          Everything across your labs, handled
        </h2>

        {/* 6 Sticky Stacking Cards */}
        <div className="relative flex flex-col gap-8">
          {HIGHLIGHTS.map((card, idx) => (
            <div
              key={card.step}
              className="lg:sticky"
              style={{
                top: `${88 + idx * 18}px`,
                zIndex: idx + 1,
              }}
            >
              <div className="grid min-h-[540px] grid-cols-1 overflow-hidden rounded-[32px] bg-white shadow-[0_8px_45px_rgba(0,0,0,0.06)] lg:grid-cols-12 lg:rounded-[48px]">
                {/* Left White Copy + 4 Hairline-Divided Points */}
                <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-5 lg:p-12">
                  <div>
                    <p className="lp-text-note text-black">{card.step}</p>
                    <h3 className="mt-4 text-[26px] font-semibold leading-[1.12] tracking-[-0.02em] text-black sm:text-[32px]">
                      {card.title}
                    </h3>
                    <p className="mt-4 text-[16px] leading-relaxed text-black/70">{card.desc}</p>
                  </div>

                  <ul className="mt-8 divide-y divide-black/15 border-t border-black/15">
                    {card.points.map((pt) => (
                      <li
                        key={pt}
                        className="flex items-center gap-3 py-3.5 text-[15px] font-medium text-black"
                      >
                        <span className="h-[7px] w-[7px] shrink-0 bg-black" />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right Signature Colored Showcase Pane */}
                <div
                  className="flex items-center justify-center p-5 sm:p-8 lg:col-span-7 lg:p-10"
                  style={{ backgroundColor: card.accentBg }}
                >
                  {card.visual}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
