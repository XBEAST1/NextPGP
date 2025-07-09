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

  const appendDetail = (payload) => {
    setDetails((prev) => {
      const combined = prev ? prev + "\n" + payload : payload;
      return removeDuplicateDetails(combined);
    });
  };

  const handleDecrypt = async () => {
    setDecrypting(true);
    setDetails("");
    setDecryptedMessage("");

    if (!inputMessage && !files) {
      addToast({
        title: "Please enter a PGP message or select a file",
        color: "danger",
      });
      setDecrypting(false);
      return;
    }

    try {
      if (inputMessage) {
        await new Promise((resolve, reject) => {
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
            onError: () => {
              setDecrypting(false);
            },
            onDetails: appendDetail,
            onToast: addToast,
            onModal: setIsPasswordModalOpen,
            onCurrentPrivateKey: setCurrentPrivateKey,
          }).catch(reject);
        });
      }

      // De duplicate files before decrypting
      let uniqueFiles = [];
      if (files && files.length) {
        const seenInputHashes = new Set();

        for (const file of files) {
          const buf = await file.arrayBuffer();
          const hashBuf = await crypto.subtle.digest("SHA-256", buf);
          const hashHex = Array.from(new Uint8Array(hashBuf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          if (!seenInputHashes.has(hashHex)) {
            seenInputHashes.add(hashHex);
            uniqueFiles.push(file);
          }
        }
      }

      for (const file of uniqueFiles) {
        try {
          const payload = await new Promise((resolve, reject) => {
            workerPool({
              type: "fileDecrypt",
              files: [file],
              pgpKeys,
              password,
              currentPrivateKey,
              responseType: "downloadFile",
              onDecryptedFile: resolve,
              onError: () => {
                setDecrypting(false);
              },
              onDetails: appendDetail,
              onToast: addToast,
              onModal: setIsPasswordModalOpen,
              onCurrentPrivateKey: setCurrentPrivateKey,
            }).catch(reject);
          });

          if (payload?.fileName && payload.decrypted) {
            saveAs(new Blob([payload.decrypted]), payload.fileName);
          }
        } catch {}
      }
    } catch (error) {
      console.error("Decryption error:", error);
      addToast({ title: "Decryption failed", color: "danger" });
    } finally {
      setDecrypting(false);
    }
  };

  const handlePasswordDecrypt = async () => {
    if (!password) {
      addToast({ title: "Please enter a password", color: "danger" });
      return;
    }

    setDecrypting(true);
    setDetails("");
    setDecryptedMessage("");

    try {
      if (inputMessage) {
        await new Promise((resolve, reject) => {
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
            onError: () => {
              setDecrypting(false);
            },
            onDetails: appendDetail,
            onToast: addToast,
            onModal: setIsPasswordModalOpen,
            onCurrentPrivateKey: setCurrentPrivateKey,
          }).catch(reject);
        });
      }

      // De duplicate files before decrypting
      let uniqueFiles = [];
      if (files && files.length) {
        const seenInputHashes = new Set();

        for (const file of files) {
          const buf = await file.arrayBuffer();
          const hashBuf = await crypto.subtle.digest("SHA-256", buf);
          const hashHex = Array.from(new Uint8Array(hashBuf))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          if (!seenInputHashes.has(hashHex)) {
            seenInputHashes.add(hashHex);
            uniqueFiles.push(file);
          }
        }
      }

      for (const file of uniqueFiles) {
        let resolved = false;

        try {
          const payload = await new Promise((resolve, reject) => {
            workerPool({
              type: "filePasswordDecrypt",
              files: [file],
              pgpKeys,
              password,
              currentPrivateKey,
              responseType: "downloadFile",
              onDecryptedFile: resolve,
              onError: () => {
                setDecrypting(false);
              },
              onDetails: appendDetail,
              // Resolve here to avoid breaking the loop if password is incorrect,
              // since onError doesn't always trigger so we're calling resolve(null) here
              onToast: (toast) => {
                addToast(toast);
                if (
                  !resolved &&
                  toast.title?.toLowerCase().includes("incorrect password")
                ) {
                  resolved = true;
                  resolve(null);
                }
              },
              onModal: setIsPasswordModalOpen,
              onCurrentPrivateKey: setCurrentPrivateKey,
            }).catch(reject);
          });

          if (payload?.fileName && payload.decrypted) {
            saveAs(new Blob([payload.decrypted]), payload.fileName);
          }
        } catch {}
      }
    } catch (error) {
      console.error("Password decryption error:", error);
      addToast({ title: "Decryption failed", color: "danger" });
    } finally {
      setDecrypting(false);
    }
  };

  const removeDuplicateDetails = (detailsStr) => {
    if (!detailsStr) return "";

    const blockRegex = /(👥 Recipients:[\s\S]*?)(?=👥 Recipients:|$)/g;
    const blocks = [];
    let match;

    const firstRecipientsIndex = detailsStr.indexOf("👥 Recipients:");
    if (firstRecipientsIndex > 0) {
      const initialBlock = detailsStr.slice(0, firstRecipientsIndex).trim();
      if (initialBlock) {
        blocks.push(initialBlock);
      }
    } else if (firstRecipientsIndex === -1 && detailsStr.trim() !== "") {
      blocks.push(detailsStr.trim());
    }

    while ((match = blockRegex.exec(detailsStr)) !== null) {
      blocks.push(match[1].trim());
    }

    const seen = new Set();
    return blocks
      .filter((block) => {
        const match = block.match(/⏱️ Signature created on:\s*(.+)$/m);
        const key = match ? match[1].trim() : block;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join("\n\n");
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
          <Button
            className="md:w-auto md:mt-0 w-full mt-4"
            onPress={SearchUnknownOnKeyserver}
          >
            🔍 Search Recipient Key On Key Server
          </Button>
        )}

        {details.includes("Signature by: Unknown Key") && (
          <Button
            className="md:w-auto md:mt-0 w-full mt-4"
            onPress={SearchSignerOnKeyserver}
          >
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
