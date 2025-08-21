"use client";

import { React, useState, useEffect, useRef } from "react";
import {
  Textarea,
  Checkbox,
  addToast,
  Input,
  Autocomplete,
  AutocompleteItem,
  Button,
  Modal,
  ModalContent,
  Snippet,
  Spinner,
} from "@heroui/react";
import {
  openDB,
  getStoredKeys,
  dbPgpKeys,
  selectedSigners,
  selectedRecipients,
} from "@/lib/indexeddb";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import { saveAs } from "file-saver";
import * as openpgp from "openpgp";
import { workerPool } from "./workerPool";

export default function App() {
  const [pgpKeys, setPgpKeys] = useState([]);
  const [signerKeys, setSignerKeys] = useState([]);
  const [signerKey, setSignerKey] = useState(null);
  const [recipientKeys, setRecipientKeys] = useState([]);
  const [isChecked, setIsChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [recipients, setRecipients] = useState([""]);
  const [message, setMessage] = useState("");
  const [output, setOutput] = useState("");
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [keyPassphrase, setKeyPassphrase] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [files, setFiles] = useState(null);
  const [directoryFiles, setdirectoryFiles] = useState(null);
  const [isInputHovered, setisInputHovered] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const onSubmitPassword = useRef(null);
  const keyPassphraseInputRef = useRef(null);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const getSubkeyUsage = (subkey) => {
    const usage = [];
    for (const sig of subkey.bindingSignatures) {
      const flags = sig.keyFlags || sig.parsedKeyFlags || [];
      for (const f of flags) {
        if (f & openpgp.enums.keyFlags.signData) {
          usage.push("Signing");
        }
        if (
          f &
          (openpgp.enums.keyFlags.encryptCommunication |
            openpgp.enums.keyFlags.encryptStorage)
        ) {
          usage.push("Encryption");
        }
      }
    }
    return [...new Set(usage)];
  };

  useEffect(() => {
    openDB();

    const fetchKeysFromIndexedDB = async () => {
      try {
        const keysFromStorage = await getStoredKeys();

        const validKeys = await Promise.all(
          keysFromStorage.map(async (key) => {
            try {
              const publicKeyObj = await openpgp.readKey({
                armoredKey: key.publicKey,
              });

              // Check revocation and expiration
              const isRevoked = await publicKeyObj.isRevoked();
              const expirationTime = await publicKeyObj.getExpirationTime();
              const isExpired =
                expirationTime instanceof Date && expirationTime < new Date();

              // Skip keys that are revoked or expired
              if (isRevoked || isExpired) return null;

              const subkeys = publicKeyObj.getSubkeys();
              const allUsages = subkeys.flatMap(getSubkeyUsage);
              const canEncrypt = allUsages.includes("Encryption");

              const userIDs = publicKeyObj.getUserIDs();
              return { ...key, userIDs, canEncrypt };
            } catch (error) {
              console.error("Error checking key status:", error);
              return null;
            }
          })
        );

        const filteredKeys = validKeys.filter((key) => key !== null);

        const signerKeys = filteredKeys.filter(
          (key) => key.publicKey && key.privateKey
        );

        const recipientKeys = filteredKeys.filter(
          (key) => key.publicKey && key.canEncrypt
        );

        setPgpKeys(filteredKeys);
        setSignerKeys(signerKeys);
        setRecipientKeys(recipientKeys);
      } catch (err) {
        console.error("Error fetching keys:", err);
      }
    };

    fetchKeysFromIndexedDB();
  }, []);

  useEffect(() => {
    if (isPasswordModalOpen && keyPassphraseInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        keyPassphraseInputRef.current?.focus();
      }, 100);
    }
  }, [isPasswordModalOpen]);

  useEffect(() => {
    const fetchSelectedKeys = async () => {
      const db = await openDB();
      const tx = db.transaction(
        [selectedSigners, selectedRecipients],
        "readonly"
      );
      const storeSigners = tx.objectStore(selectedSigners);
      const signerKeyRequest = storeSigners.getAll();
      signerKeyRequest.onsuccess = () => {
        const results = signerKeyRequest.result;
        if (results && results.length > 0) {
          setSignerKey(results[0]);
        }
      };

      const storeRecipients = tx.objectStore(selectedRecipients);
      const recipientsRequest = storeRecipients.getAll();
      recipientsRequest.onsuccess = () => {
        const results = recipientsRequest.result;
        if (results && results.length > 0) {
          const values = results.map((r) => r.value);
          setRecipients([...values, ""]);
        } else {
          setRecipients([""]);
        }
      };
    };

    fetchSelectedKeys();
  }, []);

  useEffect(() => {
    const validKeyIds = new Set(pgpKeys.map((key) => key.id.toString()));

    // Remove the selected signer that is not in the pgpKeys
    if (
      signerKey &&
      !validKeyIds.has(
        typeof signerKey === "object" && signerKey.id
          ? signerKey.id.toString()
          : signerKey
      )
    ) {
      setSignerKey(null);
      (async () => {
        const db = await openDB();
        const transaction = db.transaction(
          [dbPgpKeys, selectedSigners],
          "readwrite"
        );
        const store = transaction.objectStore(selectedSigners);
        store.clear();
      })();
    }

    // Remove the selected recipients that are not in the pgpKeys
    const newRecipients = recipients.filter((r) => {
      if (r === "") return true;
      if (typeof r === "object" && r.keyId) {
        return validKeyIds.has(r.keyId);
      }
      return validKeyIds.has(r);
    });

    if (
      !newRecipients.length ||
      newRecipients[newRecipients.length - 1] !== ""
    ) {
      newRecipients.push("");
    }

    // If cleanup changed the list, update both state and IndexedDB
    if (JSON.stringify(newRecipients) !== JSON.stringify(recipients)) {
      setRecipients(newRecipients);
      (async () => {
        const db = await openDB();
        const tx = db.transaction([dbPgpKeys, selectedRecipients], "readwrite");
        const store = tx.objectStore(selectedRecipients);
        store.clear();
        newRecipients.forEach((key, idx) => {
          if (key !== "") {
            store.put({ id: `recipient-${idx}`, value: key });
          }
        });
      })();
    }
  }, [pgpKeys]);

  const handleSignerSelection = async (selectedItem) => {
    const db = await openDB();
    const transaction = db.transaction(
      [dbPgpKeys, selectedSigners],
      "readwrite"
    );
    const store = transaction.objectStore(selectedSigners);

    if (!selectedItem) {
      setSignerKey(null);
      store.clear();
      return;
    }

    let itemObj = selectedItem;
    if (typeof selectedItem === "string") {
      const defaultItems = signerKeys.flatMap((key) =>
        key.userIDs.map((uid) => ({ ...key, selectedUserId: uid }))
      );
      itemObj = defaultItems.find(
        (item) => `${item.id}-${item.selectedUserId}` === selectedItem
      );
    }

    if (!itemObj || !itemObj.id) {
      addToast({
        title: "Invalid signer selection",
        color: "danger",
      });
      return;
    }

    store.clear();

    const newSigner = {
      id: itemObj.id.toString(),
      selectedUserId: itemObj.selectedUserId,
    };

    store.put(newSigner);

    transaction.oncomplete = () => {
      setSignerKey(newSigner);
    };
  };

  const handleRecipientsSelection = async (index, selectedItem) => {
    if (!selectedItem) {
      let updatedRecipients = [...recipients];
      updatedRecipients[index] = "";

      while (
        updatedRecipients.length > 1 &&
        updatedRecipients[updatedRecipients.length - 2] === "" &&
        updatedRecipients[updatedRecipients.length - 1] === ""
      ) {
        updatedRecipients.pop();
      }
      if (updatedRecipients[updatedRecipients.length - 1] !== "") {
        updatedRecipients.push("");
      }
      setRecipients(updatedRecipients);

      const db = await openDB();
      const tx = db.transaction([dbPgpKeys, selectedRecipients], "readwrite");
      const store = tx.objectStore(selectedRecipients);
      store.clear();
      updatedRecipients.forEach((r, idx) => {
        if (r !== "") {
          store.put({ id: `recipient-${idx}`, value: r });
        }
      });
      return;
    }

    let itemObj = selectedItem;
    if (typeof selectedItem === "string") {
      const defaultItems = recipientKeys.flatMap((key) =>
        key.userIDs.map((uid) => ({ ...key, selectedUserId: uid }))
      );
      itemObj = defaultItems.find(
        (item) => `${item.id}-${item.selectedUserId}` === selectedItem
      );
    }

    if (!itemObj || !itemObj.id) {
      addToast({
        title: "Invalid recipient selection",
        color: "danger",
      });
      return;
    }

    const updatedRecipients = [...recipients];
    updatedRecipients[index] = {
      keyId: itemObj.id.toString(),
      userId: itemObj.selectedUserId,
    };

    if (updatedRecipients[updatedRecipients.length - 1] !== "") {
      updatedRecipients.push("");
    }
    setRecipients(updatedRecipients);

    const db = await openDB();
    const tx = db.transaction([dbPgpKeys, selectedRecipients], "readwrite");
    const store = tx.objectStore(selectedRecipients);
    store.clear();
    updatedRecipients.forEach((r, idx) => {
      if (r !== "") {
        store.put({ id: `recipient-${idx}`, value: r });
      }
    });
  };

  const getDecryptedPrivateKey = async () => {
    if (!signerKey) return null;
    const signer = signerKeys.find((key) => key.id.toString() === signerKey.id);
    if (!signer) {
      addToast({
        title: "Selected signer key not found",
        color: "danger",
      });
      return null;
    }
    const privateKeyObject = await openpgp.readPrivateKey({
      armoredKey: signer.privateKey,
    });
    if (privateKeyObject.isDecrypted()) {
      return privateKeyObject.armor();
    }
    let decryptedKey;
    while (!decryptedKey || !decryptedKey.isDecrypted()) {
      setIsPasswordModalOpen(true);
      const passphrase = await new Promise((resolve) => {
        onSubmitPassword.current = resolve;
      });
      try {
        decryptedKey = await openpgp.decryptKey({
          privateKey: privateKeyObject,
          passphrase,
        });
        if (!decryptedKey || !decryptedKey.isDecrypted()) {
          addToast({
            title: "Incorrect password",
            color: "danger",
          });
        }
      } catch {
        addToast({
          title: "Incorrect password",
          color: "danger",
        });
      }
    }
    setIsPasswordModalOpen(false);
    return decryptedKey.armor();
  };

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleDirectoryUpload = (event) => {
    const selectedDirectory = Array.from(event.target.files);
    setdirectoryFiles(selectedDirectory);
  };

  const handleEncrypt = async () => {
    setEncrypting(true);
    try {
      let decryptedPrivateKey = null;
      if (signerKey) {
        decryptedPrivateKey = await getDecryptedPrivateKey();
      }

      const tasks = [];

      const wrappedAddToast = (toast) => {
        setEncrypting(false);
        addToast(toast);
      };

      if (message) {
        const task = {
          type: "messageEncrypt",
          responseType: "setEncryptedMessage",
          message,
          recipientKeys,
          recipients,
          isChecked,
          encryptionPassword,
          decryptedPrivateKey,
        };
        tasks.push(
          workerPool(task, wrappedAddToast).then((encryptedMessage) => {
            setOutput(encryptedMessage);
          })
        );
      }

      if (files && files.length > 0) {
        const fileTask = {
          type: "fileEncrypt",
          responseType: "downloadFile",
          files,
          recipientKeys,
          recipients,
          isChecked,
          encryptionPassword,
          decryptedPrivateKey,
        };
        tasks.push(
          workerPool(fileTask, wrappedAddToast).then((result) => {
            const blob = new Blob([result.encrypted], {
              type: "application/octet-stream",
            });
            saveAs(blob, result.fileName);
          })
        );
      }

      if (directoryFiles && directoryFiles.length > 0) {
        const dirTask = {
          type: "fileEncrypt",
          responseType: "downloadFile",
          directoryFiles,
          recipientKeys,
          recipients,
          isChecked,
          encryptionPassword,
          decryptedPrivateKey,
          signerKey,
        };
        tasks.push(
          workerPool(dirTask, wrappedAddToast).then((result) => {
            const blob = new Blob([result.encrypted], {
              type: "application/octet-stream",
            });
            saveAs(blob, result.fileName);
          })
        );
      }

      if (
        !message &&
        !(files && files.length > 0) &&
        !(directoryFiles && directoryFiles.length > 0)
      ) {
        addToast({
          title: "Please enter a message or select a file",
          color: "danger",
        });
        setEncrypting(false);
        return;
      }

      await Promise.all(tasks);
    } catch (error) {
      console.error(error);
    }
    setEncrypting(false);
  };

  return (
    <>
      <h1 className="text-center text-4xl font-serif">Encrypt</h1>
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
              selectedKey={
                signerKey ? `${signerKey.id}-${signerKey.selectedUserId}` : ""
              }
              defaultItems={signerKeys.flatMap((key) =>
                key.userIDs.map((uid) => ({ ...key, selectedUserId: uid }))
              )}
              onSelectionChange={handleSignerSelection}
            >
              {(item) => (
                <AutocompleteItem
                  key={`${item.id}-${item.selectedUserId}`}
                  textValue={`${item.selectedUserId}`}
                >
                  {item.selectedUserId}
                </AutocompleteItem>
              )}
            </Autocomplete>
          </div>
          <div className="flex flex-col gap-4">
            <h5 className="mt-4 ms-1">Encrypt for:</h5>
            {recipients.map((selectedKey, index) => {
              // Build a list of composite keys already selected in other inputs.
              const alreadySelected = recipients
                .filter(
                  (r, i) =>
                    i !== index && typeof r === "object" && r.keyId && r.userId
                )
                .map((r) => `${r.keyId}-${r.userId}`);
              return (
                <Autocomplete
                  key={index}
                  className="max-w-full"
                  label={`Select recipient ${index + 1}`}
                  selectedKey={
                    typeof selectedKey === "object" && selectedKey
                      ? `${selectedKey.keyId}-${selectedKey.userId}`
                      : ""
                  }
                  onSelectionChange={(key) =>
                    handleRecipientsSelection(index, key)
                  }
                  defaultItems={recipientKeys
                    .flatMap((key) =>
                      key.userIDs.map((uid) => ({
                        ...key,
                        selectedUserId: uid,
                      }))
                    )
                    .filter((item) => {
                      const combo = `${item.id}-${item.selectedUserId}`;
                      return !alreadySelected.includes(combo);
                    })}
                >
                  {(item) => (
                    <AutocompleteItem
                      key={`${item.id}-${item.selectedUserId}`}
                      textValue={`${item.selectedUserId}`}
                    >
                      {item.selectedUserId}
                    </AutocompleteItem>
                  )}
                </Autocomplete>
              );
            })}
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
            value={encryptionPassword}
            onChange={(e) => setEncryptionPassword(e.target.value)}
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
      <label htmlFor="file-upload" className="ms-2">
        Upload Files
      </label>
      <br />
      <Input
        type="file"
        className="mt-2 mb-2"
        multiple
        onChange={handleFileUpload}
      />
      <label htmlFor="folder-upload" className="ms-2">
        Upload Folder
      </label>
      <div
        data-hover={isInputHovered ? "true" : ""}
        className="mt-2 mb-6 relative w-full inline-flex tap-highlight-transparent flex-row items-center shadow-sm px-3 gap-3 bg-default-100 data-[hover=true]:bg-default-200 group-data-[focus=true]:bg-default-100 h-10 min-h-10 rounded-medium transition-background motion-reduce:transition-none !duration-150 outline-none group-data-[focus-visible=true]:z-10 group-data-[focus-visible=true]:ring-2 group-data-[focus-visible=true]:ring-focus group-data-[focus-visible=true]:ring-offset-2 group-data-[focus-visible=true]:ring-offset-background"
        onMouseEnter={() => setisInputHovered(true)}
        onMouseLeave={() => setisInputHovered(false)}
      >
        <div className="inline-flex w-full items-center h-full box-border">
          <input
            type="file"
            className="w-full font-normal bg-transparent !outline-none placeholder:text-foreground-500 focus-visible:outline-none data-[has-start-content=true]:ps-1.5 data-[has-end-content=true]:pe-1.5 file:cursor-pointer file:bg-transparent file:border-0 autofill:bg-transparent bg-clip-text text-small group-data-[has-value=true]:text-default-foreground"
            {...{ webkitdirectory: "", mozdirectory: "", directory: "" }}
            onChange={handleDirectoryUpload}
          />
        </div>
      </div>
      <br />
      {output && (
        <>
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
        </>
      )}
      <Button
        className={`${
          !isChecked &&
          !recipients.some((r) => typeof r === "object" && r.keyId) &&
          !signerKey
            ? "w-30"
            : "w-24"
        }`}
        disabled={encrypting}
        onPress={handleEncrypt}
      >
        {encrypting ? (
          <Spinner color="white" size="sm" />
        ) : recipients.some((r) => typeof r === "object" && r.keyId) ? (
          "🔒 Encrypt"
        ) : !isChecked ? (
          !signerKey ? (
            "📝 Sign \u00A0/ 🔒 Encrypt"
          ) : (
            "📝 Sign"
          )
        ) : (
          "🔒 Encrypt"
        )}
      </Button>
      <Modal
        backdrop="blur"
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false), setEncrypting(false);
        }}
      >
        <ModalContent className="p-5">
          <h3 className="mb-4">Signing Key Is Password Protected</h3>
          <Input
            ref={keyPassphraseInputRef}
            placeholder="Enter Password"
            type={isVisible ? "text" : "password"}
            value={keyPassphrase}
            onChange={(e) => setKeyPassphrase(e.target.value)}
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
                if (keyPassphrase) {
                  if (onSubmitPassword.current) {
                    onSubmitPassword.current(keyPassphrase);
                  }
                } else {
                  addToast({
                    title: "Please enter a password",
                    color: "danger",
                  });
                }
              }
            }}
          />
          <Button
            className="mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
            onPress={() => {
              if (keyPassphrase) {
                if (onSubmitPassword.current) {
                  onSubmitPassword.current(keyPassphrase);
                }
              } else {
                addToast({
                  title: "Please enter a password",
                  color: "danger",
                });
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
