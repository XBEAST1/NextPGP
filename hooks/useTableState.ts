/**
 * hooks/useTableState.ts
 *
 * Generic hook for table pagination, sorting, filtering, and column visibility.
 * Eliminates duplicate table logic across main table and modal tables.
 */

"use client";

import { useState, useMemo, useCallback } from "react";

export interface SortDescriptor {
  column?: string;
  direction?: "ascending" | "descending" | string;
}

export interface UseTableStateOptions<T = any> {
  items: T[];
  filterFn?: (item: T, filterValue: string) => boolean;
  rowsPerPage?: number;
  persistKey?: string;
}

/**
 * @param opts Configuration options for table state
 */
export function useTableState<T = any>({
  items,
  filterFn,
  rowsPerPage: initialRowsPerPage = 5,
  persistKey,
}: UseTableStateOptions<T>) {
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({});

  const [rowsPerPage, setRowsPerPage] = useState(() => {
    if (persistKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(persistKey);
      if (stored) return Number(stored);
    }
    return initialRowsPerPage;
  });

  const hasSearchFilter = Boolean(filterValue);

  const defaultFilterFn = useCallback(
    (item: any, value: string) =>
      Object.values(item).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(value.toLowerCase())
      ),
    []
  );

  const activeFilterFn = filterFn || defaultFilterFn;

  const filteredItems = useMemo(() => {
    if (!filterValue) return [...items];
    return items.filter((item: T) => activeFilterFn(item, filterValue));
  }, [items, filterValue, activeFilterFn]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));

  const sortedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return [...filteredItems]
      .sort((a: any, b: any) => {
        if (!sortDescriptor.column) return 0;
        const first = a[sortDescriptor.column];
        const second = b[sortDescriptor.column];
        const cmp = first < second ? -1 : first > second ? 1 : 0;
        return sortDescriptor.direction === "descending" ? -cmp : cmp;
      })
      .slice(start, end);
  }, [filteredItems, page, rowsPerPage, sortDescriptor]);

  const onNextPage = useCallback(() => {
    if (page < pages) setPage((p) => p + 1);
  }, [page, pages]);

  const onPreviousPage = useCallback(() => {
    if (page > 1) setPage((p) => p - 1);
  }, [page]);

  const onSearchChange = useCallback((value: string) => {
    setFilterValue(value || "");
    setPage(1);
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const onRowsPerPageChange = useCallback(
    (e: any) => {
      const val = Number(e.target.value);
      setRowsPerPage(val);
      setPage(1);
      if (persistKey) localStorage.setItem(persistKey, String(val));
    },
    [persistKey]
  );

  return {
    filterValue,
    setFilterValue,
    page,
    setPage,
    rowsPerPage,
    sortDescriptor,
    setSortDescriptor,
    hasSearchFilter,
    filteredItems,
    sortedItems,
    pages,
    onNextPage,
    onPreviousPage,
    onSearchChange,
    onClear,
    onRowsPerPageChange,
  };
}
