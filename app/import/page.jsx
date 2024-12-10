"use client";

import { useState } from "react";
import { Textarea, Button, Input } from "@nextui-org/react";
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
  const [result, setResult] = useState(null);

  const getStoredKeys = () => {
    const keys = localStorage.getItem("pgpKeys");
    return keys ? JSON.parse(keys) : [];
  };

  const saveKeyToLocalStorage = (keyData) => {
    const existingKeys = getStoredKeys();
    existingKeys.push(keyData);
    localStorage.setItem("pgpKeys", JSON.stringify(existingKeys));
  };

  const checkIfKeyExists = (newKeyData) => {
    const existingKeys = getStoredKeys();
    return existingKeys.some(
      (key) =>
        key.name === newKeyData.name &&
        key.email === newKeyData.email &&
        key.privateKey === newKeyData.privateKey
    );
  };

  // Function To Import the PGP key and handle key extraction and storage
  const importKey = async (keyArmored) => {
    try {
      const { publicKey, privateKey } = extractPGPKeys(keyArmored);

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
        return {
          name: userId?.name || "N/A",
          email: userId?.email || "N/A",
        };
      });

      // Assign the extracted name and email from the key user IDs
      if (userIds.length > 0) {
        keyData.name = userIds[0]?.name;
        keyData.email = userIds[0]?.email;
      }

      if (isPrivateKey) {
        keyData.privateKey = keyArmored;

        // Generate public key if missing
        const publicKey = key.toPublic().armor();
        keyData.publicKey = publicKey;
      } else {
        keyData.publicKey = keyArmored;
      }

      // Check if the key already exists
      if (checkIfKeyExists(keyData)) {
        return { success: false };
      }

      saveKeyToLocalStorage(keyData);

      return {
        success: true,
        details: isPrivateKey ? "Private key with public key" : "Public key",
      };
    } catch (error) {
      return { success: false, error: error.message };
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
    const response = await importKey(keyInput);

    if (response.success) {
      toast.success(response.message || "Key imported successfully.", {
        position: "top-right",
      });
    } else if (response.success === false) {
      toast.error("Key already exists.", {
        position: "top-right",
      });
    } else {
      toast.error(`Failed to import key: ${response.error}`, {
        position: "top-right",
      });
    }

    setResult(response);
  };

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">Import Key</h1>
      <br />
      <Input
        type="file"
        accept=".asc,.txt,.key"
        onChange={handleFileInput}
        label="Upload PGP Key File"
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
      <Button size="md" onClick={handleImport}>
        Import Key
      </Button>
      {result && (
        <div>
          <p>{result.message}</p>
          {result.error && <p className="text-red-500">{result.error}</p>}
        </div>
      )}
    </>
  );
}
