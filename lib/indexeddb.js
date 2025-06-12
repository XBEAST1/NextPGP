const dbName = "NextPGP";
const dbPgpKeys = "pgpKeys";
const selectedSigners = "selectedSigners";
const selectedRecipients = "selectedRecipients";
const dbCryptoKeys = "cryptoKeys";

// Opens the IndexedDB database or create object stores if they don't exist
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

// Encrypts data using the provided encryption key.
const encryptData = async (data, key) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );
  return { encrypted: new Uint8Array(encrypted), iv };
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

// Retrieves all stored keys from the database, decrypts them, and returns them.
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

const saveKeyToIndexedDB = async (keyData) => {
  const encryptionKey = await getEncryptionKey();
  const { encrypted, iv } = await encryptData(keyData, encryptionKey);

  const db = await openDB();
  const transaction = db.transaction(dbPgpKeys, "readwrite");
  const store = transaction.objectStore(dbPgpKeys);

  store.put({ id: keyData.id, encrypted, iv });
};

export {
  openDB,
  getEncryptionKey,
  encryptData,
  decryptData,
  getStoredKeys,
  saveKeyToIndexedDB,
  dbPgpKeys,
  selectedSigners,
  selectedRecipients,
};
