"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ConnectivityCheck() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function check() {
      if (!navigator.onLine && pathname !== "/offline") {
        router.replace("/offline");
      } else if (navigator.onLine && pathname === "/offline") {
        router.replace("/");
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
