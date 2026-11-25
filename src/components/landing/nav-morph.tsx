"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoopsiiButton, LoopsiiWordmark, WeightHoverLink } from "./primitives";
import { useLenis } from "./smooth-scroll";

export function NavMorph() {
  const { scrollTo: lenisScrollTo } = useLenis();
  const [isInverse, setIsInverse] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const navY = 48;

      // Flip dark/light over the dark distraction section (accounting for AppDemo -mt-[100vh] rising over it)
      const distractionEl = document.querySelector("[data-nav-dark]");
      const appDemoEl = distractionEl?.nextElementSibling;
      if (distractionEl) {
        const rect = distractionEl.getBoundingClientRect();
        const nextTop = appDemoEl ? appDemoEl.getBoundingClientRect().top : rect.bottom;
        const overDark = rect.top <= navY && nextTop > navY + 12;
        setIsInverse(overDark);
      } else {
        setIsInverse(false);
      }

      // Expand navbar into full-screen Footer Card at the footer trigger section
      const footerTrigger = document.querySelector("[data-footer-trigger]");
      if (footerTrigger) {
        const rect = footerTrigger.getBoundingClientRect();
        setIsFooterExpanded(rect.top <= window.innerHeight * 0.48);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const scrollTo = (e: React.MouseEvent<HTMLAnchorElement>, selector: string) => {
    e.preventDefault();
    setMobileOpen(false);
    if (selector === "#top") {
      lenisScrollTo(0);
    } else {
      lenisScrollTo(selector, -20);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 flex justify-center sm:inset-x-8 md:top-5">
      <motion.div
        layout
        transition={{ duration: 0.65, ease: [0.76, 0, 0.24, 1] }}
        className={`pointer-events-auto flex w-full flex-col overflow-hidden border transition-colors duration-500 ${
          isFooterExpanded
            ? "max-w-[1360px] rounded-[24px] border-black/10 bg-white text-black shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
            : isInverse
            ? "max-w-[760px] rounded-full border-white/25 bg-black/55 text-white backdrop-blur-md"
            : "max-w-[760px] rounded-full border-black/15 bg-[#F0F0F0]/88 text-black backdrop-blur-md"
        }`}
      >
        {/* Top bar (always present in pill & expanded footer state) */}
        <div
          className={`flex w-full items-center justify-between transition-all duration-300 ${
            isFooterExpanded
              ? "px-6 py-4 sm:px-9 sm:py-5"
              : "py-[4px] pl-5 pr-[4px] sm:pl-6"
          }`}
        >
          <a
            href="#top"
            onClick={(e) => scrollTo(e, "#top")}
            aria-label="NxtWave"
            className="relative z-10 flex items-center"
          >
            <LoopsiiWordmark
              inverse={isInverse && !isFooterExpanded}
              className="h-[24px] w-auto sm:h-[26px]"
            />
          </a>

          <nav aria-label="Sections" className="hidden items-center gap-8 text-[14px] md:flex">
            <WeightHoverLink href="#why-loopsii" onClick={(e) => scrollTo(e, "#why-loopsii")}>
              Why CampusLab
            </WeightHoverLink>
            <WeightHoverLink href="#features" onClick={(e) => scrollTo(e, "#features")}>
              Features
            </WeightHoverLink>
            <WeightHoverLink href="#faq" onClick={(e) => scrollTo(e, "#faq")}>
              FAQ
            </WeightHoverLink>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LoopsiiButton
                label="Open lab portal"
                href="/login"
                size="sm"
                iconOnly
                inverse={isInverse && !isFooterExpanded}
              />
            </div>
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              className={`flex h-9 w-9 items-center justify-center rounded-full border md:hidden ${
                isInverse && !isFooterExpanded
                  ? "border-white/25 text-white"
                  : "border-black/15 text-black"
              }`}
            >
              <span className="flex flex-col gap-1">
                <span
                  className={`block h-[1.5px] w-4 bg-current transition-transform ${
                    mobileOpen ? "translate-y-[2.5px] rotate-45" : ""
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-4 bg-current transition-transform ${
                    mobileOpen ? "-translate-y-[2.5px] -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileOpen && !isFooterExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col gap-4 border-t border-current/10 px-6 py-5 md:hidden"
            >
              <a
                href="#why-loopsii"
                onClick={(e) => scrollTo(e, "#why-loopsii")}
                className="text-lg font-medium"
              >
                Why CampusLab
              </a>
              <a
                href="#features"
                onClick={(e) => scrollTo(e, "#features")}
                className="text-lg font-medium"
              >
                Features
              </a>
              <a
                href="#faq"
                onClick={(e) => scrollTo(e, "#faq")}
                className="text-lg font-medium"
              >
                FAQ
              </a>
              <div className="pt-2">
                <LoopsiiButton label="Open lab portal" href="/login" size="sm" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Morphing Footer Card Panel */}
        <AnimatePresence>
          {isFooterExpanded && (
            <motion.div
              key="nav-footer-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
              className="w-full overflow-hidden"
            >
              <div className="relative mx-4 mb-4 flex min-h-[58vh] flex-col justify-between sm:mx-6 sm:mb-6">
                {/* Architectural inset hairline frame + 4 black 8x8 corner registration dots */}
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  <div className="absolute inset-x-0 top-4 h-px bg-black/20 sm:top-6" />
                  <div className="absolute inset-x-0 bottom-4 h-px bg-black/20 sm:bottom-6" />
                  <div className="absolute inset-y-0 left-4 w-px bg-black/20 sm:left-6" />
                  <div className="absolute inset-y-0 right-4 w-px bg-black/20 sm:right-6" />
                  <div className="absolute left-[12.5px] top-[12.5px] h-[8px] w-[8px] bg-black sm:left-[20.5px] sm:top-[20.5px]" />
                  <div className="absolute right-[12.5px] top-[12.5px] h-[8px] w-[8px] bg-black sm:right-[20.5px] sm:top-[20.5px]" />
                  <div className="absolute bottom-[12.5px] left-[12.5px] h-[8px] w-[8px] bg-black sm:bottom-[20.5px] sm:left-[20.5px]" />
                  <div className="absolute bottom-[12.5px] right-[12.5px] h-[8px] w-[8px] bg-black sm:bottom-[20.5px] sm:right-[20.5px]" />
                </div>

                {/* Center Hero CTA */}
                <motion.div
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.15, ease: [0.76, 0, 0.24, 1] }}
                  className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-16 text-center sm:py-24"
                >
                  <p className="lp-h2 max-w-[14ch] text-black">Start your lab loop here</p>
                  <p className="lp-text-note text-black/80">
                    One system, 40 campuses, one unified workflow
                  </p>
                  <div className="mt-6">
                    <LoopsiiButton label="Open lab portal" href="/login" size="md" />
                  </div>
                </motion.div>

                {/* Bottom social & legal row inside architectural frame */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-10 pb-9 text-[13px] text-black/75 sm:px-14 sm:pb-11">
                  <div className="flex items-center gap-6">
                    <WeightHoverLink href="/login">Central Portal</WeightHoverLink>
                    <WeightHoverLink href="/login">Lab Manager</WeightHoverLink>
                    <WeightHoverLink href="/login">Student Portal</WeightHoverLink>
                  </div>
                  <div className="flex items-center gap-6">
                    <WeightHoverLink href="#faq" onClick={(e) => scrollTo(e, "#faq")}>
                      Privacy Policy
                    </WeightHoverLink>
                    <WeightHoverLink href="#faq" onClick={(e) => scrollTo(e, "#faq")}>
                      Terms & Conditions
                    </WeightHoverLink>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
