"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  ModalContent,
  Spinner,
  InputOtp,
} from "@heroui/react";
import { logout } from "@/actions/auth";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { toast, ToastContainer } from "react-toastify";
import { useRouter, useSearchParams } from "next/navigation";
import NProgress from "nprogress";
import UserDetails from "@/components/userdetails";
import "react-toastify/dist/ReactToastify.css";
import { openDB, getEncryptionKey } from "@/lib/indexeddb";

// Encrypts the vault password using the provided master key.
const storeVaultPassword = async (password, masterKey) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPassword = new TextEncoder().encode(password);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    encodedPassword
  );
  const encryptedVaultPassword = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encryptedBuffer)),
  };
  sessionStorage.setItem(
    "encryptedVaultPassword",
    JSON.stringify(encryptedVaultPassword)
  );
};

const Page = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [deleteSpinner, setDeleteSpinner] = useState(false);
  const [OTPSpinner, setOTPSpinner] = useState(false);
  const [OTP, setOTP] = useState("");
  const [password, setPassword] = useState("");
  const [DeleteModal, setDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    openDB();
  }, []);

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

    setLoading(true);

    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const masterKey = await getEncryptionKey();
      await storeVaultPassword(password, masterKey);

      // Unlock the vault
      await fetch("/api/vault/unlock", {
        method: "POST",
      });

      setLoading(false);
      const redirectUrl = searchParams.get("redirect") ?? "/cloud-backup";
      NProgress.start();
      router.push(redirectUrl);
    } else {
      toast.error("Incorrect password", {
        position: "top-right",
      });
      setLoading(false);
    }
  };

  const sendOtpEmail = async () => {
    try {
      const emailRes = await fetch("/api/vault/delete-otp", {
        method: "POST",
      });
      const data = await emailRes.json();
      if (emailRes.ok) {
        toast.success("Confirmation email sent");
        setOTPSpinner(false);
      } else {
        toast.error(data.error || "Failed to send confirmation email");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("An error occurred");
    }
  };

  const onOtpInputChange = async (value) => {
    setOTP(value);
    if (value.length === 6) {
      // Verify the OTP on the server
      const verifyRes = await fetch("/api/vault/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: value }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        toast.error(verifyData.error || "Invalid OTP");
        return;
      }
      // If verified, delete the vault
      const res = await fetch("/api/vault", { method: "DELETE" });
      if (res.ok) {
        NProgress.start();
        router.push("/create-vault");
      } else {
        console.log("Error deleting vault");
      }
      setDeleteModal(false);
    }
  };

  const triggerOtpVerification = async () => {
    if (!otpStep) {
      await sendOtpEmail();
      setOtpStep(true);
    }
  };

  const triggerDeleteModal = () => {
    setConfirmInput("");
    setOTP("");
    setDeleteModal(true);
  };

  return (
    <div>
      <ToastContainer theme="dark" />
      <h1 className="sm:mt-10 sm:me-32 text-4xl text-center dm-serif-text-regular">
        Open Vault
      </h1>
      <div className="flex flex-col sm:flex-row sm:justify-between items-center sm:items-start mt-6">
        <div className="flex flex-col items-center sm:hidden mt-6 order-1">
          <UserDetails />
        </div>
        <div className="flex flex-col sm:flex-row items-center sm:mt-20 order-2 w-full sm:w-full">
          <Input
            className="mt-8 sm:mt-0 sm:me-10 w-full sm:w-full"
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
        </div>
        <div className="hidden sm:block order-3">
          <UserDetails />
        </div>
      </div>
      <div className="sm:me-32 sm:mb-0 mb-8 flex justify-center mt-8">
        <Button
          className="w-1/2 sm:w-1/5"
          onPress={handleLogin}
          isDisabled={loading}
        >
          {loading ? <Spinner color="white" size="sm" /> : "Enter"}
        </Button>
      </div>
      <br />
      <div className="flex justify-between items-center">
        <Button variant="flat" onPress={triggerDeleteModal} color="danger">
          Delete Vault
        </Button>
        <Button className="sm:me-5 me-2" onPress={() => logout("google")}>
          Sign Out
        </Button>
      </div>
      <Modal
        backdrop="blur"
        isOpen={DeleteModal}
        onClose={() => {
          setDeleteModal(false);
          setOTP("");
          setConfirmInput("");
        }}
      >
        <ModalContent className="p-5">
          {otpStep ? (
            <>
              <h3 className="mb-2">Enter OTP</h3>
              <p className="text-sm mb-3 text-gray-500">
                Enter the 6-digit OTP sent to your email.
              </p>
              <div className="sm:ms-3 sm:flex sm:flex-row sm:items-start sm:gap-2 flex flex-col items-center">
                <InputOtp
                  length={6}
                  value={OTP}
                  onValueChange={onOtpInputChange}
                />
                <Button
                  className="mt-2 ms-2 sm:min-w-28 min-w-32"
                  onPress={() => {
                    setOTPSpinner(true);
                    sendOtpEmail();
                  }}
                >
                  {OTPSpinner ? (
                    <Spinner color="white" size="sm" />
                  ) : (
                    "Resend OTP"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-2">
                Are You Sure You Want To Delete Your Vault?
              </h3>
              <p className="text-sm mb-3 text-gray-500">
                Please type <strong>DeleteMyVault</strong> to confirm.
              </p>
              <Input
                type="text"
                placeholder="Enter DeleteMyVault"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && confirmInput === "DeleteMyVault") {
                    triggerOtpVerification();
                  }
                }}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
              />
              <div className="flex gap-2 mt-4">
                <Button
                  className="w-full px-4 py-2 bg-default-300 text-white rounded-full"
                  onPress={() => {
                    setDeleteModal(false);
                    setOTP("");
                    setConfirmInput("");
                  }}
                >
                  No
                </Button>
                <Button
                  className={`w-full px-4 py-2 text-white rounded-full ${
                    confirmInput === "DeleteMyVault"
                      ? "bg-danger-300"
                      : "bg-danger-200 cursor-not-allowed"
                  }`}
                  isDisabled={confirmInput !== "DeleteMyVault" || deleteSpinner}
                  onPress={() => {
                    setDeleteSpinner(true);
                    triggerOtpVerification();
                  }}
                >
                  {deleteSpinner ? <Spinner color="white" size="sm" /> : "Yes"}
                </Button>
              </div>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Page;
