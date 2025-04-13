"use client";

import { React, useState, useEffect, useRef } from "react";
import {
  Textarea,
  Checkbox,
  Input,
  Autocomplete,
  AutocompleteItem,
  Button,
  Modal,
  ModalContent,
  Snippet,
} from "@heroui/react";
import { toast, ToastContainer } from "react-toastify";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function App() {
  const [pgpKeys, setPgpKeys] = useState([]);
  const [signerKeys, setSignerKeys] = useState([]);
  const [signerKey, setSignerKey] = useState(null);
  const [recipientKeys, setRecipientKeys] = useState([]);
  const [isChecked, setIsChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [recipients, setRecipients] = useState([""]);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [output, setOutput] = useState("");
  const [modalpassword, setModalpassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const onSubmitPassword = useRef(null);
  const [files, setFiles] = useState(null);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const dbName = "NextPGP";
  const dbPgpKeys = "pgpKeys";
  const selectedSigners = "selectedSigners";
  const selectedRecipients = "selectedRecipients";
  const dbCryptoKeys = "cryptoKeys";

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(dbPgpKeys)) {
          db.createObjectStore(dbPgpKeys, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(selectedSigners)) {
          db.createObjectStore(selectedSigners, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(selectedRecipients)) {
          db.createObjectStore(selectedRecipients, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(dbCryptoKeys)) {
          db.createObjectStore(dbCryptoKeys, { keyPath: "id" });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  };

  // Retrieves (or generates) the master encryption key using the Web Crypto API.
  const getEncryptionKey = async () => {
    const db = await openDB();
    const tx = db.transaction(dbCryptoKeys, "readonly");
    const store = tx.objectStore(dbCryptoKeys);
    const request = store.get("mainKey");

    return new Promise(async (resolve, reject) => {
      request.onsuccess = async () => {
        if (request.result) {
          const importedKey = await crypto.subtle.importKey(
            "raw",
            request.result.key,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
          );
          resolve(importedKey);
        } else {
          // Generate a new key if not found
          const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
          );
          const exportedKey = await crypto.subtle.exportKey("raw", key);
          const txWrite = db.transaction(dbCryptoKeys, "readwrite");
          const storeWrite = txWrite.objectStore(dbCryptoKeys);
          storeWrite.put({ id: "mainKey", key: new Uint8Array(exportedKey) });
          resolve(key);
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  };

  // Decrypts data using the provided encryption key and IV.
  const decryptData = async (encryptedData, key, iv) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  };

  // Retrieves all stored keys from IndexedDB and decrypts them.
  const getStoredKeys = async () => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readonly");
      const store = transaction.objectStore(dbPgpKeys);
      const records = [];
      const request = store.openCursor();

      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          records.push(cursor.value);
          cursor.continue();
        } else {
          try {
            const decryptedKeys = await Promise.all(
              records.map(async (record) => {
                const decrypted = await decryptData(
                  record.encrypted,
                  encryptionKey,
                  record.iv
                );
                return decrypted;
              })
            );
            resolve(decryptedKeys);
          } catch (error) {
            reject(error);
          }
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  };

  useEffect(() => {
    const fetchKeysFromIndexedDB = async () => {
      try {
        const keysFromStorage = await getStoredKeys();

        const filteredSignerKeys = keysFromStorage.filter(
          (key) => key.publicKey && key.privateKey
        );
        const filteredRecipientKeys = keysFromStorage.filter(
          (key) => key.publicKey
        );

        setPgpKeys(keysFromStorage);
        setSignerKeys(filteredSignerKeys);
        setRecipientKeys(filteredRecipientKeys);
      } catch (error) {
        console.error("Error fetching keys:", error);
      }
    };

    fetchKeysFromIndexedDB();
  }, []);

  useEffect(() => {
    const fetchSelectedKeys = async () => {
      const db = await openDB();
      const transaction = db.transaction(
        [selectedRecipients, selectedSigners],
        "readwrite"
      );
      const storeSigners = transaction.objectStore(selectedSigners);
      const storeRecipients = transaction.objectStore(selectedRecipients);

      const signerKeyRequest = storeSigners.get("selectedSignerKey");
      const recipientsRequest = storeRecipients.get("selectedRecipients");

      signerKeyRequest.onsuccess = () => {
        if (signerKeyRequest.result) {
          setSignerKey(signerKeyRequest.result.value);
        }
      };

      recipientsRequest.onsuccess = () => {
        if (recipientsRequest.result) {
          setRecipients(recipientsRequest.result.value || [""]);
        }
      };
    };

    fetchSelectedKeys();
  }, []);

  const handleSignerSelection = async (selectedKey) => {
    const db = await openDB();
    const transaction = db.transaction(
      [dbPgpKeys, selectedSigners],
      "readwrite"
    );
    const store = transaction.objectStore(selectedSigners);

    store.put({ id: "selectedSignerKey", value: selectedKey });

    transaction.oncomplete = () => {
      setSignerKey(selectedKey);
    };
  };

  const handleSelection = async (index, selectedKey) => {
    const updatedRecipients = [...recipients];

    if (selectedKey) {
      updatedRecipients[index] = selectedKey;
      if (updatedRecipients[updatedRecipients.length - 1] !== "") {
        updatedRecipients.push("");
      }
    } else {
      updatedRecipients[index] = "";
      while (
        updatedRecipients.length > 1 &&
        updatedRecipients[updatedRecipients.length - 2] === "" &&
        updatedRecipients[updatedRecipients.length - 1] === ""
      ) {
        updatedRecipients.pop();
      }
    }

    setRecipients(updatedRecipients);

    const db = await openDB();
    const transaction = db.transaction(
      [dbPgpKeys, selectedRecipients],
      "readwrite"
    );
    const store = transaction.objectStore(selectedRecipients);

    store.put({ id: "selectedRecipients", value: updatedRecipients });
  };

  const encryptMessage = async () => {
    try {
      // If the message is empty then don't push anything to output
      if (!message.trim()) {
        return;
      }
      const recipientKeysPublic = recipientKeys
        .filter((key) => recipients.includes(key.id.toString()))
        .map((key) => key.publicKey);

      // Find the selected signer
      const signer = signerKeys.find((key) => key.id.toString() === signerKey);

      if (!isChecked && recipientKeysPublic.length === 0) {
        toast.error(
          "Please select at least one recipient or provide a password",
          {
            position: "top-right",
          }
        );
        return;
      }

      let privateKey = null;
      if (signer) {
        const privateKeyObject = await openpgp.readPrivateKey({
          armoredKey: signer.privateKey,
        });

        // Check if the private key is encrypted
        if (!privateKeyObject.isDecrypted()) {
          setIsPasswordModalOpen(true);

          // Wait for the passphrase from the modal
          const passphrase = await new Promise((resolve) => {
            onSubmitPassword.current = resolve;
          });

          // Decrypt the private key
          privateKey = await openpgp.decryptKey({
            privateKey: privateKeyObject,
            passphrase: passphrase,
          });

          if (!privateKey || !privateKey.isDecrypted()) {
            throw new Error("Failed to decrypt the private key");
          }
        } else {
          privateKey = privateKeyObject;
        }
      }

      const messageToEncrypt = await openpgp.createMessage({ text: message });

      const encryptionOptions = {
        message: messageToEncrypt,
        ...(isChecked && password && { passwords: [password] }),
        ...(recipientKeysPublic.length > 0 && {
          encryptionKeys: await Promise.all(
            recipientKeysPublic.map((key) =>
              openpgp.readKey({ armoredKey: key })
            )
          ),
        }),
        ...(privateKey && { signingKeys: privateKey }),
      };

      // Encrypt the message
      const encryptedMessage = await openpgp.encrypt(encryptionOptions);
      setOutput(encryptedMessage);
    } catch (error) {
      toast.error("Please Enter a Password", {
        position: "top-right",
      });
    }
  };

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const encryptFiles = async () => {
    if (!files || files.length === 0) {
      return;
    }

    try {
      let fileToEncrypt;

      // Check if it's a single file or multiple files
      if (files.length === 1) {
        const fileData = await files[0].arrayBuffer();
        fileToEncrypt = new Uint8Array(fileData);
      } else {
        const zip = new JSZip();

        for (const file of files) {
          const fileData = await file.arrayBuffer();
          zip.file(file.name, fileData);
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipArrayBuffer = await zipBlob.arrayBuffer();
        fileToEncrypt = new Uint8Array(zipArrayBuffer);
      }

      // Find the recipient keys (public keys of the selected recipients)
      const recipientKeysPublic = recipientKeys
        .filter((key) => recipients.includes(key.id.toString()))
        .map((key) => key.publicKey);

      // Validation for empty recipients and password
      if (recipientKeysPublic.length === 0 && !password) {
        toast.error(
          "Please select at least one recipient or provide a password"
        );
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
      if (recipientKeysPublic.length === 0 && password) {
        encryptionOptions.passwords = [password];
      }

      // If both recipients and password are selected, include both in encryption
      if (recipientKeysPublic.length > 0 && password) {
        encryptionOptions.passwords = [password];
      }

      // Find the selected signer and decrypt their private key if needed
      let privateKey = null;
      const signer = signerKeys.find((key) => key.id.toString() === signerKey);

      if (signer) {
        const privateKeyObject = await openpgp.readPrivateKey({
          armoredKey: signer.privateKey,
        });

        if (!privateKeyObject.isDecrypted()) {
          setIsPasswordModalOpen(true);

          const passphrase = await new Promise((resolve) => {
            onSubmitPassword.current = resolve;
          });

          // Decrypt the private key
          privateKey = await openpgp.decryptKey({
            privateKey: privateKeyObject,
            passphrase: passphrase,
          });

          if (!privateKey || !privateKey.isDecrypted()) {
            throw new Error("Failed to decrypt the private key");
          }
        } else {
          privateKey = privateKeyObject;
        }

        if (privateKey) {
          encryptionOptions.signingKeys = privateKey;
        }
      }

      const encrypted = await openpgp.encrypt({
        ...encryptionOptions,
        format: "binary",
      });

      // Convert encrypted content to Blob and download
      const encryptedBlob = new Blob([encrypted], {
        type: "application/octet-stream",
      });
      const fileName = files.length === 1 ? files[0].name : "archive.zip";
      saveAs(encryptedBlob, `${fileName}.gpg`);
    } catch (error) {
      toast.error("Password Incorrect");
    }
  };

  const handleEncrypt = async () => {
    if (message || files) {
      await encryptMessage();
      await encryptFiles();
    } else {
      toast.error("Please Enter a Message or Select a File", {
        position: "top-right",
      });
    }
  };

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">
        Encrypt Message
      </h1>
      <br />
      <br />
      <div className="flex flex-row gap-0 flex-wrap md:gap-4">
        <div className="flex-1 mb-4 md:mb-0">
          <Textarea
            disableAutosize
            classNames={{
              input: "resize-y xs:min-w-[350px] min-w-[0px]",
            }}
            style={{
              minHeight: `${235 + recipients.length * 70}px`,
            }}
            label="Encrypt"
            placeholder="Enter your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <br />
        <div className="w-full md:w-[350px]">
          <div className="flex flex-col gap-4">
            <h5 className="ms-1">Sign as:</h5>
            <Autocomplete
              className="max-w-full"
              label="Select the signer"
              allowsCustomValue={false}
              selectedKey={signerKey}
              defaultItems={signerKeys}
              onSelectionChange={handleSignerSelection}
            >
              {(item) => (
                <AutocompleteItem
                  key={item.id}
                  textValue={`${item.name} (${item.email})`}
                >
                  {item.name} ({item.email})
                </AutocompleteItem>
              )}
            </Autocomplete>
          </div>
          <div className="flex flex-col gap-4">
            <h5 className="mt-4 ms-1">Encrypt for:</h5>
            {recipients.map((selectedKey, index) => (
              <Autocomplete
                key={index}
                className="max-w-full"
                label={`Select recipient ${index + 1}`}
                selectedKey={selectedKey}
                onSelectionChange={(key) => handleSelection(index, key)}
                defaultItems={recipientKeys.filter(
                  (key) =>
                    !recipients.includes(String(key.id)) ||
                    String(key.id) === selectedKey
                )}
              >
                {(item) => (
                  <AutocompleteItem
                    key={item.id}
                    textValue={`${item.name} (${item.email})`}
                  >
                    {item.name} ({item.email})
                  </AutocompleteItem>
                )}
              </Autocomplete>
            ))}
          </div>
          <br />
          <Checkbox
            defaultSelected={isChecked}
            color="default"
            onChange={(e) => setIsChecked(e.target.checked)}
          >
            <span className="text-medium">Encrypt With Password.</span>
            <p className="text-sm">
              Anyone you share the password with can read it.
            </p>
          </Checkbox>
          <br />
          <br />
          <Input
            isDisabled={!isChecked}
            classNames={{
              input: "min-h-[10px]",
            }}
            placeholder="Enter your password"
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          />
        </div>
      </div>
      <br />
      <Input type="file" multiple onChange={handleFileUpload} />
      <br />
      <h5 className="ms-1">Encrypted PGP Message:</h5>
      <br />
      <Snippet
        symbol=""
        classNames={{
          base: "max-w-full p-5 overflow-auto",
          content: "whitespace-pre-wrap break-all",
          pre: "whitespace-pre-wrap break-all max-h-[300px] overflow-auto",
        }}
      >
        {output}
      </Snippet>
      <br />
      <br />
      <Button onPress={handleEncrypt}>Encrypt</Button>
      <Modal
        backdrop="blur"
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-4">Signing Key Password Protected</h3>
          <Input
            placeholder="Enter Password"
            type={isVisible ? "text" : "password"}
            value={modalpassword}
            onChange={(e) => setModalpassword(e.target.value)}
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Simulate the button click on Enter key press
                if (modalpassword) {
                  setIsPasswordModalOpen(false);
                  if (onSubmitPassword.current) {
                    onSubmitPassword.current(modalpassword);
                  }
                } else {
                  toast.error("Please enter a password");
                }
              }
            }}
          />
          <br />
          <Button
            onPress={() => {
              if (modalpassword) {
                setIsPasswordModalOpen(false);
                if (onSubmitPassword.current) {
                  onSubmitPassword.current(modalpassword);
                }
              } else {
                toast.error("Please enter a password");
              }
            }}
          >
            Submit
          </Button>
        </ModalContent>
      </Modal>
    </>
  );
}
