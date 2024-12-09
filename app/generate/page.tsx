"use client";

import { useState } from "react";
import { Button } from "@nextui-org/react";
import { DatePicker } from "@nextui-org/react";
import { Input } from "@nextui-org/react";
import { Checkbox } from "@nextui-org/react";
import * as openpgp from "openpgp";

interface PgpKeyData {
  id: number;
  name: string;
  email: string;
  publicKey: string;
  privateKey: string;
  expiryDate?: string;
}

export default function App() {
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [isPasswordChecked, setIsPasswordChecked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState<string | undefined>(undefined);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);

  const getStoredKeys = (): PgpKeyData[] => {
    const keys = localStorage.getItem("pgpKeys");
    return keys ? JSON.parse(keys) : [];
  };

  const saveKeyToLocalStorage = (keyData: PgpKeyData): void => {
    const existingKeys = getStoredKeys();
    existingKeys.push(keyData);
    localStorage.setItem("pgpKeys", JSON.stringify(existingKeys));
  };

  const getNextKeyIndex = (): number => {
    const keys = getStoredKeys();
    return keys.length + 1;
  };

  const generatePGPKey = async () => {
    setNameInvalid(false);
    setEmailInvalid(false);

    if (!name.trim()) {
      setNameInvalid(true);
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailInvalid(true);
    }

    if (
      !name.trim() ||
      !email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return;
    }

    try {
      const passphraseToUse =
        isPasswordChecked && passphrase ? passphrase : undefined;

      const expiry = !isNoExpiryChecked && expiryDate ? expiryDate : undefined;

      const options: openpgp.GenerateKeyOptions & { format?: "armored" } = {
        type: "rsa",
        rsaBits: 2048,
        userIDs: [{ name, email }],
        passphrase: passphraseToUse,
        format: "armored",
        date: expiry ? new Date(expiry) : undefined,
      };

      const key = await openpgp.generateKey(options);
      const { privateKey, publicKey } = key;

      const keyData: PgpKeyData = {
        id: Date.now(),
        name,
        email,
        publicKey,
        privateKey,
      };

      saveKeyToLocalStorage(keyData);

      alert(
        `PGP Key pair for ${name} <${email}> generated and saved to local storage!`
      );

      console.log(`PGP Key pair for ${name} <${email}>:`);
      console.log("Name:", name);
      console.log("Email:", email);
      console.log("Public Key:", publicKey);
      console.log("Private Key:", privateKey);
    } catch (error) {
      console.error("Error generating PGP key pair:", error);
      alert("Failed to generate PGP keys.");
    }
  };

  return (
    <>
      <h1 className="text-center text-4xl dm-serif-text-regular">
        Generate Keyring
      </h1>

      <br />

      <Input
        isRequired
        label="Name"
        labelPlacement="outside"
        placeholder="Enter your name"
        isInvalid={nameInvalid}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <br />

      <Input
        isRequired
        label="Email"
        labelPlacement="outside"
        placeholder="Enter your email"
        isInvalid={emailInvalid}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />

      <Checkbox
        defaultSelected={isNoExpiryChecked}
        color="default"
        onChange={(e) => setIsNoExpiryChecked(e.target.checked)}
      >
        No Expiry
      </Checkbox>
      <br />
      <br />

      <DatePicker
        isDisabled={isNoExpiryChecked}
        className="max-w-[284px]"
        label="Expiry date"
      />
      <br />

      <Checkbox
        defaultSelected={isPasswordChecked}
        color="default"
        onChange={(e) => {
          setIsPasswordChecked(e.target.checked);
          if (!e.target.checked) setPassphrase("");
        }}
      >
        Use Password
      </Checkbox>
      <br />
      <br />

      <Input
        isDisabled={!isPasswordChecked}
        name="password"
        placeholder="Enter your password"
        type="password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />

      <br />
      <Button size="md" onClick={generatePGPKey}>
        Generate Key
      </Button>
    </>
  );
}
