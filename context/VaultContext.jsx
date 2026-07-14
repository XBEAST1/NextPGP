"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { getEncryptionKey } from "@/lib/indexeddb";
import { workerPool } from "@/lib/workerPool";

const VaultContext = createContext();

export const VaultProvider = ({ children }) => {
  const [encryptedVaultPassword, setEncryptedVaultPassword] = useState(null);
  const [encryptedVaultKeyData, setEncryptedVaultKeyData] = useState(null);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  // Encrypt the vault password & master key material and store them in memory
  const unlockVault = async (password, verificationCipher = null) => {
    try {
      const masterKey = await getEncryptionKey();

      // Encrypt raw password for memory storage
      const pwdIv = crypto.getRandomValues(new Uint8Array(12));
      const encodedPassword = new TextEncoder().encode(password);
      const encryptedPwdBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: pwdIv },
        masterKey,
        encodedPassword
      );
      setEncryptedVaultPassword({
        iv: Array.from(pwdIv),
        data: Array.from(new Uint8Array(encryptedPwdBuffer)),
      });

      // If verificationCipher is provided, extract salt and derive master key material once
      if (verificationCipher) {
        try {
          const salt = await workerPool({
            type: "extractSalt",
            responseType: "extractSaltResponse",
            encryptedBase64: verificationCipher,
          });

          const derived = await workerPool({
            type: "deriveMasterKey",
            responseType: "deriveMasterKeyResponse",
            password,
            salt,
          });

          const keyPayload = JSON.stringify({
            keyMaterial: derived.keyMaterial,
            vaultSalt: derived.salt,
          });

          const keyIv = crypto.getRandomValues(new Uint8Array(12));
          const encryptedKeyBuffer = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: keyIv },
            masterKey,
            new TextEncoder().encode(keyPayload)
          );

          setEncryptedVaultKeyData({
            iv: Array.from(keyIv),
            data: Array.from(new Uint8Array(encryptedKeyBuffer)),
          });
        } catch (deriveErr) {
          console.warn("Could not pre-derive vault key material:", deriveErr);
        }
      }

      setIsVaultUnlocked(true);
    } catch (error) {
      console.error("Error unlocking vault session:", error);
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

  // Decrypt and return the 512-bit master key material and vault salt for fast crypto
  const getVaultKeyMaterial = async () => {
    const password = await getVaultPassword();
    if (!encryptedVaultKeyData) {
      return { password, keyMaterial: null, vaultSalt: null };
    }
    try {
      const masterKey = await getEncryptionKey();
      const { iv, data } = encryptedVaultKeyData;
      const ivArray = new Uint8Array(iv);
      const encryptedArray = new Uint8Array(data);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivArray },
        masterKey,
        encryptedArray
      );
      const parsed = JSON.parse(new TextDecoder().decode(decryptedBuffer));
      return {
        password,
        keyMaterial: new Uint8Array(parsed.keyMaterial),
        vaultSalt: new Uint8Array(parsed.vaultSalt),
      };
    } catch (error) {
      console.error("Error decrypting vault key material:", error);
      return { password, keyMaterial: null, vaultSalt: null };
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
    setEncryptedVaultKeyData(null);
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
        encryptedVaultKeyData,
        isVaultUnlocked,
        unlockVault,
        lockVault,
        getVaultPassword,
        getVaultKeyMaterial,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => useContext(VaultContext);
