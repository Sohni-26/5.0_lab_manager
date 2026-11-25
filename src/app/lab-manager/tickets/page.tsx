"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Send, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PriorityBadge,
  TicketStatusBadge,
} from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { apiClient } from "@/lib/api-client";
import { DEMO_TICKETS } from "@/lib/demo-data";
import { formatDateTime, ISSUE_CATEGORY_LABELS } from "@/lib/utils";
import type { IssueTicketDTO, TicketStatus } from "@/types/contracts";

export default function LabManagerTicketsPage() {
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<IssueTicketDTO | null>(null);
  const [statusVal, setStatusVal] = useState<TicketStatus>("IN_PROGRESS");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.tickets.list({ pageSize: 50 });
      setTickets(res.data);
    } catch {
      setTickets(DEMO_TICKETS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openTicket = (t: IssueTicketDTO) => {
    setActiveTicket(t);
    setStatusVal(t.status);
    setResolutionNotes(t.resolutionNotes ?? "");
    setCommentBody("");
  };

  const handleUpdateTicket = async () => {
    if (!activeTicket) return;
    setSaving(true);
    try {
      const res = await apiClient.tickets.update(activeTicket.id, {
        status: statusVal,
        resolutionNotes: resolutionNotes.trim() || null,
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? res.data : t))
      );
      setActiveTicket(res.data);
      toast.success(`Ticket ${activeTicket.ticketCode} updated to ${statusVal}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !commentBody.trim()) return;
    setSaving(true);
    try {
      const res = await apiClient.tickets.addComment(activeTicket.id, {
        body: commentBody.trim(),
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? res.data : t))
      );
      setActiveTicket(res.data);
      setCommentBody("");
      toast.success("Comment posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add comment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Issue Tickets"
        description="Manage equipment damage, maintenance, and discrepancy tickets raised by your campus instructors."
      />

      {loading ? (
        <Card className="p-8 text-center text-sm text-black/55">
          Loading campus tickets...
        </Card>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No issue tickets open"
          description="Equipment maintenance or discrepancy tickets raised by campus instructors will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {tickets.map((t) => (
            <Card
              key={t.id}
              className="p-5 flex flex-wrap items-center justify-between gap-4 hover:border-black/25 transition-colors"
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-black">
                    {t.ticketCode}
                  </span>
                  <TicketStatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <span className="text-xs text-black/55">
                    {ISSUE_CATEGORY_LABELS[t.category]}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-black">
                  {t.title}
                </h3>
                <p className="text-xs text-black/55 line-clamp-2">
                  {t.description}
                </p>
                <p className="text-[11px] text-black/55">
                  Raised by <strong className="text-black">{t.createdBy.fullName}</strong> ·{" "}
                  {t.item ? `${t.item.code} (${t.item.name}) · ` : ""}
                  {formatDateTime(t.createdAt)}
                </p>
              </div>
              <Button variant="outline" onClick={() => openTicket(t)}>
                <MessageSquare className="h-4 w-4" />
                Manage (<span className="tabular-nums">{t.comments?.length ?? 0}</span>)
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Manage Ticket Dialog */}
      <Dialog
        open={Boolean(activeTicket)}
        onOpenChange={(o) => !o && setActiveTicket(null)}
      >
        <DialogContent className="max-w-2xl">
          {activeTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-black">{activeTicket.ticketCode}</span>
                  <TicketStatusBadge status={activeTicket.status} />
                  <PriorityBadge priority={activeTicket.priority} />
                </DialogTitle>
                <DialogDescription>{activeTicket.title}</DialogDescription>
              </DialogHeader>

              <p className="text-sm text-black/80 bg-[#F5F5F3] rounded-2xl p-3.5 border border-black/10">
                {activeTicket.description}
              </p>

              {/* Status & Resolution Control */}
              <div className="rounded-[22px] border border-black/12 bg-white p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ticket Status</Label>
                    <Select
                      value={statusVal}
                      onValueChange={(v) => setStatusVal(v as TicketStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">Open</SelectItem>
                        <SelectItem value="ASSIGNED">Assigned</SelectItem>
                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                        <SelectItem value="RESOLVED">Resolved</SelectItem>
                        <SelectItem value="CLOSED">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleUpdateTicket}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? "Saving..." : "Save Status & Resolution"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tkt-res">Resolution Notes</Label>
                  <Textarea
                    id="tkt-res"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Document repair action, replacement serial, or inventory adjustment..."
                  />
                </div>
              </div>

              {/* Comments Thread */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                  Discussion Thread
                </p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {activeTicket.comments && activeTicket.comments.length > 0 ? (
                    activeTicket.comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl bg-[#F5F5F3] border border-black/10 p-3 text-xs"
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold text-black">
                            {c.author.fullName}
                          </span>
                          <span className="text-black/55 tabular-nums">
                            {formatDateTime(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-black/80">{c.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-black/55">No comments yet.</p>
                  )}
                </div>

                <form onSubmit={handleAddComment} className="flex gap-2">
                  <Textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Reply to instructor..."
                    className="min-h-[44px]"
                  />
                  <Button type="submit" disabled={saving || !commentBody.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
