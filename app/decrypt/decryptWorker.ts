"use client";

import * as openpgp from "openpgp";
import type {
  DecryptWorkerMessageData,
  DecryptResponsePayload,
} from "./decryptWorker.types";
import {
  loadPublicKeys,
  getDecryptionKeyName,
  isPasswordEncryptedMessage,
  buildRecipientList,
  buildVerificationDetails,
  buildDecryptionSignatureDetails,
} from "./decryptWorker.helpers";

// Re-export types so existing imports continue to work seamlessly
export type {
  StoredPGPKey,
  DecryptWorkerMessageType,
  DecryptWorkerMessageData,
  DecryptResponseType,
  DecryptResponsePayload,
  DecryptWorkerTask,
} from "./decryptWorker.types";

/**
 * Type-safe wrapper around postMessage for the decrypt worker.
 */
function sendResponse(response: DecryptResponsePayload) {
  postMessage(response);
}

export async function handleDecryptWorkerMessage(
  e: MessageEvent<DecryptWorkerMessageData>
) {
  const { type, inputMessage, pgpKeys, password, currentPrivateKey, files } =
    e.data;

  if (type === "messageDecrypt") {
    let functionDetails = "";
    let message: openpgp.Message<string>;

    const header = "-----BEGIN PGP MESSAGE-----";
    const footer = "-----END PGP MESSAGE-----";
    const cleartextHeader = "-----BEGIN PGP SIGNED MESSAGE-----";
    const sigHeader = "-----BEGIN PGP SIGNATURE-----";
    const sigFooter = "-----END PGP SIGNATURE-----";

    let messageText = (inputMessage || "").trim();

    // Detached signature processor
    const isDetachedSignatureOnly =
      messageText.startsWith(sigHeader) &&
      messageText.includes(sigFooter) &&
      !messageText.startsWith(cleartextHeader) &&
      !messageText.includes(header);

    if (isDetachedSignatureOnly) {
      try {
        const detachedSig = await openpgp.readSignature({
          armoredSignature: messageText,
        });

        const publicKeys = await loadPublicKeys(pgpKeys);
        const emptyMsg = await openpgp.createMessage({ text: "" });

        const verificationResult = await openpgp.verify({
          message: emptyMsg,
          signature: detachedSig,
          verificationKeys: publicKeys,
          format: "binary",
        });

        functionDetails = await buildVerificationDetails(
          verificationResult.signatures,
          publicKeys,
          "en-US"
        );

        sendResponse({ type: "setDecryptedMessage", payload: "" });
        sendResponse({ type: "setDetails", payload: functionDetails });
        sendResponse({
          type: "addToast",
          payload: {
            title: "PGP Signature Detected",
            description: "No message was signed",
            color: "primary",
          },
        });
      } catch (e: unknown) {
        sendResponse({
          type: "addToast",
          payload: { title: "Invalid Detached Signature", color: "danger" },
        });
        sendResponse({
          type: "error",
          payload: { message: e instanceof Error ? e.message : "error" },
        });
      }
      return;
    }

    // Signed message Processor
    if (messageText.startsWith(cleartextHeader)) {
      if (
        !messageText.includes(sigHeader) ||
        !messageText.includes(sigFooter)
      ) {
        sendResponse({
          type: "addToast",
          payload: {
            title: "The message is missing its PGP signature block",
            color: "danger",
          },
        });
        sendResponse({ type: "error", payload: { message: "error" } });
        return;
      }

      const clearMessage = await openpgp.readCleartextMessage({
        cleartextMessage: messageText,
      });

      const publicKeys = await loadPublicKeys(pgpKeys);

      const verificationResult = await openpgp.verify({
        message: clearMessage,
        verificationKeys: publicKeys,
      });

      sendResponse({
        type: "setDecryptedMessage",
        payload: verificationResult.data,
      });

      functionDetails = await buildVerificationDetails(
        verificationResult.signatures,
        publicKeys,
        "en-US"
      );

      sendResponse({ type: "setDetails", payload: functionDetails });
      sendResponse({
        type: "addToast",
        payload: { title: "Message Successfully Verified!", color: "success" },
      });
      return;
    }

    // If the input message doesn't include the header, add it
    if (!messageText.includes(header)) {
      messageText = `${header}\n\n${messageText.trim()}`;
    }

    // If the input message doesn't include the footer, add it
    if (!messageText.includes(footer)) {
      messageText = `${messageText.trim()}\n\n${footer}`;
    }

    try {
      message = await openpgp.readMessage({ armoredMessage: messageText });
    } catch {
      sendResponse({
        type: "addToast",
        payload: {
          title: "The message is not in a valid PGP format",
          color: "danger",
        },
      });
      sendResponse({
        type: "error",
        payload: { message: "error" },
      });
      return;
    }

    // Encrypted Message Processor
    try {
      const validPgpKeys = Array.isArray(pgpKeys) ? pgpKeys : [];
      const isPasswordEncrypted = isPasswordEncryptedMessage(message);
      let successfulDecryption = false;

      // Load public keys for signature verification
      const publicKeys = await loadPublicKeys(validPgpKeys);

      for (const keyData of validPgpKeys) {
        if (!keyData.privateKey) continue;
        try {
          // Read private key
          let privateKey = await openpgp.readPrivateKey({
            armoredKey: keyData.privateKey,
          });

          // Skip if the private key cannot decrypt the message
          const matchingKeys = message.getEncryptionKeyIDs();
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
              sendResponse({
                type: "setCurrentPrivateKey",
                payload: keyData.privateKey,
              });
              sendResponse({ type: "setIsPasswordModalOpen", payload: true });
              sendResponse({
                type: "addToast",
                payload: {
                  title:
                    "The message is encrypted with a password protected key",
                  color: "primary",
                },
              });
              sendResponse({
                type: "error",
                payload: { message: "error" },
              });
              return;
            }
          }

          // Decrypt the message
          const { data: decrypted, signatures } = await openpgp.decrypt({
            message,
            decryptionKeys: privateKey,
            verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
          });

          sendResponse({ type: "setDecryptedMessage", payload: decrypted });
          successfulDecryption = true;

          // Determine the decryption key name from the private key
          const decryptionKeyName = await getDecryptionKeyName(
            privateKey,
            publicKeys
          );

          // Extract encryption key IDs for recipient matching
          const recipients = await buildRecipientList(message, publicKeys);
          functionDetails +=
            "👥 Recipients:\n" + recipients.join("\n") + "\n\n";

          functionDetails += await buildDecryptionSignatureDetails(
            signatures,
            publicKeys,
            {
              isFile: false,
              isPassword: false,
              decryptionKeyName,
              locale: "en-US",
            }
          );

          sendResponse({ type: "setDetails", payload: functionDetails });
          sendResponse({
            type: "addToast",
            payload: {
              title: "Message Successfully Decrypted!",
              color: "success",
            },
          });
          sendResponse({
            type: "error",
            payload: { message: "error" },
          });
          return;
        } catch (error: unknown) {
          console.log("Key failed to decrypt the message:", error);
          continue;
        }
      }

      if (isPasswordEncrypted && !successfulDecryption) {
        // Open password prompt only if no valid private key could decrypt
        sendResponse({ type: "setCurrentPrivateKey", payload: null });
        sendResponse({ type: "setIsPasswordModalOpen", payload: true });
        sendResponse({
          type: "addToast",
          payload: {
            title: "The message is password encrypted",
            color: "primary",
          },
        });
        sendResponse({
          type: "error",
          payload: { message: "error" },
        });
        return;
      } else if (!successfulDecryption) {
        sendResponse({
          type: "addToast",
          payload: {
            title: "No valid private key available to decrypt the message",
            color: "danger",
          },
        });
        sendResponse({
          type: "error",
          payload: { message: "error" },
        });
        return;
      }
    } catch {
      sendResponse({
        type: "addToast",
        payload: {
          title: "Decryption failed due to an unexpected error",
          color: "danger",
        },
      });
      sendResponse({
        type: "error",
        payload: { message: "error" },
      });
    }
  }

  if (type === "messagePasswordDecrypt") {
    let functionDetails = "";
    let message: openpgp.Message<string>;

    const header = "-----BEGIN PGP MESSAGE-----";
    const footer = "-----END PGP MESSAGE-----";

    let messageText = inputMessage || "";

    // If the input message doesn't include the header, add it
    if (!messageText.includes(header)) {
      messageText = `${header}\n\n${messageText.trim()}`;
    }

    // If the input message doesn't include the footer, add it
    if (!messageText.includes(footer)) {
      messageText = `${messageText.trim()}\n\n${footer}`;
    }

    try {
      message = await openpgp.readMessage({ armoredMessage: messageText });
    } catch {
      sendResponse({
        type: "addToast",
        payload: {
          title: "The message is not in a valid PGP format",
          color: "danger",
        },
      });
      sendResponse({
        type: "error",
        payload: { message: "error" },
      });
      return;
    }

    try {
      // First, try to decrypt the message using the password.
      try {
        const { data: decrypted, signatures } = await openpgp.decrypt({
          message,
          passwords: [password || ""],
          config: { allowUnauthenticatedMessages: true },
        });

        sendResponse({ type: "setDecryptedMessage", payload: decrypted });

        // Load public keys for signature verification
        const publicKeys = await loadPublicKeys(pgpKeys);

        // Extract encryption key IDs for recipient matching
        const recipients = await buildRecipientList(message, publicKeys);

        functionDetails =
          recipients.length > 0
            ? "👥 Recipients:\n" + recipients.join("\n") + "\n\n"
            : "👥 No recipients found\n\n";

        functionDetails += await buildDecryptionSignatureDetails(
          signatures,
          publicKeys,
          {
            isFile: false,
            isPassword: true,
            locale:
              typeof navigator !== "undefined" && navigator.language
                ? navigator.language
                : "en-US",
          }
        );

        sendResponse({ type: "setDetails", payload: functionDetails });
        sendResponse({ type: "setIsPasswordModalOpen", payload: false });
        sendResponse({
          type: "addToast",
          payload: {
            title: "Message decrypted successfully!",
            color: "success",
          },
        });
        sendResponse({ type: "complete", payload: null });
        return;
      } catch (error: unknown) {
        console.error(
          "Password decryption failed or no valid signature:",
          error instanceof Error ? error.message : error
        );
      }

      // If password decryption fails, fall back to private key decryption
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: currentPrivateKey || "",
      });

      privateKey = await openpgp.decryptKey({
        privateKey,
        passphrase: password || "",
      });

      // Load public keys for signature verification
      const publicKeys = await loadPublicKeys(pgpKeys);

      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
      });

      sendResponse({ type: "setDecryptedMessage", payload: decrypted });
      sendResponse({ type: "setIsPasswordModalOpen", payload: false });

      const decryptionKeyName = await getDecryptionKeyName(
        privateKey,
        publicKeys
      );

      const recipients = await buildRecipientList(message, publicKeys);
      functionDetails += "👥 Recipients:\n" + recipients.join("\n") + "\n\n";

      functionDetails += await buildDecryptionSignatureDetails(
        signatures,
        publicKeys,
        {
          isFile: false,
          isPassword: false,
          decryptionKeyName,
          locale:
            typeof navigator !== "undefined" && navigator.language
              ? navigator.language
              : "en-US",
        }
      );

      sendResponse({ type: "setDetails", payload: functionDetails });
      sendResponse({
        type: "addToast",
        payload: { title: "Message Successfully Decrypted!", color: "success" },
      });
      sendResponse({ type: "complete", payload: null });
    } catch {
      sendResponse({
        type: "addToast",
        payload: { title: "Incorrect password", color: "danger" },
      });
      sendResponse({
        type: "error",
        payload: { message: "error" },
      });
    }
  }

  if (type === "fileDecrypt") {
    if (!files || files.length === 0) {
      return;
    }

    let functionDetails = "";

    for (const file of files) {
      // Reset details per file
      functionDetails = "";
      // If the file is a ".sig", treat it as a detached signature
      if (file.name.endsWith(".sig")) {
        try {
          const fileData = await file.arrayBuffer();

          const message = await openpgp.readMessage({
            binaryMessage: new Uint8Array(fileData),
          });

          const publicKeys = await loadPublicKeys(pgpKeys);

          const verificationResult = await openpgp.verify({
            message,
            verificationKeys: publicKeys,
            format: "binary",
          });

          const extractedData = verificationResult.data;

          functionDetails += `📄 File: ${file.name}\n`;
          functionDetails += await buildVerificationDetails(
            verificationResult.signatures,
            publicKeys,
            "en-US"
          );

          sendResponse({ type: "setDecryptedMessage", payload: "" });
          sendResponse({ type: "setDetails", payload: functionDetails });
          sendResponse({
            type: "addToast",
            payload: {
              title: `Signature details for ${file.name}`,
              color: "primary",
            },
          });
          sendResponse({
            type: "downloadFile",
            payload: {
              fileName: file.name.replace(/\.sig$/, ""),
              decrypted: extractedData,
            },
          });
        } catch (error: unknown) {
          console.error("Failed to process attached-signature file:", error);
          sendResponse({
            type: "addToast",
            payload: {
              title: "Failed to verify or extract signature file",
              color: "danger",
            },
          });
        }
        continue;
      }

      try {
        const fileData = await file.arrayBuffer();

        const message = await openpgp.readMessage({
          binaryMessage: new Uint8Array(fileData),
        });

        const validPgpKeys = Array.isArray(pgpKeys) ? pgpKeys : [];
        const isPasswordEncrypted = isPasswordEncryptedMessage(message);
        let successfulDecryption = false;

        // Load public keys for signature verification
        const publicKeys = await loadPublicKeys(validPgpKeys);

        for (const keyData of validPgpKeys) {
          if (!keyData.privateKey) continue;

          try {
            let privateKey = await openpgp.readPrivateKey({
              armoredKey: keyData.privateKey,
            });
            const matchingKeys = message.getEncryptionKeyIDs();
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
                sendResponse({
                  type: "setCurrentPrivateKey",
                  payload: keyData.privateKey,
                });
                sendResponse({ type: "setIsPasswordModalOpen", payload: true });
                sendResponse({
                  type: "addToast",
                  payload: {
                    title:
                      files && files.length > 1
                        ? "The files are encrypted with a password protected key"
                        : "The file is encrypted with a password protected key",
                    color: "primary",
                  },
                });
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

            // Determine the decryption key name from the private key
            const decryptionKeyName = await getDecryptionKeyName(
              privateKey,
              publicKeys
            );

            // Extract recipients information
            const recipients = await buildRecipientList(message, publicKeys);
            functionDetails += `📄 File: ${file.name}\n`;
            functionDetails +=
              "👥 Recipients:\n" + recipients.join("\n") + "\n\n";

            functionDetails += await buildDecryptionSignatureDetails(
              signatures,
              publicKeys,
              {
                isFile: true,
                isPassword: false,
                decryptionKeyName,
                locale:
                  typeof navigator !== "undefined" && navigator.language
                    ? navigator.language
                    : "en-US",
              }
            );

            sendResponse({ type: "setDetails", payload: functionDetails });
            sendResponse({
              type: "addToast",
              payload: {
                title: `File ${file.name} successfully decrypted!`,
                color: "success",
              },
            });
            // Send decrypted file data to the main thread
            if (decrypted) {
              sendResponse({
                type: "downloadFile",
                payload: {
                  fileName: file.name.replace(/\.(gpg|pgp)$/, ""),
                  decrypted,
                },
              });
            }
            break; // Stop after a successful decryption for this file.
          } catch (error: unknown) {
            console.log("Key failed to decrypt the file:", error);
            continue;
          }
        }

        if (isPasswordEncrypted && !successfulDecryption) {
          sendResponse({ type: "setCurrentPrivateKey", payload: null });
          sendResponse({ type: "setIsPasswordModalOpen", payload: true });
          sendResponse({
            type: "addToast",
            payload: {
              title:
                files && files.length > 1
                  ? "The files are password encrypted"
                  : "The file is password encrypted",
              color: "primary",
            },
          });
          return;
        } else if (!successfulDecryption) {
          sendResponse({
            type: "addToast",
            payload: {
              title:
                "No valid private key available to decrypt the file " +
                file.name,
              color: "danger",
            },
          });
          sendResponse({
            type: "error",
            payload: { message: "error" },
          });
        }
      } catch {
        sendResponse({
          type: "addToast",
          payload: {
            title: "Incorrect Password for file " + file.name,
            color: "danger",
          },
        });
        sendResponse({
          type: "passworderror",
          payload: { message: `Incorrect password for file ${file.name}` },
        });
      }
    }
  }

  if (type === "filePasswordDecrypt") {
    if (!files || files.length === 0) {
      return;
    }

    // Track processed files to prevent duplicates
    const processedFiles = new Set<string>();

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
            passwords: [password || ""],
            config: { allowUnauthenticatedMessages: true },
            format: "binary",
          });

          // Load public keys for signature verification
          const publicKeys = await loadPublicKeys(pgpKeys);

          // Extract encryption key IDs for recipient matching
          const recipients = await buildRecipientList(message, publicKeys);

          functionDetails =
            `📄 File: ${file.name}\n` +
            (recipients.length > 0
              ? "👥 Recipients:\n" + recipients.join("\n") + "\n\n"
              : "👥 No recipients found\n\n");

          functionDetails += await buildDecryptionSignatureDetails(
            signatures,
            publicKeys,
            {
              isFile: true,
              isPassword: true,
              locale:
                typeof navigator !== "undefined" && navigator.language
                  ? navigator.language
                  : "en-US",
            }
          );

          sendResponse({ type: "setDetails", payload: functionDetails });

          // Download decrypted file - only once per file
          if (decrypted && !processedFiles.has(file.name)) {
            processedFiles.add(file.name);
            sendResponse({
              type: "downloadFile",
              payload: {
                fileName: file.name.replace(/\.(gpg|pgp)$/, ""),
                decrypted,
              },
            });
          }

          sendResponse({ type: "setIsPasswordModalOpen", payload: false });
          sendResponse({
            type: "addToast",
            payload: {
              title: `File ${file.name} decrypted successfully!`,
              color: "success",
            },
          });
          // Continue with next file
          continue;
        } catch (error: unknown) {
          console.error(
            "Password decryption failed or no valid signature:",
            error instanceof Error ? error.message : error
          );
        }

        // Fall back to private key decryption if password decryption fails
        let privateKey = await openpgp.readPrivateKey({
          armoredKey: currentPrivateKey || "",
        });
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: password || "",
        });

        // Load public keys for signature verification
        const publicKeys = await loadPublicKeys(pgpKeys);

        const { data: decrypted, signatures } = await openpgp.decrypt({
          message,
          decryptionKeys: privateKey,
          verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
          format: "binary",
        });

        sendResponse({ type: "setIsPasswordModalOpen", payload: false });

        // Determine the decryption key name from the private key
        const decryptionKeyName = await getDecryptionKeyName(
          privateKey,
          publicKeys
        );

        const recipients = await buildRecipientList(message, publicKeys);

        functionDetails += `📄 File: ${file.name}\n`;
        functionDetails += "👥 Recipients:\n" + recipients.join("\n") + "\n\n";

        functionDetails += await buildDecryptionSignatureDetails(
          signatures,
          publicKeys,
          {
            isFile: true,
            isPassword: false,
            decryptionKeyName,
            locale:
              typeof navigator !== "undefined" && navigator.language
                ? navigator.language
                : "en-US",
          }
        );

        sendResponse({ type: "setDetails", payload: functionDetails });
        sendResponse({
          type: "addToast",
          payload: {
            title: `File ${file.name} decrypted successfully!`,
            color: "success",
          },
        });

        // Download decrypted content - only once per file
        if (decrypted && !processedFiles.has(file.name)) {
          processedFiles.add(file.name);
          sendResponse({
            type: "downloadFile",
            payload: {
              fileName: file.name.replace(/\.(gpg|pgp)$/, ""),
              decrypted,
            },
          });
        }
      } catch {
        sendResponse({
          type: "addToast",
          payload: {
            title: "Incorrect Password for file " + file.name,
            color: "danger",
          },
        });
        sendResponse({
          type: "passworderror",
          payload: { message: `Incorrect password for file ${file.name}` },
        });
      }
    }
  }

  // Send completion signal for file decryption tasks
  if (type === "filePasswordDecrypt" || type === "fileDecrypt") {
    sendResponse({ type: "complete", payload: null });
  }
}

if (typeof self !== "undefined") {
  self.onmessage = handleDecryptWorkerMessage;
}

