"use client";

import React from "react";
import { SmoothScrollProvider } from "@/components/landing/smooth-scroll";
import { StudentRequestFlow } from "@/components/dashboard/student-request-flow";

export default function StudentDashboardPage() {
  return (
    <SmoothScrollProvider>
      <StudentRequestFlow />
    </SmoothScrollProvider>
  );
}
