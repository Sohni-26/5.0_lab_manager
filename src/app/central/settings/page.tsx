"use client";

import React from "react";
import { CheckCircle2, Database, Radio, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtime } from "@/hooks/use-realtime";

export default function CentralSettingsPage() {
  const { user, isDemoMode } = useAuth();
  const { status } = useRealtime({ enabled: true, isDemoMode });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings & System Health"
        description="Core security policies, database constraints, and real-time synchronization status."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-black/12 bg-white rounded-[22px]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-sm text-black">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#C4F041] text-black">
                <Radio className="h-4 w-4" />
              </span>
              <span>Realtime SSE Broker</span>
            </CardTitle>
            <CardDescription className="text-black/55">
              /api/events live campus stream
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-2xl border border-black/10 bg-[#F5F5F3] px-3.5 py-3">
              <Badge variant={status === "connected" ? "success" : "warning"}>
                {status === "connected"
                  ? "Connected & Streaming"
                  : status === "demo"
                    ? "Preview Mode"
                    : "Reconnecting"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/12 bg-white rounded-[22px]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-sm text-black">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#AAC2AA] text-black">
                <Database className="h-4 w-4" />
              </span>
              <span>Database Integrity Guards</span>
            </CardTitle>
            <CardDescription className="text-black/55">
              PostgreSQL CHECK &amp; Partial Unique Indexes
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-[#F5F5F3] text-xs text-black">
              <p className="flex items-center gap-2 px-3.5 py-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AAC2AA]/70 text-black">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <span>Single Central Lab Manager index</span>
              </p>
              <p className="flex items-center gap-2 px-3.5 py-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AAC2AA]/70 text-black">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <span>Non-negative stock quantity guards</span>
              </p>
              <p className="flex items-center gap-2 px-3.5 py-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AAC2AA]/70 text-black">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <span>Mandatory campus isolation checks</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/12 bg-white rounded-[22px]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-sm text-black">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[#BCE6FA] text-black">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <span>Active Central Authority</span>
            </CardTitle>
            <CardDescription className="text-black/55">
              Current authenticated administrator
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5 rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5 text-xs">
              <p className="text-sm font-semibold text-black">{user?.fullName}</p>
              <p className="text-black/55">{user?.email}</p>
              <div className="border-t border-black/10 pt-2 mt-2">
                <p className="inline-flex items-center rounded-full border border-black/10 bg-white px-2.5 py-0.5 font-mono text-[11px] font-medium text-black">
                  {user?.institutionalId}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
