/**
 * lib/pgp.js
 *
 * Pure PGP utility functions – no React dependencies.
 * Extracted from app/page.jsx for reuse and testability.
 */

import * as openpgp from "openpgp";
import {
  openDB,
  getEncryptionKey,
  decryptData,
  dbPgpKeys,
} from "@/lib/indexeddb";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Format a JS Date / ISO string into "DD-Mon-YYYY".
 */
export const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Parse a "DD-Mon-YYYY" expiry string back into a @internationalized/date
 * CalendarDate, or null for "No Expiry" / "Revoked" / "Error".
 */
export const parseExpiryToCalendarDate = (expiryStr) => {
  // Lazy import to avoid pulling in the package at the module level when
  // this utility is used outside a Next.js context.
  const { CalendarDate } = require("@internationalized/date");

  if (
    !expiryStr ||
    expiryStr === "No Expiry" ||
    expiryStr === "Revoked" ||
    expiryStr === "Error"
  )
    return null;

  const [day, monthStr, year] = expiryStr.split("-");
  const monthMap = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  return new CalendarDate(Number(year), monthMap[monthStr], Number(day));
};

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

export const capitalize = (s) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

/**
 * Parse an OpenPGP User ID string "Name <email>" into { id, name, email }.
 */
export const parseUserId = (uid) => {
  const match = uid.match(/^(.*?)\s*<(.+?)>$/);
  return match
    ? { id: uid, name: match[1].trim(), email: match[2].trim() || "N/A", status: "active" }
    : { id: uid, name: uid.trim(), email: "N/A", status: "active" };
};

// ---------------------------------------------------------------------------
// Key formatting helpers
// ---------------------------------------------------------------------------

const formatFingerprint = (fingerprint) => {
  const parts = fingerprint.match(/.{1,4}/g);
  const nbsp = "\u00A0";
  return parts.slice(0, 5).join(" ") + nbsp.repeat(6) + parts.slice(5).join(" ");
};

const formatKeyID = (keyid) => keyid.match(/.{1,4}/g).join(" ");

const formatAlgorithm = (algoInfo) => {
  const labelMap = {
    curve25519: "Curve25519 (EdDSA/ECDH)",
    nistP256: "NIST P-256 (ECDSA/ECDH)",
    nistP521: "NIST P-521 (ECDSA/ECDH)",
    brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
    brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
  };
  if (["eddsa", "eddsaLegacy", "curve25519"].includes(algoInfo.algorithm)) {
    return labelMap.curve25519;
  }
  if (algoInfo.curve && labelMap[algoInfo.curve]) {
    return labelMap[algoInfo.curve];
  }
  if (/^rsa/i.test(algoInfo.algorithm)) {
    switch (algoInfo.bits) {
      case 2048: return "RSA 2048";
      case 3072: return "RSA 3072";
      case 4096: return "RSA 4096";
      default: return `RSA (${algoInfo.bits || "?"} bits)`;
    }
  }
  return algoInfo.algorithm || "Unknown Algorithm";
};

// ---------------------------------------------------------------------------
// Key status
// ---------------------------------------------------------------------------

/**
 * Determine expiry date string and status for an openpgp key object.
 */
export const getKeyExpiryInfo = async (key) => {
  try {
    const isRevoked = await key.isRevoked();
    if (isRevoked) return { expirydate: "Revoked", status: "revoked" };
    const expirationTime = await key.getExpirationTime();
    const now = new Date();
    if (expirationTime === null || expirationTime === Infinity) {
      return { expirydate: "No Expiry", status: "active" };
    } else if (expirationTime < now) {
      return { expirydate: formatDate(expirationTime), status: "expired" };
    } else {
      return { expirydate: formatDate(expirationTime), status: "active" };
    }
  } catch {
    return { expirydate: "Error", status: "unknown" };
  }
};

/**
 * Returns true if the private key is encrypted (password-protected).
 */
export const isPasswordProtected = async (privateKeyArmored) => {
  try {
    const privateKey = await openpgp.readPrivateKey({
      armoredKey: privateKeyArmored,
    });
    return privateKey.isPrivate() && !privateKey.isDecrypted();
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Key processing
// ---------------------------------------------------------------------------

/**
 * Convert a raw IndexedDB key record into the shape used by all UI tables.
 */
export const processKey = async (key) => {
  const openpgpKey = await openpgp.readKey({ armoredKey: key.publicKey });

  const userIDs = openpgpKey.getUserIDs();
  const userIdCount = userIDs.length;

  const primaryUser = await openpgpKey.getPrimaryUser();
  const userID = primaryUser.user.userID.userID;

  let name, email;
  const match = userID.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    name = match[1].trim();
    email = match[2].trim();
  } else {
    name = userID.trim();
    email = "N/A";
  }

  const subkeysCount = openpgpKey.getSubkeys().length;
  const creationdate = formatDate(openpgpKey.getCreationTime());
  const { expirydate, status } = await getKeyExpiryInfo(openpgpKey);

  const passwordProtected = key.privateKey
    ? await isPasswordProtected(key.privateKey)
    : false;

  const fingerprint = formatFingerprint(
    openpgpKey.getFingerprint().toUpperCase()
  );
  const keyid = formatKeyID(openpgpKey.getKeyID().toHex().toUpperCase());
  const algorithm = formatAlgorithm(openpgpKey.getAlgorithmInfo());

  return {
    id: key.id,
    name,
    email,
    creationdate,
    expirydate,
    status,
    passwordprotected: passwordProtected ? "Yes" : "No",
    keyid,
    fingerprint,
    algorithm,
    avatar: (() => {
      const hasPrivateKey = key.privateKey && key.privateKey.trim() !== "";
      const hasPublicKey = key.publicKey && key.publicKey.trim() !== "";
      if (hasPrivateKey && hasPublicKey) return Keyring.src;
      else if (hasPublicKey) return Public.src;
    })(),
    publicKey: key.publicKey,
    privateKey: key.privateKey,
    userIdCount,
    subkeysCount,
  };
};

// ---------------------------------------------------------------------------
// IndexedDB loader
// ---------------------------------------------------------------------------

/**
 * Load, decrypt, and process all PGP keys from IndexedDB.
 * Returns an array of processed key objects ready for the UI.
 */
export const loadKeysFromIndexedDB = async () => {
  const db = await openDB();
  const encryptionKey = await getEncryptionKey();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(dbPgpKeys, "readonly");
    const store = transaction.objectStore(dbPgpKeys);
    let results = [];
    const request = store.openCursor();

    const finish = async () => {
      try {
        const decryptedKeys = await Promise.all(
          results.map((record) =>
            decryptData(record.encrypted, encryptionKey, record.iv)
          )
        );
        const processedKeys = await Promise.all(decryptedKeys.map(processKey));
        resolve(processedKeys.filter((key) => key !== null));
      } catch (err) {
        reject(err);
      }
    };

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        finish();
      }
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
};

// ---------------------------------------------------------------------------
// Subkey decryption helper
// ---------------------------------------------------------------------------

/**
 * Decrypt all encrypted subkeys on a decrypted primary private key,
 * prompting the user via `triggerSubkeyPasswordModal` for each
 * subkey that cannot be unlocked with already-cached passwords.
 *
 * @param {openpgp.PrivateKey} privateKey  - Already-decrypted primary key
 * @param {object} opts
 * @param {Function} opts.triggerSubkeyPasswordModal - async (subkey) => password string
 * @param {Function} opts.setSubkeyGlobalIndex       - React state setter
 * @param {Function} opts.addToast                   - HeroUI addToast
 * @returns {Promise<Map<number, string>>} Map of subkeyIndex → passphrase used
 */
export const decryptAllSubkeys = async (
  privateKey,
  { triggerSubkeyPasswordModal, setSubkeyGlobalIndex, addToast }
) => {
  const subkeys = privateKey.getSubkeys();
  const subkeyPassphrases = new Map();
  const triedPasswords = new Set();

  for (let i = 0; i < subkeys.length; i++) {
    const subkey = subkeys[i];
    if (await subkey.isRevoked()) continue;
    if (subkey.isDecrypted()) continue;

    setSubkeyGlobalIndex(i);
    let subkeyPass = null;

    // Try every cached password first
    for (const pass of triedPasswords) {
      if (subkey.isDecrypted()) break;
      try {
        if (!subkey.isDecrypted()) {
          await subkey.keyPacket.decrypt(pass);
        }
        subkeyPass = pass;
        break;
      } catch (err) {
        if (/already decrypted/i.test(err.message)) {
          subkeyPass = pass;
          break;
        }
      }
    }

    // If still locked, prompt the user
    if (!subkeyPass) {
      try {
        const pass = await triggerSubkeyPasswordModal(subkey);
        triedPasswords.add(pass);
        if (!subkey.isDecrypted()) {
          await subkey.keyPacket.decrypt(pass);
        }
        subkeyPass = pass;
      } catch (err) {
        addToast({ title: "Failed to decrypt subkey", color: "danger" });
        console.error(`Failed to decrypt subkey ${i}:`, err);
        throw err; // let caller handle abort
      }
    }

    subkeyPassphrases.set(i, subkeyPass);
  }

  return subkeyPassphrases;
};

/**
 * Re-encrypt subkeys using their individual passphrases after a key mutation.
 *
 * @param {string}           armoredPrivateKey  - Decrypted armored private key
 * @param {Map<number,string>} subkeyPassphrases - Map of index → passphrase
 * @returns {Promise<string>} Re-armored private key
 */
export const reEncryptSubkeys = async (armoredPrivateKey, subkeyPassphrases) => {
  if (subkeyPassphrases.size === 0) return armoredPrivateKey;

  const keyToReEncrypt = await openpgp.readPrivateKey({
    armoredKey: armoredPrivateKey,
  });
  const subkeys = keyToReEncrypt.getSubkeys();

  for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
    if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
      await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
    }
  }

  return keyToReEncrypt.armor();
};
