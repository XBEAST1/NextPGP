"use client";

import { useState, useEffect } from "react";
import { Textarea, Button, Input } from "@heroui/react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  openDB,
  getEncryptionKey,
  encryptData,
  getStoredKeys,
  dbPgpKeys,
} from "@/lib/indexeddb";
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
  const [fileContents, setFileContents] = useState([]);

  useEffect(() => {
    openDB();
  }, []);

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
        toast.error("No valid PGP key block found", {
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
        toast.info(`${keyData.name}'s Key already exists`, {
          position: "top-right",
        });
        return;
      }

      saveKeyToIndexedDB(keyData);

      toast.success(
        isPrivateKey
          ? `${keyData.name}'s Keyring Imported`
          : `${keyData.name}'s Public key imported`,
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
    const files = event.target.files;
    if (files) {
      const newContents = [];
      let processedFiles = 0;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newContents.push(e.target.result);
          processedFiles++;
          if (processedFiles === files.length) {
            setFileContents(newContents);
            if (files.length === 1) {
              setKeyInput(newContents[0]);
            }
          }
        };
        reader.readAsText(file);
      });
    }
  };

  const handleImport = async () => {
    try {
      let importedFromText = false;

      if (keyInput.trim()) {
        await importKey(keyInput);
        importedFromText = true;
      }

      for (const content of fileContents) {
        if (importedFromText && content.trim() === keyInput.trim()) {
          continue;
        }
        await importKey(content);
      }
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
      <Input
        multiple
        type="file"
        accept=".asc,.txt,.key"
        onChange={handleFileInput}
      />
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
