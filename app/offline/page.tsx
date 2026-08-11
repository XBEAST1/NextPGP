"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@heroui/react";
import Link from "next/link";
import Logo from "@/assets/Logo2.jpg";
import LogoLight from "@/assets/Logo-Light.png";

const OfflinePage = () => {
  const { theme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const checkOnlineStatus = () => {
      if (navigator.onLine) {
        router.replace("/");
      }
    };

    checkOnlineStatus();

    window.addEventListener("online", checkOnlineStatus);

    return () => {
      window.removeEventListener("online", checkOnlineStatus);
    };
  }, [router]);

  return (
    <div className="-mt-10 flex flex-col items-center justify-center h-full text-center">
      <div className="logo mb-4">
        <img
          width={200}
          height={200}
          src={theme === "light" ? LogoLight.src : Logo.src}
          alt="NextPGP Logo"
        />
      </div>
      <h1 className="text-2xl font-semibold mb-4">You&apos;re Offline</h1>
      <Button as={Link} href="/" className="mt-8">
        Go Home
      </Button>
    </div>
  );
};

export default OfflinePage;
