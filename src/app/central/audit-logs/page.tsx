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

      <div className="flex items-center gap-3 rounded-2xl border border-[#E6E5E0] bg-white p-3.5 shadow-card">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by action, entity type, actor, or campus..."
            className="pl-10"
          />
        </div>
        <Badge variant="outline">{filtered.length} records</Badge>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left">
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
                  <td colSpan={6} className="p-8 text-center text-[#72736E]">
                    Loading audit trail...
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 text-xs text-[#72736E] whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#222321]">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <Badge variant="secondary">{log.entityType}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#222321]">
                          {log.actor?.fullName ?? "System"}
                        </span>
                        {log.actorRole && <RoleBadge role={log.actorRole} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#F26943]">
                      {log.campus?.code ?? "GLOBAL"}
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
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">
                  {selected.action}
                </DialogTitle>
                <DialogDescription>
                  {selected.entityType} ({selected.entityId}) ·{" "}
                  {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E6E5E0] bg-[#FAF9F6] p-3">
                  <p className="text-[11px] font-semibold uppercase text-[#72736E] mb-2">
                    Previous State
                  </p>
                  <pre className="text-xs font-mono text-[#222321] overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.previousState ?? {}, null, 2)}
                  </pre>
                </div>
                <div className="rounded-xl border border-[#288568]/25 bg-[#EAF6F1]/40 p-3">
                  <p className="text-[11px] font-semibold uppercase text-[#288568] mb-2">
                    New State
                  </p>
                  <pre className="text-xs font-mono text-[#222321] overflow-x-auto whitespace-pre-wrap">
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
