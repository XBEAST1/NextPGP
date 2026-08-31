"use client";

import * as openpgp from "openpgp";
import JSZip from "jszip";
import type {
  EncryptWorkerMessageData,
  EncryptResponsePayload,
} from "./encryptWorker.types";

export type {
  EncryptRecipientKey,
  EncryptRecipientSelection,
  EncryptWorkerMessageType,
  EncryptWorkerResponseType,
  EncryptWorkerMessageData,
  EncryptToastPayload,
  EncryptDownloadPayload,
  EncryptResponsePayload,
  EncryptWorkerTask,
} from "./encryptWorker.types";

/**
 * Type-safe helper to send messages back to the main thread.
 */
function sendResponse(response: EncryptResponsePayload) {
  postMessage(response);
}

export async function handleEncryptWorkerMessage(
  e: MessageEvent<EncryptWorkerMessageData>
) {
  const {
    type,
    message,
    recipientKeys,
    recipients,
    isChecked = false,
    encryptionPassword,
    decryptedPrivateKey,
    files,
    directoryFiles,
  } = e.data;

  if (type === "messageEncrypt") {
    try {
      const trimmedMessage = (message || "").trim();
      if (!trimmedMessage) {
        return;
      }

      const recipientKeysList = recipientKeys || [];
      const recipientsList = recipients || [];

      const recipientKeysPublic = recipientKeysList
        .filter((key) =>
          recipientsList.some(
            (r) => typeof r === "object" && r.keyId === key.id.toString()
          )
        )
        .map((key) => key.publicKey);

      // If neither recipients nor a password is provided, then sign the message only.
      if (recipientKeysPublic.length === 0 && !isChecked) {
        if (decryptedPrivateKey) {
          const signingKey = await openpgp.readPrivateKey({
            armoredKey: decryptedPrivateKey,
          });
          const cleartextMessage = await openpgp.createCleartextMessage({
            text: trimmedMessage,
          });
          const signedMessage = await openpgp.sign({
            message: cleartextMessage,
            signingKeys: signingKey,
          });
          sendResponse({
            type: "setEncryptedMessage",
            payload: signedMessage,
          });
        } else {
          sendResponse({
            type: "addToast",
            payload: {
              title:
                "Please provide a signing key, select at least one recipient, or enter a password",
              color: "danger",
            },
          });
        }
        return;
      }

      // Use the already-decrypted key if available
      let signingKey: openpgp.PrivateKey | undefined;
      if (decryptedPrivateKey) {
        signingKey = await openpgp.readPrivateKey({
          armoredKey: decryptedPrivateKey,
        });
      }

      const messageToEncrypt = await openpgp.createMessage({
        text: trimmedMessage,
      });

      const encryptionKeys =
        recipientKeysPublic.length > 0
          ? await Promise.all(
              recipientKeysPublic.map((key) =>
                openpgp.readKey({ armoredKey: key })
              )
            )
          : undefined;

      const passwords =
        isChecked && encryptionPassword ? [encryptionPassword] : undefined;

      const encryptedMessage = (await openpgp.encrypt({
        message: messageToEncrypt,
        passwords,
        encryptionKeys,
        signingKeys: signingKey,
      })) as string;

      sendResponse({
        type: "setEncryptedMessage",
        payload: encryptedMessage,
      });
    } catch {
      sendResponse({
        type: "addToast",
        payload: { title: "Please Enter a Password", color: "danger" },
      });
    }
  }

  if (type === "fileEncrypt") {
    const dataFiles =
      files && files.length > 0
        ? files
        : directoryFiles && directoryFiles.length > 0
          ? directoryFiles
          : null;

    if (!dataFiles || dataFiles.length === 0) {
      return;
    }

    try {
      let fileToEncrypt: Uint8Array;
      let outputFileName: string = "";
      const isDirectoryUpload = Boolean(
        dataFiles[0].webkitRelativePath &&
          dataFiles[0].webkitRelativePath.trim() !== ""
      );

      // For a single file that isn’t a directory upload, use it directly.
      // Otherwise, zip the files.
      if (dataFiles.length === 1 && !isDirectoryUpload) {
        const fileData = await dataFiles[0].arrayBuffer();
        fileToEncrypt = new Uint8Array(fileData);
        outputFileName = dataFiles[0].name;
      } else {
        const zip = new JSZip();

        for (const file of dataFiles) {
          const fileData = await file.arrayBuffer();
          const relativePath =
            file.webkitRelativePath && file.webkitRelativePath.trim() !== ""
              ? file.webkitRelativePath
              : file.name;
          zip.file(relativePath, fileData);
        }

        // If uploading a directory, use the top folder name
        if (isDirectoryUpload) {
          const firstFileRelPath = dataFiles[0].webkitRelativePath;
          const folderName = firstFileRelPath.split("/")[0];
          outputFileName = `${folderName}.zip`;
        } else {
          // If multiple files are uploaded that aren't a directory set output file name to archive.zip
          outputFileName = "archive.zip";
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipArrayBuffer = await zipBlob.arrayBuffer();
        fileToEncrypt = new Uint8Array(zipArrayBuffer);
      }

      const recipientKeysList = recipientKeys || [];
      const recipientsList = recipients || [];

      // Find the recipient keys (public keys of the selected recipients)
      const recipientKeysPublic = recipientKeysList
        .filter((key) =>
          recipientsList.some(
            (r) => typeof r === "object" && r.keyId === key.id.toString()
          )
        )
        .map((key) => key.publicKey);

      // If neither recipients nor a password is provided, then sign the file only.
      if (recipientKeysPublic.length === 0 && !isChecked) {
        if (decryptedPrivateKey) {
          const signingKey = await openpgp.readPrivateKey({
            armoredKey: decryptedPrivateKey,
          });
          const messageToSign = await openpgp.createMessage({
            binary: fileToEncrypt,
          });
          const signedFile = (await openpgp.sign({
            message: messageToSign,
            signingKeys: signingKey,
            format: "binary",
          })) as Uint8Array;

          sendResponse({
            type: "downloadFile",
            payload: {
              fileName: `${outputFileName}.sig`,
              encrypted: signedFile,
            },
          });
        } else {
          sendResponse({
            type: "addToast",
            payload: {
              title:
                "Please provide a signing key, select at least one recipient, or enter a password",
              color: "danger",
            },
          });
        }
        return;
      }

      const encryptionKeys =
        recipientKeysPublic.length > 0
          ? await Promise.all(
              recipientKeysPublic.map((key) =>
                openpgp.readKey({ armoredKey: key })
              )
            )
          : undefined;

      const passwords =
        isChecked && encryptionPassword ? [encryptionPassword] : undefined;

      let signingKey: openpgp.PrivateKey | undefined;
      if (decryptedPrivateKey) {
        signingKey = await openpgp.readPrivateKey({
          armoredKey: decryptedPrivateKey,
        });
      }

      const encrypted = (await openpgp.encrypt({
        message: await openpgp.createMessage({ binary: fileToEncrypt }),
        encryptionKeys,
        passwords,
        signingKeys: signingKey,
        format: "binary",
      })) as Uint8Array;

      sendResponse({
        type: "downloadFile",
        payload: { fileName: `${outputFileName}.gpg`, encrypted },
      });
    } catch {
      sendResponse({
        type: "addToast",
        payload: { title: "Please Enter a Password", color: "danger" },
      });
    }
  }
}

if (typeof self !== "undefined") {
  self.onmessage = handleEncryptWorkerMessage;
}
