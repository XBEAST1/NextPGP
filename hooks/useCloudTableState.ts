"use client";

import { useState, useMemo, useCallback, useEffect } from "react";

export function useCloudTableState({ initialColumns, allColumns, storageKey }: any) {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState<any>({});
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [locking, setLocking] = useState(false);
  const [totalKeys, setTotalKeys] = useState(0);
  const [cache, setCache] = useState({});

  const getInitialVisibleColumns = () => {
    if (typeof window === "undefined") return new Set(initialColumns);
    const saved = localStorage.getItem(storageKey);
    if (!saved) return new Set(initialColumns);
    try {
      const parsed = JSON.parse(saved);
      const availableUids = allColumns.map((col: any) => col.uid);
      const filtered = parsed.filter((col: any) => availableUids.includes(col));
      return new Set([...initialColumns, ...filtered]);
    } catch {
      return new Set(initialColumns);
    }
  };

  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns);

  useEffect(() => {
    if (typeof window === "undefined" || !visibleColumns) return;
    const current = Array.from(visibleColumns);
    const saved = localStorage.getItem(storageKey);
    const availableUids = allColumns.map((col: any) => col.uid);
    let otherPages = [];
    if (saved) {
      try {
        otherPages = JSON.parse(saved).filter((col: any) => !availableUids.includes(col));
      } catch {}
    }
    localStorage.setItem(storageKey, JSON.stringify([...otherPages, ...current]));
  }, [visibleColumns, allColumns, storageKey]);

  const pages = totalKeys > 0 ? Math.ceil(totalKeys / rowsPerPage) : 1;

  useEffect(() => {
    if (page > pages && pages > 0) {
      setPage(pages);
    }
  }, [pages, page]);

  const filteredItems = useMemo(() => {
    let filteredUsers = [...users];

    if (filterValue) {
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.name?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.email?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.creationdate?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.expirydate?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.keystatus?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.passwordprotected?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.status?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.keyid?.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.fingerprint?.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredUsers;
  }, [users, filterValue]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const first = a[sortDescriptor.column];
      const second = b[sortDescriptor.column];
      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [sortDescriptor, filteredItems]);

  const hasSearchFilter = Boolean(filterValue);

  const headerColumns = useMemo(() => {
    let filteredColumns;
    if ((visibleColumns as any) === "all") {
      filteredColumns = allColumns;
    } else {
      filteredColumns = allColumns.filter((column: any) =>
        Array.from(visibleColumns).includes(column.uid)
      );
    }

    const widthWeights = {
      name: 8,
      email: 20,
      creationdate: 12,
      expirydate: 8,
      keystatus: 10,
      passwordprotected: 10,
      status: 10,
      keyid: 10,
      fingerprint: 20,
      algorithm: 12,
      backup: 8,
      import: 8,
      delete: 6,
    };

    const totalWeight = filteredColumns.reduce(
      (sum: any, column: any) => sum + ((widthWeights as any)[column.uid] || 10),
      0
    );

    return filteredColumns.map((column: any) => {
      const weight = (widthWeights as any)[column.uid] || 10;
      const width = `${((weight / totalWeight) * 100).toFixed(2)}%`;
      return {
        ...column,
        width,
      };
    });
  }, [visibleColumns, allColumns]);

  const onRowsPerPageChange = useCallback((e: any) => {
    const newRowsPerPage = Number(e.target.value);
    setRowsPerPage(newRowsPerPage);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value: any) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const handlePageChange = (newPage: any) => {
    setPage(newPage);
  };

  return {
    filterValue,
    setFilterValue,
    users,
    setUsers,
    rowsPerPage,
    setRowsPerPage,
    sortDescriptor,
    setSortDescriptor,
    page,
    setPage,
    isLoading,
    setIsLoading,
    isLoadingKeys,
    setIsLoadingKeys,
    locking,
    setLocking,
    totalKeys,
    setTotalKeys,
    cache,
    setCache,
    visibleColumns,
    setVisibleColumns,
    pages,
    filteredItems,
    sortedItems,
    hasSearchFilter,
    headerColumns,
    onRowsPerPageChange,
    onSearchChange,
    onClear,
    handlePageChange,
  };
}
