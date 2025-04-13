"use client";

import { useState, useEffect } from "react";
import { Button, Input, Modal, ModalContent } from "@heroui/react";
import { logout } from "@/actions/auth";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { toast, ToastContainer } from "react-toastify";
import { useRouter } from "next/navigation";
import UserDetails from "@/components/userdetails";
import "react-toastify/dist/ReactToastify.css";

const Page = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [DeleteModal, setDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  const router = useRouter();

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    const checkVaultExists = async () => {
      const res = await fetch("/api/vault");

      if (res.ok) {
        const { exists } = await res.json();
        if (!exists) {
          router.push("/create-vault");
        }
      }
    };

    checkVaultExists();
  }, [router]);

  const onKeyPress = (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const handleLogin = async () => {
    if (!password.trim()) {
      toast.error("Please enter a password", {
        position: "top-right",
      });
      return;
    }

    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/cloud-backup");
    } else {
      toast.error("Incorrect password", {
        position: "top-right",
      });
    }
  };

  const triggerDeleteModal = () => {
    setConfirmInput("");
    setDeleteModal(true);
  };

  const handleDeleteVault = async () => {
    const res = await fetch("/api/vault", {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/create-vault");
    } else {
      console.log("Error deleting vault");
    }
  };

  return (
    <div>
      <ToastContainer theme="dark" />
      <h1 className="mt-10 me-24 text-4xl text-center dm-serif-text-regular">
        Open Vault
      </h1>
      <div className="flex">
        <Input
          className="me-10 mt-20"
          name="password"
          placeholder="Enter vault password"
          type={isVisible ? "text" : "password"}
          onKeyDown={onKeyPress}
          value={password}
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
        <UserDetails />
      </div>
      <div className="flex justify-center me-24 mt-6">
        <Button className="w-1/5" onPress={handleLogin}>
          Enter
        </Button>
      </div>
      <br />
      <div className="flex justify-between items-center">
        <Button variant="flat" onPress={triggerDeleteModal} color="danger">
          Delete Vault
        </Button>
        <Button className="me-5" onPress={() => logout("google")}>
          Sign Out
        </Button>
      </div>
      <Modal
        backdrop="blur"
        isOpen={DeleteModal}
        onClose={() => setDeleteModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">Are You Sure You Want To Delete Your Vault?</h3>
          <p className="text-sm mb-3 text-gray-500">
            Please type <strong>DeleteMyVault</strong> to confirm.
          </p>
          <Input
            type="text"
            className=""
            placeholder="Enter DeleteMyVault"
            onKeyDown={(e) => {
              if (e.key === "Enter" && confirmInput === "DeleteMyVault") {
                handleDeleteVault();
                setDeleteModal(false);
              }
            }}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setDeleteModal(false)}
            >
              No
            </Button>
            <Button
              className={`w-full mt-4 px-4 py-2 text-white rounded-full ${
                confirmInput === "DeleteMyVault"
                  ? "bg-danger-300"
                  : "bg-danger-200 cursor-not-allowed"
              }`}
              isDisabled={confirmInput !== "DeleteMyVault"}
              onPress={() => {
                handleDeleteVault();
                setDeleteModal(false);
              }}
            >
              Yes
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Page;
