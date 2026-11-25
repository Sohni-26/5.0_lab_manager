"use client";

import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY } from "@/lib/demo-data";
import { exportToCsv } from "@/lib/utils";
import type { CampusInventoryDTO } from "@/types/contracts";

const PIE_COLORS = ["#AAC2AA", "#000000", "#9EC3D5", "#FA8E66", "#F3BD77"];

export default function LabManagerReportsPage() {
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);

  useEffect(() => {
    apiClient.inventory
      .list({ pageSize: 100 })
      .then((res) => setInventory(res.data))
      .catch(() => setInventory(DEMO_CAMPUS_INVENTORY));
  }, []);

  const totals = inventory.reduce(
    (acc, r) => ({
      available: acc.available + r.availableQuantity,
      borrowed: acc.borrowed + r.borrowedQuantity,
      reserved: acc.reserved + r.reservedQuantity,
      damaged: acc.damaged + r.damagedQuantity,
      missing: acc.missing + r.missingQuantity,
    }),
    { available: 0, borrowed: 0, reserved: 0, damaged: 0, missing: 0 }
  );

  const pieData = [
    { name: "Available", value: totals.available },
    { name: "Borrowed", value: totals.borrowed },
    { name: "Reserved", value: totals.reserved },
    { name: "Damaged", value: totals.damaged },
    { name: "Missing", value: totals.missing },
  ].filter((d) => d.value > 0);

  const barData = inventory.slice(0, 8).map((r) => ({
    code: r.item.code,
    available: r.availableQuantity,
    borrowed: r.borrowedQuantity,
    reserved: r.reservedQuantity,
  }));

  const handleExportSummary = () => {
    exportToCsv(
      `campus-health-report-${new Date().toISOString().slice(0, 10)}.csv`,
      inventory.map((r) => ({
        Code: r.item.code,
        Name: r.item.name,
        Allocated: r.allocatedQuantity,
        Received: r.receivedQuantity,
        Available: r.availableQuantity,
        Reserved: r.reservedQuantity,
        Borrowed: r.borrowedQuantity,
        Damaged: r.damagedQuantity,
        Missing: r.missingQuantity,
        UtilizationPct:
          r.receivedQuantity > 0
            ? Math.round(
                ((r.borrowedQuantity + r.reservedQuantity) / r.receivedQuantity) *
                  100
              )
            : 0,
      }))
    );
    toast.success("Downloaded campus stock health report");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Stock Health & Reports"
        description="Utilization ratios, availability distribution, and exportable compliance reports for your campus laboratory."
        badge={
          <span className="inline-flex items-center rounded-full border border-black/10 bg-[#C4F041] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-black">
            Live Metrics
          </span>
        }
        actions={
          <Button
            onClick={handleExportSummary}
            className="rounded-full bg-black text-white hover:bg-[#C4F041] hover:text-black"
          >
            <Download className="h-4 w-4" />
            Download CSV Report
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[22px] border-black/12 bg-white">
          <CardHeader className="border-b border-black/10 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-black">Stock Composition</CardTitle>
              <span className="rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 text-[11px] font-medium text-black/55 tabular-nums">
                {totals.available +
                  totals.borrowed +
                  totals.reserved +
                  totals.damaged +
                  totals.missing}{" "}
                units
              </span>
            </div>
            <CardDescription className="text-black/55">
              Breakdown of campus units by current operational status
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="h-72 w-full rounded-2xl border border-black/10 bg-[#F5F5F3] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={98}
                    paddingAngle={3}
                  >
                    {pieData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                      fontSize: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(0,0,0,0.7)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#AAC2AA]/25 px-2.5 py-1 text-xs font-medium text-black tabular-nums">
                <span className="h-2 w-2 rounded-full bg-[#AAC2AA]" />
                Available: {totals.available}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-black px-2.5 py-1 text-xs font-medium text-white tabular-nums">
                <span className="h-2 w-2 rounded-full bg-[#C4F041]" />
                Borrowed: {totals.borrowed}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#9EC3D5]/25 px-2.5 py-1 text-xs font-medium text-black tabular-nums">
                <span className="h-2 w-2 rounded-full bg-[#9EC3D5]" />
                Reserved: {totals.reserved}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#FA8E66]/25 px-2.5 py-1 text-xs font-medium text-black tabular-nums">
                <span className="h-2 w-2 rounded-full bg-[#FA8E66]" />
                Damaged: {totals.damaged}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[#F3BD77]/30 px-2.5 py-1 text-xs font-medium text-black tabular-nums">
                <span className="h-2 w-2 rounded-full bg-[#F3BD77]" />
                Missing: {totals.missing}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[22px] border-black/12 bg-white">
          <CardHeader className="border-b border-black/10 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-black">Top SKUs Utilization</CardTitle>
              <span className="rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 text-[11px] font-medium text-black/55 tabular-nums">
                Top {barData.length} SKUs
              </span>
            </div>
            <CardDescription className="text-black/55">
              Available vs Borrowed vs Reserved units per equipment code
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="h-72 w-full rounded-2xl border border-black/10 bg-[#F5F5F3] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 10, fill: "rgba(0,0,0,0.55)" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "rgba(0,0,0,0.55)" }}
                    axisLine={{ stroke: "rgba(0,0,0,0.12)" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.12)",
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                      fontSize: "12px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "rgba(0,0,0,0.7)" }} />
                  <Bar dataKey="available" name="Available" fill="#AAC2AA" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="borrowed" name="Borrowed" fill="#000000" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="reserved" name="Reserved" fill="#9EC3D5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 pt-3 text-xs text-black/55">
              <span>Comparing top {barData.length} equipment codes</span>
              <span className="rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-1 font-medium text-black tabular-nums">
                {inventory.length} total SKUs tracked
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
