import * as openpgp from "openpgp";

onmessage = async function (e) {
  const { type, inputMessage, pgpKeys, password, currentPrivateKey, files } =
    e.data;

  if (type === "messageDecrypt") {
    let functionDetails = "";
    let message;

    const header = "-----BEGIN PGP MESSAGE-----";
    const footer = "-----END PGP MESSAGE-----";

    let messageText = inputMessage;

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
      postMessage({
        type: "addToast",
        payload: {
          title: "The message is not in a valid PGP format",
          color: "danger",
        },
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
              postMessage({
                type: "setCurrentPrivateKey",
                payload: keyData.privateKey,
              });
              postMessage({ type: "setIsPasswordModalOpen", payload: true });
              postMessage({
                type: "addToast",
                payload: {
                  title:
                    "The message is encrypted with a password protected key",
                  color: "primary",
                },
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

          postMessage({ type: "setDecryptedMessage", payload: decrypted });
          successfulDecryption = true;

          // Determine the decryption key name from the private key used to decrypt the message
          let decryptionKeyName;
          try {
            const privateKeyID = privateKey.getKeyID().toHex();
            const matchedKey = publicKeys.find(
              (key) =>
                key.getKeyID().toHex() === privateKeyID ||
                key
                  .getSubkeys()
                  .some((sub) => sub.getKeyID().toHex() === privateKeyID)
            );
            if (matchedKey) {
              decryptionKeyName =
                matchedKey.getUserIDs()[0] || decryptionKeyName;
            }
          } catch {}

          // Extract encryption key IDs for recipient matching
          const encryptionKeyIDs = message.getEncryptionKeyIDs();
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
                const locale = "en-US";
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

              functionDetails += `Message successfully decrypted using key: ${decryptionKeyName}\n`;
              functionDetails += `Signature by: ${userID}`;
              if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
              functionDetails += `\n`;
              functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
            }
          } else {
            functionDetails += `Message successfully decrypted using key: ${decryptionKeyName}\n`;
            functionDetails += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
          }

          postMessage({ type: "setDetails", payload: functionDetails });
          postMessage({
            type: "addToast",
            payload: {
              title: "Message Successfully Decrypted!",
              color: "success",
            },
          });
          return;
        } catch (error) {
          console.log("Key failed to decrypt the message:", error);
          continue;
        }
      }

      if (isPasswordEncrypted && !successfulDecryption) {
        // Open password prompt only if no valid private key could decrypt
        postMessage({ type: "setCurrentPrivateKey", payload: null });
        postMessage({ type: "setIsPasswordModalOpen", payload: true });
        postMessage({
          type: "addToast",
          payload: {
            title: "The message is password encrypted",
            color: "primary",
          },
        });
      } else if (!successfulDecryption) {
        postMessage({
          type: "addToast",
          payload: {
            title: "No valid private key available to decrypt the message",
            color: "danger",
          },
        });
      }
    } catch {
      postMessage({
        type: "addToast",
        payload: {
          title: "Decryption failed due to an unexpected error",
          color: "danger",
        },
      });
    }
  }

  if (type === "messagePasswordDecrypt") {
    let functionDetails = "";
    let message;

    const header = "-----BEGIN PGP MESSAGE-----";
    const footer = "-----END PGP MESSAGE-----";

    let messageText = inputMessage;

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
      postMessage({
        type: "addToast",
        payload: {
          title: "The message is not in a valid PGP format",
          color: "danger",
        },
      });
      return;
    }
    try {
      // First, try to decrypt the message using the password.
      try {
        const { data: decrypted, signatures } = await openpgp.decrypt({
          message,
          passwords: [password],
          config: { allowUnauthenticatedMessages: true },
        });

        postMessage({ type: "setDecryptedMessage", payload: decrypted });

        const storedKeys = pgpKeys || [];

        // Load public keys for signature verification
        const publicKeys = await Promise.all(
          storedKeys
            .filter((key) => key.publicKey)
            .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
        );

        // Extract encryption key IDs for recipient matching
        const encryptionKeyIDs = message.getEncryptionKeyIDs();

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

        postMessage({ type: "setDetails", payload: functionDetails });
        postMessage({ type: "setIsPasswordModalOpen", payload: false });
        postMessage({
          type: "addToast",
          payload: {
            title: "Message decrypted successfully!",
            color: "success",
          },
        });
        return;
      } catch (error) {
        console.error(
          "Password decryption failed or no valid signature:",
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

      const storedKeys = pgpKeys || [];
      // Load public keys for signature verification
      const publicKeys = await Promise.all(
        storedKeys
          .filter((key) => key.publicKey)
          .map((key) => openpgp.readKey({ armoredKey: key.publicKey }))
      );

      const { data: decrypted, signatures } = await openpgp.decrypt({
        message,
        decryptionKeys: privateKey,
        verificationKeys: publicKeys.length > 0 ? publicKeys : undefined,
      });

      postMessage({ type: "setDecryptedMessage", payload: decrypted });
      postMessage({ type: "setIsPasswordModalOpen", payload: false });

      let decryptionKeyName;
      try {
        const privateKeyID = privateKey.getKeyID().toHex();
        const matchedKey = publicKeys.find(
          (key) =>
            key.getKeyID().toHex() === privateKeyID ||
            key
              .getSubkeys()
              .some((sub) => sub.getKeyID().toHex() === privateKeyID)
        );
        if (matchedKey) {
          decryptionKeyName = matchedKey.getUserIDs()[0] || decryptionKeyName;
        }
      } catch {}

      const encryptionKeyIDs = message.getEncryptionKeyIDs();

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

          functionDetails += `Message successfully decrypted using key: ${decryptionKeyName}\n`;

          functionDetails += `Signature by: ${userID}`;
          if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
          functionDetails += `\n`;

          functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
        }
      } else {
        functionDetails += `Message successfully decrypted using key: ${decryptionKeyName}\n`;
        functionDetails += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
      }
      postMessage({ type: "setDetails", payload: functionDetails });
      postMessage({
        type: "addToast",
        payload: { title: "Message Successfully Decrypted!", color: "success" },
      });
    } catch {
      postMessage({
        type: "addToast",
        payload: { title: "Incorrect password", color: "danger" },
      });
    }
  }

  if (type === "fileDecrypt") {
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
                postMessage({
                  type: "setCurrentPrivateKey",
                  payload: keyData.privateKey,
                });
                postMessage({ type: "setIsPasswordModalOpen", payload: true });
                postMessage({
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

            // Determine the decryption key name from the private key used to decrypt the message
            let decryptionKeyName;
            try {
              const privateKeyID = privateKey.getKeyID().toHex();
              const matchedKey = publicKeys.find(
                (key) =>
                  key.getKeyID().toHex() === privateKeyID ||
                  key
                    .getSubkeys()
                    .some((sub) => sub.getKeyID().toHex() === privateKeyID)
              );
              if (matchedKey) {
                decryptionKeyName =
                  matchedKey.getUserIDs()[0] || decryptionKeyName;
              }
            } catch {}

            // Extract recipients information
            const encryptionKeyIDs = message.getEncryptionKeyIDs();
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

                functionDetails += `File successfully decrypted using key: ${decryptionKeyName}\n`;

                functionDetails += `Signature by: ${userID}`;
                if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
                functionDetails += `\n`;

                functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
              }
            } else {
              functionDetails += `File successfully decrypted using key: ${decryptionKeyName}\n`;
              functionDetails += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
            }

            postMessage({ type: "setDetails", payload: functionDetails });
            postMessage({
              type: "addToast",
              payload: {
                title: `File ${file.name} successfully decrypted!`,
                color: "success",
              },
            });
            // Send decrypted file data to the main thread
            if (decrypted) {
              postMessage({
                type: "downloadFile",
                payload: {
                  fileName: file.name.replace(/\.gpg$/, ""),
                  decrypted,
                },
              });
            }
            break; // Stop after a successful decryption for this file.
          } catch (error) {
            console.log("Key failed to decrypt the file:", error);
            continue;
          }
        }

        if (isPasswordEncrypted && !successfulDecryption) {
          postMessage({ type: "setCurrentPrivateKey", payload: null });
          postMessage({ type: "setIsPasswordModalOpen", payload: true });
          postMessage({
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
          postMessage({
            type: "addToast",
            payload: {
              title:
                "No valid private key available to decrypt the file " +
                file.name,
              color: "danger",
            },
          });
        }
      } catch {
        postMessage({
          type: "addToast",
          payload: {
            title: "Incorrect Password for file " + file.name,
            color: "danger",
          },
        });
      }
    }
  }

  if (type === "filePasswordDecrypt") {
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
          const encryptionKeyIDs = message.getEncryptionKeyIDs();
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

          postMessage({ type: "setDetails", payload: functionDetails });

          // Download decrypted file
          if (decrypted) {
            postMessage({
              type: "downloadFile",
              payload: { fileName: file.name.replace(/\.gpg$/, ""), decrypted },
            });
          }

          postMessage({ type: "setIsPasswordModalOpen", payload: false });
          postMessage({
            type: "addToast",
            payload: {
              title: `File ${file.name} decrypted successfully!`,
              color: "success",
            },
          });
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

        postMessage({ type: "setIsPasswordModalOpen", payload: false });

        // Determine the decryption key name from the private key used to decrypt the message
        let decryptionKeyName;
        try {
          const privateKeyID = privateKey.getKeyID().toHex();
          const matchedKey = publicKeys.find(
            (key) =>
              key.getKeyID().toHex() === privateKeyID ||
              key
                .getSubkeys()
                .some((sub) => sub.getKeyID().toHex() === privateKeyID)
          );
          if (matchedKey) {
            decryptionKeyName = matchedKey.getUserIDs()[0] || decryptionKeyName;
          }
        } catch {}

        const encryptionKeyIDs = message.getEncryptionKeyIDs();
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
            functionDetails += `File successfully decrypted using key: ${decryptionKeyName}\n`;

            functionDetails += `Signature by: ${userID}`;
            if (formattedKeyID) functionDetails += ` (${formattedKeyID})`;
            functionDetails += `\n`;

            functionDetails += `Signature created on: ${createdTimeStr}\n\n`;
          }
        } else {
          functionDetails += `File successfully decrypted using key: ${decryptionKeyName}\n`;
          functionDetails += `You cannot be sure who encrypted this file as it is not signed.\n\n`;
        }

        postMessage({ type: "setDetails", payload: functionDetails });
        postMessage({
          type: "addToast",
          payload: {
            title: `File ${file.name} decrypted successfully!`,
            color: "success",
          },
        });

        if (decrypted) {
          postMessage({
            type: "downloadFile",
            payload: { fileName: file.name.replace(/\.gpg$/, ""), decrypted },
          });
        }
      } catch {
        postMessage({
          type: "addToast",
          payload: {
            title: "Incorrect Password for file " + file.name,
            color: "danger",
          },
        });
      }
    }
  }
};
