"use client";

import React from "react";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll";
import { InstructorRequestFlow } from "@/components/dashboard/instructor-request-flow";

export default function InstructorDashboardPage() {
  return (
    <SmoothScrollProvider>
      <InstructorRequestFlow />
    </SmoothScrollProvider>
  );
}
