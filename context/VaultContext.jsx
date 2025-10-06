"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getEncryptionKey } from "@/lib/indexeddb";

const VaultContext = createContext();

export const VaultProvider = ({ children }) => {
  const [encryptedVaultPassword, setEncryptedVaultPassword] = useState(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  // Encrypt the vault password and store it in memory
  const unlockVault = async (password) => {
    try {
      const masterKey = await getEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encodedPassword = new TextEncoder().encode(password);
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        masterKey,
        encodedPassword
      );
      const encryptedData = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encryptedBuffer)),
      };
      setEncryptedVaultPassword(encryptedData);
      setIsVaultUnlocked(true);
    } catch (error) {
      console.error("Error encrypting vault password:", error);
    }
  };

  // Decrypt and return the vault password
  const getVaultPassword = async () => {
    if (!encryptedVaultPassword) return null;
    try {
      const masterKey = await getEncryptionKey();
      const { iv, data } = encryptedVaultPassword;
      const ivArray = new Uint8Array(iv);
      const encryptedArray = new Uint8Array(data);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivArray },
        masterKey,
        encryptedArray
      );
      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error("Error decrypting vault password:", error);
      return null;
    }
  };

  // Clear vault data from memory and lock the vault
  const lockVault = async () => {
    if (window.vaultLockInProgress) {
      return;
    }

    window.vaultLockInProgress = true;

    try {
      const res = await fetch("/api/csrf", { method: "GET" });
      const { csrfToken } = await res.json();

      await fetch("/api/vault/lock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csrfToken }),
      });
    } catch (error) {
      console.error("Error locking vault on server:", error);
    } finally {
      window.vaultLockInProgress = false;
    }

    setEncryptedVaultPassword(null);
    setIsVaultUnlocked(false);
  };

  // Automatically lock the vault when the tab is closed
  useEffect(() => {
    const key = "vault_session_started";
    const hasStarted = sessionStorage.getItem(key);

    if (!hasStarted) {
      sessionStorage.setItem(key, "1");
      lockVault();
    }
  }, []);

  return (
    <VaultContext.Provider
      value={{
        encryptedVaultPassword,
        isVaultUnlocked,
        unlockVault,
        lockVault,
        getVaultPassword,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => useContext(VaultContext);
