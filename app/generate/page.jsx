"use client";

import { useState } from "react";
import { Button } from "@nextui-org/react";
import { DatePicker } from "@nextui-org/react";
import { Input } from "@nextui-org/react";
import { Checkbox } from "@nextui-org/react";
import * as openpgp from "openpgp";

export default function App() {
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [isPasswordChecked, setIsPasswordChecked] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [expiryDate, setExpiryDate] = useState(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);

  const getStoredKeys = () => {
    const keys = localStorage.getItem("pgpKeys");
    return keys ? JSON.parse(keys) : [];
  };

  const saveKeyToLocalStorage = (keyData) => {
    const existingKeys = getStoredKeys();
    existingKeys.push(keyData);
    localStorage.setItem("pgpKeys", JSON.stringify(existingKeys));
  };

  const generatePGPKey = async () => {
    setNameInvalid(false);
    setEmailInvalid(false);

    if (!name.trim()) {
      setNameInvalid(true);
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailInvalid(true);
      return;
    }

    const validEmail = email.trim() ? email : "";

    if (!name.trim()) {
      return;
    }

    try {
      const passphraseToUse =
        isPasswordChecked && passphrase ? passphrase : undefined;

      let keyExpirationTime = undefined;
      if (!isNoExpiryChecked && expiryDate) {
        const now = new Date();
        const expiry = new Date(expiryDate);
        keyExpirationTime = Math.floor((expiry - now) / 1000);
        if (keyExpirationTime <= 0) {
          alert("The expiry date must be in the future.");
          return;
        }
      }

      const options = {
        type: "ecc",
        curve: "ed25519",
        userIDs: [{ name, email: validEmail }],
        passphrase: passphraseToUse,
        format: "armored",
        keyExpirationTime: keyExpirationTime,
      };

      const key = await openpgp.generateKey(options);
      const { privateKey, publicKey } = key;

      const keyData = {
        id: Date.now(),
        name,
        email: validEmail,
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
        disableAnimation
        isDisabled={isNoExpiryChecked}
        className="max-w-[284px]"
        label="Expiry date"
        value={expiryDate}
        onChange={(date) => setExpiryDate(date)}
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
