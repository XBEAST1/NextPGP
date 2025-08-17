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

  // States for tracking password-encrypted files
  const [passwordEncryptedFiles, setPasswordEncryptedFiles] = useState(
    new Map()
  );
  const [currentPasswordFile, setCurrentPasswordFile] = useState(null);

  // Refs for tracking processed and downloaded files
  const processedFilesRef = useRef(new Set());
  const downloadedFilesRef = useRef(new Set());
  const downloadLockRef = useRef(new Set()); // Lock for preventing concurrent downloads of the same file

  const toggleVisibility = () => setIsVisible(!isVisible);
  const passwordInputRef = useRef(null);

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

  useEffect(() => {
    if (isPasswordModalOpen && passwordInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [isPasswordModalOpen]);

  const handleFileUpload = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    // Reset tracking state when new files are uploaded
    setPasswordEncryptedFiles(new Map());
    setCurrentPasswordFile(null);
    processedFilesRef.current = new Set();
    downloadedFilesRef.current = new Set();
    downloadLockRef.current = new Set();
  };

  const appendDetail = (payload) => {
    setDetails((prev) => {
      // Add extra spacing between detail blocks
      const combined = prev ? prev + "\n\n" + payload : payload;
      return removeDuplicateDetails(combined);
    });
  };

  const processNextPasswordFile = async (filesMap = null) => {
    const filesToProcess = new Map(filesMap || passwordEncryptedFiles);

    // Filter out files that have already been decrypted/downloaded
    for (const file of Array.from(filesToProcess.keys())) {
      try {
        const expectedOutputName = file.name.replace(/\.(gpg|pgp|sig)$/i, "");
        if (
          downloadedFilesRef.current.has(expectedOutputName) ||
          processedFilesRef.current.has(expectedOutputName)
        ) {
          filesToProcess.delete(file);
        }
      } catch {}
    }

    // Persist the filtered list
    setPasswordEncryptedFiles(filesToProcess);

    if (filesToProcess.size === 0) {
      setIsPasswordModalOpen(false);
      setDecrypting(false);
      return;
    }

    // Get the next file that needs a password
    const nextFile = Array.from(filesToProcess.keys())[0];
    setCurrentPasswordFile(nextFile);
    setPassword("");
    setDecrypting(false);
    setIsPasswordModalOpen(true);
  };

  const downloadQueue = async (filePayload = null) => {
    if (!filePayload?.fileName || !filePayload?.decrypted) {
      return false;
    }

    // Always use the payload fileName for tracking since it's the actual output name
    const trackingName = filePayload.fileName;

    // Check if this file is currently being downloaded by another worker
    if (downloadLockRef.current.has(trackingName)) {
      console.log(
        `File ${trackingName} is being downloaded by another worker, skipping`
      );
      return false;
    }

    // Check if this file has already been downloaded
    if (downloadedFilesRef.current.has(trackingName)) {
      console.log(`File ${trackingName} already downloaded, skipping`);
      return false;
    }

    // Acquire download lock to prevent other workers from downloading the same file
    downloadLockRef.current.add(trackingName);
    console.log(`Acquired download lock for: ${filePayload.fileName}`);

    try {
      // Small delay to ensure proper coordination between workers
      await new Promise((resolve) => setTimeout(resolve, 50));

      await new Promise((resolveDownload) => {
        saveAs(new Blob([filePayload.decrypted]), filePayload.fileName);
        // Small delay to ensure download starts before continuing
        setTimeout(resolveDownload, 100);
      });

      // Mark as downloaded to prevent future duplicates
      downloadedFilesRef.current.add(trackingName);
      processedFilesRef.current.add(trackingName);

      console.log(`Successfully downloaded: ${filePayload.fileName}`);
      return true;
    } catch (error) {
      console.error(`Error downloading ${filePayload.fileName}:`, error);
      return false;
    } finally {
      // Always release the download lock
      downloadLockRef.current.delete(trackingName);
      console.log(`Released download lock for: ${filePayload.fileName}`);
    }
  };

  const handleDecrypt = async () => {
    setDecrypting(true);
    setDetails("");
    setDecryptedMessage("");

    setPasswordEncryptedFiles(new Map());
    setCurrentPasswordFile(null);
    processedFilesRef.current = new Set();
    downloadedFilesRef.current = new Set();
    downloadLockRef.current = new Set();

    // Track files that need passwords
    let filesNeedingPassword = new Map();

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
            onModal: (isOpen) => {
              if (isOpen) {
                setIsPasswordModalOpen(true);
              }
            },
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

      // Process files individually to properly track which ones need passwords
      const successfullyDecryptedFiles = new Set();

      for (const file of uniqueFiles) {
        try {
          // Skip files that have already been processed
          if (processedFilesRef.current.has(file.name)) {
            continue;
          }

          await new Promise((resolve) => {
            workerPool({
              type: "fileDecrypt",
              files: [file], // Process one file at a time
              pgpKeys,
              password,
              currentPrivateKey,
              responseType: "downloadFile",
              onDecryptedFile: async (filePayload) => {
                if (filePayload?.fileName && filePayload.decrypted) {
                  // Use download queue to prevent duplicates
                  const downloaded = await downloadQueue(filePayload);
                  if (downloaded) {
                    successfullyDecryptedFiles.add(file.name);
                  }
                }
                resolve();
              },
              onError: () => {
                resolve(); // Continue to next file
              },
              onDetails: appendDetail,
              onToast: (toast) => {
                if (toast.color === "danger") {
                  addToast(toast);
                }
              },
              onModal: (isOpen) => {
                if (isOpen) {
                  // This file needs a password
                  filesNeedingPassword.set(file, true);
                }
                resolve(); // Continue processing
              },
              onCurrentPrivateKey: setCurrentPrivateKey,
            }).catch(() => resolve()); // Continue even if this file fails
          });
        } catch (error) {
          console.error("Error processing file:", file.name, error);
        }
      }

      // Show summary toast for initial file processing
      if (successfullyDecryptedFiles.size > 0) {
        addToast({
          title: `Successfully decrypted ${successfullyDecryptedFiles.size} ${successfullyDecryptedFiles.size === 1 ? "file" : "files"} with available keys`,
          color: "success",
        });
      }

      // After processing all files, handle password-encrypted files
      if (filesNeedingPassword.size > 0) {
        // Show info about password-encrypted files
        addToast({
          title: `${filesNeedingPassword.size} ${filesNeedingPassword.size === 1 ? "file" : "files"} require password for decryption`,
          color: "primary",
        });

        setPasswordEncryptedFiles(filesNeedingPassword);
        // If a message password modal is open (message needs password),
        // defer opening the file modal until after we try the same password on files.
        if (!(isPasswordModalOpen && inputMessage && !currentPasswordFile)) {
          processNextPasswordFile(filesNeedingPassword);
        }
      }
    } catch {
    } finally {
      // Only finish if no password files are being processed
      if (filesNeedingPassword.size === 0) {
        setDecrypting(false);
      }
    }
  };

  const handlePasswordDecrypt = async () => {
    if (!password) {
      addToast({ title: "Please enter a password", color: "danger" });
      return;
    }

    setDecrypting(true);

    try {
      // If there's a current password file, try the password on all remaining files
      if (currentPasswordFile) {
        // Get all remaining password-encrypted files
        const allPasswordFiles = Array.from(passwordEncryptedFiles.keys());
        const successfullyDecryptedFiles = [];
        let currentFileDecrypted = false;

        // Try the password on all remaining files
        for (const file of allPasswordFiles) {
          try {
            await new Promise((resolve, reject) => {
              workerPool({
                type: "filePasswordDecrypt",
                files: [file],
                pgpKeys,
                password,
                currentPrivateKey,
                responseType: "downloadFile",
                onDecryptedFile: async (filePayload) => {
                  if (filePayload?.decrypted) {
                    // Use download queue to prevent duplicates
                    await downloadQueue(filePayload);
                  }
                  resolve(filePayload);
                },
                onError: () => {
                  reject(new Error("Worker error"));
                },
                onDetails: appendDetail,
                onToast: (toast) => {
                  // Only show toast for the current file to avoid spam
                  if (file === currentPasswordFile) {
                    addToast(toast);
                  }
                },
                onModal: (isOpen) => {
                  // Don't auto-close modal during multi-file processing
                  console.log("Worker modal signal:", isOpen);
                },
                onCurrentPrivateKey: setCurrentPrivateKey,
              }).catch(reject);
            });

            successfullyDecryptedFiles.push(file);
            if (file === currentPasswordFile) {
              currentFileDecrypted = true;
            }
          } catch {
            // This file couldn't be decrypted with this password
            console.log("Password didn't work for file:", file.name);
          }
        }

        // Update processed files and remove successfully decrypted files
        successfullyDecryptedFiles.forEach((file) =>
          processedFilesRef.current.add(file.name)
        );

        const updatedFiles = new Map(passwordEncryptedFiles);
        successfullyDecryptedFiles.forEach((file) => {
          updatedFiles.delete(file);
        });
        setPasswordEncryptedFiles(updatedFiles);

        if (currentFileDecrypted) {
          if (successfullyDecryptedFiles.length > 1) {
            // Show additional info if multiple files were decrypted
            addToast({
              title: `${successfullyDecryptedFiles.length - 1} other ${successfullyDecryptedFiles.length - 1 === 1 ? "file" : "files"} also decrypted with the same password!`,
              color: "success",
            });
          }

          // Clear password for next file
          setPassword("");

          // Reset decrypting state after successful decryption
          setDecrypting(false);

          // Process next file or finish
          processNextPasswordFile(updatedFiles);
        } else {
          setDecrypting(false);
          return;
        }
      } else if (inputMessage) {
        try {
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
                reject(new Error("Worker error"));
              },
              onDetails: appendDetail,
              onToast: addToast,
              onModal: setIsPasswordModalOpen,
              onCurrentPrivateKey: setCurrentPrivateKey,
            }).catch(reject);
          });

          // Close modal after successful message decryption
          setIsPasswordModalOpen(false);

          // If files are also selected, process them next and prompt for file passwords if needed
          let filesNeedingPassword = new Map();
          let uniqueFiles = [];

          if (files && files.length) {
            // De-duplicate selected files
            const seenInputHashes = new Set();
            for (const file of files) {
              try {
                const buf = await file.arrayBuffer();
                const hashBuf = await crypto.subtle.digest("SHA-256", buf);
                const hashHex = Array.from(new Uint8Array(hashBuf))
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");
                if (!seenInputHashes.has(hashHex)) {
                  seenInputHashes.add(hashHex);
                  uniqueFiles.push(file);
                }
              } catch {}
            }

            // First, try the same password used for the message on all selected files
            const decryptedWithMsgPassword = new Set();
            for (const file of uniqueFiles) {
              try {
                await new Promise((resolve) => {
                  workerPool({
                    type: "filePasswordDecrypt",
                    files: [file],
                    pgpKeys,
                    password,
                    currentPrivateKey,
                    responseType: "downloadFile",
                    onDecryptedFile: async (filePayload) => {
                      if (filePayload?.decrypted) {
                        const downloaded = await downloadQueue(filePayload);
                        if (downloaded) {
                          decryptedWithMsgPassword.add(file.name);
                        }
                      }
                      resolve();
                    },
                    onError: () => {
                      resolve();
                    },
                    onDetails: appendDetail,
                    onToast: (toast) => {
                      if (toast.color === "danger") {
                        addToast(toast);
                      }
                    },
                    onModal: () => {
                      resolve();
                    },
                    onCurrentPrivateKey: setCurrentPrivateKey,
                  }).catch(() => resolve());
                });
              } catch {
                console.error(
                  "Error trying message password for file:",
                  file.name,
                  error
                );
              }
            }

            // For files not decrypted with the message password, try key-based decryption
            const remainingFiles = uniqueFiles.filter(
              (f) => !decryptedWithMsgPassword.has(f.name)
            );
            const successfullyDecryptedFiles = new Set();

            for (const file of remainingFiles) {
              try {
                await new Promise((resolve) => {
                  workerPool({
                    type: "fileDecrypt",
                    files: [file],
                    pgpKeys,
                    password,
                    currentPrivateKey,
                    responseType: "downloadFile",
                    onDecryptedFile: async (filePayload) => {
                      if (filePayload?.fileName && filePayload.decrypted) {
                        const downloaded = await downloadQueue(filePayload);
                        if (downloaded) {
                          successfullyDecryptedFiles.add(file.name);
                        }
                      }
                      resolve();
                    },
                    onError: () => {
                      resolve();
                    },
                    onDetails: appendDetail,
                    onToast: (toast) => {
                      if (toast.color === "danger") {
                        addToast(toast);
                      }
                    },
                    onModal: (isOpen) => {
                      if (isOpen) {
                        filesNeedingPassword.set(file, true);
                      }
                      resolve();
                    },
                    onCurrentPrivateKey: setCurrentPrivateKey,
                  }).catch(() => resolve());
                });
              } catch (error) {
                console.error("Error processing file:", file.name, error);
              }
            }

            if (successfullyDecryptedFiles.size > 0) {
              addToast({
                title: `Successfully decrypted ${successfullyDecryptedFiles.size} ${successfullyDecryptedFiles.size === 1 ? "file" : "files"} with available keys`,
                color: "success",
              });
            }

            if (filesNeedingPassword.size > 0) {
              addToast({
                title: `${filesNeedingPassword.size} ${filesNeedingPassword.size === 1 ? "file" : "files"} require password for decryption`,
                color: "primary",
              });
              setPasswordEncryptedFiles(filesNeedingPassword);
              processNextPasswordFile(filesNeedingPassword);
            } else {
              setDecrypting(false);
            }
          } else {
            setDecrypting(false);
          }
        } catch {
          addToast({ title: "Incorrect password", color: "danger" });
          setDecrypting(false);
          return;
        }
      }
    } catch (error) {
      console.error("Unexpected password decryption error:", error);
      addToast({ title: "Decryption failed", color: "danger" });
      setDecrypting(false);
    }
  };

  const removeDuplicateDetails = (detailsStr) => {
    if (!detailsStr) return "";

    // Split by double newlines to separate blocks
    const blocks = detailsStr.split(/\n\s*\n/).filter((block) => block.trim());

    // Group blocks into file decryption groups
    // Each group should contain: Recipients -> Decryption Success -> Signature info
    const fileGroups = [];
    let currentGroup = [];

    for (const block of blocks) {
      const trimmed = block.trim();

      // If a new file header starts, close the previous group first
      if (trimmed.startsWith("📄 File:")) {
        if (currentGroup.length > 0) {
          fileGroups.push(currentGroup);
          currentGroup = [];
        }
      }

      currentGroup.push(trimmed);

      // End a group when we see a signature timestamp (last item in a file's details)
      if (trimmed.includes("⏱️ Signature created on:")) {
        fileGroups.push(currentGroup);
        currentGroup = [];
      }
    }

    // Don't forget the last group if it doesn't end with a timestamp
    if (currentGroup.length > 0) {
      fileGroups.push(currentGroup);
    }

    // Now deduplicate complete file groups
    const seen = new Set();
    const uniqueGroups = [];

    for (const group of fileGroups) {
      // Use the full group text (including 📄 File header when present) as key
      // This avoids dropping different files that happen to share identical timestamps
      const groupText = group.join("\n\n");
      const key = groupText;

      if (!seen.has(key)) {
        seen.add(key);
        uniqueGroups.push(group);
      }
    }

    // Flatten groups back into blocks
    const result = [];
    for (const group of uniqueGroups) {
      result.push(...group);
    }

    return result.join("\n\n");
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
            setIsPasswordModalOpen(false);
            setDecrypting(false);
          }}
        >
          <ModalContent className="p-5">
            <h3 className="mb-4">Password Required</h3>
            {currentPasswordFile ? (
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>File:</strong> {currentPasswordFile.name}
                </p>
                {passwordEncryptedFiles.size > 1 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {passwordEncryptedFiles.size} files remaining to decrypt
                  </p>
                )}
                {passwordEncryptedFiles.size > 1 && (
                  <p className="text-xs text-blue-600 mt-1">
                    💡 Each file may have a different password
                  </p>
                )}
              </div>
            ) : inputMessage ? (
              <p className="mb-4 text-sm text-gray-600">
                Message requires password for decryption
              </p>
            ) : null}
            <Input
              ref={passwordInputRef}
              placeholder="Enter Password"
              type={isVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePasswordDecrypt();
                }
              }}
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
            <div className="flex gap-2 mt-4">
              <Button
                className="flex-1 px-4 py-2 bg-default-200 text-white rounded-full"
                onPress={handlePasswordDecrypt}
                disabled={decrypting}
              >
                {decrypting ? <Spinner color="white" size="sm" /> : "Submit"}
              </Button>
              {currentPasswordFile && passwordEncryptedFiles.size > 1 && (
                <Button
                  className="px-4 py-2 bg-gray-500 text-white rounded-full"
                  onPress={() => {
                    // Skip this file and move to next
                    const updatedFiles = new Map(passwordEncryptedFiles);
                    updatedFiles.delete(currentPasswordFile);
                    setPasswordEncryptedFiles(updatedFiles);
                    processedFilesRef.current.add(currentPasswordFile.name);
                    setPassword(""); // Clear password for next file
                    addToast({
                      title: `Skipped ${currentPasswordFile.name}`,
                      color: "warning",
                    });
                    processNextPasswordFile(updatedFiles);
                  }}
                >
                  Skip File
                </Button>
              )}
            </div>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
