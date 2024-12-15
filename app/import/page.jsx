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

      if (!publicKey && !privateKey) {
        toast.error("No valid PGP key block found.", {
          position: "top-right",
        });
        return;
      }

      const key = await openpgp.readKey({
        armoredKey: privateKey || publicKey,
      });

      console.log(key);

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

        // Extract the part before the < and ignore the email part
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

      if (checkIfKeyExists(keyData)) {
        toast.error("Key already exists.", {
          position: "top-right",
        });
        return;
      }

      saveKeyToLocalStorage(keyData);

      toast.success(
        isPrivateKey ? "Keyring Imported." : "Public key imported.",
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
    try {
      await importKey(keyInput);
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
    </>
  );
}
