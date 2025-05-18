"use client";

import { useState, useEffect } from "react";
import { Button, Input, Spinner } from "@heroui/react";
import { logout } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import UserDetails from "@/components/userdetails";
import NProgress from "nprogress";
import "react-toastify/dist/ReactToastify.css";
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

  useEffect(() => {
    const checkVaultExists = async () => {
      const res = await fetch("/api/create-vault");

      if (res.ok) {
        const { exists } = await res.json();
        if (exists) {
          NProgress.start();
          router.push("/vault");
        }
      }
    };

    checkVaultExists();
  }, [router]);

  const onKeyPress = (e) => {
    if (e.key === "Enter") {
      handleCreateVault();
    }
  };

  const handleCreateVault = async () => {
    if (!password.trim()) {
      toast.error("Please enter a password", {
        position: "top-right",
      });
      return;
    }
    setLoading(true);

    const res = await fetch("/api/create-vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      NProgress.start();
      router.push("/vault");
    } else {
      const errorData = await res.json();
      if (errorData.error === "Vault already exists") {
        toast.error("Vault already exists", { position: "top-right" });
      } else {
        toast.error("There Was An Error Creating The Vault", {
          position: "top-right",
        });
      }
      console.log("Error creating vault:", errorData.error);
      setLoading(false);
    }
  };

  return (
    <div>
      <ConnectivityCheck />
      <ToastContainer theme="dark" />
      <h1 className="sm:me-32 sm:mt-10 text-4xl text-center dm-serif-text-regular">
        Create Vault
      </h1>
      <div className="flex flex-col sm:flex-row sm:justify-between items-center sm:items-start mt-6">
        <div className="flex flex-col items-center sm:hidden mt-6 order-1">
          <UserDetails />
        </div>
        <div className="w-full sm:pe-6 order-2">
          <p className="text-center text-red-500 text-sm mt-6 sm:mt-16 mb-5">
            This password cannot be recovered. If forgotten, the vault will be
            permanently inaccessible and must be deleted.
          </p>
          <Input
            name="password"
            placeholder="Enter vault password"
            type={isVisible ? "text" : "password"}
            value={password}
            onKeyDown={onKeyPress}
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
      <div className="sm:justify-end ms-4 flex justify-center items-center">
        <Button className="me-5" onPress={() => logout("google")}>
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Page;
