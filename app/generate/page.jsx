"use client";

import { useState, useEffect } from "react";
import {
  Button,
  DatePicker,
  Input,
  Checkbox,
  Autocomplete,
  AutocompleteItem,
} from "@heroui/react";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  openDB,
  getEncryptionKey,
  encryptData,
  dbPgpKeys,
} from "@/lib/indexeddb";
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
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("curve25519");

  const keyalgorithms = [
    {
      label: "Curve25519 (EdDSA/ECDH) - Recommended",
      key: "curve25519",
    },
    {
      label: "NIST P-256 (ECDSA/ECDH)",
      key: "nistP256",
    },
    {
      label: "NIST P-521 (ECDSA/ECDH)",
      key: "nistP521",
    },
    {
      label: "Brainpool P-256r1 (ECDSA/ECDH)",
      key: "brainpoolP256r1",
    },
    {
      label: "Brainpool P-512r1 (ECDSA/ECDH)",
      key: "brainpoolP512r1",
    },
    {
      label: "RSA 2048",
      key: "rsa2048",
    },
    {
      label: "RSA 3072",
      key: "rsa3072",
    },
    {
      label: "RSA 4096",
      key: "rsa4096",
    },
  ];

  useEffect(() => {
    openDB();
  }, []);

  // Save Encrypted PGP Key to IndexedDB
  const saveKeyToIndexedDB = async (id, keyData) => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();
    const { encrypted, iv } = await encryptData(keyData, encryptionKey);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readwrite");
      const store = transaction.objectStore(dbPgpKeys);
      store.put({ id, encrypted, iv });

      transaction.oncomplete = () => resolve();
      transaction.onerror = (e) => reject(e.target.error);
    });
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
          toast.error("The expiry date must be in the future", {
            position: "top-right",
          });
          return;
        }
      }

      let options;
      if (selectedAlgorithm.startsWith("rsa")) {
        options = {
          type: "rsa",
          rsaBits: parseInt(selectedAlgorithm.replace("rsa", "")),
          userIDs: [{ name, email: validEmail }],
          passphrase: passphraseToUse,
          format: "armored",
          keyExpirationTime: keyExpirationTime,
        };
      } else {
        options = {
          type: "ecc",
          curve: selectedAlgorithm,
          userIDs: [{ name, email: validEmail }],
          passphrase: passphraseToUse,
          format: "armored",
          keyExpirationTime: keyExpirationTime,
        };
      }

      const key = await openpgp.generateKey(options);
      const { privateKey, publicKey } = key;

      const keyData = {
        id: Date.now(),
        name,
        email: validEmail || "N/A",
        publicKey,
        privateKey,
      };

      // Save the encrypted key data
      await saveKeyToIndexedDB(keyData.id, keyData);

      toast.success("PGP Keyring Generated", {
        position: "top-right",
      });
    } catch (error) {
      toast.error("Failed to generate PGP Keyring", {
        position: "top-right",
      });
      console.log(error);
    }
  };

  const [isVisible, setIsVisible] = useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  return (
    <>
      <ToastContainer theme="dark" />
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

      <Autocomplete
        className="max-w-md"
        defaultItems={keyalgorithms}
        defaultSelectedKey="curve25519"
        label="Select Key Algorithm"
        onSelectionChange={(selectedItem) => {
          const selectedKey =
            typeof selectedItem === "object" && selectedItem !== null
              ? selectedItem.key
              : selectedItem;
          if (selectedKey) {
            setSelectedAlgorithm(selectedKey);
          }
        }}
      >
        {(item) => (
          <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>
        )}
      </Autocomplete>

      <br />
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
        type={isVisible ? "text" : "password"}
        endContent={
          <button
            aria-label="toggle password visibility"
            className="focus:outline-none"
            type="button"
            onClick={toggleVisibility}
          >
            {isVisible ? (
              <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
            ) : (
              <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
            )}
          </button>
        }
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />

      <br />
      <Button size="md" onPress={generatePGPKey}>
        Generate Key
      </Button>
    </>
  );
}
