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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Radio className="h-4 w-4 text-[#F26943]" />
              Realtime SSE Broker
            </CardTitle>
            <CardDescription>/api/events live campus stream</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={status === "connected" ? "success" : "warning"}>
              {status === "connected"
                ? "Connected & Streaming"
                : status === "demo"
                  ? "Preview Mode"
                  : "Reconnecting"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-[#288568]" />
              Database Integrity Guards
            </CardTitle>
            <CardDescription>PostgreSQL CHECK &amp; Partial Unique Indexes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs text-[#288568]">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Single Central Lab Manager index
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Non-negative stock quantity guards
            </p>
            <p className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mandatory campus isolation checks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-[#4D83B5]" />
              Active Central Authority
            </CardTitle>
            <CardDescription>Current authenticated administrator</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p className="font-semibold text-[#222321]">{user?.fullName}</p>
            <p className="text-[#72736E]">{user?.email}</p>
            <p className="font-mono text-[#72736E]">{user?.institutionalId}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
