"use client";

const dbName = "NextPGP";
const dbPgpKeys = "pgpKeys";
const selectedSigners = "selectedSigners";
const selectedRecipients = "selectedRecipients";
const dbCryptoKeys = "cryptoKeys";

// 1. Database & Setup
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e: any) => {
      const db: any = e.target.result;

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
    request.onsuccess = (e: any) => resolve(e.target.result);
    request.onerror = (e: any) => reject(e.target.error);
  });
};

// 2. Session Management
let encryptedDecryptedMainKey: any = null;

const isSessionValid = () => {
  const sessionValue = sessionStorage.getItem("appPasswordKey");
  const isValid = sessionValue === "true";
  return isValid;
};

const setDecryptedMainKey = async (key: any) => {
  try {
    let rawBytes: Uint8Array;
    if (key instanceof CryptoKey) {
      if (!key.extractable) {
        throw new Error("Cannot export non-extractable key");
      }
      const exported = await crypto.subtle.exportKey("raw", key);
      rawBytes = new Uint8Array(exported);
    } else if (key instanceof Uint8Array) {
      rawBytes = key;
    } else if (key instanceof ArrayBuffer) {
      rawBytes = new Uint8Array(key);
    } else {
      throw new Error("Invalid key format for setDecryptedMainKey");
    }

    // Generate a temporary key for encrypting the decrypted main key
    const tempKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    // Encrypt the decrypted main key with the temp key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      tempKey,
      rawBytes as any
    );

    // Store both the encrypted key and the temp key
    encryptedDecryptedMainKey = {
      encrypted: new Uint8Array(encryptedBuffer),
      iv: new Uint8Array(iv),
      tempKey: tempKey,
    };
  } catch (error) {
    console.error("Error encrypting decrypted main key:", error);
    encryptedDecryptedMainKey = null;
  }
};

const getDecryptedMainKey = async () => {
  if (!encryptedDecryptedMainKey) return null;

  try {
    // Decrypt the main key using the temp key
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: encryptedDecryptedMainKey.iv },
      encryptedDecryptedMainKey.tempKey,
      encryptedDecryptedMainKey.encrypted
    );

    // Import the decrypted main key (non-extractable — XSS cannot export)
    return await crypto.subtle.importKey(
      "raw",
      decryptedBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  } catch (error) {
    console.error("Error decrypting main key:", error);
    return null;
  }
};

const clearDecryptedMainKey = () => {
  encryptedDecryptedMainKey = null;
};

// Helper: Safely get raw main key bytes without needing extractable CryptoKeys
const getRawMainKey = async (): Promise<Uint8Array> => {
  const db: any = await openDB();
  const tx = db.transaction(dbCryptoKeys, "readonly");
  const store = tx.objectStore(dbCryptoKeys);
  const record: any = await new Promise((resolve, reject) => {
    const req = store.get("mainKey");
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e: any) => reject(e.target.error);
  });

  if (!record) {
    // Generate fresh 32 bytes and store in IDB
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const writeTx = db.transaction(dbCryptoKeys, "readwrite");
    const writeStore = writeTx.objectStore(dbCryptoKeys);
    await new Promise((resolve, reject) => {
      const req = writeStore.put({
        id: "mainKey",
        key: rawKey,
        isPasswordProtected: false,
      });
      req.onsuccess = () => resolve(undefined);
      req.onerror = (e: any) => reject(e.target.error);
    });
    return rawKey;
  }

  if (record.isPasswordProtected) {
    if (!encryptedDecryptedMainKey) {
      throw new Error("Password-protected key requires verification first");
    }
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: encryptedDecryptedMainKey.iv },
      encryptedDecryptedMainKey.tempKey,
      encryptedDecryptedMainKey.encrypted
    );
    return new Uint8Array(decryptedBuffer);
  }

  return record.key instanceof Uint8Array ? record.key : new Uint8Array(record.key);
};

// 3. Core Encryption
const getEncryptionKey = async () => {
  const db: any = await openDB();
  const tx = db.transaction(dbCryptoKeys, "readonly");
  const store = tx.objectStore(dbCryptoKeys);
  const request = store.get("mainKey");

  return new Promise(async (resolve, reject) => {
    request.onsuccess = async () => {
      if (request.result) {
        if (request.result.isPasswordProtected) {
          // If the key is password protected, we need to decrypt it
          // This should only be called after password verification
          if (!isSessionValid()) {
            reject();
            return;
          }

          // Check if we have the decrypted key in memory
          const decryptedKey = await getDecryptedMainKey();
          if (decryptedKey) {
            resolve(decryptedKey);
            return;
          }

          reject(
            new Error("Password-protected key requires verification first")
          );
          return;
        } else {
          // Regular unencrypted key (non-extractable — XSS cannot export)
          const importedKey = await crypto.subtle.importKey(
            "raw",
            request.result.key,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
          );
          resolve(importedKey);
        }
      } else {
        // Generate a new key if not found
        const rawBytes = crypto.getRandomValues(new Uint8Array(32));
        const txWrite = db.transaction(dbCryptoKeys, "readwrite");
        const storeWrite = txWrite.objectStore(dbCryptoKeys);
        storeWrite.put({
          id: "mainKey",
          key: rawBytes,
          isPasswordProtected: false,
        });
        const key = await crypto.subtle.importKey(
          "raw",
          rawBytes,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
        );
        resolve(key);
      }
    };
    request.onerror = (e: any) => reject(e.target.error);
  });
};

// 4. Password-based Security

// Generate a new encryption key derived from a password
const generatePasswordBasedKey = async (password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 1000000,
      hash: "SHA-512",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return { key, salt };
};

// Derive key from password and salt
const deriveKeyFromPassword = async (password: string, salt: any) => {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 1000000,
      hash: "SHA-512",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// Check if app has password protection enabled
const checkIfPasswordProtected = async () => {
  const db: any = await openDB();
  const tx = db.transaction(dbCryptoKeys, "readonly");
  const store = tx.objectStore(dbCryptoKeys);
  const request = store.get("mainKey");

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const record = request.result;
      const hasPassword =
        record && record.isPasswordProtected && record.encrypted;
      resolve(hasPassword);
    };
    request.onerror = (e: any) => {
      reject(e.target.error);
    };
  });
};

// Set app password and re-encrypt the main key with the new password protected key
const setAppPassword = async (password: string) => {
  const db: any = await openDB();

  // Generate password-based key (PBKDF2-SHA512)
  const { key: passwordKey, salt } = await generatePasswordBasedKey(password);

  // Get the current raw main key bytes (or generate fresh ones)
  const rawMainKey = await getRawMainKey();

  // Encrypt the main key with the password-based key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedMainKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    passwordKey,
    rawMainKey as any
  );

  // Store the encrypted main key and salt (no passwordHash — verification
  // is implicit via AES-GCM decrypt success/failure in verifyAppPassword)
  const tx = db.transaction(dbCryptoKeys, "readwrite");
  const store = tx.objectStore(dbCryptoKeys);
  await new Promise((resolve, reject) => {
    const request = store.put({
      id: "mainKey",
      encrypted: new Uint8Array(encryptedMainKey),
      iv: new Uint8Array(iv),
      salt: new Uint8Array(salt),
      isPasswordProtected: true,
    });
    request.onsuccess = () => {
      resolve(undefined);
    };
    request.onerror = (e: any) => {
      reject(e.target.error);
    };
  });

  // Store the decrypted main key in memory and set session
  await setDecryptedMainKey(rawMainKey);
  sessionStorage.setItem("appPasswordKey", "true");
};

// Verify app password and decrypt the main key
const verifyAppPassword = async (password: string) => {
  const db: any = await openDB();

  // Get the stored encrypted main key
  const tx = db.transaction(dbCryptoKeys, "readonly");
  const store = tx.objectStore(dbCryptoKeys);
  const request = store.get("mainKey");

  return new Promise(async (resolve, reject) => {
    request.onsuccess = async () => {
      const record = request.result;
      if (!record || !record.isPasswordProtected) {
        reject(new Error("No password protection found"));
        return;
      }

      try {
        // Derive key from password
        const passwordKey = await deriveKeyFromPassword(password, record.salt);

        // Decrypt the main key
        const decryptedMainKey = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: record.iv },
          passwordKey,
          record.encrypted
        );

        // Store the decrypted key in memory for session
        await setDecryptedMainKey(decryptedMainKey);
        sessionStorage.setItem("appPasswordKey", "true");

        // Import the decrypted main key (non-extractable — XSS cannot export)
        const mainKey = await crypto.subtle.importKey(
          "raw",
          decryptedMainKey,
          { name: "AES-GCM" },
          false,
          ["encrypt", "decrypt"]
        );

        resolve(mainKey);
      } catch {
        reject(new Error("Invalid password"));
      }
    };
    request.onerror = (e: any) => reject(e.target.error);
  });
};

// Remove password protection and restore original key
const removeAppPassword = async () => {
  const db: any = await openDB();

  // Get the current encrypted main key
  const tx = db.transaction(dbCryptoKeys, "readonly");
  const store = tx.objectStore(dbCryptoKeys);
  const request = store.get("mainKey");

  return new Promise(async (resolve, reject) => {
    request.onsuccess = async () => {
      const record = request.result;
      if (!record || !record.isPasswordProtected) {
        reject(new Error("No password protection found"));
        return;
      }

      try {
        // First decrypt the current main key using the password-derived key
        // This requires the password to be verified first, so we need the decrypted main key
        const decryptedMainKey = await getDecryptedMainKey();
        if (!decryptedMainKey) {
          reject(new Error("No decrypted main key available"));
          return;
        }

        // Generate a new unencrypted main key
        const newKey = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
        const exportedKey = await crypto.subtle.exportKey("raw", newKey);

        // Re-encrypt all existing PGP keys with the new main key
        const pgpTx = db.transaction(dbPgpKeys, "readonly");
        const pgpStore = pgpTx.objectStore(dbPgpKeys);
        const pgpRequest = pgpStore.openCursor();

        const keysToReEncrypt: any[] = [];

        pgpRequest.onsuccess = async (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            keysToReEncrypt.push(cursor.value);
            cursor.continue();
          } else {
            try {
              // Re-encrypt all keys with the new main key
              const reEncryptedKeys = await Promise.all(
                keysToReEncrypt.map(async (keyRecord) => {
                  // Decrypt with old main key
                  const decryptedKey = await decryptData(
                    keyRecord.encrypted,
                    decryptedMainKey,
                    keyRecord.iv
                  );

                  // Re-encrypt with new key
                  const { encrypted, iv } = await encryptData(
                    decryptedKey,
                    newKey
                  );

                  return {
                    ...keyRecord,
                    encrypted,
                    iv,
                  };
                })
              );

              // Store the re-encrypted keys
              const writeTx = db.transaction(dbPgpKeys, "readwrite");
              const writeStore = writeTx.objectStore(dbPgpKeys);

              await Promise.all(
                reEncryptedKeys.map((keyRecord) => {
                  return new Promise<void>((resolveWrite, rejectWrite) => {
                    const writeRequest = writeStore.put(keyRecord);
                    writeRequest.onsuccess = () => resolveWrite();
                    writeRequest.onerror = (e: any) => rejectWrite(e.target.error);
                  });
                })
              );

              // Store the new unencrypted main key (without password hash)
              const txWrite = db.transaction(dbCryptoKeys, "readwrite");
              const storeWrite = txWrite.objectStore(dbCryptoKeys);
              await new Promise<void>((resolveWrite, rejectWrite) => {
                const writeRequest = storeWrite.put({
                  id: "mainKey",
                  key: new Uint8Array(exportedKey),
                  isPasswordProtected: false,
                });
                writeRequest.onsuccess = () => resolveWrite();
                writeRequest.onerror = (e: any) => rejectWrite(e.target.error);
              });

              resolve(undefined);
            } catch (error) {
              reject(error);
            }
          }
        };

        pgpRequest.onerror = (e: any) => reject(e.target.error);
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = (e: any) => reject(e.target.error);
  });
};

// 5. Data Encryption/Decryption
const encryptData = async (data: any, key: any) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );
  return { encrypted: new Uint8Array(encrypted), iv };
};

const decryptData = async (encryptedData: any, key: any, iv: any) => {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );

    const decoded = new TextDecoder().decode(decrypted);

    return JSON.parse(decoded);
  } catch (error) {
    throw error;
  }
};

// 6. PGP Key Operations
export const KEYRING_BROADCAST_CHANNEL = "nextpgp-keyring-channel";

export const notifyKeyringChannel = () => {
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(KEYRING_BROADCAST_CHANNEL);
      channel.postMessage({ type: "KEYRING_UPDATED", timestamp: Date.now() });
      channel.close();
    } catch (e) {
      console.warn("Failed to broadcast keyring update:", e);
    }
  }
};

const getStoredKeys = async () => {
  const db: any = await openDB();
  const encryptionKey = await getEncryptionKey();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(dbPgpKeys, "readonly");
    const store = transaction.objectStore(dbPgpKeys);
    const records: any[] = [];
    const request = store.openCursor();

    request.onsuccess = async (event: any) => {
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

    request.onerror = (e: any) => reject(e.target.error);
  });
};

const saveKeyToIndexedDB = async (keyData: any) => {
  const encryptionKey = await getEncryptionKey();
  const { encrypted, iv } = await encryptData(keyData, encryptionKey);

  const db: any = await openDB();
  const transaction = db.transaction(dbPgpKeys, "readwrite");
  const store = transaction.objectStore(dbPgpKeys);

  await new Promise<void>((resolve, reject) => {
    const req = store.put({ id: keyData.id, encrypted, iv });
    req.onsuccess = () => resolve();
    req.onerror = (e: any) => reject(e.target.error);
  });

  notifyKeyringChannel();
};

const updateKeyInIndexeddb = async (keyId: any, updatedKeys: any) => {
  const runUpdate = async () => {
    const db: any = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pgpKeys", "readonly");
      const store = transaction.objectStore("pgpKeys");
      const getRequest = store.get(keyId);

      getRequest.onsuccess = async () => {
        const record = getRequest.result;
        if (!record) {
          return reject(new Error("Key record not found"));
        }

        try {
          const originalDecrypted = await decryptData(
            record.encrypted,
            encryptionKey,
            record.iv
          );
          const updatedDecrypted = {
            ...originalDecrypted,
            privateKey:
              updatedKeys.privateKey !== undefined
                ? updatedKeys.privateKey
                : originalDecrypted.privateKey,
            publicKey:
              updatedKeys.publicKey !== undefined
                ? updatedKeys.publicKey
                : originalDecrypted.publicKey,
          };

          const { encrypted, iv } = await encryptData(
            updatedDecrypted,
            encryptionKey
          );
          record.encrypted = encrypted;
          record.iv = iv;
        } catch (error) {
          return reject(error);
        }

        const writeTx = db.transaction("pgpKeys", "readwrite");
        const writeStore = writeTx.objectStore("pgpKeys");
        const putRequest = writeStore.put(record);

        putRequest.onsuccess = () => {
          notifyKeyringChannel();
          resolve(undefined);
        };
        putRequest.onerror = (e: any) => reject(e.target.error);
      };

      getRequest.onerror = (e: any) => reject(e.target.error);
    });
  };

  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`pgp-key-${keyId}`, runUpdate);
  }
  return runUpdate();
};

// 7. Data Management
const deleteAllData = async () => {
  const db: any = await openDB();

  // Delete all object stores
  const stores = [dbPgpKeys, selectedSigners, selectedRecipients, dbCryptoKeys];

  for (const storeName of stores) {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve(undefined);
      request.onerror = (e: any) => reject(e.target.error);
    });
  }

  // Clear session storage and memory
  sessionStorage.clear();
  clearDecryptedMainKey();
  notifyKeyringChannel();
};

export {
  openDB,
  getEncryptionKey,
  encryptData,
  decryptData,
  getStoredKeys,
  saveKeyToIndexedDB,
  updateKeyInIndexeddb,
  checkIfPasswordProtected,
  setAppPassword,
  verifyAppPassword,
  removeAppPassword,
  deleteAllData,
  isSessionValid,
  setDecryptedMainKey,
  getDecryptedMainKey,
  clearDecryptedMainKey,
  dbPgpKeys,
  selectedSigners,
  selectedRecipients,
};
