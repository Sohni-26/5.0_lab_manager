"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { apiClient } from "@/lib/api-client";
import { DEMO_CAMPUS_INVENTORY, DEMO_TICKETS } from "@/lib/demo-data";
import { formatDateTime, ISSUE_CATEGORY_LABELS } from "@/lib/utils";
import type {
  CampusInventoryDTO,
  IssueCategory,
  IssueTicketDTO,
  TicketPriority,
} from "@/types/contracts";

export default function InstructorTicketsPage() {
  const [tickets, setTickets] = useState<IssueTicketDTO[]>([]);
  const [inventory, setInventory] = useState<CampusInventoryDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Create ticket form
  const [category, setCategory] = useState<IssueCategory>(
    "MALFUNCTIONING_EQUIPMENT"
  );
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [itemId, setItemId] = useState<string>("NONE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Comments dialog
  const [activeTicket, setActiveTicket] = useState<IssueTicketDTO | null>(null);
  const [commentBody, setCommentBody] = useState("");

  const load = useCallback(async () => {
    try {
      const [tRes, invRes] = await Promise.all([
        apiClient.tickets.list({ pageSize: 50 }),
        apiClient.inventory.list({ pageSize: 100 }),
      ]);
      setTickets(tRes.data);
      setInventory(invRes.data);
    } catch {
      setTickets(DEMO_TICKETS);
      setInventory(DEMO_CAMPUS_INVENTORY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await apiClient.uploads.uploadFile(file);
      setAttachmentUrls((prev) => [...prev, res.data.url]);
      toast.success("Photo attached to ticket");
    } catch {
      const localUrl = URL.createObjectURL(file);
      setAttachmentUrls((prev) => [...prev, localUrl]);
      toast.success("Photo attached (preview)");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.tickets.create({
        category,
        priority,
        itemId: itemId === "NONE" ? null : itemId,
        title: title.trim(),
        description: description.trim(),
        attachmentUrls,
      });
      setTickets((prev) => [res.data, ...prev]);
      toast.success(`Issue ticket ${res.data.ticketCode} raised to Campus Lab Manager`);
      setTitle("");
      setDescription("");
      setItemId("NONE");
      setAttachmentUrls([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to raise ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket || !commentBody.trim()) return;
    try {
      const res = await apiClient.tickets.addComment(activeTicket.id, {
        body: commentBody.trim(),
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === activeTicket.id ? res.data : t))
      );
      setActiveTicket(res.data);
      setCommentBody("");
      toast.success("Comment added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to comment");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Issue Tickets"
        description="Report damaged, missing, or malfunctioning equipment directly to your Campus Lab Manager and track resolution progress."
      />

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* Raise Ticket Form */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4.5 w-4.5 text-[#F26943]" />
              Raise New Issue Ticket
            </CardTitle>
            <CardDescription>
              Automatically routed to your assigned Campus Lab Manager.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Issue Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as IssueCategory)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ISSUE_CATEGORY_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v as TicketPriority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Affected Equipment (Optional)</Label>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campus item..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">General Lab / No Specific SKU</SelectItem>
                    {inventory.map((inv) => (
                      <SelectItem key={inv.itemId} value={inv.itemId}>
                        {inv.item.code} · {inv.item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tkt-title">Issue Summary</Label>
                <Input
                  id="tkt-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Power supply channel 2 voltage drift"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tkt-desc">Detailed Description</Label>
                <Textarea
                  id="tkt-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe symptoms, unit serial/bench number, and urgency..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Attach Evidence Photo (Optional)</Label>
                <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#DAD8D0] bg-[#FAF9F6] px-4 py-3 text-xs font-medium text-[#72736E] hover:border-[#F26943] cursor-pointer">
                  <Upload className="h-4 w-4 text-[#F26943]" />
                  <span>
                    {uploading
                      ? "Uploading photo..."
                      : `Upload image (${attachmentUrls.length} attached)`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                <ShieldAlert className="h-4 w-4" />
                {submitting ? "Submitting..." : "Submit Issue Ticket"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Campus Ticket Tracker */}
        <div className="lg:col-span-7 space-y-3.5">
          {loading ? (
            <Card className="p-8 text-center text-sm text-[#72736E]">
              Loading tickets...
            </Card>
          ) : (
            tickets.map((t) => (
              <Card key={t.id} className="p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#F26943]">
                      {t.ticketCode}
                    </span>
                    <TicketStatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <span className="text-xs text-[#72736E]">
                    {formatDateTime(t.createdAt)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#222321]">
                  {t.title}
                </h3>
                <p className="text-xs text-[#72736E] leading-relaxed">
                  {t.description}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-[#EFECE6]">
                  <span className="text-xs text-[#72736E]">
                    {ISSUE_CATEGORY_LABELS[t.category]}
                    {t.item ? ` · ${t.item.code}` : ""}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveTicket(t);
                      setCommentBody("");
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comments ({t.comments?.length ?? 0})
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Ticket Discussion Modal */}
      <Dialog
        open={Boolean(activeTicket)}
        onOpenChange={(o) => !o && setActiveTicket(null)}
      >
        <DialogContent className="max-w-xl">
          {activeTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono">{activeTicket.ticketCode}</span>
                  <TicketStatusBadge status={activeTicket.status} />
                </DialogTitle>
                <DialogDescription>{activeTicket.title}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {activeTicket.comments && activeTicket.comments.length > 0 ? (
                  activeTicket.comments.map((c) => (
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
              <form onSubmit={handleAddComment} className="flex gap-2">
                <Textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Add an update for your Lab Manager..."
                  className="min-h-[44px]"
                />
                <Button type="submit" disabled={!commentBody.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
