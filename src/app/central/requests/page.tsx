"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequestStatusBadge } from "@/components/ui/status-badge";
import { RequestTimeline } from "@/components/shared/request-timeline";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { DEMO_REQUESTS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { LabRequestDTO } from "@/types/contracts";

export default function CentralRequestsMonitorPage() {
  const { selectedCampusId } = useAuth();
  const [requests, setRequests] = useState<LabRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<LabRequestDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.requests.list({
        campusId: selectedCampusId || undefined,
        pageSize: 60,
      });
      setRequests(res.data);
    } catch {
      setRequests(DEMO_REQUESTS);
    } finally {
      setLoading(false);
    }
  }, [selectedCampusId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.requestCode.toLowerCase().includes(q) ||
        r.student.fullName.toLowerCase().includes(q) ||
        r.campus.code.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q)
      );
    });
  }, [requests, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System-Wide Borrowing Requests"
        description="Read-only operational visibility across all campus borrowing workflows, approvals, and return verifications."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-[22px] border border-black/12 bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request code, student, campus, purpose..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56 border-black/15 bg-white text-black focus:border-black focus:ring-[#C4F041]/50">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent className="border-black/12 bg-white text-black">
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PENDING_INSTRUCTOR">Pending Instructor</SelectItem>
            <SelectItem value="PENDING_LAB_MANAGER">Pending Lab Manager</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="ISSUED">Issued</SelectItem>
            <SelectItem value="RETURN_VERIFICATION_PENDING">Return Verification</SelectItem>
            <SelectItem value="RETURN_DISPUTED">Return Disputed</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto rounded-full border border-black/10 bg-[#F5F5F3] px-3 py-1 text-xs font-semibold text-black tabular-nums">
          {filtered.length} requests
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left border-b border-black/10">
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-black/55">
                    Loading requests...
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-[#F5F5F3]">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-black">
                        {req.requestCode}
                      </p>
                      <p className="text-xs text-black/55 truncate max-w-[200px]">
                        {req.purpose}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-[#F5F5F3] px-2.5 py-0.5 font-mono text-xs font-semibold text-black">
                        {req.campus.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-black">
                      {req.student.fullName}
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55">
                      {req.instructor.fullName}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-black tabular-nums">
                      {req.items.length}
                    </td>
                    <td className="px-4 py-3">
                      <RequestStatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-black/55 tabular-nums">
                      {formatDateTime(req.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(req)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl rounded-[22px] border-black/12 bg-white text-black">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-black">
                  <span className="font-mono">{selected.requestCode}</span>
                  <RequestStatusBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription className="text-black/55">
                  {selected.campus.code} · {selected.student.fullName} →{" "}
                  {selected.instructor.fullName}
                </DialogDescription>
              </DialogHeader>
              <RequestTimeline status={selected.status} />
              <div className="rounded-2xl bg-[#F5F5F3] border border-black/10 p-3.5 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-black/55 mb-1">
                  Purpose
                </p>
                <p className="text-black">{selected.purpose}</p>
              </div>
              <div className="space-y-2">
                {selected.items.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-black">{it.item.name}</p>
                      <p className="font-mono text-xs text-black/55">
                        {it.item.code}
                      </p>
                    </div>
                    <div className="text-right text-xs tabular-nums">
                      <p className="text-black">
                        Requested: <strong>{it.requestedQuantity}</strong>
                      </p>
                      <p className="text-black/55">
                        Issued: {it.issuedQuantity} · Returned: {it.returnedQuantity}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
