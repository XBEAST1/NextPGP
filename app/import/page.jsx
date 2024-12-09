"use client"

import { useState } from "react";
import { Textarea, Button, Input } from "@nextui-org/react";
import * as openpgp from "openpgp";

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

  const importKey = async (keyArmored) => {
    try {
      const importedKey = await openpgp.readKey({ armoredKey: keyArmored });

      const userIds = importedKey.users.map((user) => {
        const userId = user.userID;
        return {
          name: userId?.name || "N/A",
          email: userId?.email || "N/A",
        };
      });

      const keyId = Date.now();

      const publicKeyArmored = importedKey.armor();

      const keyData = {
        id: keyId,
        name: userIds[0]?.name || "N/A",
        email: userIds[0]?.email || "N/A",
        privateKey: keyArmored,
        publicKey: publicKeyArmored,
      };

      saveKeyToLocalStorage(keyData);

      return { success: true, userIds };
    } catch (error) {
      console.error("Error importing key:", error);
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
    setResult(response);
  };

  return (
    <>
      <h1 className="text-center text-4xl dm-serif-text-regular">
        Import Key
      </h1>
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