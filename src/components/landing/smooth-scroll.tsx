"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Lenis from "lenis";

interface LenisContextValue {
  lenis: Lenis | null;
  scrollTo: (target: string | number | HTMLElement, offset?: number) => void;
}

const LenisContext = createContext<LenisContextValue>({
  lenis: null,
  scrollTo: () => {},
});

export function useLenis() {
  return useContext(LenisContext);
}

export function SmoothScrollProvider({
  locked = false,
  children,
}: {
  locked?: boolean;
  children: React.ReactNode;
}) {
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const prevScrollBehavior = html.style.scrollBehavior;
    // Prevent native CSS scroll-behavior: smooth from fighting Lenis rAF interpolation
    html.style.scrollBehavior = "auto";

    const lenis = new Lenis({
      lerp: 0.08,
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.5,
      autoResize: true,
    });

    setLenisInstance(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      html.style.scrollBehavior = prevScrollBehavior;
      setLenisInstance(null);
    };
  }, []);

  // Lock Lenis smoothly while the opening lime loader curtain is running
  useEffect(() => {
    if (!lenisInstance) return;
    if (locked) {
      lenisInstance.stop();
    } else {
      lenisInstance.start();
    }
  }, [lenisInstance, locked]);

  const scrollTo = (target: string | number | HTMLElement, offset = 0) => {
    if (lenisInstance) {
      lenisInstance.scrollTo(target, {
        offset,
        duration: 1.35,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      });
    } else if (typeof target === "string") {
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <LenisContext.Provider value={{ lenis: lenisInstance, scrollTo }}>
      {children}
    </LenisContext.Provider>
  );
}
