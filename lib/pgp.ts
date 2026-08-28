/**
 * lib/pgp.ts
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
export const formatDate = (isoDate: any) => {
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
export const parseExpiryToCalendarDate = (expiryStr: any) => {
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
  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  return new CalendarDate(Number(year), monthMap[monthStr], Number(day));
};

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

export const capitalize = (s: any) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

/**
 * Parse an OpenPGP User ID string "Name <email>" into { id, name, email }.
 */
export const parseUserId = (uid: any) => {
  const match = uid.match(/^(.*?)\s*<(.+?)>$/);
  return match
    ? { id: uid, name: match[1].trim(), email: match[2].trim() || "N/A", status: "active" }
    : { id: uid, name: uid.trim(), email: "N/A", status: "active" };
};

// ---------------------------------------------------------------------------
// Key formatting helpers
// ---------------------------------------------------------------------------

const formatFingerprint = (fingerprint: any) => {
  const parts = fingerprint.match(/.{1,4}/g);
  const nbsp = "\u00A0";
  return parts.slice(0, 5).join(" ") + nbsp.repeat(6) + parts.slice(5).join(" ");
};

const formatKeyID = (keyid: any) => keyid.match(/.{1,4}/g).join(" ");

const formatAlgorithm = (algoInfo: any) => {
  const labelMap: Record<string, string> = {
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
export const getKeyExpiryInfo = async (key: any) => {
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
export const isPasswordProtected = async (privateKeyArmored: any) => {
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
export const processKey = async (key: any) => {
  const openpgpKey = await openpgp.readKey({ armoredKey: key.publicKey });

  const userIDs = openpgpKey.getUserIDs();
  const userIdCount = userIDs.length;

  const primaryUser = await openpgpKey.getPrimaryUser();
  const userID = primaryUser.user.userID?.userID || "";

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
export const loadKeysFromIndexedDB = async (): Promise<any[]> => {
  const db: any = await openDB();
  const encryptionKey = await getEncryptionKey();

  return new Promise<any[]>((resolve, reject) => {
    const transaction = db.transaction(dbPgpKeys, "readonly");
    const store = transaction.objectStore(dbPgpKeys);
    let results: any[] = [];
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
      } catch (err: any) {
        reject(err);
      }
    };

    request.onsuccess = (e: any) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        finish();
      }
    };

    request.onerror = (e: any) => {
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
  privateKey: any,
  { triggerSubkeyPasswordModal, setSubkeyGlobalIndex, addToast }: any
) => {
  const subkeys = privateKey.getSubkeys();
  const subkeyPassphrases = new Map();
  const triedPasswords = new Set();

  try {
    for (let i = 0; i < subkeys.length; i++) {
      const subkey = subkeys[i];
      if (await subkey.isRevoked()) continue;
      if (subkey.isDecrypted()) continue;

      if (setSubkeyGlobalIndex) setSubkeyGlobalIndex(i);
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
        } catch (err: any) {
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
        } catch (err: any) {
          if (err instanceof Error && err.message === "Password entry cancelled") {
            throw err;
          }
          if (addToast) addToast({ title: "Failed to decrypt subkey", color: "danger" });
          console.error(`Failed to decrypt subkey ${i}:`, err);
          throw err; // let caller handle abort
        }
      }

      subkeyPassphrases.set(i, subkeyPass);
    }

    return subkeyPassphrases;
  } finally {
    if (setSubkeyGlobalIndex) setSubkeyGlobalIndex(null);
  }
};

/**
 * Re-encrypt subkeys using their individual passphrases after a key mutation.
 *
 * @param {string}           armoredPrivateKey  - Decrypted armored private key
 * @param {Map<number,string>} subkeyPassphrases - Map of index → passphrase
 * @returns {Promise<string>} Re-armored private key
 */
export const reEncryptSubkeys = async (armoredPrivateKey: any, subkeyPassphrases: any) => {
  if (subkeyPassphrases.size === 0) return armoredPrivateKey;

  const keyToReEncrypt = await openpgp.readPrivateKey({
    armoredKey: armoredPrivateKey,
  });
  const subkeys = keyToReEncrypt.getSubkeys();

  for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
    if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
      await (subkeys[subkeyIndex].keyPacket as any).encrypt(passphrase);
    }
  }

  return keyToReEncrypt.armor();
};

// ---------------------------------------------------------------------------
// File Download Helper
// ---------------------------------------------------------------------------

/**
 * Triggers a browser download of the given text content with the specified filename.
 */
export const downloadAsFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/plain" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
};

// ---------------------------------------------------------------------------
// Revocation Preservation Helpers
// ---------------------------------------------------------------------------

export interface RevocationStateMaps {
  userRevocationMap: Map<string, { isRevoked: boolean; revocationSignatures: any[] }>;
  subkeyRevocationMap: Map<string, { isRevoked: boolean; revocationSignatures: any[] }>;
  subkeyBindingSignaturesMap: Map<string, any[]>;
}

/**
 * Captures revocation signatures and subkey binding signatures from keys before
 * an operation (such as reformatKey) that might strip or rebuild them.
 *
 * Note: In OpenPGP.js v5+, User.isRevoked() and Subkey.isRevoked() return
 * Promise<boolean>, so this function must be async.
 */
export const captureRevocationState = async (
  publicKeyOrUsers: any,
  privateKeyOrSubkeys?: any
): Promise<RevocationStateMaps> => {
  const userRevocationMap = new Map<string, { isRevoked: boolean; revocationSignatures: any[] }>();
  const subkeyRevocationMap = new Map<string, { isRevoked: boolean; revocationSignatures: any[] }>();
  const subkeyBindingSignaturesMap = new Map<string, any[]>();

  if (publicKeyOrUsers) {
    const users = publicKeyOrUsers.users || (Array.isArray(publicKeyOrUsers) ? publicKeyOrUsers : []);
    for (const u of users) {
      if (u.userID) {
        const revoked = typeof u.isRevoked === "function" ? await u.isRevoked() : Boolean(u.isRevoked);
        userRevocationMap.set(u.userID.userID, {
          isRevoked: revoked,
          revocationSignatures: u.revocationSignatures ? [...u.revocationSignatures] : [],
        });
      }
    }
  }

  if (privateKeyOrSubkeys) {
    const subkeys = typeof privateKeyOrSubkeys.getSubkeys === "function"
      ? privateKeyOrSubkeys.getSubkeys()
      : (Array.isArray(privateKeyOrSubkeys) ? privateKeyOrSubkeys : []);
    for (const sk of subkeys) {
      const fp = typeof sk.getFingerprint === "function" ? sk.getFingerprint() : "";
      if (fp) {
        const revoked = typeof sk.isRevoked === "function" ? await sk.isRevoked() : Boolean(sk.isRevoked);
        subkeyRevocationMap.set(fp, {
          isRevoked: revoked,
          revocationSignatures: sk.revocationSignatures ? [...sk.revocationSignatures] : [],
        });
        if (sk.bindingSignatures) {
          subkeyBindingSignaturesMap.set(fp, [...sk.bindingSignatures]);
        }
      }
    }
  }

  return { userRevocationMap, subkeyRevocationMap, subkeyBindingSignaturesMap };
};

/**
 * Restores revocation and binding signatures onto a mutated OpenPGP key object.
 */
export const restoreRevocationState = (
  targetKey: any,
  maps: RevocationStateMaps
) => {
  const { userRevocationMap, subkeyRevocationMap, subkeyBindingSignaturesMap } = maps;

  if (typeof targetKey.getSubkeys === "function") {
    targetKey.getSubkeys().forEach((sk: any) => {
      const fp = sk.getFingerprint();
      const origBind = subkeyBindingSignaturesMap?.get(fp);
      if (origBind?.length) sk.bindingSignatures = [...origBind];

      const orig = subkeyRevocationMap?.get(fp);
      if (orig?.isRevoked) {
        orig.revocationSignatures.forEach((sig: any) => {
          if (!sk.revocationSignatures.some((e: any) => (typeof e.equals === "function" ? e.equals(sig) : e === sig))) {
            sk.revocationSignatures.push(sig);
          }
        });
      }
    });
  }

  if (targetKey.users) {
    targetKey.users.forEach((u: any) => {
      if (!u.userID) return;
      const orig = userRevocationMap?.get(u.userID.userID);
      if (orig?.isRevoked) {
        orig.revocationSignatures.forEach((sig: any) => {
          if (!u.revocationSignatures.some((e: any) => (typeof e.equals === "function" ? e.equals(sig) : e === sig))) {
            u.revocationSignatures.push(sig);
          }
        });
      }
    });
  }
};

// ---------------------------------------------------------------------------
// Safe Expiration Calculation
// ---------------------------------------------------------------------------

/**
 * Safely computes keyExpirationTime (in seconds) from OpenPGP.js date values.
 * Handles the `Infinity` return from `getExpirationTime()` for no-expiry keys,
 * as well as null/undefined, returning `undefined` to signal "no expiry" to
 * reformatKey / generateKey.
 */
export const safeExpirationSeconds = (
  expirationTime: Date | typeof Infinity | null | undefined,
  creationTime: Date
): number | undefined => {
  if (!expirationTime) return undefined;
  const expMs = new Date(expirationTime as any).getTime();
  if (!isFinite(expMs)) return undefined;
  const seconds = Math.floor((expMs - new Date(creationTime).getTime()) / 1000);
  return seconds > 0 ? seconds : undefined;
};

// ---------------------------------------------------------------------------
// Key Decryption & Re-encryption Lifecycle Helper
// ---------------------------------------------------------------------------

export interface DecryptedKeyContext {
  privateKey: any;
  /** Lazily parsed — only reads user.publicKey when accessed. Avoids unnecessary parsing for revocation-only ops. */
  publicKeyObj: any;
  currentPassword: string | null;
  subkeyPassphrases: Map<number, string>;
}

export interface WithDecryptedKeyOpts {
  triggerKeyPasswordModal: (user: any) => Promise<string>;
  decryptSubkeys: (privateKey: any) => Promise<Map<number, string>>;
}

/**
 * Executes a mutation operation on a decrypted private key, automatically managing:
 * 1. Decrypting primary private key if passphrase-protected (prompting via modal)
 * 2. Decrypting all subkeys
 * 3. Executing callback with decrypted keys
 * 4. Re-encrypting primary private key with original passphrase
 * 5. Re-encrypting subkeys with their individual passphrases
 * 6. Returning final armored private and public keys
 *
 * The `publicKeyObj` in the context is lazily parsed from `user.publicKey` —
 * operations that don't need it (e.g. revokeKey) skip the readKey call entirely.
 */
export const withDecryptedKey = async (
  user: { id: string; privateKey: string; publicKey: string; [key: string]: any },
  opts: WithDecryptedKeyOpts,
  operation: (ctx: DecryptedKeyContext) => Promise<{
    privateKey: any;
    publicKey?: string;
  } | void>
): Promise<{ finalPrivateKey: string; finalPublicKey: string; currentPassword: string | null }> => {
  let privateKey: any = await openpgp.readPrivateKey({ armoredKey: user.privateKey });
  let currentPassword: string | null = null;

  if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
    currentPassword = await opts.triggerKeyPasswordModal(user);
    privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
  }

  const subkeyPassphrases = await opts.decryptSubkeys(privateKey);

  // Lazy public key — initialized on first access via privateKey.toPublic()
  let _publicKeyObj: any = null;
  const ctx: DecryptedKeyContext = {
    privateKey,
    get publicKeyObj() {
      if (!_publicKeyObj) {
        _publicKeyObj = privateKey.toPublic();
      }
      return _publicKeyObj;
    },
    currentPassword,
    subkeyPassphrases,
  };

  const result = await operation(ctx);

  let mutatedPrivateKey = result?.privateKey ?? privateKey;
  let privateKeyObj =
    typeof mutatedPrivateKey === "string"
      ? await openpgp.readPrivateKey({ armoredKey: mutatedPrivateKey })
      : mutatedPrivateKey;

  let finalPrivateKeyArmored = privateKeyObj.armor();
  const finalPublicKeyArmored = result?.publicKey || privateKeyObj.toPublic().armor();

  if (currentPassword) {
    const keyToEncrypt = await openpgp.readPrivateKey({ armoredKey: finalPrivateKeyArmored });
    const reEncrypted = await openpgp.encryptKey({
      privateKey: keyToEncrypt,
      passphrase: currentPassword,
    });
    finalPrivateKeyArmored = reEncrypted.armor();
  }

  finalPrivateKeyArmored = await reEncryptSubkeys(finalPrivateKeyArmored, subkeyPassphrases);

  return {
    finalPrivateKey: finalPrivateKeyArmored,
    finalPublicKey: finalPublicKeyArmored,
    currentPassword,
  };
};

