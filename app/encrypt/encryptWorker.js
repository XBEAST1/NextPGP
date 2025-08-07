"use client";

import * as openpgp from "openpgp";
import JSZip from "jszip";

onmessage = async function (e) {
  const {
    type,
    message,
    recipientKeys,
    recipients,
    isChecked,
    encryptionPassword,
    decryptedPrivateKey,
    files,
    directoryFiles,
  } = e.data;

  if (type === "messageEncrypt") {
    try {
      if (!message.trim()) {
        return;
      }
      const recipientKeysPublic = recipientKeys
        .filter((key) =>
          recipients.some(
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
            text: message,
          });
          const signedMessage = await openpgp.sign({
            message: cleartextMessage,
            signingKeys: signingKey,
          });
          postMessage({ type: "setEncryptedMessage", payload: signedMessage });
        } else {
          postMessage({
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
      let signingKey;

      if (decryptedPrivateKey) {
        // Reconstruct the decrypted key object from the armored string
        signingKey = await openpgp.readPrivateKey({
          armoredKey: decryptedPrivateKey,
        });
      }

      const messageToEncrypt = await openpgp.createMessage({ text: message });
      const encryptionOptions = {
        message: messageToEncrypt,
        ...(isChecked &&
          encryptionPassword && { passwords: [encryptionPassword] }),
        ...(recipientKeysPublic.length > 0 && {
          encryptionKeys: await Promise.all(
            recipientKeysPublic.map((key) =>
              openpgp.readKey({ armoredKey: key })
            )
          ),
        }),
        ...(signingKey && { signingKeys: signingKey }),
      };

      const encryptedMessage = await openpgp.encrypt(encryptionOptions);
      postMessage({ type: "setEncryptedMessage", payload: encryptedMessage });
    } catch {
      postMessage({
        type: "addToast",
        payload: { title: "Please Enter a Password", color: "danger" },
      });
    }
  }

  if (type === "fileEncrypt") {
    if ((!files && !directoryFiles) || (files && files.length === 0)) {
      return;
    }

    try {
      let fileToEncrypt;
      let outputFileName;
      const dataFiles = files ? files : directoryFiles;
      const isDirectoryUpload =
        dataFiles[0].webkitRelativePath &&
        dataFiles[0].webkitRelativePath.trim() !== "";

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

        // If uploading a directory, use the top folder name and ensure the name
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

      // Find the recipient keys (public keys of the selected recipients)
      const recipientKeysPublic = recipientKeys
        .filter((key) =>
          recipients.some(
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
          const signedFile = await openpgp.sign({
            message: messageToSign,
            signingKeys: signingKey,
            format: "binary",
          });
          postMessage({
            type: "downloadFile",
            payload: {
              fileName: `${outputFileName}.sig`,
              encrypted: signedFile,
            },
          });
        } else {
          postMessage({
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

      let encryptionOptions = {
        message: await openpgp.createMessage({ binary: fileToEncrypt }),
      };

      // If recipients are selected, encrypt with public keys
      if (recipientKeysPublic.length > 0) {
        encryptionOptions.encryptionKeys = await Promise.all(
          recipientKeysPublic.map((key) => openpgp.readKey({ armoredKey: key }))
        );
      }

      // If no recipients are selected but a password is provided, encrypt with the password
      if (recipientKeysPublic.length === 0 && encryptionPassword && isChecked) {
        encryptionOptions.passwords = [encryptionPassword];
      }

      // If both recipients and password are selected, include both in encryption
      if (recipientKeysPublic.length > 0 && encryptionPassword && isChecked) {
        encryptionOptions.passwords = [encryptionPassword];
      }

      let signingKey;
      if (decryptedPrivateKey) {
        signingKey = await openpgp.readPrivateKey({
          armoredKey: decryptedPrivateKey,
        });
      }
      if (signingKey) {
        encryptionOptions.signingKeys = signingKey;
      }

      const encrypted = await openpgp.encrypt({
        ...encryptionOptions,
        format: "binary",
      });

      postMessage({
        type: "downloadFile",
        payload: { fileName: `${outputFileName}.gpg`, encrypted: encrypted },
      });
    } catch {
      postMessage({
        type: "addToast",
        payload: { title: "Please Enter a Password", color: "danger" },
      });
    }
  }
};
