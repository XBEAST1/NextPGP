"use client";

import React, { useState, useEffect } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Modal, ModalContent, Input, Button } from "@nextui-org/react";
import { Textarea } from "@nextui-org/input";
import * as openpgp from "openpgp";

export const EyeSlashFilledIcon = (props) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M21.2714 9.17834C20.9814 8.71834 20.6714 8.28834 20.3514 7.88834C19.9814 7.41834 19.2814 7.37834 18.8614 7.79834L15.8614 10.7983C16.0814 11.4583 16.1214 12.2183 15.9214 13.0083C15.5714 14.4183 14.4314 15.5583 13.0214 15.9083C12.2314 16.1083 11.4714 16.0683 10.8114 15.8483C10.8114 15.8483 9.38141 17.2783 8.35141 18.3083C7.85141 18.8083 8.01141 19.6883 8.68141 19.9483C9.75141 20.3583 10.8614 20.5683 12.0014 20.5683C13.7814 20.5683 15.5114 20.0483 17.0914 19.0783C18.7014 18.0783 20.1514 16.6083 21.3214 14.7383C22.2714 13.2283 22.2214 10.6883 21.2714 9.17834Z"
        fill="currentColor"
      />
      <path
        d="M14.0206 9.98062L9.98062 14.0206C9.47062 13.5006 9.14062 12.7806 9.14062 12.0006C9.14062 10.4306 10.4206 9.14062 12.0006 9.14062C12.7806 9.14062 13.5006 9.47062 14.0206 9.98062Z"
        fill="currentColor"
      />
      <path
        d="M18.25 5.74969L14.86 9.13969C14.13 8.39969 13.12 7.95969 12 7.95969C9.76 7.95969 7.96 9.76969 7.96 11.9997C7.96 13.1197 8.41 14.1297 9.14 14.8597L5.76 18.2497H5.75C4.64 17.3497 3.62 16.1997 2.75 14.8397C1.75 13.2697 1.75 10.7197 2.75 9.14969C3.91 7.32969 5.33 5.89969 6.91 4.91969C8.49 3.95969 10.22 3.42969 12 3.42969C14.23 3.42969 16.39 4.24969 18.25 5.74969Z"
        fill="currentColor"
      />
      <path
        d="M14.8581 11.9981C14.8581 13.5681 13.5781 14.8581 11.9981 14.8581C11.9381 14.8581 11.8881 14.8581 11.8281 14.8381L14.8381 11.8281C14.8581 11.8881 14.8581 11.9381 14.8581 11.9981Z"
        fill="currentColor"
      />
      <path
        d="M21.7689 2.22891C21.4689 1.92891 20.9789 1.92891 20.6789 2.22891L2.22891 20.6889C1.92891 20.9889 1.92891 21.4789 2.22891 21.7789C2.37891 21.9189 2.56891 21.9989 2.76891 21.9989C2.96891 21.9989 3.15891 21.9189 3.30891 21.7689L21.7689 3.30891C22.0789 3.00891 22.0789 2.52891 21.7689 2.22891Z"
        fill="currentColor"
      />
    </svg>
  );
};

export const EyeFilledIcon = (props) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M21.25 9.14969C18.94 5.51969 15.56 3.42969 12 3.42969C10.22 3.42969 8.49 3.94969 6.91 4.91969C5.33 5.89969 3.91 7.32969 2.75 9.14969C1.75 10.7197 1.75 13.2697 2.75 14.8397C5.06 18.4797 8.44 20.5597 12 20.5597C13.78 20.5597 15.51 20.0397 17.09 19.0697C18.67 18.0897 20.09 16.6597 21.25 14.8397C22.25 13.2797 22.25 10.7197 21.25 9.14969ZM12 16.0397C9.76 16.0397 7.96 14.2297 7.96 11.9997C7.96 9.76969 9.76 7.95969 12 7.95969C14.24 7.95969 16.04 9.76969 16.04 11.9997C16.04 14.2297 14.24 16.0397 12 16.0397Z"
        fill="currentColor"
      />
      <path
        d="M11.9984 9.14062C10.4284 9.14062 9.14844 10.4206 9.14844 12.0006C9.14844 13.5706 10.4284 14.8506 11.9984 14.8506C13.5684 14.8506 14.8584 13.5706 14.8584 12.0006C14.8584 10.4306 13.5684 9.14062 11.9984 9.14062Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default function App() {
  const [inputMessage, setInputMessage] = useState("");
  const [decryptedMessage, setDecryptedMessage] = useState("");
  const [pgpKeys, setPgpKeys] = useState(null);
  const [detailsText, setDetailsText] = useState("");

  useEffect(() => {
    // Fetch PGP keys from local storage
    const storedKeys = JSON.parse(localStorage.getItem("pgpKeys"));
    setPgpKeys(storedKeys);
  }, []);

  const handleDecrypt = async () => {
    if (!inputMessage || !pgpKeys) {
      toast.error("Please enter a pgp message.", {
        position: "top-right",
      });
      return;
    }

    // Validate if the message is a PGP message
    let message;
    try {
      message = await openpgp.readMessage({
        armoredMessage: inputMessage,
      });
    } catch (error) {
      toast.error("The message is not in PGP message format.", {
        position: "top-right",
      });
      return;
    }

    try {
      let successfulDecryption = false;
      let details = "";

      for (const keyData of pgpKeys) {
        if (!keyData.privateKey) {
          continue;
        }

        try {
          // Read the private key
          const privateKey = await openpgp.readPrivateKey({
            armoredKey: keyData.privateKey,
          });

          if (keyData.passphrase) {
            await privateKey.decrypt(keyData.passphrase);
          }

          const message = await openpgp.readMessage({
            armoredMessage: inputMessage,
          });

          const publicKeys = await Promise.all(
            pgpKeys
              .filter((key) => key.publicKey)
              .map(async (key) => {
                const loadedKey = await openpgp.readKey({
                  armoredKey: key.publicKey,
                });
                return loadedKey;
              })
          );

          // Decrypt the message
          const { data: decrypted, signatures } = await openpgp.decrypt({
            message,
            decryptionKeys: [privateKey],
            verificationKeys: publicKeys, // Use public keys for signature verification
          });

          setDecryptedMessage(decrypted);
          successfulDecryption = true;

          // Extract encryption key IDs for recipient matching
          const encryptionKeyIDs = await message.getEncryptionKeyIDs();

          // Match encryption key IDs with the public keys explicitly
          const recipients = encryptionKeyIDs.map((keyID) => {
            const matchedKey = publicKeys.find((key) => {
              // Check both primary key ID and subkeys
              return (
                key.getKeyID().equals(keyID) ||
                key
                  .getSubkeys()
                  .some((subkey) => subkey.getKeyID().equals(keyID))
              );
            });

            if (matchedKey) {
              // Return the User ID and Key ID
              const userID = matchedKey.getUserIDs()[0];
              return `  - ${userID} (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")})`;
            } else {
              // Handle case where no match is found
              return `  - Unknown (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")})`;
            }
          });

          // Log the list of recipients
          details += "Recipients:\n" + recipients.join("\n") + "\n\n";

          // Signature verification details
          if (signatures && signatures.length > 0) {
            for (const sig of signatures) {
              const { keyID, verified, signature } = sig;

              const isVerified = await verified;

              const resolvedSignature = await signature;

              // Find the signer key from public keys
              const signerKey = publicKeys.find((key) =>
                key.getKeyID().equals(keyID)
              );

              const signerUser = signerKey
                ? signerKey.getUserIDs()[0]
                : "Unknown";

              details += `Signature by ${signerUser} (${keyID
                .toHex()
                .match(/.{1,4}/g)
                .join(" ")}) is ${isVerified ? "valid" : "not valid"}.\n`;

              try {
                const signaturePacket = resolvedSignature.packets[0];
                const createdTime =
                  signaturePacket && signaturePacket.created
                    ? new Date(signaturePacket.created)
                    : null;

                if (createdTime) {
                  const dayName = createdTime.toLocaleDateString("en-US", {
                    weekday: "long",
                  });
                  const monthName = createdTime.toLocaleDateString("en-US", {
                    month: "long",
                  });
                  const day = createdTime.getDate();
                  const year = createdTime.getFullYear();

                  const locale = navigator.language || "en-US";
                  const is24Hour =
                    locale.includes("GB") || locale.includes("DE");

                  const timeWithZone = createdTime.toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: !is24Hour,
                    timeZoneName: "long",
                  });

                  details += `Signature created on ${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}\n\n`;
                } else {
                  details += `Signature created at: Not available\n\n`;
                }
              } catch (error) {
                details += "Signature created at: Not available\n\n";
              }
            }
          } else {
            details += `You cannot be sure who encrypted this message as it is not signed.\n\n`;
          }

          break;
        } catch (error) {
        }
      }

      if (!successfulDecryption) {
        toast.error("No private key found for decryption.", {
          position: "top-right",
        });
      }
      setDetailsText(details);
    } catch (error) {
      console.error("Decryption process failed:", error);
    }
  };

  return (
    <>
      <ToastContainer theme="dark" />
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

      <Textarea isReadOnly label="Details" value={detailsText} />

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

      <Button onClick={handleDecrypt}>Decrypt</Button>
    </>
  );
}
