"use client";

import React, { useState, useEffect } from "react";
import { Button, Input } from "@heroui/react";
import { logout } from "@/actions/auth";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import UserDetails from "@/components/userdetails";
import "react-toastify/dist/ReactToastify.css";

const Page = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [password, setPassword] = useState("");
  const router = useRouter();

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    const checkVaultExists = async () => {
      const res = await fetch("/api/create-vault");

      if (res.ok) {
        const { exists } = await res.json();
        if (exists) {
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

    const res = await fetch("/api/create-vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/vault");
    } else {
      console.log("There Was An Error Creating The Vault");
    }
  };

  return (
    <div>
      <ToastContainer theme="dark" />
      <h1 className="mt-10 me-24 text-4xl text-center dm-serif-text-regular">
        Create Vault
      </h1>
      <div className="flex">
        <div className="w-full pe-6">
          <p className="text-center text-red-500 text-sm me-10 mt-16 mb-5">
            This password cannot be recovered. If forgotten, the vault will be
            permanently inaccessible and must be deleted.
          </p>
          <Input
            className=""
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
        <UserDetails />
      </div>
      <div className="flex justify-center me-24 mt-6">
        <Button
          color="success"
          variant="flat"
          className="w-1/5"
          onPress={handleCreateVault}
        >
          Create Vault
        </Button>
      </div>
      <br />
      <div className="flex justify-end items-center">
        <Button className="me-5" onPress={() => logout("google")}>
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Page;
