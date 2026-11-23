"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
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
import {
  PriorityBadge,
  TicketStatusBadge,
} from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { DEMO_TICKETS } from "@/lib/demo-data";
import { formatDateTime, ISSUE_CATEGORY_LABELS } from "@/lib/utils";
import type { IssueTicketDTO } from "@/types/contracts";

export default function CentralTicketsMonitorPage() {
  const { selectedCampusId } = useAuth();
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selected, setSelected] = useState<IssueTicketDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.tickets.list({
        campusId: selectedCampusId || undefined,
        pageSize: 60,
      });
      setTickets(res.data);
    } catch {
      setTickets(DEMO_TICKETS);
    } finally {
      setLoading(false);
    }
  }, [selectedCampusId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.ticketCode.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.campus.code.toLowerCase().includes(q)
      );
    });
  }, [tickets, search, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System-Wide Issue Tickets"
        description="Monitor equipment damage, malfunctions, discrepancies, and maintenance tickets raised across all 40 campuses."
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E6E5E0] bg-white p-3.5 shadow-card">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket code, title, or campus..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Raised By</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#72736E]">
                    Loading tickets...
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-[#222321]">
                        {t.ticketCode}
                      </p>
                      <p className="text-xs text-[#72736E] truncate max-w-[260px]">
                        {t.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#F26943]">
                      {t.campus.code}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {ISSUE_CATEGORY_LABELS[t.category]}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <TicketStatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#72736E]">
                      {t.createdBy.fullName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(t)}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Inspect
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
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{selected.ticketCode}</span>
                  <TicketStatusBadge status={selected.status} />
                  <PriorityBadge priority={selected.priority} />
                </DialogTitle>
                <DialogDescription>
                  {selected.campus.code} ({selected.campus.name}) ·{" "}
                  {ISSUE_CATEGORY_LABELS[selected.category]}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <h4 className="font-semibold text-[#222321]">{selected.title}</h4>
                <p className="text-[#72736E] leading-relaxed">
                  {selected.description}
                </p>
                {selected.resolutionNotes && (
                  <div className="rounded-xl bg-[#EAF6F1] p-3 text-xs text-[#288568]">
                    <strong>Resolution:</strong> {selected.resolutionNotes}
                  </div>
                )}
                <div className="space-y-2 pt-2 border-t border-[#EFECE6]">
                  <p className="text-xs font-semibold uppercase text-[#72736E]">
                    Activity Comments ({selected.comments?.length ?? 0})
                  </p>
                  {selected.comments && selected.comments.length > 0 ? (
                    selected.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl bg-[#FAF9F6] border border-[#EFECE6] p-3 text-xs"
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold text-[#222321]">
                            {c.author.fullName}
                          </span>
                          <span className="text-[#72736E]">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-[#585955]">{c.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[#72736E]">No comments yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
