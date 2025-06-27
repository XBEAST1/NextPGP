"use client";
import { useEffect } from "react";

export default function ClearCacheOnUpdate() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__;

    const stored = localStorage.getItem("build_version");
    if (stored !== BUILD_TIMESTAMP && "caches" in window) {
      // delete all caches
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));

      // unregister every SW
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()));

      // store version & reload
      localStorage.setItem("build_version", BUILD_TIMESTAMP);
      location.replace(location.href);
    }
  }, []);
  return null;
}
