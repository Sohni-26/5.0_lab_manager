"use client";

import React, { useCallback, useState } from "react";
import "./loopsii.css";
import { SmoothScrollProvider } from "./smooth-scroll";
import { LoaderOverlay } from "./loader-overlay";
import { NavMorph } from "./nav-morph";
import { HeroSection } from "./hero-section";
import { IntroSection } from "./intro-section";
import { DistractionSection } from "./distraction-section";
import { AppDemoSection } from "./app-demo-section";
import { StackSection } from "./stack-section";
import { HighlightsSection } from "./highlights-section";
import { FoldersSection } from "./folders-section";
import { FeaturesSection } from "./features-section";
import { TestimonialsSection } from "./testimonials-section";
import { RoadmapSection } from "./roadmap-section";
import {
  CookieBanner,
  FaqSection,
  FooterTriggerSection,
  OutroSection,
  WaitlistSection,
} from "./closing-sections";

export function LoopsiiLandingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const handleLoaderComplete = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <SmoothScrollProvider locked={isLoading}>
      <div className="loopsii-root min-h-screen selection:bg-[#C4F041] selection:text-black">
        {/* 0. Opening Lime Loader Sequence */}
        <LoaderOverlay onComplete={handleLoaderComplete} />

        {/* Global Morphing Floating Navbar (flips over dark section & expands into Footer Card) */}
        <NavMorph />

        {/* Main 15-Section Editorial Landing Sequence */}
        <main className="relative z-10">
          <HeroSection />
          <IntroSection />
          <DistractionSection />
          <AppDemoSection />
          <StackSection />
          <HighlightsSection />
          <FoldersSection />
          <FeaturesSection />
          <TestimonialsSection />
          <RoadmapSection />
          <WaitlistSection />
          <FaqSection />
          <OutroSection />
          <FooterTriggerSection />
        </main>

        {/* Bottom-left Cookie Toast */}
        <CookieBanner />
      </div>
    </SmoothScrollProvider>
  );
}
