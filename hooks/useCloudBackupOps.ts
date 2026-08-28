"use client";

import { useCallback, useRef, useState } from "react";
import * as openpgp from "openpgp";
import {
  openDB,
  getEncryptionKey,
  decryptData,
  dbPgpKeys,
} from "@/lib/indexeddb";
import { workerPool } from "@/lib/workerPool";
import { addToast } from "@heroui/react";
import KeyringImg from "@/assets/Keyring.png";
import PublicImg from "@/assets/Public.png";

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

const formatDate = (isoDate: any) => {
  const date = new Date(isoDate);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const getKeyExpiryInfo = async (key: any) => {
  try {
    const isRevoked = await key.isRevoked();
    if (isRevoked) {
      return { expirydate: "Revoked", keystatus: "revoked" };
    }
    const expirationTime = await key.getExpirationTime();
    const now = new Date();
    if (expirationTime === null || expirationTime === Infinity) {
      return { expirydate: "No Expiry", keystatus: "active" };
    } else if (expirationTime < now) {
      return {
        expirydate: formatDate(expirationTime),
        keystatus: "expired",
      };
    } else {
      return {
        expirydate: formatDate(expirationTime),
        keystatus: "active",
      };
    }
  } catch {
    return { expirydate: "Error", keystatus: "unknown" };
  }
};

const isPasswordProtected = async (privateKeyArmored: any) => {
  try {
    const privateKey = await openpgp.readPrivateKey({
      armoredKey: privateKeyArmored,
    });
    return privateKey.isPrivate() && !privateKey.isDecrypted();
  } catch {
    return false;
  }
};

const formatFingerprint = (fingerprint: any) => {
  const parts = fingerprint.match(/.{1,4}/g);
  const nbsp = "\u00A0";
  return (
    parts.slice(0, 5).join(" ") + nbsp.repeat(6) + parts.slice(5).join(" ")
  );
};

const formatKeyID = (keyid: any) => keyid.match(/.{1,4}/g).join(" ");

const formatAlgorithm = (algoInfo: any) => {
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
  if (algoInfo.curve && (labelMap as any)[algoInfo.curve]) {
    return (labelMap as any)[algoInfo.curve];
  }
  if (/^rsa/i.test(algoInfo.algorithm)) {
    switch (algoInfo.bits) {
      case 2048:
        return "RSA 2048";
      case 3072:
        return "RSA 3072";
      case 4096:
        return "RSA 4096";
      default:
        return `RSA (${algoInfo.bits || "?"} bits)`;
    }
  }
  return algoInfo.algorithm || "Unknown Algorithm";
};

export const processKey = async (key: any, validDecryptedBackedUpKeys: any[] = []) => {
  const openpgpKey = await openpgp.readKey({ armoredKey: key.publicKey });

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

  const creationdate = formatDate(openpgpKey.getCreationTime());
  const { expirydate, keystatus } = await getKeyExpiryInfo(openpgpKey);

  const passwordProtected = key.privateKey
    ? await isPasswordProtected(key.privateKey)
    : false;

  const isBackedUp = validDecryptedBackedUpKeys.some((backedUpKey) => {
    if (key.privateKey && backedUpKey.privateKey) {
      const normalizedLocal = key.privateKey.replace(/\s+/g, "").trim().toLowerCase();
      const normalizedCloud = backedUpKey.privateKey.replace(/\s+/g, "").trim().toLowerCase();
      return normalizedLocal === normalizedCloud;
    }
    return key.publicKey === backedUpKey.publicKey;
  });

  const fingerprint = formatFingerprint(
    openpgpKey.getFingerprint().toUpperCase()
  );
  const keyid = formatKeyID(openpgpKey.getKeyID().toHex().toUpperCase());
  const algorithm = formatAlgorithm(openpgpKey.getAlgorithmInfo());

  const avatar = (() => {
    const hasPrivateKey = key.privateKey && key.privateKey.trim() !== "";
    const hasPublicKey = key.publicKey && key.publicKey.trim() !== "";
    if (hasPrivateKey && hasPublicKey) return KeyringImg.src;
    else if (hasPublicKey) return PublicImg.src;
    else return KeyringImg.src;
  })();

  return {
    id: key.id,
    name,
    email,
    creationdate,
    expirydate,
    keystatus,
    passwordprotected: passwordProtected ? "Yes" : "No",
    status: isBackedUp ? "Backed Up" : "Not Backed Up",
    keyid,
    fingerprint,
    algorithm,
    avatar,
    publicKey: key.publicKey,
    privateKey: key.privateKey,
  };
};

const getTotalKeysCount = async () => {
  const db: any = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(dbPgpKeys, "readonly");
    const store = transaction.objectStore(dbPgpKeys);
    const countRequest = store.count();
    countRequest.onsuccess = () => resolve(countRequest.result);
    countRequest.onerror = (e: any) => reject(e.target.error);
  });
};

// ---------------------------------------------------------------------------
// Main Cloud Backup Hook
// ---------------------------------------------------------------------------

export function useCloudBackupOps({
  page,
  rowsPerPage,
  setUsers,
  setTotalKeys,
  setIsLoading,
  isLoadingKeys,
  setIsLoadingKeys,
  getVaultPassword,
  getVaultKeyMaterial,
  router,
  triggerPasswordModal,
}: any) {
  const fetchInProgressRef = useRef(false);
  const [backingUpKeyIds, setBackingUpKeyIds] = useState<Set<string | number>>(new Set());

  const loadKeysFromIndexedDB = useCallback(
    async (offset: number, limit: number) => {
      if (isLoadingKeys) return [];
      if (window.loadingKeysInProgress) return [];

      setIsLoadingKeys(true);
      window.loadingKeysInProgress = true;

      try {
        const db: any = await openDB();
        const encryptionKey = await getEncryptionKey();
        let backedUpKeys = [];

        try {
          const res = await fetch("/api/csrf", { method: "GET" });
          const { csrfToken } = await res.json();

          const response = await fetch("/api/manage-keys/fetch-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ csrfToken }),
          });
          if (response.ok) {
            const data = await response.json();
            backedUpKeys = data.keys || [];
          } else {
            if (response.status === 429) {
              addToast({ title: "Too many requests. Please try again.", color: "warning" });
            } else if (response.status === 401) {
              addToast({ title: "Please log in to continue.", color: "danger" });
            } else {
              addToast({ title: "Failed to fetch backed up keys.", color: "danger" });
            }
          }
        } catch (error) {
          console.error("Error fetching backed up keys:", error);
        }

        const vaultAuth = getVaultKeyMaterial
          ? await getVaultKeyMaterial()
          : { password: await getVaultPassword(), keyMaterial: null, vaultSalt: null };

        const decryptedBackedUpKeys = await Promise.all(
          backedUpKeys.map(async (backedUpKey: any) => {
            try {
              const [decryptedCloudPublicKey, decryptedCloudPrivateKey] = await Promise.all([
                backedUpKey.publicKey
                  ? (workerPool as any)({
                      type: "decrypt",
                      responseType: "decryptResponse",
                      encryptedBase64: backedUpKey.publicKey,
                      password: vaultAuth?.password,
                      keyMaterial: vaultAuth?.keyMaterial,
                      expectedSalt: vaultAuth?.vaultSalt,
                    }, addToast)
                  : Promise.resolve(""),
                backedUpKey.privateKey
                  ? (workerPool as any)({
                      type: "decrypt",
                      responseType: "decryptResponse",
                      encryptedBase64: backedUpKey.privateKey,
                      password: vaultAuth?.password,
                      keyMaterial: vaultAuth?.keyMaterial,
                      expectedSalt: vaultAuth?.vaultSalt,
                    }, addToast)
                  : Promise.resolve(""),
              ]);
              return {
                publicKey: decryptedCloudPublicKey,
                privateKey: decryptedCloudPrivateKey,
              };
            } catch {
              return null;
            }
          })
        );

        const validDecryptedBackedUpKeys = decryptedBackedUpKeys.filter((k) => k !== null);

        return new Promise((resolve, reject) => {
          const transaction = db.transaction(dbPgpKeys, "readonly");
          const store = transaction.objectStore(dbPgpKeys);
          let results: any[] = [];
          let index = 0;
          let count = 0;

          const request = store.openCursor();
          request.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              if (index >= offset && count < limit) {
                results.push(cursor.value);
                count++;
              }
              index++;
              if (count < limit) {
                cursor.continue();
              } else {
                finish();
              }
            } else {
              finish();
            }
          };

          const finish = async () => {
            try {
              const decryptedKeys = await Promise.all(
                results.map(async (record) => {
                  try {
                    return await decryptData(record.encrypted, encryptionKey, record.iv);
                  } catch {
                    return null;
                  }
                })
              );
              const validDecryptedKeys = decryptedKeys.filter((k) => k !== null);
              const processedKeys = await Promise.all(
                validDecryptedKeys.map((k) => processKey(k, validDecryptedBackedUpKeys))
              );
              resolve(processedKeys.filter((key) => key !== null));
            } catch (err) {
              reject(err);
            }
          };
          request.onerror = (e: any) => reject(e.target.error);
        });
      } finally {
        setIsLoadingKeys(false);
        window.loadingKeysInProgress = false;
      }
    },
    [isLoadingKeys, setIsLoadingKeys, getVaultPassword, getVaultKeyMaterial]
  );

  const fetchKeys = useCallback(async () => {
    if (fetchInProgressRef.current) return;

    fetchInProgressRef.current = true;
    setIsLoading(true);

    try {
      const offset = (page - 1) * rowsPerPage;
      const keys = await loadKeysFromIndexedDB(offset, rowsPerPage);
      setUsers(keys);

      const total = await getTotalKeysCount();
      setTotalKeys(total);
    } catch (error) {
      console.error("Error in fetchKeys:", error);
      addToast({ title: "Failed to initialize key loading", color: "danger" });
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, [page, rowsPerPage, setUsers, setTotalKeys, setIsLoading, loadKeysFromIndexedDB]);

  const backupKey = useCallback(async (user: any) => {
    try {
      const isPublicKeyOnly = !user.privateKey || user.privateKey.trim() === "";
      let privateKeyRaw = null;
      let key = null;

      if (!isPublicKeyOnly) {
        let isProtected = false;
        try {
          isProtected = await isPasswordProtected(user.privateKey);
        } catch {
          isProtected = false;
        }

        if (isProtected) {
          let privateKeyObj;
          try {
            privateKeyObj = await openpgp.readPrivateKey({ armoredKey: user.privateKey });
          } catch {
            throw new Error("Corrupted private key structure.");
          }

          let decryptedKey = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (!decryptedKey && attempts < maxAttempts) {
            let passphrase = null;
            try {
              passphrase = await triggerPasswordModal(user.name);
            } catch {
              addToast({ title: "Password entry cancelled", color: "warning" });
              return;
            }

            if (!passphrase) {
              addToast({ title: "Password is required to decrypt this key", color: "danger" });
              return;
            }

            try {
              decryptedKey = await openpgp.decryptKey({ privateKey: privateKeyObj, passphrase });
            } catch {
              attempts++;
              const remaining = maxAttempts - attempts;
              if (remaining > 0) {
                addToast({
                  title: `Incorrect password. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining.`,
                  color: "danger",
                });
              } else {
                addToast({
                  title: "Too many failed attempts. Please try again later.",
                  color: "danger",
                });
                return;
              }
            }
          }

          if (!decryptedKey) return;
          privateKeyRaw = decryptedKey.armor();
          key = decryptedKey;
        } else {
          privateKeyRaw = user.privateKey;
          try {
            key = await openpgp.readPrivateKey({ armoredKey: user.privateKey });
          } catch {
            throw new Error("Invalid unencrypted private key data.");
          }
        }
      } else {
        try {
          key = await openpgp.readKey({ armoredKey: user.publicKey });
        } catch {
          throw new Error("Failed to read public key.");
        }
      }

      if (!key && !user.publicKey) {
        try {
          key = await openpgp.readKey({ armoredKey: user.publicKey });
        } catch {
          throw new Error("Failed to read both private and public keys.");
        }
      }

      if (!key) throw new Error("No valid PGP key found.");

      const vaultAuth = getVaultKeyMaterial
        ? await getVaultKeyMaterial()
        : { password: await getVaultPassword(), keyMaterial: null, vaultSalt: null };

      if (!vaultAuth?.password && !vaultAuth?.keyMaterial) {
        addToast({ title: "No vault password found. Please lock and reopen vault.", color: "danger" });
        return;
      }

      setBackingUpKeyIds((prev) => new Set(prev).add(user.id));
      try {
        let privateKeyHash = null, encryptedPrivateKey = null;
        let publicKeyHash = null, encryptedPublicKey = null;
        const hasPrivate = privateKeyRaw && privateKeyRaw.trim() !== "";
        const hasPublic = user.publicKey && user.publicKey.trim() !== "";

        if (hasPrivate) {
          const [hash, encrypted] = await Promise.all([
            (workerPool as any)({ type: "hashKey", responseType: "hashKeyResponse", text: privateKeyRaw }, addToast),
            (workerPool as any)({
              type: "encrypt",
              responseType: "encryptResponse",
              text: privateKeyRaw,
              password: vaultAuth?.password,
              keyMaterial: vaultAuth?.keyMaterial,
              salt: vaultAuth?.vaultSalt,
            }, addToast),
          ]);
          privateKeyHash = hash;
          encryptedPrivateKey = encrypted;
        }
        if (!hasPrivate && hasPublic) {
          const [hash, encrypted] = await Promise.all([
            (workerPool as any)({ type: "hashKey", responseType: "hashKeyResponse", text: user.publicKey }, addToast),
            (workerPool as any)({
              type: "encrypt",
              responseType: "encryptResponse",
              text: user.publicKey,
              password: vaultAuth?.password,
              keyMaterial: vaultAuth?.keyMaterial,
              salt: vaultAuth?.vaultSalt,
            }, addToast),
          ]);
          publicKeyHash = hash;
          encryptedPublicKey = encrypted;
        }

        const payload = {
          ...(encryptedPrivateKey ? { encryptedPrivateKey } : {}),
          ...(encryptedPublicKey ? { encryptedPublicKey } : {}),
          ...(privateKeyHash ? { privateKeyHash } : {}),
          ...(publicKeyHash ? { publicKeyHash } : {}),
        };

        const res = await fetch("/api/csrf", { method: "GET" });
        if (!res.ok) {
          if (res.status === 429) addToast({ title: "Too many requests. Please try again.", color: "warning" });
          else if (res.status === 401) {
            addToast({ title: "Please log in to continue.", color: "danger" });
            router.push("/login");
          } else addToast({ title: "Failed to get session token.", color: "danger" });
          return;
        }

        const { csrfToken } = await res.json();
        const response = await fetch("/api/manage-keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, csrfToken }),
        });

        const responseData = await response.json();

        if (response.ok) {
          if (responseData.message === "Key already backed up.") {
            addToast({ title: `${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"} is already backed up`, color: "primary" });
          } else {
            addToast({ title: `${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"} successfully backed up to the cloud!`, color: "success" });
            setUsers((prevUsers: any[]) =>
              prevUsers.map((u: any) => (u.id === user.id ? { ...u, status: "Backed Up" } : u))
            );
          }
        } else {
          if (response.status === 429) {
            addToast({ title: "Too many requests. Please try again.", color: "warning" });
          } else if (response.status === 403) {
            addToast({ title: "Session expired. Please refresh the page.", color: "danger" });
            setTimeout(() => window.location.reload(), 2000);
          } else {
            const errorMessage = responseData?.error || `Failed to back up ${user.name}'s key`;
            addToast({ title: errorMessage, color: "danger" });
          }
        }
      } finally {
        setBackingUpKeyIds((prev) => {
          const next = new Set(prev);
          next.delete(user.id);
          return next;
        });
      }
    } catch (error) {
      console.error(error);
      addToast({ title: `Failed to process ${user.name}'s key.`, color: "danger" });
    }
  }, [getVaultPassword, getVaultKeyMaterial, router, triggerPasswordModal, setUsers]);

  return { fetchKeys, loadKeysFromIndexedDB, backupKey, fetchInProgressRef, backingUpKeyIds };
}
