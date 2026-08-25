"use client";

import { useCallback, useRef, useState } from "react";
import * as openpgp from "openpgp";
import {
  openDB,
  getEncryptionKey,
  encryptData,
  getStoredKeys,
  dbPgpKeys,
} from "@/lib/indexeddb";
import { workerPool } from "@/lib/workerPool";
import { addToast } from "@heroui/react";
import KeyringImg from "@/assets/Keyring.png";
import PublicImg from "@/assets/Public.png";

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

export const processKey = async (key: any, vaultAuth: any, storedKeys: any[], keyIndex: number) => {
  try {
    let decryptedCloudPrivateKey = "";
    let decryptedCloudPublicKey = "";
    const decryptionTasks = [];

    const password = typeof vaultAuth === "object" ? vaultAuth?.password : vaultAuth;
    const keyMaterial = typeof vaultAuth === "object" ? vaultAuth?.keyMaterial : null;
    const expectedSalt = typeof vaultAuth === "object" ? vaultAuth?.vaultSalt : null;

    if (key.privateKey) {
      decryptionTasks.push(
        (workerPool as any)(
          {
            type: "decrypt",
            responseType: "decryptResponse",
            encryptedBase64: key.privateKey,
            password,
            keyMaterial,
            expectedSalt,
          },
          addToast
        ).then((result: any) => {
          decryptedCloudPrivateKey = result;
        })
      );
    }
    if (key.publicKey) {
      decryptionTasks.push(
        (workerPool as any)(
          {
            type: "decrypt",
            responseType: "decryptResponse",
            encryptedBase64: key.publicKey,
            password,
            keyMaterial,
            expectedSalt,
          },
          addToast
        ).then((result: any) => {
          decryptedCloudPublicKey = result;
        })
      );
    }

    await Promise.all(decryptionTasks);

    const openpgpKey = await openpgp.readKey({
      armoredKey: decryptedCloudPrivateKey || decryptedCloudPublicKey,
    });

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

    const formatDate = (isoDate: any) => {
      const date = new Date(isoDate);
      const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const day = String(date.getDate()).padStart(2, "0");
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const creationdate = formatDate(openpgpKey.getCreationTime());

    const getKeyExpiryInfo = async (key: any) => {
      try {
        const expirationTime = await key.getExpirationTime();
        const now = new Date();
        if (expirationTime === null || expirationTime === Infinity) {
          return { expirydate: "No Expiry", keystatus: "active" };
        } else if (expirationTime < now) {
          return { expirydate: formatDate(expirationTime), keystatus: "expired" };
        } else {
          return { expirydate: formatDate(expirationTime), keystatus: "active" };
        }
      } catch {
        return { expirydate: "Error", keystatus: "unknown" };
      }
    };
    const { expirydate, keystatus } = await getKeyExpiryInfo(openpgpKey);

    const isPasswordProtected = async (privateKey: any) => {
      try {
        return privateKey.isPrivate() && !privateKey.isDecrypted();
      } catch {
        return false;
      }
    };

    const passwordProtected = await isPasswordProtected(openpgpKey);

    const formatFingerprint = (fingerprint: any) => {
      const parts = fingerprint.match(/.{1,4}/g);
      const nbsp = "\u00A0";
      return parts.slice(0, 5).join(" ") + nbsp.repeat(6) + parts.slice(5).join(" ");
    };
    const fingerprint = formatFingerprint(openpgpKey.getFingerprint().toUpperCase());

    const formatKeyID = (keyid: any) => keyid.match(/.{1,4}/g).join(" ");
    const keyid = formatKeyID(openpgpKey.getKeyID().toHex().toUpperCase());

    const formatAlgorithm = (algoInfo: any) => {
      const labelMap = {
        curve25519: "Curve25519 (EdDSA/ECDH)",
        nistP256: "NIST P-256 (ECDSA/ECDH)",
        nistP521: "NIST P-521 (ECDSA/ECDH)",
        brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
        brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
      };
      if (["eddsa", "eddsaLegacy", "curve25519"].includes(algoInfo.algorithm)) return labelMap.curve25519;
      if (algoInfo.curve && (labelMap as any)[algoInfo.curve]) return (labelMap as any)[algoInfo.curve];
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

    const algorithm = formatAlgorithm(openpgpKey.getAlgorithmInfo());

    const isImported = storedKeys.some((storedKey) => {
      if (decryptedCloudPublicKey && storedKey.publicKey) {
        return (
          decryptedCloudPublicKey.replace(/\s+/g, "").trim().toLowerCase() ===
          storedKey.publicKey.replace(/\s+/g, "").trim().toLowerCase()
        );
      }
      if (decryptedCloudPrivateKey && storedKey.privateKey) {
        return (
          decryptedCloudPrivateKey.replace(/\s+/g, "").trim().toLowerCase() ===
          storedKey.privateKey.replace(/\s+/g, "").trim().toLowerCase()
        );
      }
      return false;
    });

    const avatar = (() => {
      const hasPrivateKey = decryptedCloudPrivateKey && decryptedCloudPrivateKey.trim() !== "";
      const hasPublicKey = decryptedCloudPublicKey && decryptedCloudPublicKey.trim() !== "";
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
      status: isImported ? "Imported" : "Not Imported",
      keyid,
      fingerprint,
      algorithm,
      avatar,
      decryptedPrivateKey: decryptedCloudPrivateKey,
      decryptedPublicKey: decryptedCloudPublicKey,
      privateKeyHash: key.privateKeyHash,
      publicKeyHash: key.publicKeyHash,
    };
  } catch {
    addToast({ title: `Key ${keyIndex + 1} is corrupted`, color: "danger" });
    return {
      id: key.id || Date.now(),
      name: "N/A",
      email: "N/A",
      creationdate: "N/A",
      expirydate: "N/A",
      keystatus: "Corrupted",
      passwordprotected: "N/A",
      status: "N/A",
      keyid: "N/A",
      fingerprint: "N/A",
      algorithm: "N/A",
      avatar: KeyringImg.src,
      decryptedPrivateKey: null,
      decryptedPublicKey: null,
      privateKeyHash: key.privateKeyHash,
      publicKeyHash: key.publicKeyHash,
    };
  }
};

const saveKeyToIndexedDB = async (keyData: any) => {
  const encryptionKey = await getEncryptionKey();
  const { encrypted, iv } = await encryptData(keyData, encryptionKey);

  const db = await openDB();
  const transaction = (db as any).transaction(dbPgpKeys, "readwrite");
  const store = transaction.objectStore(dbPgpKeys);

  store.put({ id: keyData.id, encrypted, iv });
};

const checkIfKeyExists = async (newKeyData: any) => {
  const existingKeys = await getStoredKeys();

  return (existingKeys as any[]).some((key: any) => {
    if (newKeyData.privateKey) {
      const normalizedNewKey = newKeyData.privateKey.replace(/\s+/g, "").trim().toLowerCase();
      const normalizedExistingKey = key.privateKey?.replace(/\s+/g, "").trim().toLowerCase();
      return normalizedNewKey === normalizedExistingKey;
    }
    return key.publicKey === newKeyData.publicKey;
  });
};

// ---------------------------------------------------------------------------
// Main Cloud Manage Hook
// ---------------------------------------------------------------------------

export function useCloudManageOps({
  page,
  rowsPerPage,
  setUsers,
  setPage,
  setTotalKeys,
  getVaultPassword,
  getVaultKeyMaterial,
  router,
}: any) {
  const fetchInProgressRef = useRef(false);
  const decryptedCacheRef = useRef({});
  const apiCacheRef = useRef({});
  const [deletingKeyIds, setDeletingKeyIds] = useState<Set<string | number>>(new Set());

  const loadKeysFromCloud = useCallback(async () => {
    if (window.loadingCloudKeysInProgress) return [];
    window.loadingCloudKeysInProgress = true;

    try {
      const vaultAuth = getVaultKeyMaterial
        ? await getVaultKeyMaterial()
        : { password: await getVaultPassword(), keyMaterial: null, vaultSalt: null };

      const offset = (page - 1) * rowsPerPage;
      const limit = rowsPerPage;
      const cacheKey = `${page}-${rowsPerPage}`;
      const storedKeys = await getStoredKeys();

      if ((apiCacheRef.current as any)[cacheKey]) {
        const plainKeys = (apiCacheRef.current as any)[cacheKey];

        const processPromises = (plainKeys as any[]).map(async (key: any, index: any) => {
          if ((decryptedCacheRef.current as any)[key.id]) return (decryptedCacheRef.current as any)[key.id];
          const decrypted = await processKey(key, vaultAuth, storedKeys as any[], index).catch((err) => {
            console.error("Error processing key:", err);
            return null;
          });
          if (decrypted) (decryptedCacheRef.current as any)[key.id] = decrypted;
          return decrypted;
        });
        const results = await Promise.all(processPromises);
        return results.filter((k: any) => k !== null);
      }

      const res = await fetch("/api/csrf", { method: "GET" });
      if (!res.ok) {
        if (res.status === 429) addToast({ title: "Too many requests. Please try again.", color: "warning" });
        else if (res.status === 401) {
          addToast({ title: "Please log in to continue.", color: "danger" });
          router.push("/login");
        } else addToast({ title: "Failed to get session token.", color: "danger" });
        return [];
      }

      const { csrfToken } = await res.json();
      const response = await fetch("/api/manage-keys/fetch-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offset, limit, csrfToken }),
      });

      if (!response.ok) {
        if (response.status === 429) addToast({ title: "Too many requests. Please try again.", color: "warning" });
        else if (response.status === 403) {
          addToast({ title: "Session expired. Please refresh the page.", color: "danger" });
          setTimeout(() => window.location.reload(), 2000);
        } else addToast({ title: "Failed to fetch keys from API.", color: "danger" });
        return [];
      }

      const data = await response.json();
      const total = data.total || data.keys?.length || 0;
      setTotalKeys(total);

      const allKeys = data.keys || [];
      const paginatedKeys = allKeys.slice(offset, offset + limit);

      // Store plain objects directly in memory cache — data is already in the
      // JS heap, so encrypting/decrypting it adds CPU cost with zero security gain
      (apiCacheRef.current as any)[cacheKey] = paginatedKeys;

      const plainKeys = paginatedKeys;

      const processPromises = (plainKeys as any[]).map(async (key: any, index: any) => {
        if ((decryptedCacheRef.current as any)[key.id]) return (decryptedCacheRef.current as any)[key.id];
        const decrypted = await processKey(key, vaultAuth, storedKeys as any[], index).catch((err) => {
          console.error("Error processing key:", err);
          return null;
        });
        if (decrypted) (decryptedCacheRef.current as any)[key.id] = decrypted;
        return decrypted;
      });
      const results = await Promise.all(processPromises);
      return results.filter((k: any) => k !== null);
    } catch (error: any) {
      console.error("Error loading keys:", error);
      addToast({ title: "Failed to load keys.", color: "danger" });
      return [];
    } finally {
      window.loadingCloudKeysInProgress = false;
    }
  }, [page, rowsPerPage, getVaultPassword, getVaultKeyMaterial, router, setTotalKeys]);

  const importFromCloud = useCallback(async (selectedUser: any) => {
    try {
      const vaultPassword = await getVaultPassword();
      if (!vaultPassword) throw new Error("Vault password not available");

      let keyname;
      let publicKey = selectedUser.decryptedPublicKey;
      const privateKey = selectedUser.decryptedPrivateKey;

      if (privateKey && (!publicKey || publicKey.trim() === "")) {
        try {
          const privateKeyObj = await openpgp.readPrivateKey({ armoredKey: privateKey });
          const publicKeyObj = privateKeyObj.toPublic();
          publicKey = publicKeyObj.armor();
          const primaryUser = await privateKeyObj.getPrimaryUser();
          const userID = primaryUser.user.userID?.userID || "";
          keyname = userID.split("<")[0].trim() || "Unknown User";
        } catch (err) {
          console.error("Error generating public key:", err);
          throw new Error("Failed to generate public key from private key");
        }
      }

      if (!keyname && publicKey && publicKey.trim() !== "") {
        try {
          const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
          const primaryUser = await publicKeyObj.getPrimaryUser();
          const userID = primaryUser.user.userID?.userID || "";
          keyname = userID.split("<")[0].trim() || "Unknown User";
        } catch (err) {
          console.error("Error reading public key for user name:", err);
          keyname = "Unknown User";
        }
      }

      const keyData = {
        id: Date.now(),
        publicKey: publicKey,
        privateKey: privateKey && privateKey.trim().toLowerCase() !== "null" && privateKey.trim() !== "" ? privateKey : null,
      };

      const exists = await checkIfKeyExists(keyData);
      if (!exists) {
        await saveKeyToIndexedDB(keyData);

        apiCacheRef.current = {};
        decryptedCacheRef.current = {};

        const keyType = keyData.privateKey === null ? "Public Key" : "Keyring";
        addToast({ title: `Imported ${keyname}'s ${keyType}`, color: "success" });

        setUsers((prevUsers: any[]) => prevUsers.map((u: any) => u.id === selectedUser.id ? { ...u, status: "Imported" } : u));
      } else {
        const keyType = keyData.privateKey === null ? "Public Key" : "Keyring";
        addToast({ title: `${keyname}'s ${keyType} already exists`, color: "primary" });
      }
    } catch (error: any) {
      console.error("Error processing key:", error);
      addToast({ title: `Failed to import key: ${error.message}`, color: "danger" });
    }
  }, [getVaultPassword, setUsers]);

  const deleteKey = useCallback(async (user: any) => {
    setDeletingKeyIds((prev) => new Set(prev).add(user.id));
    try {
      let requestBody: any = { keyId: user.id };
      if (user.privateKeyHash) requestBody.privateKeyHash = user.privateKeyHash;
      else if (user.publicKeyHash) requestBody.publicKeyHash = user.publicKeyHash;

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
      const deleteResponse = await fetch("/api/manage-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, csrfToken }),
      });

      if (!deleteResponse.ok) {
        if (deleteResponse.status === 429) addToast({ title: "Too many requests.", color: "warning" });
        else if (deleteResponse.status === 403) {
          addToast({ title: "Session expired. Please refresh the page.", color: "danger" });
          setTimeout(() => window.location.reload(), 2000);
        } else {
          const errorData = await deleteResponse.json();
          addToast({ title: errorData.error || "Failed to delete key", color: "danger" });
        }
        return;
      }

      addToast({ title: `${user.name}'s Key successfully deleted from the cloud`, color: "success" });

      decryptedCacheRef.current = {};
      apiCacheRef.current = {};

      const refreshedKeys = await loadKeysFromCloud();
      setUsers(refreshedKeys);
      setPage(1);
    } catch (error: any) {
      console.error("Error in deleteKey:", error);
      addToast({ title: `Failed to delete key: ${error.message}`, color: "danger" });
    } finally {
      setDeletingKeyIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }, [router, setUsers, setPage, loadKeysFromCloud]);

  return { loadKeysFromCloud, importFromCloud, deleteKey, fetchInProgressRef, deletingKeyIds };
}
