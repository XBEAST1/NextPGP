/**
 * hooks/useKeyring.js
 *
 * Manages loading PGP keys from IndexedDB, refreshing on storage events,
 * and exposing a manual refresh callback.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { openDB } from "@/lib/indexeddb";
import { loadKeysFromIndexedDB } from "@/lib/pgp";

export function useKeyring() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Ensure IndexedDB is initialised
    openDB();
  }, []);

  useEffect(() => {
    const fetchKeys = async () => {
      setIsLoading(true);
      try {
        const pgpKeys = await loadKeysFromIndexedDB();
        setUsers(pgpKeys);
      } catch {
        // silently ignore initial load errors; individual operations surface their own toasts
      }
      setIsLoading(false);
    };

    fetchKeys();

    const handleStorageChange = async () => {
      setIsLoading(true);
      try {
        const updatedKeys = await loadKeysFromIndexedDB();
        setUsers(updatedKeys);
      } catch (error) {
        console.error("Error loading keys:", error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const refreshKeys = useCallback(async () => {
    const refreshedKeys = await loadKeysFromIndexedDB();
    setUsers(refreshedKeys);
    return refreshedKeys;
  }, []);

  return { users, setUsers, isLoading, refreshKeys };
}
