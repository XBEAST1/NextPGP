"use client";

import { useState, useEffect, useRef } from "react";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";
import {
  Modal,
  ModalContent,
  Input,
  Button,
  addToast,
  Textarea,
  Spinner,
} from "@heroui/react";
import { openDB, getStoredKeys } from "@/lib/indexeddb";
import KeyServer from "@/components/keyserver";
import { saveAs } from "file-saver";
import { workerPool } from "./workerPool";

export default function App() {
  const [inputMessage, setInputMessage] = useState("");
  const [details, setDetails] = useState("");
  const [decryptedMessage, setDecryptedMessage] = useState("");
  const [pgpKeys, setPgpKeys] = useState(null);
  const [password, setPassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [files, setFiles] = useState(null);
  const [currentPrivateKey, setCurrentPrivateKey] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [keyServerModal, setkeyServerModal] = useState(false);
  const [keyserverQuery, setKeyserverQuery] = useState("");

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    openDB();

    const fetchKeysFromIndexedDB = async () => {
      try {
        const storedKeys = await getStoredKeys();
        setPgpKeys(storedKeys);
      } catch (error) {
        console.error("Error fetching keys:", error);
      }
    };

    fetchKeysFromIndexedDB();
  }, []);

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const handleDecrypt = async () => {
    setDecrypting(true);
    setDetails("");
    setDecryptedMessage("");

    if (!inputMessage && !files) {
      addToast({
        title: "Please enter a PGP message or Select a File",
        color: "danger",
      });
      setDecrypting(false);
      return;
    }

    try {
      const tasks = [];

      if (inputMessage) {
        tasks.push(
          new Promise((resolve, reject) => {
            workerPool({
              type: "messageDecrypt",
              inputMessage,
              pgpKeys,
              password,
              currentPrivateKey,
              responseType: "setDecryptedMessage",
              onDecryptedMessage: (payload) => {
                setDecryptedMessage(payload);
                resolve();
              },
              onError: () => setDecrypting(false),
              onDetails: (payload) =>
                setDetails((prev) => (prev ? prev + "\n" + payload : payload)),
              onToast: (payload) => addToast(payload),
              onModal: (payload) => setIsPasswordModalOpen(payload),
              onCurrentPrivateKey: (payload) => setCurrentPrivateKey(payload),
            }).catch(reject);
          })
        );
      }

      if (files) {
        const fileTasks = files.map(
          (file) =>
            new Promise((resolve, reject) => {
              workerPool({
                type: "fileDecrypt",
                files: [file],
                pgpKeys,
                password,
                currentPrivateKey,
                responseType: "downloadFile",
                onDecryptedFile: (payload) => {
                  if (payload && payload.fileName && payload.decrypted) {
                    const blob = new Blob([payload.decrypted]);
                    saveAs(blob, payload.fileName);
                  }
                  resolve();
                },
                onError: () => setDecrypting(false),
                onDetails: (payload) =>
                  setDetails((prev) =>
                    prev ? prev + "\n" + payload : payload
                  ),
                onToast: (payload) => addToast(payload),
                onModal: (payload) => setIsPasswordModalOpen(payload),
                onCurrentPrivateKey: (payload) => setCurrentPrivateKey(payload),
              }).catch(reject);
            })
        );
        tasks.push(...fileTasks);
      }
      await Promise.all(tasks);
    } catch (error) {
      console.error("Decryption error:", error);
    }
    setDecrypting(false);
  };

  const removeDuplicateDetails = (detailsStr) => {
    if (!detailsStr) return "";
    const blocks = detailsStr
      .split(/(?=👥 (?:Recipients:|No recipients found))/)
      .map((b) => b.trim());
    const seen = new Set();
    const uniqueBlocks = [];
    blocks.forEach((block) => {
      if (!seen.has(block)) {
        seen.add(block);
        uniqueBlocks.push(block);
      }
    });
    return uniqueBlocks.join("\n\n");
  };

  const handlePasswordDecrypt = async () => {
    if (!password) {
      addToast({
        title: "Please enter a password",
        color: "danger",
      });
      return;
    }

    setDecrypting(true);
    try {
      const tasks = [];

      if (inputMessage) {
        tasks.push(
          new Promise((resolve, reject) => {
            workerPool({
              type: "messagePasswordDecrypt",
              inputMessage,
              pgpKeys,
              password,
              currentPrivateKey,
              responseType: "setDecryptedMessage",
              onDecryptedMessage: (payload) => {
                setDecryptedMessage(payload);
                resolve();
              },
              onDetails: (payload) =>
                setDetails((prev) =>
                  removeDuplicateDetails(prev ? prev + "\n" + payload : payload)
                ),
              onToast: (payload) => addToast(payload),
              onModal: (payload) => setIsPasswordModalOpen(payload),
              onCurrentPrivateKey: (payload) => setCurrentPrivateKey(payload),
            }).catch(reject);
          })
        );
      }

      if (files) {
        const fileTasks = files.map(
          (file) =>
            new Promise((resolve, reject) => {
              workerPool({
                type: "filePasswordDecrypt",
                files: [file],
                pgpKeys,
                password,
                currentPrivateKey,
                responseType: "downloadFile",
                onDecryptedFile: (payload) => {
                  if (payload && payload.fileName && payload.decrypted) {
                    const blob = new Blob([payload.decrypted]);
                    saveAs(blob, payload.fileName);
                  }
                  resolve();
                },
                onDetails: (payload) =>
                  setDetails((prev) =>
                    removeDuplicateDetails(
                      prev ? prev + "\n" + payload : payload
                    )
                  ),
                onToast: (payload) => addToast(payload),
                onModal: (payload) => setIsPasswordModalOpen(payload),
                onCurrentPrivateKey: (payload) => setCurrentPrivateKey(payload),
              }).catch(reject);
            })
        );
        tasks.push(...fileTasks);
      }
      await Promise.all(tasks);
    } catch (error) {
      console.error("Password decryption error:", error);
    }
    setDecrypting(false);
  };

  const SearchSignerOnKeyserver = () => {
    const regex =
      /Signature by: Unknown Key[\s\S]*?Fingerprint:\s*([A-Fa-f0-9 ]{4,})/g;
    const matches = details.matchAll(regex);
    const fingerprints = new Set();

    for (const match of matches) {
      fingerprints.add(match[1].trim());
    }

    if (fingerprints.size > 0) {
      setKeyserverQuery([...fingerprints].join(", "));
      setkeyServerModal(true);
    } else {
      console.log("Fingerprint not found.");
    }
  };

  const SearchUnknownOnKeyserver = () => {
    const regex = /Unknown\s*\(\s*([0-9A-Fa-f0-9 ]+)\s*\)/g;
    const matches = details.matchAll(regex);
    const keyIds = new Set();

    for (const match of matches) {
      keyIds.add(match[1].trim());
    }

    if (keyIds.size > 0) {
      setKeyserverQuery([...keyIds].join(", "));
      setkeyServerModal(true);
    } else {
      console.log("No Unknown key IDs found.");
    }
  };

  // Details Textareas Auto Expand Height
  const decryptedDetails = details.trimEnd();
  const detailsRef = useRef(null);
  useEffect(() => {
    const ta = detailsRef.current;
    if (!ta) return;
    ta.style.height = `${ta.scrollHeight}px`;
    requestAnimationFrame(() => {
      ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [decryptedDetails]);

  // Decrypted Message Textareas Auto Expand Height
  const outputMessage = decryptedMessage.trimEnd();
  const outputRef = useRef(null);
  useEffect(() => {
    const ta = outputRef.current;
    if (!ta) return;
    ta.style.height = `${ta.scrollHeight}px`;
    requestAnimationFrame(() => {
      ta.style.height = `${ta.scrollHeight}px`;
    });
  }, [outputMessage]);

  return (
    <>
      <h1 className="text-center text-4xl dm-serif-text-regular">Decrypt</h1>
      <br />
      <br />
      <Textarea
        disableAutosize
        classNames={{ input: "resize-y min-h-[130px]" }}
        label="Decrypt"
        placeholder="Enter your pgp message"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
      />
      <br />
      <Input
        type="file"
        accept=".gpg, .sig, .pgp"
        multiple
        onChange={handleFileUpload}
      />
      <br />
      <Textarea
        ref={detailsRef}
        isReadOnly
        label="Details"
        value={decryptedDetails}
        classNames={{ input: "overflow-hidden resize-none" }}
        style={{ transition: "height 0.2s ease-out" }}
      />
      <br />
      <Textarea
        ref={outputRef}
        isReadOnly
        disableAutosize
        label="Output"
        value={outputMessage}
        classNames={{ input: "overflow-hidden resize-none min-h-[170px]" }}
        style={{ transition: "height 0.2s ease-out" }}
      />
      <br />
      <div className="md:flex md:justify-between flex-column">
        <Button
          className={
            details.includes("- Unknown") &&
            details.includes("Signature by: Unknown Key")
              ? "md:w-60 w-full"
              : "md:w-24 w-full"
          }
          disabled={decrypting}
          onPress={handleDecrypt}
        >
          {decrypting ? <Spinner color="white" size="sm" /> : "🔓 Decrypt"}
        </Button>

        {details.includes("- Unknown") && (
          <Button className="md:w-auto md:mt-0 w-full mt-4" onPress={SearchUnknownOnKeyserver}>
            🔍 Search Recipient Key On Key Server
          </Button>
        )}

        {details.includes("Signature by: Unknown Key") && (
          <Button className="md:w-auto md:mt-0 w-full mt-4" onPress={SearchSignerOnKeyserver}>
            🔍 Search Signer Key On Key Server
          </Button>
        )}

        <KeyServer
          isOpen={keyServerModal}
          onClose={() => setkeyServerModal(false)}
          initialSearch={keyserverQuery}
        />
      </div>
      {isPasswordModalOpen && (
        <Modal
          backdrop="blur"
          isOpen={isPasswordModalOpen}
          onClose={() => {
            setIsPasswordModalOpen(false), setDecrypting(false);
          }}
        >
          <ModalContent className="p-5">
            <h3 className="mb-4">Password Required</h3>
            <Input
              placeholder="Enter Password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordDecrypt()}
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
            <Button
              className="mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
              onPress={() => {
                handlePasswordDecrypt(), setDecrypting(false);
              }}
            >
              Submit
            </Button>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
