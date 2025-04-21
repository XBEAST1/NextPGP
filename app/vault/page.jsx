"use client";

import { useState } from "react";
import { Button, Input, Modal, ModalContent, Spinner } from "@heroui/react";
import { logout } from "@/actions/auth";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { toast, ToastContainer } from "react-toastify";
import { useRouter, useSearchParams } from "next/navigation";
import UserDetails from "@/components/userdetails";
import "react-toastify/dist/ReactToastify.css";

const dbName = "NextPGP";
const dbPgpKeys = "pgpKeys";
const selectedSigners = "selectedSigners";
const selectedRecipients = "selectedRecipients";
const dbCryptoKeys = "cryptoKeys";

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains(dbPgpKeys)) {
        db.createObjectStore(dbPgpKeys, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(selectedSigners)) {
        db.createObjectStore(selectedSigners, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(selectedRecipients)) {
        db.createObjectStore(selectedRecipients, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(dbCryptoKeys)) {
        db.createObjectStore(dbCryptoKeys, { keyPath: "id" });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Retrieves (or generates) the master encryption key using the Web Crypto API.
const getEncryptionKey = async () => {
  const db = await openDB();
  const tx = db.transaction(dbCryptoKeys, "readonly");
  const store = tx.objectStore(dbCryptoKeys);
  const request = store.get("mainKey");

  return new Promise(async (resolve, reject) => {
    request.onsuccess = async () => {
      if (request.result) {
        const importedKey = await crypto.subtle.importKey(
          "raw",
          request.result.key,
          { name: "AES-GCM" },
          true,
          ["encrypt", "decrypt"]
        );
        resolve(importedKey);
      } else {
        // Generate key if not found
        const key = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const exportedKey = await crypto.subtle.exportKey("raw", key);
        const txWrite = db.transaction(dbCryptoKeys, "readwrite");
        const storeWrite = txWrite.objectStore(dbCryptoKeys);
        storeWrite.put({ id: "mainKey", key: new Uint8Array(exportedKey) });
        resolve(key);
      }
    };
    request.onerror = (e) => reject(e.target.error);
  });
};

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
  const [password, setPassword] = useState("");
  const [DeleteModal, setDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [isLocked, setIsLocked] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleVisibility = () => setIsVisible(!isVisible);

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
      setIsLocked(false);
      const redirectUrl = searchParams.get("redirect") ?? "/cloud-backup";
      router.push(redirectUrl);
    } else {
      toast.error("Incorrect password", {
        position: "top-right",
      });
      setLoading(false);
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
        onClose={() => setDeleteModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">Are You Sure You Want To Delete Your Vault?</h3>
          <p className="text-sm mb-3 text-gray-500">
            Please type <strong>DeleteMyVault</strong> to confirm.
          </p>
          <Input
            type="text"
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
