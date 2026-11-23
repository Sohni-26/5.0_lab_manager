"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Layers,
  Lock,
  Package,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "./brand-logo";
import { HeroStage } from "./hero-stage";
import { FeatureBento } from "./feature-bento";
import { RoleLoopSection } from "./role-loop-section";
import { DEMO_CAMPUSES } from "@/lib/demo-data";

export function LandingPage() {
  const [campusSearch, setCampusSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState<"ALL" | "ACTIVE" | "TOP">("ALL");
  const [showAllCampuses, setShowAllCampuses] = useState(false);

  const filteredCampuses = useMemo(() => {
    const q = campusSearch.trim().toLowerCase();
    let list = DEMO_CAMPUSES;
    if (campusFilter === "ACTIVE") {
      list = list.filter((c) => c.status === "ACTIVE");
    } else if (campusFilter === "TOP") {
      list = [...list].sort(
        (a, b) => (b.stats?.availableUnits ?? 0) - (a.stats?.availableUnits ?? 0)
      );
    }
    if (q) {
      list = list.filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.city && c.city.toLowerCase().includes(q)) ||
          (c.state && c.state.toLowerCase().includes(q))
      );
    }
    return showAllCampuses || q ? list : list.slice(0, 12);
  }, [campusSearch, campusFilter, showAllCampuses]);

  return (
    <div className="min-h-screen bg-[#F2F1ED] text-[#222321] selection:bg-[#FFF0E9] selection:text-[#DA5835]">
      {/* Loopsii-Inspired Floating Pill Navigation Bar */}
      <div className="sticky top-0 z-50 px-4 pt-4">
        <header className="mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full border border-[#E2E0D8]/90 bg-white/85 px-3 sm:px-5 shadow-[0_8px_30px_rgba(34,35,33,0.06)] backdrop-blur-xl">
          <Link href="/" className="pl-1 focus:outline-none">
            <BrandLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-[#72736E]">
            {[
              { label: "Features", href: "#features" },
              { label: "How it works", href: "#how-it-works" },
              { label: "40 Campuses", href: "#campuses" },
              { label: "About", href: "#about" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-full px-3.5 py-1.5 hover:bg-[#F2F1ED] hover:text-[#222321] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden sm:inline-flex rounded-full px-3.5 py-1.5 text-sm font-medium text-[#72736E] hover:text-[#222321] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#222321] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#F26943] transition-colors"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>
      </div>

      <main>
        {/* SECTION 1: Monumental Centered Loopsii-Inspired Hero + Floating Tactile Stickers */}
        <section className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28 bg-dot-warm">
          {/* Soft warm ambient top wash */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-[#F2F1ED] via-[#F2F1ED]/70 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#F2F1ED] to-transparent" />

          <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            {/* Floating Tactile UI Stickers on Desktop Margins (Loopsii signature playful polish) */}
            <motion.div
              initial={{ opacity: 0, x: -24, rotate: -6 }}
              animate={{ opacity: 1, x: 0, rotate: -4, y: [0, -6, 0] }}
              transition={{
                opacity: { duration: 0.5, delay: 0.25 },
                x: { duration: 0.5, delay: 0.25 },
                y: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
              }}
              className="hidden xl:flex absolute left-0 top-10 items-center gap-2.5 rounded-2xl border border-[#E6E5E0] bg-white px-3.5 py-2.5 shadow-card"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EAF6F1] text-[#288568]">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#222321]">ALLOC-0142 Verified</p>
                <p className="text-[10px] text-[#72736E]">48/50 received · 2 flagged</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24, rotate: 6 }}
              animate={{ opacity: 1, x: 0, rotate: 4, y: [0, 6, 0] }}
              transition={{
                opacity: { duration: 0.5, delay: 0.3 },
                x: { duration: 0.5, delay: 0.3 },
                y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
              }}
              className="hidden xl:flex absolute right-0 top-12 items-center gap-2.5 rounded-2xl border border-[#E6E5E0] bg-white px-3.5 py-2.5 shadow-card"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF0E9] text-[#F26943]">
                <Camera className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#222321]">4 / 4 Angles Locked</p>
                <p className="text-[10px] text-[#72736E]">Collection vs Return audit</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -16, rotate: 4 }}
              animate={{ opacity: 1, x: 0, rotate: 3, y: [0, 5, 0] }}
              transition={{
                opacity: { duration: 0.5, delay: 0.4 },
                x: { duration: 0.5, delay: 0.4 },
                y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              }}
              className="hidden xl:flex absolute left-6 top-56 items-center gap-2 rounded-full border border-[#E6E5E0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#222321] shadow-card"
            >
              <Lock className="h-3.5 w-3.5 text-[#288568]" />
              Zero double-booking
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16, rotate: -4 }}
              animate={{ opacity: 1, x: 0, rotate: -3, y: [0, -5, 0] }}
              transition={{
                opacity: { duration: 0.5, delay: 0.45 },
                x: { duration: 0.5, delay: 0.45 },
                y: { duration: 5.8, repeat: Infinity, ease: "easeInOut" },
              }}
              className="hidden xl:flex absolute right-6 top-56 items-center gap-2 rounded-full border border-[#E6E5E0] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#222321] shadow-card"
            >
              <Radio className="h-3.5 w-3.5 text-[#F26943] animate-pulse" />
              40 campuses synced live
            </motion.div>

            {/* Centered Expressive Hero Copy */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-4xl text-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#E6E5E0] bg-white px-4 py-1.5 text-xs font-medium text-[#72736E] shadow-xs">
                <span className="h-2 w-2 rounded-full bg-[#288568]" />
                <span>The all-in-one lab operating system for 40 campuses</span>
              </div>

              <h1 className="mt-7 text-[2.75rem] sm:text-6xl lg:text-[4.85rem] font-bold tracking-[-0.04em] text-[#222321] leading-[0.98] font-display">
                One system.
                <br />
                40 campuses.
                <br />
                <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-1">
                  <span>Every lab</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#F26943]/30 bg-[#FFF0E9] px-4 py-1 text-2xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#F26943] align-middle">
                    <Layers className="h-6 w-6 sm:h-8 sm:w-8" />
                    accounted for.
                  </span>
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-[#72736E] leading-relaxed">
                Like a dedicated operations hub for every engineering &amp; science lab — keeping
                master inventory, campus allocations, two-stage approvals, and 4-angle photo
                audits in one continuous loop.
              </p>

              {/* Tactile Rounded-Full CTA Pair */}
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full bg-[#F26943] px-7 py-3.5 text-sm sm:text-base font-semibold text-white hover:bg-[#DA5835] transition-all btn-tactile-accent"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-full border border-[#DDDCD4] bg-white px-7 py-3.5 text-sm sm:text-base font-semibold text-[#222321] hover:border-[#222321]/30 hover:bg-[#FAF9F6] transition-all shadow-xs"
                >
                  <span>Explore Features</span>
                </a>
              </div>

              {/* Clean Metric Pill Strip */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-[#72736E]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#288568]" />
                  40 campuses isolated &amp; synced
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#288568]" />
                  Immutable stock transaction ledger
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#288568]" />
                  Mandatory 4-angle photo proof
                </span>
              </div>
            </motion.div>

            {/* Interactive Full-Width Product Stage Directly Below Hero */}
            <div className="mt-14 sm:mt-16">
              <HeroStage />
            </div>
          </div>
        </section>

        {/* SECTION 2 & 3: Conversational Pain Points + Editorial Interactive Feature Bento */}
        <FeatureBento />

        {/* SECTION 4: Dark Contrast 4-Role Loop Showcase */}
        <RoleLoopSection />

        {/* SECTION 5: Enterprise Scale — Interactive 40-Campus Network Explorer */}
        <section id="campuses" className="py-24 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E5E0] bg-white px-3.5 py-1 text-xs font-semibold text-[#4D83B5]">
                  <Building2 className="h-3.5 w-3.5" />
                  Enterprise Network
                </span>
                <h2 className="mt-4 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#222321] leading-[1.06] font-display">
                  One platform. Forty campuses.
                </h2>
                <p className="mt-3 text-base text-[#72736E] leading-relaxed">
                  Strict campus-level isolation for daily operations, paired with instant global
                  roll-ups for the Central Lab Manager.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="inline-flex rounded-full border border-[#E6E5E0] bg-white p-1">
                  {(
                    [
                      { id: "ALL", label: "All 40" },
                      { id: "ACTIVE", label: "Online" },
                      { id: "TOP", label: "Highest Stock" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCampusFilter(f.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                        campusFilter === f.id
                          ? "bg-[#222321] text-white"
                          : "text-[#72736E] hover:text-[#222321]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
                  <Input
                    value={campusSearch}
                    onChange={(e) => setCampusSearch(e.target.value)}
                    placeholder="Search city or CMP-01..."
                    className="rounded-full pl-10 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredCampuses.map((campus) => {
                const avail = campus.stats?.availableUnits ?? 0;
                const borrowed = campus.stats?.borrowedUnits ?? 0;
                const total = Math.max(1, avail + borrowed);
                const utilPct = Math.round((borrowed / total) * 100);
                return (
                  <div
                    key={campus.id}
                    className="group rounded-[22px] border border-[#E6E5E0] bg-white p-4 shadow-card hover:border-[#F26943]/45 hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#FFF0E9] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#DA5835]">
                        {campus.code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                          campus.status === "ACTIVE" ? "text-[#288568]" : "text-[#72736E]"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {campus.status === "ACTIVE" ? "Online" : "Maintenance"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#222321] truncate">
                      {campus.name}
                    </p>
                    <p className="text-xs text-[#72736E]">
                      {campus.city}, {campus.state}
                    </p>

                    {/* Micro utilization bar */}
                    <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#F2F1ED]">
                      <div
                        className="h-full rounded-full bg-[#288568] group-hover:bg-[#F26943] transition-colors"
                        style={{ width: `${Math.min(100, Math.max(14, 100 - utilPct))}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#72736E]">
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        <strong className="text-[#222321]">{avail}</strong> avail
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <strong className="text-[#222321]">{borrowed}</strong> out
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {!campusSearch && (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  className="rounded-full bg-white"
                  onClick={() => setShowAllCampuses((v) => !v)}
                >
                  <Building2 className="h-4 w-4" />
                  {showAllCampuses
                    ? "Collapse to 12 campuses"
                    : "Explore all 40 campuses"}
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 6: Tactile Editorial Final CTA */}
        <section id="about" className="pb-24 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="relative overflow-hidden rounded-[36px] border border-[#E2E0D8] bg-white px-6 py-16 sm:px-14 sm:py-20 text-center shadow-stage">
              <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#FFF0E9] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#EAF6F1] blur-3xl" />

              <div className="relative z-10 mx-auto max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E9] px-3.5 py-1 text-xs font-semibold text-[#DA5835]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ready across all 40 campuses
                </span>
                <h2 className="mt-5 text-3xl sm:text-5xl font-bold tracking-[-0.03em] text-[#222321] leading-[1.05] font-display">
                  Bring every laboratory into one system.
                </h2>
                <p className="mt-4 text-base text-[#72736E] leading-relaxed">
                  Jump straight into the Central Lab Manager, Campus Lab Manager, Instructor, or
                  Student workspace with one-click role switching.
                </p>

                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-full bg-[#F26943] px-8 py-4 text-sm sm:text-base font-semibold text-white hover:bg-[#DA5835] transition-all btn-tactile-accent"
                  >
                    <span>Access Lab Manager</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Role quick-jump badges */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  {[
                    "Central Lab Manager",
                    "Campus Lab Manager",
                    "Faculty Instructor",
                    "Student Borrower",
                  ].map((role) => (
                    <Link
                      key={role}
                      href="/login"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E5E0] bg-[#FAF9F6] px-3.5 py-1.5 text-xs font-medium text-[#72736E] hover:border-[#F26943]/40 hover:text-[#222321] transition-colors"
                    >
                      <ShieldCheck className="h-3 w-3 text-[#288568]" />
                      {role}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Loopsii-Inspired Minimalist Editorial Footer with Oversized Subtle Brand Display */}
      <footer className="border-t border-[#E2E0D8] bg-[#EAE9E4]/60 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="space-y-3 md:col-span-5">
              <BrandLogo />
              <p className="max-w-sm text-sm text-[#72736E] leading-relaxed">
                One connected lab management loop for 40 campuses — uniting centralized
                procurement, live campus stock sheets, atomic reservations, and 4-angle visual
                audits.
              </p>
            </div>

            <div className="md:col-span-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#222321]">
                Product
              </h4>
              <ul className="mt-3.5 space-y-2.5 text-sm text-[#72736E]">
                <li>
                  <a href="#features" className="hover:text-[#222321] transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-[#222321] transition-colors">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#campuses" className="hover:text-[#222321] transition-colors">
                    40 Campuses
                  </a>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#222321] transition-colors">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#222321]">
                Role Workspaces
              </h4>
              <ul className="mt-3.5 space-y-2.5 text-sm text-[#72736E]">
                <li>
                  <Link href="/login" className="hover:text-[#222321] transition-colors">
                    Central Lab Manager
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#222321] transition-colors">
                    Campus Lab Manager
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#222321] transition-colors">
                    Faculty Instructor
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-[#222321] transition-colors">
                    Student Borrower
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#222321]">
                Operations
              </h4>
              <ul className="mt-3.5 space-y-2.5 text-sm text-[#72736E]">
                <li>support@campuslab.edu</li>
                <li>40-Campus Network</li>
                <li>PostgreSQL + SSE Live</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#DDDCD4] pt-6 text-xs text-[#72736E]">
            <p>© {new Date().getFullYear()} CampusLab. All rights reserved.</p>
            <p>Built for multi-campus engineering &amp; science laboratories.</p>
          </div>
        </div>

        {/* Oversized Editorial Watermark Wordmark (Loopsii / Awwwards finish) */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none text-center font-display font-extrabold tracking-[-0.06em] text-[#222321]/[0.05] leading-none text-[18vw] sm:text-[14vw] -mb-[3.5vw]"
        >
          CampusLab
        </div>
      </footer>
    </div>
  );
}
