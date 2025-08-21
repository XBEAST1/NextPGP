"use client";

import { useEffect, useState } from "react";
import { Progress, Modal, ModalContent } from "@heroui/react";

export default function AppUpdater() {
  const [show, setShow] = useState(false);

  const isProduction = process.env.NODE_ENV === "production";
  const isNotLocalhost =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    !window.location.hostname.startsWith("127.") &&
    !window.location.hostname.startsWith("192.168.") &&
    !window.location.hostname.startsWith("10.");

  useEffect(() => {
    if (!isProduction || !isNotLocalhost) {
      return;
    }
    const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__;
    const stored = localStorage.getItem("build_version");

    const shouldShowModal = stored && stored !== BUILD_TIMESTAMP;

    if (shouldShowModal && "serviceWorker" in navigator) {
      setShow(true);
    }

    if (stored !== BUILD_TIMESTAMP && "serviceWorker" in navigator) {
      // Clear caches and unregister old service workers
      Promise.all([
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister()))),
      ]).then(async () => {
        let reloaded = false;

        function doReload() {
          if (reloaded) return;
          reloaded = true;

          const url = new URL(window.location.href);
          url.searchParams.set("forceReload", Date.now().toString());
          window.location.replace(url.toString());
        }

        // Check all caches that start with "workbox-precache"
        let foundWorkboxCache = false;
        await new Promise((res) => setTimeout(res, 4000));
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.startsWith("workbox-precache")) {
            foundWorkboxCache = true;

            const cache = await caches.open(cacheName);

            let prevCount = 0;
            let stableCount = 0;

            const checkRequests = async () => {
              const requests = await cache.keys();
              if (requests.length > 100) {
                localStorage.setItem("build_version", BUILD_TIMESTAMP);
                doReload();
                return;
              }
              if (requests.length === prevCount) {
                stableCount++;
              } else {
                stableCount = 0;
                prevCount = requests.length;
              }
              if (stableCount >= 5) {
                setShow(false);
                return;
              }
              setTimeout(checkRequests, 1000);
            };

            checkRequests();
            return;
          }
        }
        if (!foundWorkboxCache) {
          doReload();
        }
      });
    }
  }, []);

  // Don't render anything if not in production or on localhost
  if (!isProduction || !isNotLocalhost) {
    return null;
  }

  return (
    <Modal isOpen={show} hideCloseButton backdrop="blur">
      <ModalContent className="flex flex-col items-center gap-4 p-8">
        <span className="text-lg font-semibold">Updating Next PGP...</span>
        <span className="text-default-400 text-sm text-center">
          A new version is available. Caching the latest build, please wait...
        </span>
        <Progress
          isIndeterminate
          aria-label="Loading..."
          className="max-w-md"
          size="sm"
        />
      </ModalContent>
    </Modal>
  );
}
