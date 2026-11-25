"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Code2, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { DEMO_AUDIT_LOGS } from "@/lib/demo-data";
import { formatDateTime } from "@/lib/utils";
import type { AuditLogDTO } from "@/types/contracts";

export default function CentralAuditLogsPage() {
  const { selectedCampusId } = useAuth();
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditLogDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.auditLogs.list({
        campusId: selectedCampusId || undefined,
        pageSize: 80,
      });
      setLogs(res.data);
    } catch {
      setLogs(DEMO_AUDIT_LOGS);
    } finally {
      setLoading(false);
    }
  }, [selectedCampusId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        (l.actor?.fullName.toLowerCase().includes(q) ?? false) ||
        (l.campus?.code.toLowerCase().includes(q) ?? false)
    );
  }, [logs, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Immutable Audit Logs"
        description="Append-only governance trail recording every stock adjustment, allocation dispatch, approval decision, and return verification."
      />

      <div className="flex items-center justify-between gap-3 rounded-[22px] border border-black/12 bg-white p-3.5 shadow-card">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/55" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by action, entity type, actor, or campus..."
            className="pl-10"
          />
        </div>
        <Badge variant="accent" className="font-mono">
          {filtered.length} records
        </Badge>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="border-b border-black/10 text-left">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3 text-right">State Diff</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-black/55">
                    Loading audit trail...
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-black/10 transition-colors hover:bg-[#F5F5F3]"
                  >
                    <td className="px-4 py-3 text-xs text-black/55 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-black">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Badge variant="secondary">{log.entityType}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-black">
                          {log.actor?.fullName ?? "System"}
                        </span>
                        {log.actorRole && <RoleBadge role={log.actorRole} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-[#BCE6FA] px-2.5 py-0.5 font-mono text-xs font-semibold text-black">
                        {log.campus?.code ?? "GLOBAL"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelected(log)}
                      >
                        <Code2 className="h-3.5 w-3.5" />
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
        <DialogContent className="max-w-2xl rounded-[22px] border-black/12 bg-white text-black">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base font-semibold text-black">
                  {selected.action}
                </DialogTitle>
                <DialogDescription className="text-black/55">
                  {selected.entityType}{" "}
                  <span className="font-mono text-black">({selected.entityId})</span>{" "}
                  · {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-[#F5F5F3] p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-black/55 mb-2">
                    Previous State
                  </p>
                  <pre className="text-xs font-mono text-black overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.previousState ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-2xl border border-black/10 bg-[#AAC2AA]/25 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-black mb-2">
                    New State
                  </p>
                  <pre className="text-xs font-mono text-black overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.newState ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
