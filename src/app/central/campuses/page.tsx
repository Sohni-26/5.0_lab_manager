"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CampusStatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUSES } from "@/lib/demo-data";
import { formatNumber } from "@/lib/utils";
import type { CampusDTO, CampusStatus } from "@/types/contracts";

export default function CentralCampusesPage() {
  const [campuses, setCampuses] = useState<CampusDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    city: "",
    state: "",
    address: "",
  });

  const loadCampuses = useCallback(async () => {
    try {
      const res = await apiClient.campuses.list({ pageSize: 60 });
      setCampuses(res.data);
    } catch {
      setCampuses(DEMO_CAMPUSES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampuses();
  }, [loadCampuses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campuses.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.city?.toLowerCase().includes(q) ?? false) ||
        (c.state?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [campuses, search, statusFilter]);

  const handleToggleStatus = async (campus: CampusDTO) => {
    const nextStatus: CampusStatus =
      campus.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiClient.campuses.update(campus.id, { status: nextStatus });
      setCampuses((prev) =>
        prev.map((c) => (c.id === campus.id ? { ...c, status: nextStatus } : c))
      );
      toast.success(`${campus.code} marked ${nextStatus.toLowerCase()}`);
    } catch {
      setCampuses((prev) =>
        prev.map((c) => (c.id === campus.id ? { ...c, status: nextStatus } : c))
      );
      toast.success(`${campus.code} updated (preview mode)`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Campus code and name are required");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.campuses.create({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        address: form.address.trim() || undefined,
      });
      setCampuses((prev) => [res.data, ...prev]);
      toast.success(`Campus ${res.data.code} created`);
      setCreateOpen(false);
      setForm({ code: "", name: "", city: "", state: "", address: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campus");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campuses Directory"
        description={`Managing ${campuses.length} campuses across the laboratory network with isolated inventory and staff assignments.`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Campus
          </Button>
        }
      />

      {/* Filter & View Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E5E0] bg-white p-3.5 shadow-card">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[240px]">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campus code, name, city..."
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#EAE9E4] p-1">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
              viewMode === "grid"
                ? "bg-white text-[#222321] shadow-xs"
                : "text-[#72736E]"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
              viewMode === "table"
                ? "bg-white text-[#222321] shadow-xs"
                : "text-[#72736E]"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Table
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((campus) => (
            <Card
              key={campus.id}
              className="p-5 flex flex-col justify-between hover:border-[#F26943]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-[#F26943] bg-[#FFF0E9] px-2.5 py-0.5 rounded-md">
                    {campus.code}
                  </span>
                  <CampusStatusBadge status={campus.status} />
                </div>

                <h3 className="mt-3 text-base font-semibold text-[#222321] leading-snug">
                  {campus.name}
                </h3>
                <p className="mt-1 flex items-center gap-1 text-xs text-[#72736E]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {[campus.city, campus.state].filter(Boolean).join(", ") || "—"}
                  </span>
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#FAF9F6] border border-[#EFECE6] p-2.5 text-center">
                  <div>
                    <p className="text-xs font-bold text-[#222321]">
                      {formatNumber(campus.stats?.availableUnits ?? 0)}
                    </p>
                    <p className="text-[10px] text-[#72736E]">Available</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#222321]">
                      {formatNumber(campus.stats?.borrowedUnits ?? 0)}
                    </p>
                    <p className="text-[10px] text-[#72736E]">Borrowed</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#222321]">
                      {(campus.stats?.labManagerCount ?? 0) +
                        (campus.stats?.instructorCount ?? 0)}
                    </p>
                    <p className="text-[10px] text-[#72736E]">Staff</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#EFECE6] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={campus.status === "ACTIVE"}
                    onCheckedChange={() => handleToggleStatus(campus)}
                    aria-label={`Toggle ${campus.name} active`}
                  />
                  <span className="text-[11px] text-[#72736E]">Active</span>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/central/campuses/${campus.id}`}>
                    Inspect <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm sheet-table">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3 text-right">Lab Mgrs</th>
                  <th className="px-4 py-3 text-right">Instructors</th>
                  <th className="px-4 py-3 text-right">Available</th>
                  <th className="px-4 py-3 text-right">Borrowed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#F26943]">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#222321]">{c.name}</td>
                    <td className="px-4 py-3 text-xs text-[#72736E]">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-[#72736E]" />
                        {c.stats?.labManagerCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {c.stats?.instructorCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#288568]">
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {formatNumber(c.stats?.availableUnits ?? 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-[#222321]">
                      {formatNumber(c.stats?.borrowedUnits ?? 0)}
                    </td>
                    <td className="px-4 py-3">
                      <CampusStatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/central/campuses/${c.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Campus Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#F26943]" />
              Register New Campus
            </DialogTitle>
            <DialogDescription>
              Add a campus to the multi-campus laboratory network.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="campus-code">Campus Code</Label>
                <Input
                  id="campus-code"
                  placeholder="CMP-41"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campus-city">City</Label>
                <Input
                  id="campus-city"
                  placeholder="Bengaluru"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campus-name">Campus Name</Label>
              <Input
                id="campus-name"
                placeholder="Bengaluru South Research Campus"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="campus-state">State</Label>
                <Input
                  id="campus-state"
                  placeholder="Karnataka"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campus-address">Address</Label>
                <Input
                  id="campus-address"
                  placeholder="Tech Corridor, Block A"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create Campus"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
