"use client";

import { useEffect } from "react";
import NProgress from "nprogress";
import { usePathname, useSearchParams } from "next/navigation";
import "@/styles/nprogress.css";
import NextLink from "next/link";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
    NProgress.configure({ showSpinner: false });
  }, [pathname, searchParams]);

  return null;
}

// NProgressLink component
export function NProgressLink({ href, ...props }) {
  const handleClick = (...args) => {
    NProgress.start();
    if (props.onClick) props.onClick(...args);
  };

  return <NextLink href={href} {...props} onClick={handleClick} />;
}
