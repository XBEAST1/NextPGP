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
import JSZip from "jszip";
import * as openpgp from "openpgp";

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
  const onSubmitPassword = useRef(null);

  const toggleVisibility = () => setIsVisible(!isVisible);

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
              if (isRevoked || isExpired) {
                return null;
              }

              const userIDs = publicKeyObj.getUserIDs();
              return { ...key, userIDs };
            } catch (error) {
              console.error("Error checking key status:", error);
              return null;
            }
          })
        );

        const filteredKeys = validKeys.filter((key) => key !== null);

        const filteredSignerKeys = filteredKeys.filter(
          (key) => key.publicKey && key.privateKey
        );
        const filteredRecipientKeys = filteredKeys.filter(
          (key) => key.publicKey
        );

        setPgpKeys(filteredKeys);
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
    if (!selectedItem) {
      setSignerKey(null);
      const db = await openDB();
      const transaction = db.transaction(
        [dbPgpKeys, selectedSigners],
        "readwrite"
      );
      const store = transaction.objectStore(selectedSigners);
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

    const db = await openDB();
    const transaction = db.transaction(
      [dbPgpKeys, selectedSigners],
      "readwrite"
    );
    const store = transaction.objectStore(selectedSigners);

    const newSigner = {
      id: itemObj.id.toString(),
      selectedUserId: itemObj.selectedUserId,
    };

    store.put(newSigner);

    transaction.oncomplete = () => {
      setSignerKey(newSigner);
    };
  };

  const handleSelection = async (index, selectedItem) => {
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
    // Use the numeric id from the selected signer object
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
      return privateKeyObject;
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
    return decryptedKey;
  };

  const encryptMessage = async (decryptedKey = null) => {
    try {
      if (!message.trim()) {
        return;
      }
      const recipientKeysPublic = recipientKeys
        .filter((key) =>
          recipients.some(
            (r) => typeof r === "object" && r.keyId === key.id.toString()
          )
        )
        .map((key) => key.publicKey);

      // Validate that at least one recipient or a password is available.
      if (!isChecked && recipientKeysPublic.length === 0) {
        addToast({
          title: "Please select at least one recipient or provide a password",
          color: "danger",
        });
        return;
      }

      // Use the already-decrypted key if available
      let signingKey = decryptedKey;

      const messageToEncrypt = await openpgp.createMessage({ text: message });
      const encryptionOptions = {
        message: messageToEncrypt,
        ...(isChecked &&
          encryptionPassword && { passwords: [encryptionPassword] }),
        ...(recipientKeysPublic.length > 0 && {
          encryptionKeys: await Promise.all(
            recipientKeysPublic.map((key) =>
              openpgp.readKey({ armoredKey: key })
            )
          ),
        }),
        ...(signingKey && { signingKeys: signingKey }),
      };

      const encryptedMessage = await openpgp.encrypt(encryptionOptions);
      setOutput(encryptedMessage);
    } catch {
      addToast({
        title: "Please Enter a Password",
        color: "danger",
      });
    }
  };

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleDirectoryUpload = (event) => {
    const selectedDirectory = Array.from(event.target.files);
    setdirectoryFiles(selectedDirectory);
  };

  const encryptFiles = async (dataFiles, decryptedKey = null) => {
    if (!dataFiles || dataFiles.length === 0) {
      return;
    }

    try {
      let fileToEncrypt;
      let outputFileName;
      const isDirectoryUpload =
        dataFiles[0].webkitRelativePath &&
        dataFiles[0].webkitRelativePath.trim() !== "";

      // For a single file that isn’t a directory upload, use it directly.
      // Otherwise, zip the files.
      if (dataFiles.length === 1 && !isDirectoryUpload) {
        const fileData = await dataFiles[0].arrayBuffer();
        fileToEncrypt = new Uint8Array(fileData);
        outputFileName = dataFiles[0].name;
      } else {
        const zip = new JSZip();

        for (const file of dataFiles) {
          const fileData = await file.arrayBuffer();
          // Preserve folder structure if available
          const relativePath =
            file.webkitRelativePath && file.webkitRelativePath.trim() !== ""
              ? file.webkitRelativePath
              : file.name;
          zip.file(relativePath, fileData);
        }

        // If uploading a directory, use the top folder name and ensure the name
        if (isDirectoryUpload) {
          const firstFileRelPath = dataFiles[0].webkitRelativePath;
          const folderName = firstFileRelPath.split("/")[0];
          outputFileName = `${folderName}.zip`;
        } else {
          // If multiple files are uploaded that aren't a directory set output file name to archive.zip
          outputFileName = "archive.zip";
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipArrayBuffer = await zipBlob.arrayBuffer();
        fileToEncrypt = new Uint8Array(zipArrayBuffer);
      }

      // Find the recipient keys (public keys of the selected recipients)
      const recipientKeysPublic = recipientKeys
        .filter((key) =>
          recipients.some(
            (r) => typeof r === "object" && r.keyId === key.id.toString()
          )
        )
        .map((key) => key.publicKey);

      // Validate that at least one recipient or a password is provided.
      if (recipientKeysPublic.length === 0 && !isChecked) {
        addToast({
          title: "Please select at least one recipient or provide a password",
          color: "danger",
        });
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
      if (recipientKeysPublic.length === 0 && encryptionPassword && isChecked) {
        encryptionOptions.passwords = [encryptionPassword];
      }

      // If both recipients and password are selected, include both in encryption
      if (recipientKeysPublic.length > 0 && encryptionPassword && isChecked) {
        encryptionOptions.passwords = [encryptionPassword];
      }

      if (decryptedKey) {
        encryptionOptions.signingKeys = decryptedKey;
      }

      const encrypted = await openpgp.encrypt({
        ...encryptionOptions,
        format: "binary",
      });

      const encryptedBlob = new Blob([encrypted], {
        type: "application/octet-stream",
      });
      saveAs(encryptedBlob, `${outputFileName}.gpg`);
    } catch {
      addToast({
        title: "Please Enter a Password",
        color: "danger",
      });
    }
  };

  const handleEncrypt = async () => {
    let decryptedKey = null;
    if (signerKey) {
      decryptedKey = await getDecryptedPrivateKey();
    }

    if (message) {
      await encryptMessage(decryptedKey);
    }

    if (files) {
      await encryptFiles(files, decryptedKey);
    }

    if (directoryFiles) {
      await encryptFiles(directoryFiles, decryptedKey);
    }

    if (!message && !files && !directoryFiles) {
      addToast({
        title: "Please enter a message or Select a File",
        color: "danger",
      });
      return;
    }
  };

  return (
    <>
      <h1 className="text-center text-4xl dm-serif-text-regular">Encrypt</h1>
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
                  onSelectionChange={(key) => handleSelection(index, key)}
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
          <h3 className="mb-4">Signing Key Is Password Protected</h3>
          <Input
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
            className="mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
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
