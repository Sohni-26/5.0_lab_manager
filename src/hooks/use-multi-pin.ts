"use client";

import type React from "react";
import { useCallback, useMemo, useState } from "react";

/**
 * Shared Ctrl+Click / Cmd+Click multi-pin selection hook used across all role dashboards.
 * - Normal click: focuses a single item (clean default experience).
 * - Ctrl+Click (Windows/Linux) or Cmd+Click (macOS): pins/unpins multiple items on the canvas
 *   so users can view and compare multiple flowcharts, allocations, tickets, or campuses live.
 */
export function useMultiPinSelection<T>(
  items: T[],
  getId: (item: T) => string,
  maxPinned = 6
) {
  const [rawSelectedIds, setRawSelectedIds] = useState<string[]>([]);

  const itemMap = useMemo(() => {
    const map = new Map<string, T>();
    for (const item of items) {
      map.set(getId(item), item);
    }
    return map;
  }, [items, getId]);

  // Keep selectedIds strictly in sync with currently available items; default to first item
  const selectedIds = useMemo(() => {
    if (items.length === 0) return [];
    const valid = rawSelectedIds.filter((id) => itemMap.has(id));
    if (valid.length > 0) return valid;
    return [getId(items[0])];
  }, [rawSelectedIds, itemMap, items, getId]);

  const selectedItems = useMemo(
    () =>
      selectedIds
        .map((id) => itemMap.get(id))
        .filter((item): item is T => Boolean(item)),
    [selectedIds, itemMap]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const isMultiMode = selectedIds.length > 1;

  const isSelected = useCallback(
    (id: string) => selectedSet.has(id),
    [selectedSet]
  );

  const setSingle = useCallback((id: string) => {
    setRawSelectedIds([id]);
  }, []);

  const unpin = useCallback(
    (id: string) => {
      setRawSelectedIds((prev) => {
        const current =
          prev.filter((x) => itemMap.has(x)).length > 0
            ? prev.filter((x) => itemMap.has(x))
            : items[0]
              ? [getId(items[0])]
              : [];
        if (current.length <= 1) return current;
        return current.filter((x) => x !== id);
      });
    },
    [itemMap, items, getId]
  );

  const collapseToPrimary = useCallback(() => {
    setRawSelectedIds((prev) => {
      const valid = prev.filter((x) => itemMap.has(x));
      if (valid.length > 0) return [valid[0]];
      return items[0] ? [getId(items[0])] : [];
    });
  }, [itemMap, items, getId]);

  const handleSelect = useCallback(
    (id: string, e?: Pick<React.MouseEvent, "ctrlKey" | "metaKey">) => {
      const multiIntent = Boolean(e && (e.ctrlKey || e.metaKey));
      if (!multiIntent) {
        setRawSelectedIds([id]);
        return;
      }

      setRawSelectedIds((prev) => {
        const current =
          prev.filter((x) => itemMap.has(x)).length > 0
            ? prev.filter((x) => itemMap.has(x))
            : items[0]
              ? [getId(items[0])]
              : [];

        if (current.includes(id)) {
          // Keep at least one item visible if user Ctrl+Clicks the only selected item
          if (current.length <= 1) return current;
          return current.filter((x) => x !== id);
        }

        if (current.length >= maxPinned) {
          return [...current.slice(1), id];
        }
        return [...current, id];
      });
    },
    [itemMap, items, getId, maxPinned]
  );

  return {
    selectedIds,
    selectedItems,
    primaryItem: selectedItems[0] ?? null,
    isMultiMode,
    isSelected,
    handleSelect,
    setSingle,
    unpin,
    collapseToPrimary,
  };
}
