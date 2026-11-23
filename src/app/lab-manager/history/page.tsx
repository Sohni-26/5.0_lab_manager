"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { DEMO_TRANSACTIONS } from "@/lib/demo-data";
import { exportToCsv, formatDateTime } from "@/lib/utils";
import type { InventoryTransactionDTO } from "@/types/contracts";

export default function LabManagerHistoryPage() {
  const [transactions, setTransactions] = useState<InventoryTransactionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiClient.inventory.transactions({ pageSize: 100 });
      setTransactions(res.data);
    } catch {
      setTransactions(DEMO_TRANSACTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        t.type.toLowerCase().includes(q) ||
        (t.item?.name.toLowerCase().includes(q) ?? false) ||
        (t.item?.code.toLowerCase().includes(q) ?? false) ||
        (t.remarks?.toLowerCase().includes(q) ?? false)
    );
  }, [transactions, search]);

  const handleExport = () => {
    exportToCsv(
      `campus-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((t) => ({
        Timestamp: t.createdAt,
        Type: t.type,
        ItemCode: t.item?.code ?? "",
        ItemName: t.item?.name ?? "",
        Quantity: t.quantity,
        Previous: t.previousQuantity,
        Updated: t.updatedQuantity,
        PerformedBy: t.performedBy?.fullName ?? "System",
        Remarks: t.remarks ?? "",
      }))
    );
    toast.success("Exported transaction ledger CSV");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Inventory Transaction Ledger"
        description="Append-only history of every stock receipt, reservation, student issue, return, damage mark, and authorised adjustment."
        actions={
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export Ledger CSV
          </Button>
        }
      />

      <div className="rounded-2xl border border-[#E6E5E0] bg-white p-3.5 shadow-card">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72736E]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by event type, equipment, or remarks..."
            className="pl-10"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm sheet-table">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Transaction</th>
                <th className="px-4 py-3">Equipment</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Before → After</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#72736E]">
                    Loading transaction ledger...
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#FAF9F6]">
                    <td className="px-4 py-3 text-xs text-[#72736E] whitespace-nowrap">
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#222321]">
                        {tx.item?.name ?? tx.itemId}
                      </p>
                      <p className="font-mono text-[11px] text-[#72736E]">
                        {tx.item?.code}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {tx.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-[#72736E]">
                      {tx.previousQuantity} →{" "}
                      <strong className="text-[#222321]">
                        {tx.updatedQuantity}
                      </strong>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#72736E]">
                      {tx.performedBy?.fullName ?? "System"}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#585955] max-w-xs truncate">
                      {tx.remarks ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
