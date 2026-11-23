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

const PIE_COLORS = ["#288568", "#F26943", "#4D83B5", "#D9534F", "#D69A35"];

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
        actions={
          <Button onClick={handleExportSummary}>
            <Download className="h-4 w-4" />
            Download CSV Report
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock Composition</CardTitle>
            <CardDescription>
              Breakdown of campus units by current operational status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
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
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top SKUs Utilization</CardTitle>
            <CardDescription>
              Available vs Borrowed vs Reserved units per equipment code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" />
                  <XAxis dataKey="code" tick={{ fontSize: 10, fill: "#72736E" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#72736E" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="available" name="Available" fill="#288568" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="borrowed" name="Borrowed" fill="#F26943" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reserved" name="Reserved" fill="#4D83B5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
