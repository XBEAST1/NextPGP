/**
 * hooks/useKeyOperations.ts
 *
 * Core PGP key mutation operations and unified facade orchestrating
 * specialized domain hooks (Subkeys, Revocation, User IDs, Certifications).
 * Fully decoupled from UI layout and modal states.
 */

"use client";

import { useCallback } from "react";
import { addToast } from "@heroui/react";
import * as openpgp from "openpgp";
import {
  openDB,
  getEncryptionKey,
  decryptData,
  encryptData,
  dbPgpKeys,
  updateKeyInIndexeddb,
  notifyKeyringChannel,
} from "@/lib/indexeddb";
import {
  loadKeysFromIndexedDB,
  parseUserId,
  decryptAllSubkeys,
  reEncryptSubkeys,
  downloadAsFile,
  captureKeySignatureState,
  restoreKeySignatureState,
  withDecryptedKey,
} from "@/lib/pgp";
import { useSubkeyManagement } from "@/hooks/useSubkeyManagement";
import { useKeyRevocation } from "@/hooks/useKeyRevocation";
import { useUserIdManagement } from "@/hooks/useUserIdManagement";
import { useKeyCertifications } from "@/hooks/useKeyCertifications";

export interface KeyringUser {
  id: string;
  name: string;
  email?: string;
  publicKey: string;
  privateKey?: string;
  keyid: string;
  fingerprint: string;
  algorithm?: string;
  creationdate?: string;
  expirydate?: string;
  status?: string;
  passwordprotected?: string;
  avatar?: string | null;
  userIdCount?: number;
  subkeysCount?: number;
  [key: string]: any;
}

export interface UseKeyOperationsConfig {
  setUsers: (users: KeyringUser[] | any[]) => void;
  // from usePasswordModal
  triggerKeyPasswordModal: (user: any) => Promise<string>;
  triggerNewPasswordChangeModal: () => Promise<string>;
  triggerSubkeyPasswordModal: (subkey: any) => Promise<string>;
  setSubkeyGlobalIndex: (idx: number | null) => void;
  // selected key context
  selectedUserId: KeyringUser | any;
  selectedKeyName?: string;
  selectedKeyId?: string;
  // revocation
  revocationReason: string;
  revocationReasonText: string;
  setRevocationReasonText: (text: string) => void;
  // pagination (for deleteKey page adjustment)
  page: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  rowsPerPage: number;
}

const isCancellationError = (err: any): boolean => {
  return err instanceof Error && err.message === "Password entry cancelled";
};

export function useKeyOperations({
  setUsers,
  triggerKeyPasswordModal,
  triggerNewPasswordChangeModal,
  triggerSubkeyPasswordModal,
  setSubkeyGlobalIndex,
  selectedUserId,
  selectedKeyName = "",
  selectedKeyId = "",
  revocationReason,
  revocationReasonText,
  setRevocationReasonText,
  page,
  setPage,
  rowsPerPage,
}: UseKeyOperationsConfig) {
  // ---------------------------------------------------------------------------
  // Internal Decryption Helpers
  // ---------------------------------------------------------------------------

  const decryptSubkeys = useCallback(
    (privateKey: any) =>
      decryptAllSubkeys(privateKey, {
        triggerSubkeyPasswordModal,
        setSubkeyGlobalIndex,
        addToast,
      }),
    [triggerSubkeyPasswordModal, setSubkeyGlobalIndex]
  );

  const getDecryptionOpts = useCallback(
    () => ({
      triggerKeyPasswordModal,
      decryptSubkeys,
    }),
    [triggerKeyPasswordModal, decryptSubkeys]
  );

  // ---------------------------------------------------------------------------
  // Sub-Hooks Composition
  // ---------------------------------------------------------------------------

  const subkeyOps = useSubkeyManagement({
    setUsers,
    getDecryptionOpts,
    triggerKeyPasswordModal,
    triggerNewPasswordChangeModal,
    triggerSubkeyPasswordModal,
    setSubkeyGlobalIndex,
    selectedUserId,
    selectedKeyName,
    selectedKeyId,
    revocationReason,
    revocationReasonText,
    setRevocationReasonText,
  });

  const revocationOps = useKeyRevocation({
    setUsers,
    getDecryptionOpts,
    decryptSubkeys,
    triggerKeyPasswordModal,
    revocationReason,
    revocationReasonText,
    setRevocationReasonText,
  });

  const userIdOps = useUserIdManagement({
    setUsers,
    getDecryptionOpts,
  });

  const certOps = useKeyCertifications({
    setUsers,
    triggerKeyPasswordModal,
    decryptSubkeys,
  });

  // ---------------------------------------------------------------------------
  // updateKeyPassword (IndexedDB write guarded with Web Locks)
  // ---------------------------------------------------------------------------

  const updateKeyPassword = useCallback(async (userId: string, newArmoredKey: string) => {
    const runUpdate = async () => {
      const db: any = await openDB();
      const encryptionKey = await getEncryptionKey();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("pgpKeys", "readonly");
        const store = transaction.objectStore("pgpKeys");
        const getRequest = store.get(userId);

        getRequest.onsuccess = async () => {
          const record = getRequest.result;
          if (!record) return reject(new Error("Key record not found"));

          try {
            const originalDecrypted = await decryptData(
              record.encrypted,
              encryptionKey,
              record.iv
            );
            const updatedDecrypted = { ...originalDecrypted, privateKey: newArmoredKey };
            const { encrypted, iv } = await encryptData(updatedDecrypted, encryptionKey);
            record.encrypted = encrypted;
            record.iv = iv;
          } catch (error: any) {
            return reject(error);
          }

          const writeTx = db.transaction("pgpKeys", "readwrite");
          const writeStore = writeTx.objectStore("pgpKeys");
          const putRequest = writeStore.put(record);
          putRequest.onsuccess = () => {
            notifyKeyringChannel();
            resolve();
          };
          putRequest.onerror = (e: any) => reject(e.target.error);
        };

        getRequest.onerror = (e: any) => reject(e.target.error);
      });
    };

    if (typeof navigator !== "undefined" && navigator.locks) {
      return navigator.locks.request(`pgp-key-${userId}`, runUpdate);
    }
    return runUpdate();
  }, []);

  // ---------------------------------------------------------------------------
  // publishKeyOnServer
  // ---------------------------------------------------------------------------

  const publishKeyOnServer = useCallback(async (): Promise<boolean> => {
    if (!selectedUserId) return false;
    try {
      const response = await fetch("/api/keyserver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: selectedUserId.publicKey }),
      });
      if (!response.ok) throw new Error("Failed to publish key on the server.");

      addToast({
        title: `${selectedKeyName}'s Key published successfully`,
        color: "success",
      });
      return true;
    } catch (error: any) {
      console.error("Error publishing key:", error);
      addToast({ title: `Failed to publish ${selectedKeyName}'s key`, color: "danger" });
      return false;
    }
  }, [selectedUserId, selectedKeyName]);

  // ---------------------------------------------------------------------------
  // exportPublicKey
  // ---------------------------------------------------------------------------

  const exportPublicKey = useCallback((user: KeyringUser | any) => {
    if (!user || !user.publicKey) return "";
    const keyid = (user.keyid || "").replace(/\s/g, "");
    downloadAsFile(user.publicKey, `${user.name}_0x${keyid}_PUBLIC.asc`);
    return user.publicKey;
  }, []);

  // ---------------------------------------------------------------------------
  // backupKeyring
  // ---------------------------------------------------------------------------

  const backupKeyring = useCallback(
    async (user: KeyringUser | any) => {
      try {
        const keyid = (user.keyid || "").replace(/\s/g, "");
        let privateKey: any = await openpgp.readKey({ armoredKey: user.privateKey });

        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        await decryptSubkeys(privateKey);
        downloadAsFile(user.privateKey, `${user.name}_0x${keyid}_SECRET.asc`);
      } catch (err: any) {
        if (isCancellationError(err)) return;
        addToast({
          title:
            "Failed to read or decrypt. The key is not valid or there was an error processing it",
          color: "danger",
        });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys]
  );

  // ---------------------------------------------------------------------------
  // changeKeyValidity
  // ---------------------------------------------------------------------------

  const changeKeyValidity = useCallback(
    async ({
      isNoExpiryChecked,
      expiryDate,
    }: {
      isNoExpiryChecked: boolean;
      expiryDate: string | null;
    }): Promise<boolean> => {
      if (!selectedUserId) return false;
      try {
        const now = new Date();
        let keyExpirationTime: number | undefined;
        if (isNoExpiryChecked || !expiryDate) {
          keyExpirationTime = undefined;
        } else {
          const selected = new Date(expiryDate);
          const expiry = new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate() + 1,
            0,
            0,
            0,
            0
          );
          keyExpirationTime = Math.floor((expiry.getTime() - now.getTime()) / 1000);
        }

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          selectedUserId,
          getDecryptionOpts(),
          async ({ privateKey, publicKeyObj }) => {
            const signatureState = await captureKeySignatureState(publicKeyObj, privateKey);

            const allUserIDsForReformat = publicKeyObj.users
              .filter((u: any) => !!u.userID)
              .map((u: any) => parseUserId(u.userID.userID))
              .map((u: any) =>
                u.email && u.email !== "N/A"
                  ? { name: u.name, email: u.email.trim() }
                  : { name: u.name }
              );

            const updatedKeyPair = (await openpgp.reformatKey({
              privateKey,
              keyExpirationTime,
              date: new Date(),
              format: "object",
              userIDs: allUserIDsForReformat,
            })) as any;

            const updatedPrivateKey = updatedKeyPair.privateKey;
            restoreKeySignatureState(updatedPrivateKey, signatureState);

            return { privateKey: updatedPrivateKey };
          }
        );

        await updateKeyInIndexeddb(selectedUserId.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });
        addToast({ title: "Validity Updated Successfully", color: "success" });
        setUsers(await loadKeysFromIndexedDB());
        return true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        addToast({ title: "Failed to update validity", color: "danger" });
        console.error(error);
        return false;
      }
    },
    [selectedUserId, getDecryptionOpts, setUsers]
  );

  // ---------------------------------------------------------------------------
  // addOrChangeKeyPassword
  // ---------------------------------------------------------------------------

  const addOrChangeKeyPassword = useCallback(
    async (user: KeyringUser | any): Promise<boolean> => {
      try {
        let privateKey: any = await openpgp.readKey({ armoredKey: user.privateKey });
        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);
        setSubkeyGlobalIndex(null);

        const newPassword = await triggerNewPasswordChangeModal();
        const updatedKey = await openpgp.encryptKey({ privateKey, passphrase: newPassword });
        let finalPrivateKey = updatedKey.armor();

        finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

        await updateKeyPassword(user.id, finalPrivateKey);
        setUsers(await loadKeysFromIndexedDB());

        const toastMessage =
          user.passwordprotected === "No"
            ? "Password Added Successfully"
            : "Password Changed Successfully";
        addToast({ title: toastMessage, color: "success" });
        return true;
      } catch (err: any) {
        if (isCancellationError(err)) return false;
        console.error(err);
        addToast({ title: "Failed to change password", color: "danger" });
        return false;
      }
    },
    [
      triggerKeyPasswordModal,
      triggerNewPasswordChangeModal,
      decryptSubkeys,
      setSubkeyGlobalIndex,
      updateKeyPassword,
      setUsers,
    ]
  );

  // ---------------------------------------------------------------------------
  // removePasswordFromKey
  // ---------------------------------------------------------------------------

  const removePasswordFromKey = useCallback(async (): Promise<boolean> => {
    if (!selectedUserId) return false;
    try {
      let privateKey = await openpgp.readKey({ armoredKey: selectedUserId.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(selectedUserId);
        privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
      }

      const subkeyPassphrases = await decryptSubkeys(privateKey);
      let finalPrivateKey = privateKey.armor();
      finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

      await updateKeyPassword(selectedUserId.id, finalPrivateKey);
      addToast({ title: "Password removed successfully", color: "success" });
      setUsers(await loadKeysFromIndexedDB());
      return true;
    } catch (err: any) {
      if (isCancellationError(err)) return false;
      addToast({ title: "Failed to remove password", color: "danger" });
      return false;
    }
  }, [selectedUserId, triggerKeyPasswordModal, decryptSubkeys, updateKeyPassword, setUsers]);

  // ---------------------------------------------------------------------------
  // deleteKey
  // ---------------------------------------------------------------------------

  const deleteKey = useCallback(
    async (userId: string) => {
      const db: any = await openDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(dbPgpKeys, "readwrite");
        const store = transaction.objectStore(dbPgpKeys);
        const request = store.delete(userId);

        request.onsuccess = async () => {
          notifyKeyringChannel();
          const refreshedKeys: any = await loadKeysFromIndexedDB();
          setUsers(refreshedKeys);
          const totalPages = Math.ceil(refreshedKeys.length / rowsPerPage);
          if (page > totalPages) setPage(Math.max(1, totalPages));
          resolve();
        };

        request.onerror = (e: any) => reject((e.target as any).error);
      });
    },
    [rowsPerPage, page, setPage, setUsers]
  );

  return {
    // Core Key operations
    publishKeyOnServer,
    exportPublicKey,
    backupKeyring,
    changeKeyValidity,
    addOrChangeKeyPassword,
    removePasswordFromKey,
    deleteKey,
    updateKeyPassword,

    // Subkey operations (delegated)
    backupSubkey: subkeyOps.backupSubkey,
    changeSubkeyValidity: subkeyOps.changeSubkeyValidity,
    addOrChangeSubkeyPassword: subkeyOps.addOrChangeSubkeyPassword,
    removeSubkeyPassword: subkeyOps.removeSubkeyPassword,
    addSubkey: subkeyOps.addSubkey,
    revokeSubkey: subkeyOps.revokeSubkey,
    manageSubkeys: subkeyOps.manageSubkeys,

    // Revocation operations (delegated)
    generateRevocationCertificate: revocationOps.generateRevocationCertificate,
    revokeUsingCertificate: revocationOps.revokeUsingCertificate,
    revokeKey: revocationOps.revokeKey,
    getRevocationReason: revocationOps.getRevocationReason,

    // User ID operations (delegated)
    addUserID: userIdOps.addUserID,
    setPrimaryUserID: userIdOps.setPrimaryUserID,
    revokeUserID: userIdOps.revokeUserID,
    getUserIDsFromKeyForModal: userIdOps.getUserIDsFromKeyForModal,

    // Certification operations (delegated)
    certifyUserKey: certOps.certifyUserKey,
    getKeyCertifications: certOps.getKeyCertifications,
  };
}
