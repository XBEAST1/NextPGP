"use client";

import { useState, useEffect } from "react";
import { Button, Input, Spinner, addToast } from "@heroui/react";
import { logout } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { workerPool } from "@/lib/workerPool";
import UserDetails from "@/components/userdetails";
import NProgress from "nprogress";
import ConnectivityCheck from "@/components/connectivity-check";

const Page = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    if (!navigator.onLine) {
      router.push("/offline");
      return;
    }

    const handleOffline = () => {
      router.push("/offline");
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    const checkVaultExists = async () => {
      const res = await fetch("/api/create-vault");
      if (res.ok) {
        const { exists, csrfToken } = await res.json();
        setCsrfToken(csrfToken);
        if (exists) {
          NProgress.start();
          router.push("/vault");
        }
      }
    };

    checkVaultExists();
  }, [router]);

  const handleCreateVault = async () => {
    if (!password.trim()) {
      addToast({
        title: "Please enter a password",
        color: "danger",
      });
      return;
    }
    setLoading(true);

    // Helper to convert buffer to hex string
    function bufferToHex(buffer) {
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    try {
      // Generate a random 32-byte verification text
      const randomBytes = crypto.getRandomValues(new Uint8Array(32));
      const verificationText = bufferToHex(randomBytes);

      // Store the verification text with a prefix to identify it
      const combinedText = `VERIFY:${verificationText}`;

      const verificationCipher = await workerPool({
        type: "encrypt",
        responseType: "encryptResponse",
        text: combinedText,
        password,
      });

      // Only send the cipher with real CSRF protection
      const res = await fetch("/api/create-vault", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verificationCipher,
          csrfToken,
        }),
      });

      if (res.ok) {
        NProgress.start();
        router.push("/vault");
      } else {
        const { error } = await res.json();

        if (res.status === 429) {
          addToast({
            title: "Too many requests. Please wait a moment and try again.",
            color: "warning",
          });
        } else if (res.status === 403) {
          addToast({
            title: "Session expired. Please refresh the page and try again.",
            color: "danger",
          });
          // Refresh the page to get new CSRF token
          setTimeout(() => window.location.reload(), 2000);
        } else if (error === "Vault already exists") {
          addToast({
            title: "Vault already exists",
            color: "danger",
          });
        } else {
          addToast({
            title: "There was an error creating the vault",
            color: "danger",
          });
        }
        setLoading(false);
      }
    } catch (e) {
      console.error("Vault creation failed:", e);
      addToast({
        title:
          "Encryption failed. Your device may be low on memory or CPU power",
        color: "danger",
      });
      setLoading(false);
    }
  };

  return (
    <div>
      <ConnectivityCheck />
      <div className="sm:mt-10 sm:me-32 text-center font-serif">
        <h1 className="text-4xl mb-6">Create Vault</h1>
        <span className="text-xl text-gray-400 flex justify-center items-center gap-2">
          <span className="glow-pulse">🔒</span>
          <span className="shine-text">End-to-End Encrypted</span>
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between items-center sm:items-start mt-6">
        <div className="flex flex-col items-center sm:hidden mt-6 order-1">
          <UserDetails />
        </div>
        <div className="w-full sm:pe-6 order-2">
          <div className="text-center text-sm mt-6 sm:mt-10 mb-5">
            <p className="text-red-500 sm:mb-1 mb-4">
              This password cannot be recovered. If forgotten, the vault will be
              permanently inaccessible and must be deleted. <br />
            </p>
            <span className="text-gray-300 font-medium">
              Use a strong, unique passphrase — it&apos;s the unbreakable key
              that guards your encrypted data.
            </span>
          </div>
          <Input
            name="password"
            placeholder="Enter vault password"
            type={isVisible ? "text" : "password"}
            value={password}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateVault();
              }
            }}
            onChange={(e) => setPassword(e.target.value)}
            endContent={
              <button
                aria-label="toggle password visibility"
                className="focus:outline-none"
                type="button"
                onClick={toggleVisibility}
              >
                {isVisible ? (
                  <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
          />
        </div>
        <div className="hidden sm:block order-3">
          <UserDetails />
        </div>
      </div>
      <div className="sm:me-28 sm:pe-6 flex justify-center mt-8">
        <Button
          color="success"
          variant="flat"
          className="w-1/2 sm:w-1/5"
          onPress={handleCreateVault}
          isDisabled={loading}
        >
          {loading ? <Spinner color="white" size="sm" /> : "Create Vault"}
        </Button>
      </div>
      <br />
      <div className="sm:justify-end sm:mt-0 mt-6 ms-4 flex justify-center items-center">
        <Button className="me-5" onPress={() => logout("google")}>
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Page;
