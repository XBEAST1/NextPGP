"use client";

import { usePasswordProtection } from "@/context/password-protection";
import { Spinner } from "@heroui/react";

const PasswordProtectionWrapper = ({ children }) => {
  const { isUnlocked, isLoading } = usePasswordProtection();

  // Show loading spinner while password protection is initializing
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" color="primary" />
          <p className="mt-4 text-sm text-default-500">
            Initializing security...
          </p>
        </div>
      </div>
    );
  }

  // If password protection is enabled but user is not unlocked, show a minimal container
  // (the PasswordProtectionProvider will show the unlock modal)
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-background">
        {/* Modal will be rendered by PasswordProtectionProvider */}
      </div>
    );
  }

  // User is authenticated, render the app content
  return children;
};

export default PasswordProtectionWrapper;
