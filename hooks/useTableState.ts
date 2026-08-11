/**
 * hooks/useTableState.js
 *
 * Generic hook for table pagination, sorting, filtering, and column visibility.
 * Eliminates the identical pattern that was copy-pasted 5× in page.jsx
 * (main table + 4 modal tables).
 */

"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * @param {object} opts
 * @param {Array}  opts.items                - The full dataset to operate on
 * @param {Function} [opts.filterFn]         - Custom filter predicate (item, filterValue) => bool
 *                                            Defaults to matching filterValue against all string fields.
 * @param {number} [opts.rowsPerPage=5]      - Rows per page
 * @param {string} [opts.persistKey]         - localStorage key for persisting rowsPerPage
 */
export function useTableState({
  items,
  filterFn,
  rowsPerPage: initialRowsPerPage = 5,
  persistKey,
}: {
  items: any[];
  filterFn?: (item: any, value: string) => boolean;
  rowsPerPage?: number;
  persistKey?: string;
}) {
  const [filterValue, setFilterValue] = useState("");
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<{column?: string; direction?: string}>({});
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    if (persistKey && typeof window !== "undefined") {
      const stored = localStorage.getItem(persistKey);
      if (stored) return Number(stored);
    }
    return initialRowsPerPage;
  });

  const hasSearchFilter = Boolean(filterValue);

  // Default filter: match against all string-valued fields
  const defaultFilterFn = useCallback(
    (item: any, value: string) =>
      Object.values(item).some(
        (v) => typeof v === "string" && v.toLowerCase().includes(value.toLowerCase())
      ),
    []
  );

  const activeFilerFn = filterFn || defaultFilterFn;

  const filteredItems = useMemo(() => {
    if (!filterValue) return [...items];
    return items.filter((item: any) => activeFilerFn(item, filterValue));
  }, [items, filterValue, activeFilerFn]);

  const pages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage));

  const sortedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return [...filteredItems]
      .sort((a, b) => {
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
