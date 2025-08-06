"use client";

import { usePasswordProtection } from "@/context/password-protection";
import { Spinner } from "@heroui/react";

const PasswordProtectionWrapper = ({ children }) => {
  const { isUnlocked, isLoading, refreshKey } = usePasswordProtection();

  return (
    <>
      <div key={refreshKey}>{children}</div>

      {isLoading && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <Spinner size="lg" color="primary" />
            <p className="mt-4 text-sm text-default-500">
              Preparing secure workspace...
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isUnlocked && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center"></div>
      )}
    </>
  );
};

export default PasswordProtectionWrapper;
