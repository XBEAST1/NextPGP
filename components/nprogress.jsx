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
  const currentPath = usePathname();

  const handleClick = (e) => {
    NProgress.start();
    if (href === currentPath) {
      setTimeout(() => {
        NProgress.done();
      }, 300);
    }
    if (props.onClick) props.onClick(e);
  };

  return <NextLink href={href} {...props} onClick={handleClick} />;
}
