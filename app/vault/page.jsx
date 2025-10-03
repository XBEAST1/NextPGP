"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Input,
  Modal,
  addToast,
  ModalContent,
  Spinner,
  InputOtp,
} from "@heroui/react";
import { logout } from "@/actions/auth";
import { openDB } from "@/lib/indexeddb";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { useVault } from "@/context/VaultContext";
import { workerPool } from "@/lib/workerPool";
import NProgress from "nprogress";
import UserDetails from "@/components/userdetails";
import ConnectivityCheck from "@/components/connectivity-check";

const Page = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [deleteSpinner, setDeleteSpinner] = useState(false);
  const [OTPSpinner, setOTPSpinner] = useState(false);
  const [OTPVerifying, setOTPVerifying] = useState(false);
  const [OTP, setOTP] = useState("");
  const [password, setPassword] = useState("");
  const [DeleteModal, setDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unlockVault } = useVault();

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    openDB();
  }, []);

  const handleLogin = async () => {
    if (!password.trim()) {
      addToast({
        title: "Please enter a password",
        color: "danger",
      });
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/vault", { method: "GET" });
      const { verificationCipher } = await res.json();

      if (!verificationCipher) {
        addToast({
          title: "Vault data incomplete",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      const decrypted = await workerPool({
        type: "decrypt",
        responseType: "decryptResponse",
        encryptedBase64: verificationCipher,
        password,
      });

      // Check if the decrypted text starts with "VERIFY:"
      if (!decrypted.startsWith("VERIFY:")) {
        addToast({
          title: "Incorrect password",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      // Vault unlocked successfully
      unlockVault(password);
      await fetch("/api/vault/unlock", { method: "POST" });

      setLoading(false);
      const redirectUrl = searchParams.get("redirect") ?? "/cloud-backup";
      NProgress.start();
      router.push(redirectUrl);
    } catch {
      addToast({
        title: "Incorrect password",
        color: "danger",
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
        addToast({
          title: `Confirmation email sent to ${data.maskedEmail}`,
          color: "success",
        });
        setOTPSpinner(false);
      } else {
        addToast({
          title: data.error || "Failed to send confirmation email",
          color: "danger",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      addToast({
        title: "An error occurred",
        color: "danger",
      });
    }
  };

  const onOtpInputChange = async (value) => {
    setOTP(value);
    if (value.length === 6) {
      setOTPVerifying(true);
      try {
        // Verify the OTP on the server
        const verifyRes = await fetch("/api/vault/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp: value }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          addToast({
            title: verifyData.error || "Invalid OTP",
            color: "danger",
          });
          setOTPVerifying(false);
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
      } catch (error) {
        console.error("Error verifying OTP:", error);
        addToast({
          title: "An error occurred while verifying OTP",
          color: "danger",
        });
        setOTPVerifying(false);
      }
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
    setOTPVerifying(false);
    setDeleteModal(true);
  };

  return (
    <div>
      <ConnectivityCheck />
      <div className="sm:mt-10 sm:me-32 text-center font-serif">
        <h1 className="text-4xl mb-6">Open Vault</h1>
        <span className="text-xl text-gray-400 flex justify-center items-center gap-2">
          <span className="glow-pulse">🔒</span>
          <span className="shine-text">End-to-End Encrypted</span>
        </span>
      </div>
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLogin();
              }
            }}
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
        className={`transition-all duration-50 ease-in-out overflow-hidden ${OTPVerifying ? "sm:max-w-[35vw]" : ""}`}
        backdrop="blur"
        isOpen={DeleteModal}
        onClose={() => {
          setDeleteModal(false);
          setOTP("");
          setConfirmInput("");
          setOTPVerifying(false);
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
                {OTPVerifying && (
                  <Spinner
                    className="mt-4 ms-2 mb-4 sm:mb-0"
                    color="white"
                    size="sm"
                  />
                )}
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
                    setDeleteSpinner(true);
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
