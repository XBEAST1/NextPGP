"use client";

import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { Modal, ModalContent, Input, Button, Textarea } from "@heroui/react";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";
import { saveAs } from "file-saver";

export default function App() {
  let message;
  let [inputMessage, setInputMessage] = useState("");
  let [details, setDetails] = useState("");
  const [decryptedMessage, setDecryptedMessage] = useState("");
  const [pgpKeys, setPgpKeys] = useState(null);
  const [password, setPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPrivateKey, setCurrentPrivateKey] = useState(null);
  const [files, setFiles] = useState(null);
  const [isVisible, setIsVisible] = React.useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = () => {};

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

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
                return await decryptData(
                  record.encrypted,
                  encryptionKey,
                  record.iv
                );
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

  useEffect(() => {
    const fetchKeysFromIndexedDB = async () => {
      try {
        const storedKeys = await getStoredKeys();
        setPgpKeys(storedKeys);
      } catch (error) {
        console.error("Error fetching keys:", error);
      }
    };

    fetchKeysFromIndexedDB();
  }, []);

  let decryptedFileData;

  const messageDecrypt = async () => {
    try {
      const header = "-----BEGIN PGP MESSAGE-----";
      const footer = "-----END PGP MESSAGE-----";

      // If the input message doesn't include the header, add it
      if (!inputMessage.includes(header)) {
        inputMessage = `${header}\n\n${inputMessage.trim()}`;
      }

      // If the input message doesn't include the footer, add it
      if (!inputMessage.includes(footer)) {
        inputMessage = `${inputMessage.trim()}\n\n${footer}`;
      }

      message = await openpgp.readMessage({ armoredMessage: inputMessage });
    } catch (error) {
      toast.error("The message is not in a valid PGP format", {
        position: "top-right",
      });
      return;
    }

    try {
      const validPgpKeys = Array.isArray(pgpKeys) ? pgpKeys : [];

      // Check if the message contains s2k in the packet if yes then prompt for password
      const packets = message.packets;
      let isPasswordEncrypted = packets.some((packet) => packet.s2k);

      let successfulDecryption = false;

      // Load public keys for signature verification
      const publicKeys = await Promise.all(
        validPgpKeys
          .filter((key) => key.publicKey)
          .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
      );

      for (const keyData of validPgpKeys) {
        if (!keyData.privateKey) continue;

        try {
          // Read private key
          let privateKey = await openpgp.readPrivateKey({
            armoredKey: keyData.privateKey,
          });

          // Skip if the private key cannot decrypt the message
          const matchingKeys = await message.getEncryptionKeyIDs();
          const privateKeyIDs = [
            privateKey.getKeyID(),
            ...privateKey.getSubkeys().map((subkey) => subkey.getKeyID()),
          ];

          const canDecrypt = matchingKeys.some((keyID) =>
            privateKeyIDs.some((id) => id.equals(keyID))
          );

          // Skip keys that don't match
          if (!canDecrypt) continue;

          // Check if the private key requires a password
          if (!privateKey.isDecrypted()) {
            if (keyData.passphrase) {
              privateKey = await openpgp.decryptKey({
                privateKey,
                passphrase: keyData.passphrase,
              });
            } else {
              // Mark as needing a password but defer the prompt
              setCurrentPrivateKey(keyData.privateKey);
              setIsPasswordModalOpen(true);
              toast.info(
                "The message is encrypted with a password protected key",
                {
                  position: "top-right",
                }
              );
              return;
            }
          }

          // Decrypt the message
          const { data: decrypted, signatures } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey,
            verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
          });

          setDecryptedMessage(decrypted);
          successfulDecryption = true;

          // Extract encryption key IDs for recipient matching
          const encryptionKeyIDs = await message.getEncryptionKeyIDs();

          const recipients = encryptionKeyIDs.map((keyID) => {
            const matchedKey = publicKeys.find((key) => {
              return (
                key.getKeyID().equals(keyID) ||
                key
                  .getSubkeys()
                  .some((subkey) => subkey.getKeyID().equals(keyID))
              );
            });

            if (matchedKey) {
              const userID = matchedKey.getUserIDs()[0];
              return `  - ${userID} (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")})`;
            } else {
              return `  - Unknown (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")})`;
            }
          });

          details += "Recipients:\n" + recipients.join("\n") + "\n\n";

          if (!signatures || signatures.length === 0) {
            // If No signatures found
            details += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
          } else {
            for (const sig of signatures) {
              // Resolve the signature and extract created time
              const { signature } = sig;
              const resolvedSignature = await signature;

              const signaturePacket = resolvedSignature.packets[0];
              const createdTime =
                signaturePacket && signaturePacket.created
                  ? new Date(signaturePacket.created)
                  : null;

              let createdTimeStr;
              if (createdTime) {
                const locale = navigator.language || "en-US";
                const is24Hour = locale.includes("GB") || locale.includes("DE");

                const dayName = createdTime.toLocaleDateString(locale, {
                  weekday: "long",
                });
                const monthName = createdTime.toLocaleDateString(locale, {
                  month: "long",
                });
                const day = createdTime.getDate();
                const year = createdTime.getFullYear();
                const timeWithZone = createdTime.toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: !is24Hour,
                  timeZoneName: "long",
                });

                createdTimeStr = `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
              } else {
                createdTimeStr = "Not Available";
              }

              // Match the public key and format signer info
              const signingKeyID = sig.keyID?.toHex();
              let userID = "Unknown Key";
              let formattedKeyID = signingKeyID
                ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
                : "";

              if (signingKeyID) {
                const matchedKey = publicKeys.find(
                  (key) =>
                    key.getKeyID().toHex() === signingKeyID ||
                    key
                      .getSubkeys()
                      .some((sub) => sub.getKeyID().toHex() === signingKeyID)
                );

                if (matchedKey) {
                  userID = matchedKey.getUserIDs()[0] || "Unnamed Key";
                }
              }

              // Append to details
              details += `Signature by: ${userID}`;
              if (formattedKeyID) details += ` (${formattedKeyID})`;
              details += `\n`;

              details += `Signature created on: ${createdTimeStr}\n\n`;
            }
          }

          setDetails(details);

          toast.success("Message Successfully Decrypted!", {
            position: "top-right",
          });
          return;
        } catch (error) {
          console.log("Key failed to decrypt the message:", error);
          continue;
        }
      }

      if (isPasswordEncrypted && !successfulDecryption) {
        // Open password prompt only if no valid private key could decrypt
        setCurrentPrivateKey(null);
        setIsPasswordModalOpen(true);
        toast.info("The message is password encrypted", {
          position: "top-right",
        });
      } else if (!successfulDecryption) {
        toast.error("No valid private key was able to decrypt this message", {
          position: "top-right",
        });
      }
    } catch (error) {
      toast.error("Decryption failed due to an unexpected error", {
        position: "top-right",
      });
    }
  };

  const messagePasswordDecrypt = async () => {
    try {
      const header = "-----BEGIN PGP MESSAGE-----";
      const footer = "-----END PGP MESSAGE-----";

      // If the input message doesn't include the header, add it
      if (!inputMessage.includes(header)) {
        inputMessage = `${header}\n\n${inputMessage.trim()}`;
      }

      // If the input message doesn't include the footer, add it
      if (!inputMessage.includes(footer)) {
        inputMessage = `${inputMessage.trim()}\n\n${footer}`;
      }

      message = await openpgp.readMessage({ armoredMessage: inputMessage });

      // Attempt to decrypt the message using the password
      try {
        const { data: decrypted, signatures } = await openpgp.decrypt({
          message,
          passwords: [password],
          config: { allowUnauthenticatedMessages: true },
        });

        setDecryptedMessage(decrypted);

        const storedKeys = pgpKeys || [];
        console.log(storedKeys);

        // Load public keys for signature verification
        const publicKeys = await Promise.all(
          storedKeys
            .filter((key) => key.publicKey)
            .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
        );

        // Extract encryption key IDs for recipient matching
        const encryptionKeyIDs = await message.getEncryptionKeyIDs();

        // Match recipients
        const recipients = encryptionKeyIDs.map((keyID) => {
          const matchedKey = publicKeys.find((key) => {
            return (
              key.getKeyID().equals(keyID) ||
              key.getSubkeys().some((subkey) => subkey.getKeyID().equals(keyID))
            );
          });

          if (matchedKey) {
            const userID = matchedKey.getUserIDs()[0];
            return `  - ${userID} (${keyID
              .toHex()
              .match(/.{1,4}/g)
              .join(" ")})`;
          } else {
            return `  - Unknown (${keyID
              .toHex()
              .match(/.{1,4}/g)
              .join(" ")})`;
          }
        });

        details =
          recipients.length > 0
            ? "Recipients:\n" + recipients.join("\n") + "\n\n"
            : "No recipients found\n\n";

        if (signatures && signatures.length > 0) {
          for (const sig of signatures) {
            const { signature } = sig;
            const resolvedSignature = await signature;

            const signaturePacket = resolvedSignature.packets[0];
            const createdTime =
              signaturePacket && signaturePacket.created
                ? new Date(signaturePacket.created)
                : null;

            let createdTimeStr;
            if (createdTime) {
              const locale = navigator.language || "en-US";
              const is24Hour = locale.includes("GB") || locale.includes("DE");

              const dayName = createdTime.toLocaleDateString(locale, {
                weekday: "long",
              });
              const monthName = createdTime.toLocaleDateString(locale, {
                month: "long",
              });
              const day = createdTime.getDate();
              const year = createdTime.getFullYear();
              const timeWithZone = createdTime.toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !is24Hour,
                timeZoneName: "long",
              });

              createdTimeStr = `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
            } else {
              createdTimeStr = "Not Available";
            }

            const signingKeyID = sig.keyID?.toHex();
            let userID = "Unknown Key";
            let formattedKeyID = signingKeyID
              ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
              : "";

            if (signingKeyID) {
              const matchedKey = publicKeys.find(
                (key) =>
                  key.getKeyID().toHex() === signingKeyID ||
                  key
                    .getSubkeys()
                    .some((sub) => sub.getKeyID().toHex() === signingKeyID)
              );

              if (matchedKey) {
                userID = matchedKey.getUserIDs()[0] || "Unnamed Key";
              }
            }

            details += `Signature by: ${userID}`;
            if (formattedKeyID) details += ` (${formattedKeyID})`;
            details += `\n`;

            details += `Signature created on: ${createdTimeStr}\n\n`;
          }
        }

        setDetails(details);

        setIsPasswordModalOpen(false);
        setPassword("");

        toast.success("Message decrypted successfully!", {
          position: "top-right",
        });
        return;
      } catch (error) {
        console.error(
          "Decryption failed or no valid signature:",
          error.message
        );
      }

      // If password decryption fails, fall back to private key decryption
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: currentPrivateKey,
      });

      privateKey = await openpgp.decryptKey({
        privateKey,
        passphrase: password,
      });

      // Load public keys for signature verification
      const publicKeys = await Promise.all(
        pgpKeys
          .filter((key) => key.publicKey)
          .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
      );

      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
      });

      setDecryptedMessage(decrypted);
      setIsPasswordModalOpen(false);
      setPassword("");

      const keyData = pgpKeys.find(
        (key) => key.privateKey === currentPrivateKey
      );

      const encryptionKeyIDs = await message.getEncryptionKeyIDs();

      const recipients = encryptionKeyIDs.map((keyID) => {
        const matchedKey = publicKeys.find((key) => {
          return (
            key.getKeyID().equals(keyID) ||
            key.getSubkeys().some((subkey) => subkey.getKeyID().equals(keyID))
          );
        });

        if (matchedKey) {
          const userID = matchedKey.getUserIDs()[0];
          return `  - ${userID} (${keyID
            .toHex()
            .match(/.{1,4}/g)
            .join(" ")})`;
        } else {
          return `  - Unknown (${keyID
            .toHex()
            .match(/.{1,4}/g)
            .join(" ")})`;
        }
      });

      details += "Recipients:\n" + recipients.join("\n") + "\n\n";

      if (!signatures || signatures.length === 0) {
        // If No signatures found
        details += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
      } else {
        for (const sig of signatures) {
          // Resolve the signature and extract created time
          const { signature } = sig;
          const resolvedSignature = await signature;

          const signaturePacket = resolvedSignature.packets[0];
          const createdTime =
            signaturePacket && signaturePacket.created
              ? new Date(signaturePacket.created)
              : null;

          let createdTimeStr;
          if (createdTime) {
            const locale = navigator.language || "en-US";
            const is24Hour = locale.includes("GB") || locale.includes("DE");

            const dayName = createdTime.toLocaleDateString(locale, {
              weekday: "long",
            });
            const monthName = createdTime.toLocaleDateString(locale, {
              month: "long",
            });
            const day = createdTime.getDate();
            const year = createdTime.getFullYear();
            const timeWithZone = createdTime.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: !is24Hour,
              timeZoneName: "long",
            });

            createdTimeStr = `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
          } else {
            createdTimeStr = "Not Available";
          }

          // Match the public key and format signer info
          const signingKeyID = sig.keyID?.toHex();
          let userID = "Unknown Key";
          let formattedKeyID = signingKeyID
            ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
            : "";

          if (signingKeyID) {
            const matchedKey = publicKeys.find(
              (key) =>
                key.getKeyID().toHex() === signingKeyID ||
                key
                  .getSubkeys()
                  .some((sub) => sub.getKeyID().toHex() === signingKeyID)
            );

            if (matchedKey) {
              userID = matchedKey.getUserIDs()[0] || "Unnamed Key";
            }
          }

          // Append to details
          details += `Signature by: ${userID}`;
          if (formattedKeyID) details += ` (${formattedKeyID})`;
          details += `\n`;

          details += `Signature created on: ${createdTimeStr}\n\n`;
        }
      }

      setDetails(details);

      toast.success("Message Successfully Decrypted!", {
        position: "top-right",
      });
    } catch (error) {
      toast.error("Incorrect password", {
        position: "top-right",
      });
    }
  };

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const DecryptFile = async () => {
    if (!files || files.length === 0) {
      return;
    }

    try {
      const file = files[0];

      const fileData = await file.arrayBuffer();
      message = await openpgp.readMessage({
        binaryMessage: new Uint8Array(fileData),
      });

      const validPgpKeys = Array.isArray(pgpKeys) ? pgpKeys : [];

      // Check if the file contains s2k in the packet if yes then prompt for password
      const packets = message.packets;
      let isPasswordEncrypted = packets.some((packet) => packet.s2k);

      let successfulDecryption = false;

      // Load public keys for signature verification
      const publicKeys = await Promise.all(
        validPgpKeys
          .filter((key) => key.publicKey)
          .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
      );

      for (const keyData of validPgpKeys) {
        if (!keyData.privateKey) continue;

        try {
          let privateKey = await openpgp.readPrivateKey({
            armoredKey: keyData.privateKey,
          });

          // Check if key can decrypt
          const matchingKeys = await message.getEncryptionKeyIDs();
          const privateKeyIDs = [
            privateKey.getKeyID(),
            ...privateKey.getSubkeys().map((subkey) => subkey.getKeyID()),
          ];

          const canDecrypt = matchingKeys.some((keyID) =>
            privateKeyIDs.some((id) => id.equals(keyID))
          );

          if (!canDecrypt) continue;

          // Handle passphrase if needed
          if (!privateKey.isDecrypted()) {
            if (keyData.passphrase) {
              privateKey = await openpgp.decryptKey({
                privateKey,
                passphrase: keyData.passphrase,
              });
            } else {
              setCurrentPrivateKey(keyData.privateKey);
              setIsPasswordModalOpen(true);
              toast.info("Private key requires passphrase", {
                position: "top-right",
              });
              return;
            }
          }

          // Decrypt the file
          const { data: decrypted, signatures } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey,
            verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
            format: "binary",
          });

          successfulDecryption = true;

          // Extract encryption key IDs for recipient matching
          const encryptionKeyIDs = await message.getEncryptionKeyIDs();
          const recipients = encryptionKeyIDs.map((keyID) => {
            const matchedKey = publicKeys.find((key) => {
              return (
                key.getKeyID().equals(keyID) ||
                key
                  .getSubkeys()
                  .some((subkey) => subkey.getKeyID().equals(keyID))
              );
            });

            if (matchedKey) {
              const userID = matchedKey.getUserIDs()[0];
              return `  - ${userID} (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")})`;
            } else {
              return `  - Unknown (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")})`;
            }
          });

          details += "Recipients:\n" + recipients.join("\n") + "\n\n";

          if (!signatures || signatures.length === 0) {
            // If No signatures found
            details += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
          } else {
            for (const sig of signatures) {
              // Resolve the signature and extract created time
              const { signature } = sig;
              const resolvedSignature = await signature;

              const signaturePacket = resolvedSignature.packets[0];
              const createdTime =
                signaturePacket && signaturePacket.created
                  ? new Date(signaturePacket.created)
                  : null;

              let createdTimeStr;
              if (createdTime) {
                const locale = navigator.language || "en-US";
                const is24Hour = locale.includes("GB") || locale.includes("DE");

                const dayName = createdTime.toLocaleDateString(locale, {
                  weekday: "long",
                });
                const monthName = createdTime.toLocaleDateString(locale, {
                  month: "long",
                });
                const day = createdTime.getDate();
                const year = createdTime.getFullYear();
                const timeWithZone = createdTime.toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: !is24Hour,
                  timeZoneName: "long",
                });

                createdTimeStr = `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
              } else {
                createdTimeStr = "Not Available";
              }

              // Match the public key and format signer info
              const signingKeyID = sig.keyID?.toHex();
              let userID = "Unknown Key";
              let formattedKeyID = signingKeyID
                ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
                : "";

              if (signingKeyID) {
                const matchedKey = publicKeys.find(
                  (key) =>
                    key.getKeyID().toHex() === signingKeyID ||
                    key
                      .getSubkeys()
                      .some((sub) => sub.getKeyID().toHex() === signingKeyID)
                );

                if (matchedKey) {
                  userID = matchedKey.getUserIDs()[0] || "Unnamed Key";
                }
              }

              // Append to details
              details += `Signature by: ${userID}`;
              if (formattedKeyID) details += ` (${formattedKeyID})`;
              details += `\n`;

              details += `Signature created on: ${createdTimeStr}\n\n`;
            }
          }

          setDetails(details);
          decryptedFileData = decrypted;

          // Download Decrypted Content
          if (decryptedFileData) {
            const blob = new Blob([decryptedFileData]);
            saveAs(blob, file.name.replace(/\.gpg$/, ""));
          }

          toast.success("File Successfully Decrypted!", {
            position: "top-right",
          });
          return;
        } catch (error) {
          console.log("Key failed to decrypt the file:", error);
          continue;
        }
      }

      if (isPasswordEncrypted && !successfulDecryption) {
        // Open password prompt only if no valid private key could decrypt
        setCurrentPrivateKey(null);
        setIsPasswordModalOpen(true);
        toast.info("The file is password encrypted", {
          position: "top-right",
        });
      } else if (!successfulDecryption) {
        toast.error("No valid private key was able to decrypt this file", {
          position: "top-right",
        });
      }
    } catch (error) {
      toast.error("Decryption failed", {
        position: "top-right",
      });
    }
  };

  const PasswordFileDecrypt = async () => {
    const file = files[0];

    try {
      const fileData = await file.arrayBuffer();
      message = await openpgp.readMessage({
        binaryMessage: new Uint8Array(fileData),
      });

      // Attempt to decrypt the file using the password
      try {
        const { data: decrypted, signatures } = await openpgp.decrypt({
          message,
          passwords: [password],
          config: { allowUnauthenticatedMessages: true },
          format: "binary",
        });

        const storedKeys = pgpKeys || [];

        // Load public keys for signature verification
        const publicKeys = await Promise.all(
          storedKeys
            .filter((key) => key.publicKey)
            .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
        );

        // Extract encryption key IDs for recipient matching
        const encryptionKeyIDs = await message.getEncryptionKeyIDs();

        // Match recipients
        const recipients = encryptionKeyIDs.map((keyID) => {
          const matchedKey = publicKeys.find((key) => {
            return (
              key.getKeyID().equals(keyID) ||
              key.getSubkeys().some((subkey) => subkey.getKeyID().equals(keyID))
            );
          });

          if (matchedKey) {
            const userID = matchedKey.getUserIDs()[0];
            return `  - ${userID} (${keyID
              .toHex()
              .match(/.{1,4}/g)
              .join(" ")})`;
          } else {
            return `  - Unknown (${keyID
              .toHex()
              .match(/.{1,4}/g)
              .join(" ")})`;
          }
        });

        details =
          recipients.length > 0
            ? "Recipients:\n" + recipients.join("\n") + "\n\n"
            : "No recipients found\n\n";

        if (signatures && signatures.length > 0) {
          for (const sig of signatures) {
            const { signature } = sig;
            const resolvedSignature = await signature;

            const signaturePacket = resolvedSignature.packets[0];
            const createdTime =
              signaturePacket && signaturePacket.created
                ? new Date(signaturePacket.created)
                : null;

            let createdTimeStr;
            if (createdTime) {
              const locale = navigator.language || "en-US";
              const is24Hour = locale.includes("GB") || locale.includes("DE");

              const dayName = createdTime.toLocaleDateString(locale, {
                weekday: "long",
              });
              const monthName = createdTime.toLocaleDateString(locale, {
                month: "long",
              });
              const day = createdTime.getDate();
              const year = createdTime.getFullYear();
              const timeWithZone = createdTime.toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !is24Hour,
                timeZoneName: "long",
              });

              createdTimeStr = `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
            } else {
              createdTimeStr = "Not Available";
            }

            const signingKeyID = sig.keyID?.toHex();
            let userID = "Unknown Key";
            let formattedKeyID = signingKeyID
              ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
              : "";

            if (signingKeyID) {
              const matchedKey = publicKeys.find(
                (key) =>
                  key.getKeyID().toHex() === signingKeyID ||
                  key
                    .getSubkeys()
                    .some((sub) => sub.getKeyID().toHex() === signingKeyID)
              );

              if (matchedKey) {
                userID = matchedKey.getUserIDs()[0] || "Unnamed Key";
              }
            }

            details += `Signature by: ${userID}`;
            if (formattedKeyID) details += ` (${formattedKeyID})`;
            details += `\n`;

            details += `Signature created on: ${createdTimeStr}\n\n`;
          }
        }

        setDetails(details);
        decryptedFileData = decrypted;

        // Download Decrypted Content
        if (decryptedFileData) {
          const blob = new Blob([decryptedFileData]);
          saveAs(blob, file.name.replace(/\.gpg$/, ""));
        }

        setIsPasswordModalOpen(false);
        setPassword("");

        toast.success("File decrypted successfully!", {
          position: "top-right",
        });
        return;
      } catch (error) {
        console.error(
          "Decryption failed or no valid signature:",
          error.message
        );
      }

      // If password decryption fails, fall back to private key decryption
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: currentPrivateKey,
      });

      privateKey = await openpgp.decryptKey({
        privateKey,
        passphrase: password,
      });

      // Load public keys for signature verification
      const publicKeys = await Promise.all(
        pgpKeys
          .filter((key) => key.publicKey)
          .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
      );

      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
        format: "binary",
      });

      setIsPasswordModalOpen(false);
      setPassword("");

      const keyData = pgpKeys.find(
        (key) => key.privateKey === currentPrivateKey
      );

      const encryptionKeyIDs = await message.getEncryptionKeyIDs();

      const recipients = encryptionKeyIDs.map((keyID) => {
        const matchedKey = publicKeys.find((key) => {
          return (
            key.getKeyID().equals(keyID) ||
            key.getSubkeys().some((subkey) => subkey.getKeyID().equals(keyID))
          );
        });

        if (matchedKey) {
          const userID = matchedKey.getUserIDs()[0];
          return `  - ${userID} (${keyID
            .toHex()
            .match(/.{1,4}/g)
            .join(" ")})`;
        } else {
          return `  - Unknown (${keyID
            .toHex()
            .match(/.{1,4}/g)
            .join(" ")})`;
        }
      });

      details += "Recipients:\n" + recipients.join("\n") + "\n\n";

      if (!signatures || signatures.length === 0) {
        // If No signatures found
        details += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
      } else {
        for (const sig of signatures) {
          // Resolve the signature and extract created time
          const { signature } = sig;
          const resolvedSignature = await signature;

          const signaturePacket = resolvedSignature.packets[0];
          const createdTime =
            signaturePacket && signaturePacket.created
              ? new Date(signaturePacket.created)
              : null;

          let createdTimeStr;
          if (createdTime) {
            const locale = navigator.language || "en-US";
            const is24Hour = locale.includes("GB") || locale.includes("DE");

            const dayName = createdTime.toLocaleDateString(locale, {
              weekday: "long",
            });
            const monthName = createdTime.toLocaleDateString(locale, {
              month: "long",
            });
            const day = createdTime.getDate();
            const year = createdTime.getFullYear();
            const timeWithZone = createdTime.toLocaleTimeString(locale, {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: !is24Hour,
              timeZoneName: "long",
            });

            createdTimeStr = `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
          } else {
            createdTimeStr = "Not Available";
          }

          // Match the public key and format signer info
          const signingKeyID = sig.keyID?.toHex();
          let userID = "Unknown Key";
          let formattedKeyID = signingKeyID
            ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
            : "";

          if (signingKeyID) {
            const matchedKey = publicKeys.find(
              (key) =>
                key.getKeyID().toHex() === signingKeyID ||
                key
                  .getSubkeys()
                  .some((sub) => sub.getKeyID().toHex() === signingKeyID)
            );

            if (matchedKey) {
              userID = matchedKey.getUserIDs()[0] || "Unnamed Key";
            }
          }

          // Append to details
          details += `Signature by: ${userID}`;
          if (formattedKeyID) details += ` (${formattedKeyID})`;
          details += `\n`;

          details += `Signature created on: ${createdTimeStr}\n\n`;
        }
      }

      setDetails(details);
      decryptedFileData = decrypted;

      // Download Decrypted Content
      if (decryptedFileData) {
        const blob = new Blob([decryptedFileData]);
        saveAs(blob, file.name.replace(/\.gpg$/, ""));
      }

      toast.success("File Successfully Decrypted!", { position: "top-right" });
    } catch (error) {
      toast.error("Incorrect password", {
        position: "top-right",
      });
    }
  };

  const handleDecrypt = async () => {
    if (inputMessage) {
      await messageDecrypt();
    }

    if (files) {
      await DecryptFile();
    }

    if (!inputMessage && !files) {
      toast.error("Please enter a PGP message or Select a File", {
        position: "top-right",
      });
      return;
    }
  };

  const handlePasswordDecrypt = async () => {
    if (!password) {
      toast.error("Please enter a password", {
        position: "top-right",
      });
      return;
    }

    if (inputMessage) {
      await messagePasswordDecrypt();
    }

    if (files) {
      await PasswordFileDecrypt();
    }
  };

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">
        Decrypt
      </h1>
      <br />
      <br />
      <Textarea
        disableAutosize
        classNames={{
          input: "resize-y min-h-[130px]",
        }}
        label="Decrypt"
        placeholder="Enter your pgp message"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
      />
      <br />
      <Input type="file" onChange={handleFileUpload} />
      <br />
      <Textarea
        disableAutosize
        isReadOnly
        classNames={{
          input: "resize-y min-h-[100px]",
        }}
        label="Details"
        value={details}
      />
      <br />
      <Textarea
        isReadOnly
        disableAutosize
        classNames={{
          input: "resize-y min-h-[170px]",
        }}
        label="Output"
        value={decryptedMessage}
      />
      <br />
      <Button onPress={handleDecrypt}>Decrypt</Button>
      {isPasswordModalOpen && (
        <Modal
          backdrop="blur"
          isOpen={isPasswordModalOpen}
          onClose={() => setIsPasswordModalOpen(false)}
        >
          <ModalContent className="p-5">
            <h3 className="mb-4">Password Required</h3>
            <Input
              placeholder="Enter Password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordDecrypt()}
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
            <Button
              className="mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={handlePasswordDecrypt}
            >
              Submit
            </Button>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
