"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect legacy /student/new-request route directly to Browse Inventory */
export default function StudentNewRequestRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/inventory");
  }, [router]);
  return null;
}
