"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ConnectivityCheck() {
  const router = useRouter();

  useEffect(() => {
    function check() {
      if (!navigator.onLine && router.pathname !== "/offline") {
        router.replace("/offline", { forceOptimisticNavigation: true });
      } else if (navigator.onLine && router.pathname === "/offline") {
        router.replace("/", { forceOptimisticNavigation: true });
      }
    }

    window.addEventListener("offline", check);
    window.addEventListener("online", check);
    check();

    return () => {
      window.removeEventListener("offline", check);
      window.removeEventListener("online", check);
    };
  }, [router]);

  return null;
}
