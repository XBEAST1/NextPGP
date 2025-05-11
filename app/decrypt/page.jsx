"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { Modal, ModalContent, Input, Button, Textarea } from "@heroui/react";
import "react-toastify/dist/ReactToastify.css";
import { openDB, getStoredKeys } from "@/lib/indexeddb";
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

  useEffect(() => {
    openDB();

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
    let functionDetails = "";

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

          functionDetails += "Recipients:\n" + recipients.join("\n") + "\n\n";

          if (signatures && signatures.length > 0) {
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

              functionDetails += `Message successfully decrypted using key: ${
                keyData.name || "Unnamed Key"
              }\n`;

              functionDetails += `Signature by: ${userID}`;
              if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
              functionDetails += `\n`;

              functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
            }
          } else {
            functionDetails += `Message successfully decrypted using key: ${
              keyData.name || "Unnamed Key"
            }\n`;
            functionDetails += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
          }

          setDetails((prev) => prev + functionDetails);

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
        toast.error("No valid private key available to decrypt the message", {
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
    let functionDetails = "";

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

        functionDetails =
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

            functionDetails += `Message successfully decrypted using Password\n`;

            functionDetails += `Signature by: ${userID}`;
            if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
            functionDetails += `\n`;

            functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
          }
        } else {
          functionDetails += `Message successfully decrypted using Password\n`;
          functionDetails += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
        }

        setDetails((prev) => prev + functionDetails);

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

      functionDetails += "Recipients:\n" + recipients.join("\n") + "\n\n";

      if (signatures && signatures.length > 0) {
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

          functionDetails += `Message successfully decrypted using key: ${
            keyData.name || "Unnamed Key"
          }\n`;

          functionDetails += `Signature by: ${userID}`;
          if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
          functionDetails += `\n`;

          functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
        }
      } else {
        functionDetails += `Message successfully decrypted using key: ${
          keyData.name || "Unnamed Key"
        }\n`;
        functionDetails += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
      }

      setDetails((prev) => prev + functionDetails);

      toast.success("Message Successfully Decrypted!", {
        position: "top-right",
      });
    } catch (error) {
      toast.error("Incorrect password", {
        position: "top-right",
      });
    }
  };

  const fileDecrypt = async () => {
    if (!files || files.length === 0) {
      return;
    }

    for (const file of files) {
      let functionDetails = "";

      try {
        const fileData = await file.arrayBuffer();
        const message = await openpgp.readMessage({
          binaryMessage: new Uint8Array(fileData),
        });

        const validPgpKeys = Array.isArray(pgpKeys) ? pgpKeys : [];
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
            const matchingKeys = await message.getEncryptionKeyIDs();
            const privateKeyIDs = [
              privateKey.getKeyID(),
              ...privateKey.getSubkeys().map((subkey) => subkey.getKeyID()),
            ];

            const canDecrypt = matchingKeys.some((keyID) =>
              privateKeyIDs.some((id) => id.equals(keyID))
            );
            if (!canDecrypt) continue;

            if (!privateKey.isDecrypted()) {
              if (keyData.passphrase) {
                privateKey = await openpgp.decryptKey({
                  privateKey,
                  passphrase: keyData.passphrase,
                });
              } else {
                setCurrentPrivateKey(keyData.privateKey);
                setIsPasswordModalOpen(true);
                toast.info(
                  files && files.length > 1
                    ? "The files are encrypted with a password protected key"
                    : "The file is encrypted with a password protected key",
                  {
                    position: "top-right",
                  }
                );
                return;
              }
            }

            const { data: decrypted, signatures } = await openpgp.decrypt({
              message,
              decryptionKeys: privateKey,
              verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
              format: "binary",
            });

            successfulDecryption = true;

            // Extract recipients information
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
            functionDetails += "Recipients:\n" + recipients.join("\n") + "\n\n";

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
                  const is24Hour =
                    locale.includes("GB") || locale.includes("DE");

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

                functionDetails += `File successfully decrypted using key: ${
                  keyData.name || "Unnamed Key"
                }\n`;

                functionDetails += `Signature by: ${userID}`;
                if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
                functionDetails += `\n`;
                functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
              }
            } else {
              functionDetails += `File successfully decrypted using key: ${
                keyData.name || "Unnamed Key"
              }\n`;
              functionDetails += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
            }

            setDetails((prev) => prev + functionDetails);

            // Download decrypted file
            if (decrypted) {
              const blob = new Blob([decrypted]);
              saveAs(blob, file.name.replace(/\.gpg$/, ""));
            }

            toast.success(`File ${file.name} successfully decrypted!`, {
              position: "top-right",
            });
            break; // Stop after a successful decryption for this file.
          } catch (error) {
            console.log("Key failed to decrypt the file:", error);
            continue;
          }
        }

        if (isPasswordEncrypted && !successfulDecryption) {
          setCurrentPrivateKey(null);
          setIsPasswordModalOpen(true);
          toast.info(
            files && files.length > 1
              ? "The files are password encrypted"
              : "The file is password encrypted",
            {
              position: "top-right",
            }
          );
          return;
        } else if (!successfulDecryption) {
          toast.error(
            "No valid private key available to decrypt the file " + file.name,
            {
              position: "top-right",
            }
          );
        }
      } catch (error) {
        toast.error("Incorrect Password for file " + file.name, {
          position: "top-right",
        });
      }
    }
  };

  const filePasswordDecrypt = async () => {
    if (!files || files.length === 0) {
      return;
    }

    for (const file of files) {
      let functionDetails = "";

      try {
        const fileData = await file.arrayBuffer();
        const message = await openpgp.readMessage({
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

          functionDetails =
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

              functionDetails += `File successfully decrypted using Password\n`;

              functionDetails += `Signature by: ${userID}`;
              if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
              functionDetails += `\n`;
              functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
            }
          } else {
            functionDetails += `File successfully decrypted using Password\n`;
            functionDetails += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
          }

          setDetails((prev) => prev + functionDetails);
          decryptedFileData = decrypted;

          // Download decrypted file
          if (decryptedFileData) {
            const blob = new Blob([decryptedFileData]);
            saveAs(blob, file.name.replace(/\.gpg$/, ""));
          }

          setIsPasswordModalOpen(false);
          setPassword("");

          toast.success(`File ${file.name} decrypted successfully!`, {
            position: "top-right",
          });
          // Continue with next file
          continue;
        } catch (error) {
          console.error(
            "Password decryption failed or no valid signature:",
            error.message
          );
        }

        // Fall back to private key decryption if password decryption fails
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

        functionDetails += "Recipients:\n" + recipients.join("\n") + "\n\n";

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

            functionDetails += `File successfully decrypted using key: ${
              keyData.name || "Unnamed Key"
            }\n`;

            functionDetails += `Signature by: ${userID}`;
            if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
            functionDetails += `\n`;
            functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
          }
        } else {
          functionDetails += `File successfully decrypted using key: ${
            keyData.name || "Unnamed Key"
          }\n`;
          functionDetails += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
        }

        setDetails((prev) => prev + functionDetails);
        decryptedFileData = decrypted;

        if (decryptedFileData) {
          const blob = new Blob([decryptedFileData]);
          saveAs(blob, file.name.replace(/\.gpg$/, ""));
        }

        toast.success(`File ${file.name} decrypted successfully!`, {
          position: "top-right",
        });
      } catch (error) {
        toast.error("Incorrect Password for file " + file.name, {
          position: "top-right",
        });
      }
    }
  };

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleDecrypt = async () => {
    setDetails("");
    setDecryptedMessage("");

    if (inputMessage) {
      await messageDecrypt();
    }

    if (files) {
      await fileDecrypt();
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
      await filePasswordDecrypt();
    }
  };

  // Details Text Areas Auto Expand Height

  const decryptedDetails = details.trimEnd();
  const detailsRef = useRef(null);

  useEffect(() => {
    const ta = detailsRef.current;
    if (!ta) return;

    if (!ta.style.height) {
      ta.style.height = `${ta.scrollHeight}px`;
    }

    requestAnimationFrame(() => {
      ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [decryptedDetails]);

  // Decrypted Message Text Areas Auto Expand Height

  const outputMessage = decryptedMessage.trimEnd();
  const outputRef = useRef(null);

  useEffect(() => {
    const ta = outputRef.current;
    if (!ta) return;

    if (!ta.style.height) {
      ta.style.height = `${ta.scrollHeight}px`;
    }

    requestAnimationFrame(() => {
      ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [outputMessage]);

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">Decrypt</h1>
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
      <Input type="file" multiple onChange={handleFileUpload} />
      <br />
      <Textarea
        ref={detailsRef}
        isReadOnly
        label="Details"
        value={decryptedDetails}
        classNames={{
          input: "overflow-hidden resize-none",
        }}
        style={{ transition: "height 0.2s ease-out" }}
      />
      <br />
      <Textarea
        ref={outputRef}
        isReadOnly
        disableAutosize
        label="Output"
        value={outputMessage}
        classNames={{
          input: "overflow-hidden resize-none min-h-[170px]",
        }}
        style={{ transition: "height 0.2s ease-out" }}
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
