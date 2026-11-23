"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Package,
  Send,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AllocationStatusBadge,
  CampusStatusBadge,
  RoleBadge,
} from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import {
  DEMO_ALLOCATIONS,
  DEMO_CAMPUSES,
  DEMO_CAMPUS_INVENTORY,
  DEMO_USERS,
} from "@/lib/demo-data";
import { formatDate } from "@/lib/utils";
import type {
  AuthUserDTO,
  CampusDTO,
  CampusInventoryDTO,
  StockAllocationDTO,
} from "@/types/contracts";

export default function CampusDetailPage() {
  const params = useParams<{ id: string }>();
  const campusId = params?.id;
  const [campus, setCampus] = useState<CampusDTO | null>(null);
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [allocations, setAllocations] = useState<StockAllocationDTO[]>([]);
  const [users, setUsers] = useState<AuthUserDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campusId) return;
    Promise.all([
      apiClient.campuses.get(campusId).then((r) => r.data).catch(() =>
        DEMO_CAMPUSES.find((c) => c.id === campusId) ?? DEMO_CAMPUSES[0]
      ),
      apiClient.inventory
        .list({ campusId, pageSize: 50 })
        .then((r) => r.data)
        .catch(() => DEMO_CAMPUS_INVENTORY),
      apiClient.allocations
        .list({ campusId, pageSize: 20 })
        .then((r) => r.data)
        .catch(() => DEMO_ALLOCATIONS),
      apiClient.users
        .list({ campusId, pageSize: 50 })
        .then((r) => r.data)
        .catch(() => DEMO_USERS.filter((u) => u.campusId)),
    ]).then(([c, inv, alloc, usr]) => {
      setCampus(c);
      setInventory(inv);
      setAllocations(alloc);
      setUsers(usr);
      setLoading(false);
    });
  }, [campusId]);

  if (loading || !campus) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-72" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/central/campuses">
            <ArrowLeft className="h-4 w-4" />
            All Campuses
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`${campus.code} · ${campus.name}`}
        description={[campus.address, campus.city, campus.state].filter(Boolean).join(", ")}
        badge={<CampusStatusBadge status={campus.status} />}
        actions={
          <Button asChild>
            <Link href={`/central/allocations?campusId=${campus.id}`}>
              <Send className="h-4 w-4" />
              Dispatch Stock
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Available Stock"
          value={campus.stats?.availableUnits ?? 0}
          icon={Package}
          tone="success"
        />
        <StatCard
          title="Currently Borrowed"
          value={campus.stats?.borrowedUnits ?? 0}
          icon={Building2}
          tone="accent"
        />
        <StatCard
          title="Campus Staff & Students"
          value={
            (campus.stats?.labManagerCount ?? 0) +
            (campus.stats?.instructorCount ?? 0) +
            (campus.stats?.studentCount ?? 0)
          }
          icon={Users}
          tone="info"
        />
        <StatCard
          title="Open Issue Tickets"
          value={campus.stats?.openTickets ?? 0}
          icon={ShieldAlert}
          tone={(campus.stats?.openTickets ?? 0) > 0 ? "danger" : "success"}
        />
      </div>

      {/* Campus Inventory Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle>Campus Inventory Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Allocated</th>
                <th className="px-4 py-3 text-right">Received</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reserved</th>
                <th className="px-4 py-3 text-right">Borrowed</th>
                <th className="px-4 py-3 text-right">Damaged</th>
                <th className="px-4 py-3">Visibility</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => (
                <tr key={row.id} className="hover:bg-[#FAF9F6]">
                  <td className="px-4 py-3 font-medium text-[#222321]">
                    {row.item.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#72736E]">
                    {row.item.code}
                  </td>
                  <td className="px-4 py-3 text-right">{row.allocatedQuantity}</td>
                  <td className="px-4 py-3 text-right">{row.receivedQuantity}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#288568]">
                    {row.availableQuantity}
                  </td>
                  <td className="px-4 py-3 text-right text-[#4D83B5]">
                    {row.reservedQuantity}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {row.borrowedQuantity}
                  </td>
                  <td className="px-4 py-3 text-right text-[#D9534F]">
                    {row.damagedQuantity}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.isVisible ? "success" : "outline"}>
                      {row.isVisible ? "Visible" : "Hidden"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Stock Allocations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {allocations.length === 0 ? (
              <p className="text-sm text-[#72736E]">No allocations dispatched yet.</p>
            ) : (
              allocations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-3.5"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#222321]">
                      {a.referenceCode}
                    </p>
                    <p className="text-xs text-[#72736E] mt-0.5">
                      {a.items.length} items · {formatDate(a.createdAt)}
                    </p>
                  </div>
                  <AllocationStatusBadge status={a.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#F26943]" />
              Assigned Campus Personnel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {users.length === 0 ? (
              <p className="text-sm text-[#72736E]">No users assigned yet.</p>
            ) : (
              users.slice(0, 8).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#EFECE6] bg-[#FAF9F6] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#222321] truncate">
                      {u.fullName}
                    </p>
                    <p className="text-xs text-[#72736E] truncate">{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
