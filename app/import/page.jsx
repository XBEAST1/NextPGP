"use client";

import { useState, useEffect } from "react";
import {
  openDB,
  getStoredKeys,
  saveKeyToIndexedDB,
} from "@/lib/indexeddb";
import { Textarea, Button, Input, addToast } from "@heroui/react";
import KeyServer from "@/components/keyserver";
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
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    openDB();
  }, []);

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
        addToast({
          title: "No valid PGP key block found",
          color: "danger",
        });
        return;
      }

      const key = await openpgp.readKey({
        armoredKey: privateKey || publicKey,
      });

      if (!key || !key.getUserIDs || key.getUserIDs().length === 0) {
        addToast({
          title: "The PGP key is Corrupted",
          color: "danger",
        });
        return;
      }

      const isPrivateKey = privateKey !== null;

      let keyData = {
        id: Date.now(),
        publicKey: publicKey,
        privateKey: privateKey,
      };

      let keyname = key.getUserIDs()[0]?.split("<")[0].trim() || "Unknown User";

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
        addToast({
          title: `${keyname}'s Key already exists`,
          color: "primary",
        });
        return;
      }

      saveKeyToIndexedDB(keyData);

      addToast({
        title: isPrivateKey
          ? `${keyname}'s Keyring Imported`
          : `${keyname}'s Public key imported`,
        color: "success",
      });
    } catch (error) {
      addToast({
        title: `Failed to import key: ${error.message}`,
        color: "danger",
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
      addToast({
        title: `An error occurred: ${error.message}`,
        color: "danger",
      });
    }
  };

  return (
    <>
      <h1 className="text-center text-4xl dm-serif-text-regular">Import Key</h1>
      <br />
      <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full">
        <Input
          className="w-full sm:w-1/2"
          multiple
          type="file"
          accept=".asc,.txt,.key"
          onChange={handleFileInput}
        />

        <span className="text-center text-sm text-gray-300 sm:mt-3">Or</span>

        <Button
          className="w-full sm:w-1/2 border-0"
          variant="faded"
          onPress={() => setIsModalOpen(true)}
        >
          Import From Keyserver
        </Button>

        <KeyServer isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>

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
