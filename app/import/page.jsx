"use client";

import { useState } from "react";
import { Textarea, Button, Input } from "@heroui/react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";

// Extract only the PGP keys from the content
const extractPGPKeys = (content) => {
  const publicKeyRegex =
    /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----/;
  const privateKeyRegex =
    /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]+?-----END PGP PRIVATE KEY BLOCK-----/;

  const publicKeyMatch = content.match(publicKeyRegex);
  const privateKeyMatch = content.match(privateKeyRegex);

  return {
    publicKey: publicKeyMatch ? publicKeyMatch[0] : null,
    privateKey: privateKeyMatch ? privateKeyMatch[0] : null,
  };
};

export default function ImportKeyPage() {
  const [keyInput, setKeyInput] = useState("");

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
          // Generate a new key if not found
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

  // Encrypts data using the provided encryption key.
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

  // Decrypts data using the provided encryption key and IV.
  const decryptData = async (encryptedData, key, iv) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  };

  const getStoredKeys = async () => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readonly");
      const store = transaction.objectStore(dbPgpKeys);
      const records = [];
      const request = store.openCursor();

      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          records.push(cursor.value);
          cursor.continue();
        } else {
          try {
            const decryptedKeys = await Promise.all(
              records.map(async (record) => {
                const decrypted = await decryptData(
                  record.encrypted,
                  encryptionKey,
                  record.iv
                );
                return decrypted;
              })
            );
            resolve(decryptedKeys);
          } catch (error) {
            reject(error);
          }
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  };

  const saveKeyToIndexedDB = async (keyData) => {
    const encryptionKey = await getEncryptionKey();
    const { encrypted, iv } = await encryptData(keyData, encryptionKey);

    const db = await openDB();
    const transaction = db.transaction(dbPgpKeys, "readwrite");
    const store = transaction.objectStore(dbPgpKeys);

    // Save the encrypted data along with its id.
    store.put({ id: keyData.id, encrypted, iv });
  };

  const checkIfKeyExists = async (newKeyData) => {
    const existingKeys = await getStoredKeys();
    return existingKeys.some(
      (key) =>
        key.publicKey === newKeyData.publicKey &&
        key.privateKey === newKeyData.privateKey
    );
  };

  const importKey = async (keyArmored) => {
    try {
      const { publicKey, privateKey } = extractPGPKeys(keyArmored);

      if (!publicKey && !privateKey) {
        toast.error("No valid PGP key block found.", {
          position: "top-right",
        });
        return;
      }

      const key = await openpgp.readKey({
        armoredKey: privateKey || publicKey,
      });

      const isPrivateKey = privateKey !== null;

      let keyData = {
        id: Date.now(),
        name: "N/A",
        email: "N/A",
        publicKey: publicKey,
        privateKey: privateKey,
      };

      // Extract User IDs
      const userIds = key.users.map((user) => {
        const userId = user.userID;

        const name = userId?.userID.split(" <")[0] || "N/A";
        const email = userId?.email || "N/A";

        return {
          name: name,
          email: email,
        };
      });

      if (userIds.length > 0) {
        keyData.name = userIds[0]?.name;
        keyData.email = userIds[0]?.email;
      }

      if (isPrivateKey) {
        keyData.privateKey = privateKey;

        // Check if the public key is missing, and if so, generate one
        if (!publicKey) {
          const extractedPublicKey = key.toPublic().armor();
          keyData.publicKey = extractedPublicKey;
        }
      } else {
        keyData.publicKey = publicKey;
      }

      if (await checkIfKeyExists(keyData)) {
        toast.error("Key already exists.", {
          position: "top-right",
        });
        return;
      }

      saveKeyToIndexedDB(keyData);

      toast.success(
        isPrivateKey ? "Keyring Imported." : "Public key imported.",
        {
          position: "top-right",
        }
      );
    } catch (error) {
      toast.error(`Failed to import key: ${error.message}`, {
        position: "top-right",
      });
    }
  };

  const handleFileInput = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target.result;
        setKeyInput(fileContent);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    try {
      await importKey(keyInput);
    } catch (error) {
      toast.error(`An error occurred: ${error.message}`, {
        position: "top-right",
      });
    }
  };

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">Import Key</h1>
      <br />
      <p className="ms-1 mb-3 text-small">Upload PGP Key File</p>
      <Input type="file" accept=".asc,.txt,.key" onChange={handleFileInput} />
      <br />
      <Textarea
        disableAutosize
        classNames={{
          input: "resize-y min-h-[180px]",
        }}
        value={keyInput}
        onChange={(e) => setKeyInput(e.target.value)}
        label="Import PGP Key"
        placeholder="Paste your PGP key here"
      />
      <br />
      <Button size="md" onPress={handleImport}>
        Import Key
      </Button>
    </>
  );
}
