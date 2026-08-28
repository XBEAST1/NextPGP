/**
 * hooks/useKeyring.ts
 *
 * Manages loading PGP keys from IndexedDB and exposing a manual refresh callback.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { loadKeysFromIndexedDB } from "@/lib/pgp";
import { KEYRING_BROADCAST_CHANNEL } from "@/lib/indexeddb";
import { KeyringUser } from "@/hooks/useKeyOperations";

export function useKeyring() {
  const [users, setUsers] = useState<KeyringUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshKeys = useCallback(async () => {
    try {
      const refreshedKeys = (await loadKeysFromIndexedDB()) as KeyringUser[];
      setUsers(refreshedKeys);
      return refreshedKeys;
    } catch (error) {
      console.error("Failed to refresh keys from IndexedDB:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchKeys = async () => {
      setIsLoading(true);
      try {
        const pgpKeys = (await loadKeysFromIndexedDB()) as KeyringUser[];
        if (isMounted) {
          setUsers(pgpKeys);
        }
      } catch (error) {
        console.error("Failed to load keys from IndexedDB:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchKeys();

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(KEYRING_BROADCAST_CHANNEL);
        channel.onmessage = (event) => {
          if (event.data?.type === "KEYRING_UPDATED" && isMounted) {
            refreshKeys();
          }
        };
      } catch (e) {
        console.warn("BroadcastChannel not supported:", e);
      }
    }

    return () => {
      isMounted = false;
      if (channel) {
        channel.close();
      }
    };
  }, [refreshKeys]);

  return { users, setUsers, isLoading, refreshKeys };
}
