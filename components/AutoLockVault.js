"use client";

import { useEffect } from "react";

export default function AutoLockVault() {
  useEffect(() => {
    const lockVault = () => {
      const url = "/api/vault/lock";
      if (navigator.sendBeacon) {
        const blob = new Blob([], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, { method: "POST", keepalive: true, credentials: "include" });
      }
    };

    window.addEventListener("unload", lockVault);

    return () => {
      window.removeEventListener("unload", lockVault);
    };
  }, []);

  return null;
}
