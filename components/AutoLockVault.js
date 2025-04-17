"use client";

import { useEffect } from "react";

export default function AutoLockVault() {
  useEffect(() => {
    let locked = false;

    const lockVault = () => {
      if (locked) return;
      // don’t lock on a page reload
      const navEntries = performance.getEntriesByType("navigation");
      const navType = navEntries.length ? navEntries[0].type : null;
      if (navType === "reload") return;

      locked = true;
      const url = "/api/vault/lock";

      if (navigator.sendBeacon) {
        navigator.sendBeacon(url);
      } else {
        // fallback for older browsers
        fetch(url, {
          method: "POST",
          keepalive: true,
          credentials: "include",
        }).catch(() => {
          /* swallow errors */
        });
      }
    };

    window.addEventListener("pagehide", lockVault);

    return () => {
      window.removeEventListener("pagehide", lockVault);
    };
  }, []);

  return null;
}
