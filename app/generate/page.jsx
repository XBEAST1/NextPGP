"use client";

import React from "react";
import { useState } from "react";
import { Button, DatePicker, Input, Checkbox } from "@heroui/react";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";

export default function App() {
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [isPasswordChecked, setIsPasswordChecked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);

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
          // Generate Key if not found
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

  // Encrypt Data before storing in IndexedDB
  const encryptData = async (data, key) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoded
    );
    return { encrypted: new Uint8Array(encrypted), iv };
  };

  // Save Encrypted PGP Key to IndexedDB
  const saveKeyToIndexedDB = async (id, keyData) => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();
    const { encrypted, iv } = await encryptData(keyData, encryptionKey);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readwrite");
      const store = transaction.objectStore(dbPgpKeys);
      store.put({ id, encrypted, iv });

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
  };

  const generatePGPKey = async () => {
    setNameInvalid(false);
    setEmailInvalid(false);

    if (!name.trim()) {
      setNameInvalid(true);
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailInvalid(true);
      return;
    }

    const validEmail = email.trim() ? email : "";

    if (!name.trim()) {
      return;
    }

    try {
      const passphraseToUse =
        isPasswordChecked && passphrase ? passphrase : undefined;

      let keyExpirationTime = undefined;
      if (!isNoExpiryChecked && expiryDate) {
        const now = new Date();
        const expiry = new Date(expiryDate);
        keyExpirationTime = Math.floor((expiry - now) / 1000);
        if (keyExpirationTime <= 0) {
          toast.error("The expiry date must be in the future", {
            position: "top-right",
          });
          return;
        }
      }

      const options = {
        type: "ecc",
        curve: "ed25519",
        userIDs: [{ name, email: validEmail }],
        passphrase: passphraseToUse,
        format: "armored",
        keyExpirationTime: keyExpirationTime,
      };

      const key = await openpgp.generateKey(options);
      const { privateKey, publicKey } = key;

      const keyData = {
        id: Date.now(),
        name,
        email: validEmail || "N/A",
        publicKey,
        privateKey,
      };

      // Save the encrypted key data
      await saveKeyToIndexedDB(keyData.id, keyData);

      toast.success("PGP Keyring Generated", {
        position: "top-right",
      });
    } catch (error) {
      toast.error("Failed to generate PGP Keyring", {
        position: "top-right",
      });
      console.log(error);
    }
  };

  const [isVisible, setIsVisible] = React.useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">
        Generate Keyring
      </h1>

      <br />

      <Input
        isRequired
        label="Name"
        labelPlacement="outside"
        placeholder="Enter your name"
        isInvalid={nameInvalid}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br />

      <Input
        label="Email"
        labelPlacement="outside"
        placeholder="Enter your email"
        isInvalid={emailInvalid}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />

      <Checkbox
        defaultSelected={isNoExpiryChecked}
        color="default"
        onChange={(e) => setIsNoExpiryChecked(e.target.checked)}
      >
        No Expiry
      </Checkbox>
      <br />
      <br />

      <DatePicker
        isDisabled={isNoExpiryChecked}
        className="max-w-[284px]"
        label="Expiry date"
        value={expiryDate}
        onChange={(date) => setExpiryDate(date)}
      />
      <br />

      <Checkbox
        defaultSelected={isPasswordChecked}
        color="default"
        onChange={(e) => {
          setIsPasswordChecked(e.target.checked);
          if (!e.target.checked) setPassphrase("");
        }}
      >
        Use Password
      </Checkbox>
      <br />
      <br />

      <Input
        isDisabled={!isPasswordChecked}
        name="password"
        placeholder="Enter your password"
        type={isVisible ? "text" : "password"}
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
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />

      <br />
      <Button size="md" onPress={generatePGPKey}>
        Generate Key
      </Button>
    </>
  );
}
