"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "framer-motion";
import { LoopsiiButton } from "./primitives";

/** Live working analog clock synced to real time with sweeping coral second hand */
function LiveAnalogClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(id);
  }, []);

  const hours = now ? now.getHours() % 12 : 10;
  const minutes = now ? now.getMinutes() : 10;
  const seconds = now ? now.getSeconds() + now.getMilliseconds() / 1000 : 32;

  const hourDeg = hours * 30 + minutes * 0.5;
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const secondDeg = seconds * 6;

  return (
    <div className="relative flex aspect-square w-[210px] items-center justify-center rounded-full border border-black bg-white/35 backdrop-blur-xs sm:w-[250px]">
      {/* 12 clock hour ticks */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 flex justify-center p-2.5"
          style={{ transform: `rotate(${i * 30}deg)` }}
        >
          <span
            className={`block bg-black ${
              i % 3 === 0 ? "h-3 w-[2px]" : "h-1.5 w-[1px] opacity-45"
            }`}
          />
        </div>
      ))}

      {/* Hour hand */}
      <div
        className="absolute bottom-1/2 left-1/2 h-[27%] w-[4px] -translate-x-1/2 origin-bottom rounded-full bg-black"
        style={{ transform: `translateX(-50%) rotate(${hourDeg}deg)` }}
      />

      {/* Minute hand */}
      <div
        className="absolute bottom-1/2 left-1/2 h-[38%] w-[2.5px] -translate-x-1/2 origin-bottom rounded-full bg-black"
        style={{ transform: `translateX(-50%) rotate(${minuteDeg}deg)` }}
      />

      {/* Coral second hand */}
      <div
        className="absolute bottom-1/2 left-1/2 h-[42%] w-[1.5px] -translate-x-1/2 origin-bottom rounded-full bg-[#FA8E66]"
        style={{ transform: `translateX(-50%) rotate(${secondDeg}deg)` }}
      />

      {/* Center Coral Ring Pin */}
      <div className="relative z-10 h-3 w-3 rounded-full border-2 border-[#FA8E66] bg-white" />
    </div>
  );
}

/** Section 12: Waitlist / Social Proof + Animated Counter + Live Clock */
export function WaitlistSection() {
  const counterRef = useRef<HTMLDivElement>(null);
  const inView = useInView(counterRef, { once: true, amount: 0.4 });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(eased * 40));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  return (
    <section className="relative z-20 bg-[#F0F0F0] px-4 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1380px] overflow-hidden rounded-[28px] bg-white shadow-[0_6px_40px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left CTA */}
          <div className="flex flex-col justify-between p-8 sm:p-12 lg:col-span-5 lg:p-14">
            <h2 className="lp-h3 max-w-[11ch] text-black">
              Ready for an easier way to run labs?
            </h2>
            <div className="mt-10 lg:mt-24">
              <LoopsiiButton label="Open lab portal" href="/login" size="md" />
            </div>
          </div>

          {/* Right Steel Panel: Giant 40 Counter + Live Working Analog Clock */}
          <div
            ref={counterRef}
            className="flex flex-col items-center justify-between gap-8 bg-[#9EC3D5] p-8 text-black sm:flex-row sm:p-12 lg:col-span-7 lg:p-14"
          >
            <div>
              <p className="text-[110px] font-medium leading-[0.85] tracking-[-0.05em] tabular-nums sm:text-[152px]">
                {count}
              </p>
              <p className="mt-2 text-[32px] font-semibold leading-tight tracking-tight sm:text-[38px]">
                campuses
              </p>
              <p className="lp-text-note mt-1 text-black/85">connected on CampusLab</p>
            </div>

            <div className="shrink-0">
              <LiveAnalogClock />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  {
    q: "How does 4-angle photo verification work?",
    a: "Before any approved lab kit is issued, students upload four mandatory photos (front/top, back/bottom, left side, and right side) per item. Collection photos lock immutably so instructors can compare them side-by-side against 4 new return photos.",
  },
  {
    q: "Can we manage 40+ campuses from one account?",
    a: "Yes. CampusLab enforces a single global Central Lab Manager who owns the master catalog, campus directory, and stock dispatches — while each campus Lab Manager, Instructor, and Student sees strictly scoped data for their own campus.",
  },
  {
    q: "What prevents two students from reserving the last kit?",
    a: "Every approval, collection, and return executes inside an atomic PostgreSQL transaction with database-level non-negative quantity checks. Once the Lab Manager signs off, available stock moves instantly into reserved stock with zero double-booking.",
  },
  {
    q: "Who can edit or adjust campus stock quantities?",
    a: "Only the assigned campus Lab Manager can verify incoming dispatches, toggle student visibility, or log stock adjustments — and every change requires a remark and automatically appends an immutable InventoryTransaction ledger entry.",
  },
  {
    q: "How are damaged or missing returns handled?",
    a: "During physical return inspection, the Instructor marks each unit as Good, Partial, Damaged, or Missing. Good units return to available stock immediately, while damaged or missing units flag the request as Return Disputed and update campus damage/missing totals.",
  },
  {
    q: "Does every inventory mutation leave an audit trail?",
    a: "Yes. CampusLab writes append-only records to both the InventoryTransaction ledger (previous vs. updated quantities) and the system-wide AuditLog (actor, role, campus, and JSON before/after states).",
  },
  {
    q: "How do Instructors report faulty lab gear?",
    a: "Instructors open item-linked Issue Tickets directly from their portal with priority, description, and photos. Tickets route straight to that campus's Lab Manager with threaded resolution comments and full visibility for Central oversight.",
  },
];

/** Section 13: FAQ Accordion */
export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="relative z-20 bg-[#F0F0F0] px-5 py-20 sm:px-10 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1440px]">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          {/* Left Sticky Header */}
          <div className="lg:col-span-4">
            <p className="lp-text-note text-black">FAQ</p>
            <h2 className="lp-h2 mt-2 max-w-[12ch] text-black">
              Good questions, straight answers.
            </h2>
          </div>

          {/* Right Accordion List */}
          <div className="border-t border-black/20 lg:col-span-8">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div key={item.q} className="border-b border-black/20 py-6">
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : idx)}
                    className="flex w-full items-start justify-between gap-6 text-left"
                  >
                    <h3 className="text-[20px] font-medium leading-snug tracking-[-0.015em] text-black sm:text-[24px]">
                      {item.q}
                    </h3>
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/20 text-[20px] leading-none text-black transition-transform duration-300 ${
                        isOpen ? "rotate-45 bg-black text-white" : ""
                      }`}
                    >
                      +
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.76, 0, 0.24, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-[68ch] pt-4 text-[15.5px] leading-relaxed text-black/75 sm:text-[16.5px]">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Section 14: Kinetic Giant Outro */
export function OutroSection() {
  const words = ["Built", "for", "labs,", "trusted", "at", "scale"];

  return (
    <section className="relative z-20 bg-[#F0F0F0] px-5 pb-24 pt-16 sm:px-10 lg:px-12 lg:pb-32 lg:pt-24">
      <div className="mx-auto max-w-[1440px]">
        <h2 className="sr-only">Built for labs, trusted at scale</h2>
        <div className="flex flex-wrap gap-x-[0.26em] gap-y-1 text-[clamp(3.2rem,7.2vw,6.8rem)] font-medium leading-[0.98] tracking-[-0.035em] text-black">
          {words.map((word, idx) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.65, delay: idx * 0.08, ease: [0.76, 0, 0.24, 1] }}
              className="inline-block"
            >
              {word}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Section 15: Footer Trigger Spacer (Activates NavMorph Full-Screen White Footer Card) */
export function FooterTriggerSection() {
  return (
    <section
      data-footer-trigger=""
      className="relative z-10 min-h-screen overflow-hidden bg-[#101010]"
    >
      {/* Ambient kinetic dual-color motion canvas echoing /video/footer-dual.mp4 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="lp-footer-blob-1 absolute -left-24 top-1/4 h-[560px] w-[560px] rounded-full bg-[#C4F041]/25 blur-[130px]" />
        <div className="lp-footer-blob-2 absolute -right-24 bottom-1/4 h-[560px] w-[560px] rounded-full bg-[#BCE6FA]/25 blur-[130px]" />
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FA8E66]/20 blur-[120px]" />
      </div>
    </section>
  );
}

/** Dismissible Bottom-Left Cookie Pill Toast */
export function CookieBanner() {
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45, delay: 1.8 }}
          className="fixed bottom-5 left-5 z-40 flex max-w-[360px] items-center gap-3 rounded-full border border-black/15 bg-white/92 py-2 pl-4 pr-2 text-[12px] text-black shadow-lg backdrop-blur-md"
        >
          <p className="leading-snug text-black/75">
            We use cookies to keep your lab portal session secure and fast.{" "}
            <a href="#faq" className="underline underline-offset-2 hover:text-black">
              Privacy Policy
            </a>
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="shrink-0 rounded-full bg-black px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#C4F041] hover:text-black"
          >
            OK
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
