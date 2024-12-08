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
  const [nameInvalid, setNameInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);

  const getNextKeyIndex = () => {
    let index = 1;
    while (localStorage.getItem(`pgp_public_key_${index}`)) {
      index++;
    }
    return index;
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

      const options: openpgp.GenerateKeyOptions & { format?: "armored" } = {
        type: "rsa",
        rsaBits: 2048,
        userIDs: [{ name, email }],
        passphrase: passphraseToUse,
        format: "armored",
      };

      const key = await openpgp.generateKey(options);
      const { privateKey, publicKey } = key;

      const keyIndex = getNextKeyIndex();

      localStorage.setItem(`pgp_public_key_${keyIndex}`, publicKey);
      localStorage.setItem(`pgp_private_key_${keyIndex}`, privateKey);

      alert(`PGP Key pair #${keyIndex} generated and saved to local storage!`);

      console.log(`PGP Key pair #${keyIndex}:`);
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
