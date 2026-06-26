/**
 * hooks/useKeyOperations.js
 *
 * All async PGP key mutation operations extracted from app/page.jsx.
 * Receives state setters and modal triggers as arguments so this hook
 * remains decoupled from UI layout.
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
} from "@/lib/indexeddb";
import {
  loadKeysFromIndexedDB,
  parseUserId,
  decryptAllSubkeys,
  reEncryptSubkeys,
} from "@/lib/pgp";
import KeyringImg from "@/assets/Keyring.png";

export function useKeyOperations({
  setUsers,
  // from usePasswordModal
  triggerKeyPasswordModal,
  triggernewPasswordChangeModal,
  triggerSubkeyPasswordModal,
  setSubkeyGlobalIndex,
  // selected key context
  selectedUserId,
  selectedKeyName,
  selectedKeyId,
  // revocation
  revocationReason,
  revocationReasonText,
  setRevocationReasonText,
  // pagination (for deleteKey page adjustment)
  page,
  setPage,
  rowsPerPage,
}) {
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  const decryptSubkeys = useCallback(
    (privateKey) =>
      decryptAllSubkeys(privateKey, {
        triggerSubkeyPasswordModal,
        setSubkeyGlobalIndex,
        addToast,
      }),
    [triggerSubkeyPasswordModal, setSubkeyGlobalIndex]
  );


  // ---------------------------------------------------------------------------
  // updateKeyPassword  (low-level IndexedDB write)
  // ---------------------------------------------------------------------------

  const updateKeyPassword = useCallback(async (userId, newArmoredKey) => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
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
        } catch (error) {
          return reject(error);
        }

        const writeTx = db.transaction("pgpKeys", "readwrite");
        const writeStore = writeTx.objectStore("pgpKeys");
        const putRequest = writeStore.put(record);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (e) => reject(e.target.error);
      };

      getRequest.onerror = (e) => reject(e.target.error);
    });
  }, []);

  // ---------------------------------------------------------------------------
  // publishKeyOnServer
  // ---------------------------------------------------------------------------

  const publishKeyOnServer = useCallback(async () => {
    try {
      const csrfRes = await fetch("/api/csrf", { method: "GET" });
      if (!csrfRes.ok) throw new Error("Failed to get CSRF token");
      const { csrfToken } = await csrfRes.json();

      const response = await fetch("/api/keyserver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: selectedUserId.publicKey, csrfToken }),
      });
      if (!response.ok) throw new Error("Failed to publish key on the server.");

      addToast({
        title: `${selectedKeyName}'s Key published successfully`,
        color: "success",
      });
    } catch (error) {
      console.error("Error publishing key:", error);
      addToast({ title: `Failed to publish ${selectedKeyName}'s key`, color: "danger" });
    }
  }, [selectedUserId, selectedKeyName]);

  // ---------------------------------------------------------------------------
  // exportPublicKey
  // ---------------------------------------------------------------------------

  const exportPublicKey = useCallback((user, { setPublicKeySnippet, setpublicKeyModal }) => {
    const keyid = user.keyid.replace(/\s/g, "");
    const blob = new Blob([user.publicKey], { type: "text/plain" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${user.name}_0x${keyid}_PUBLIC.asc`;
    link.click();
    URL.revokeObjectURL(objectUrl);
    setPublicKeySnippet(user.publicKey);
    setpublicKeyModal(true);
  }, []);

  // ---------------------------------------------------------------------------
  // backupKeyring
  // ---------------------------------------------------------------------------

  const backupKeyring = useCallback(
    async (user) => {
      try {
        const keyid = user.keyid.replace(/\s/g, "");
        let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });

        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        await decryptSubkeys(privateKey);

        const blob = new Blob([user.privateKey], { type: "text/plain" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${user.name}_0x${keyid}_SECRET.asc`;
        link.click();
        URL.revokeObjectURL(objectUrl);
      } catch {
        addToast({
          title: "Failed to read or decrypt. The key is not valid or there was an error processing it",
          color: "danger",
        });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys]
  );

  // ---------------------------------------------------------------------------
  // backupSubkey
  // ---------------------------------------------------------------------------

  const backupSubkey = useCallback(
    async (subkey, subkeyIndex, armoredSubkey) => {
      try {
        let privateKey = await openpgp.readPrivateKey({
          armoredKey: selectedUserId.privateKey,
        });

        if (!privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(selectedUserId);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeys = privateKey.getSubkeys();
        const targetSubkey = subkeys[subkeyIndex];
        if (!targetSubkey.isDecrypted()) {
          await triggerSubkeyPasswordModal(targetSubkey);
        }

        const mainkeyid = selectedKeyId.replace(/\s/g, "");
        const keyid = subkey.keyid.replace(/\s/g, "");
        const label = subkey.usage.toLowerCase() === "signing" ? "SIGN" : "ENCRYPT";

        const blob = new Blob([armoredSubkey], { type: "text/plain" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${selectedKeyName}_0x${mainkeyid}_SECRET_SUBKEY_0x${keyid}_${label}.asc`;
        link.click();
        URL.revokeObjectURL(objectUrl);
      } catch {
        addToast({ title: "Failed to process or export the subkey.", color: "danger" });
      }
    },
    [selectedUserId, selectedKeyId, selectedKeyName, triggerKeyPasswordModal, triggerSubkeyPasswordModal]
  );

  // ---------------------------------------------------------------------------
  // certifyUserKey
  // ---------------------------------------------------------------------------

  const certifyUserKey = useCallback(
    async (certifierUser, targetUser, { setcertifyUserModal }) => {
      try {
        let privateKey = await openpgp.readKey({ armoredKey: certifierUser.privateKey });

        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(certifierUser);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        await decryptSubkeys(privateKey);

        const theirPub = await openpgp.readKey({ armoredKey: targetUser.publicKey });
        const signerKeyId = privateKey.getKeyIDs()[0].toHex().toLowerCase();

        const existingKeyIds = theirPub.users.flatMap((user) =>
          user.otherCertifications.map((sig) => sig.issuerKeyID.toHex().toLowerCase())
        );

        if (existingKeyIds.includes(signerKeyId)) {
          addToast({
            title: `${targetUser.name}'s Key Already Certified By ${certifierUser.name}'s Key`,
            color: "primary",
          });
          return targetUser.publicKey;
        }

        const primaryKeyOnly = await openpgp.readKey({ armoredKey: privateKey.armor() });
        primaryKeyOnly.subkeys = [];

        const certifiedKey = await theirPub.signAllUsers([primaryKeyOnly], new Date());
        const updatedArmored = certifiedKey.armor();

        await updateKeyInIndexeddb(targetUser.id, {
          privateKey: targetUser.privateKey,
          publicKey: updatedArmored,
        });

        setcertifyUserModal(false);
        setUsers(await loadKeysFromIndexedDB());

        addToast({
          title: `${targetUser.name}'s Key Successfully Certified By ${certifierUser.name}'s Key`,
          color: "success",
        });

        return updatedArmored;
      } catch (err) {
        console.error("Certification failed:", err);
        addToast({ title: `Certification Error: ${err.message || err}`, color: "danger" });
        throw err;
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // getKeyCertifications
  // ---------------------------------------------------------------------------

  const getKeyCertifications = useCallback(async (selectedUser, allKeys) => {
    if (!selectedUser?.publicKey) return [];
    try {
      const pubKey = await openpgp.readKey({ armoredKey: selectedUser.publicKey });
      const certifications = pubKey.users.flatMap((user) =>
        user.otherCertifications.map((sig) => ({
          issuerKeyID: sig.issuerKeyID.toHex().toUpperCase(),
          fingerprint: sig.issuerFingerprint
            ? Buffer.from(sig.issuerFingerprint).toString("hex").toUpperCase()
            : "",
          creationTime: sig.created,
        }))
      );

      const uniqueCerts = [];
      const seen = new Set();
      for (const cert of certifications) {
        if (!seen.has(cert.issuerKeyID)) {
          uniqueCerts.push(cert);
          seen.add(cert.issuerKeyID);
        }
      }

      return uniqueCerts.map((cert) => {
        const match = allKeys.find((k) => k.keyid.replace(/\s/g, "") === cert.issuerKeyID);
        if (match) return { ...match, certificationTime: cert.creationTime };
        return {
          id: cert.issuerKeyID,
          name: "Unknown",
          email: "Unknown",
          creationdate: "Unknown",
          expirydate: "Unknown",
          status: "Unknown",
          passwordprotected: "Unknown",
          keyid: cert.issuerKeyID.match(/.{1,4}/g)?.join(" ") || cert.issuerKeyID,
          fingerprint: cert.fingerprint
            ? cert.fingerprint.match(/.{1,4}/g)?.join(" ") || cert.fingerprint
            : "Unknown",
          algorithm: "Unknown",
          avatar: null,
          certificationTime: cert.creationTime,
        };
      });
    } catch (e) {
      console.error("Error reading certifications:", e);
      return [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // ChangeKeyValidity
  // ---------------------------------------------------------------------------

  const ChangeKeyValidity = useCallback(
    async ({ isNoExpiryChecked, expiryDate, setvalidityModal, setSelectedUserId }) => {
      if (!selectedUserId) return;
      try {
        const now = new Date();
        let keyExpirationTime;
        if (isNoExpiryChecked || !expiryDate) {
          keyExpirationTime = undefined;
        } else {
          const selected = new Date(expiryDate);
          const expiry = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + 1, 0, 0, 0, 0);
          keyExpirationTime = Math.floor((expiry - now) / 1000);
        }

        let privateKey = await openpgp.readPrivateKey({ armoredKey: selectedUserId.privateKey });
        let currentPassword = null;
        if (!privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(selectedUserId);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);

        const fullPublicKey = await openpgp.readKey({ armoredKey: selectedUserId.publicKey });

        const userRevocationMap = new Map();
        fullPublicKey.users.forEach((user) => {
          if (user.userID) {
            userRevocationMap.set(user.userID.userID, {
              isRevoked: user.isRevoked(),
              revocationSignatures: [...user.revocationSignatures],
            });
          }
        });

        const allUserIDsForReformat = fullPublicKey.users
          .filter((u) => !!u.userID)
          .map((u) => parseUserId(u.userID.userID))
          .map((u) => (u.email && u.email !== "N/A" ? { name: u.name, email: u.email.trim() } : { name: u.name }));

        const originalSubkeys = privateKey.getSubkeys();
        const subkeyRevocationMap = new Map();
        originalSubkeys.forEach((sk) => {
          const fp = sk.getFingerprint();
          subkeyRevocationMap.set(fp, {
            isRevoked: sk.isRevoked(),
            revocationSignatures: [...sk.revocationSignatures],
          });
        });

        const updatedKeyPair = await openpgp.reformatKey({
          privateKey,
          keyExpirationTime,
          date: new Date(),
          format: "armored",
          userIDs: allUserIDsForReformat,
        });

        let updatedPrivateKey = await openpgp.readPrivateKey({ armoredKey: updatedKeyPair.privateKey });

        // Re-apply subkey revocations
        updatedPrivateKey.getSubkeys().forEach((sk) => {
          const fp = sk.getFingerprint();
          const orig = subkeyRevocationMap.get(fp);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!sk.revocationSignatures.some((e) => e.equals(sig))) sk.revocationSignatures.push(sig);
            });
          }
        });

        // Re-apply userID revocations
        updatedPrivateKey.users.forEach((user) => {
          if (!user.userID) return;
          const orig = userRevocationMap.get(user.userID.userID);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!user.revocationSignatures.some((e) => e.equals(sig))) user.revocationSignatures.push(sig);
            });
          }
        });

        const restoredKey = updatedPrivateKey.armor();
        const restoredPublicKey = updatedPrivateKey.toPublic().armor();

        let finalPrivateKey = restoredKey;
        if (currentPassword) {
          const reEncrypted = await openpgp.encryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: restoredKey }),
            passphrase: currentPassword,
          });
          finalPrivateKey = reEncrypted.armor();
        }

        finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

        await updateKeyInIndexeddb(selectedUserId.id, { privateKey: finalPrivateKey, publicKey: restoredPublicKey });
        addToast({ title: "Validity Updated Successfully", color: "success" });
        setUsers(await loadKeysFromIndexedDB());
        setvalidityModal(false);
        setSelectedUserId(null);
      } catch (error) {
        addToast({ title: "Failed to update validity", color: "danger" });
        console.error(error);
      }
    },
    [selectedUserId, triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // ChangeSubkeyValidity
  // ---------------------------------------------------------------------------

  const ChangeSubkeyValidity = useCallback(
    async (armoredSelectedSubkey, { isNoExpiryChecked, expiryDate, setvalidityModal, setSelectedUserId, setSelectedSubkey }) => {
      if (!selectedUserId || !armoredSelectedSubkey) return;
      try {
        const now = new Date();
        let keyExpirationTime;
        if (isNoExpiryChecked || !expiryDate) {
          keyExpirationTime = undefined;
        } else {
          const sel = new Date(expiryDate);
          const expiry = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate() + 1, 0, 0, 0, 0);
          keyExpirationTime = Math.floor((expiry - now) / 1000);
        }

        let privateKey = await openpgp.readPrivateKey({ armoredKey: selectedUserId.privateKey });
        let currentPassword = null;
        if (!privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(selectedUserId);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);

        const subkeyContainer = await openpgp.readKey({ armoredKey: armoredSelectedSubkey });
        const targetPacket = subkeyContainer.subkeys?.[0]?.keyPacket;
        if (!targetPacket) throw new Error("Invalid subkey data");

        const keyIDhex = targetPacket.getKeyID().toHex();
        const targetSubkey = privateKey.subkeys.find((s) => s.keyPacket.getKeyID().toHex() === keyIDhex);
        if (!targetSubkey) throw new Error("Subkey not found on primary key");

        const fullPublicKey = await openpgp.readKey({ armoredKey: selectedUserId.publicKey });
        const existingUserIDs = fullPublicKey.getUserIDs().map(parseUserId).map((u) =>
          u.email && u.email !== "N/A" ? { name: u.name, email: u.email.trim() } : { name: u.name }
        );

        const { privateKey: helperKey } = await openpgp.reformatKey({
          privateKey,
          userIDs: existingUserIDs,
          keyExpirationTime,
          date: new Date(),
          format: "object",
        });

        const updatedSubkey = helperKey.subkeys.find((s) => s.keyPacket.getKeyID().toHex() === keyIDhex);
        if (!updatedSubkey) throw new Error("Failed to locate updated subkey");

        await targetSubkey.update(updatedSubkey, new Date());

        let finalPrivateKey = privateKey.armor();
        const finalPublicKey = privateKey.toPublic().armor();

        if (currentPassword) {
          const decryptedKey = await openpgp.readPrivateKey({ armoredKey: finalPrivateKey });
          const reEncrypted = await openpgp.encryptKey({ privateKey: decryptedKey, passphrase: currentPassword });
          finalPrivateKey = reEncrypted.armor();
        }

        finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

        await updateKeyInIndexeddb(selectedUserId.id, { privateKey: finalPrivateKey, publicKey: finalPublicKey });

        const refreshed = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updatedUser = refreshed.find((u) => u.id === selectedUserId.id);
        if (updatedUser) setSelectedUserId(updatedUser);

        addToast({ title: "Subkey Validity Updated", color: "success" });
        setvalidityModal(false);
        setSelectedSubkey(null);
      } catch (err) {
        console.error(err);
        addToast({ title: "Failed to update subkey validity", color: "danger" });
      }
    },
    [selectedUserId, triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // addOrChangeKeyPassword
  // ---------------------------------------------------------------------------

  const addOrChangeKeyPassword = useCallback(
    async (user) => {
      try {
        let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);
        setSubkeyGlobalIndex(null);

        const newPassword = await triggernewPasswordChangeModal();
        const updatedKey = await openpgp.encryptKey({ privateKey, passphrase: newPassword });
        let finalPrivateKey = updatedKey.armor();

        finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

        await updateKeyPassword(user.id, finalPrivateKey);
        setUsers(await loadKeysFromIndexedDB());

        const toastMessage = user.passwordprotected === "No"
          ? "Password Added Successfully"
          : "Password Changed Successfully";
        addToast({ title: toastMessage, color: "success" });
      } catch (err) {
        console.error(err);
        addToast({ title: "Failed to change password", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, triggernewPasswordChangeModal, decryptSubkeys, setSubkeyGlobalIndex, updateKeyPassword, setUsers]
  );

  // ---------------------------------------------------------------------------
  // addOrChangeSubkeyPassword
  // ---------------------------------------------------------------------------

  const addOrChangeSubkeyPassword = useCallback(
    async (subkeyIndex) => {
      if (!selectedUserId || subkeyIndex === undefined) return;
      try {
        let privateKey = await openpgp.readPrivateKey({ armoredKey: selectedUserId.privateKey });
        let ownerPassphrase = null;
        if (!privateKey.isDecrypted()) {
          ownerPassphrase = await triggerKeyPasswordModal(selectedUserId);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: ownerPassphrase });
        }

        const subkeys = privateKey.getSubkeys();
        const selectedSubkey = subkeys[subkeyIndex];
        if (!selectedSubkey) throw new Error("Subkey not found");

        const isEncrypted = !selectedSubkey.isDecrypted();
        let currentSubkeyPassphrase = null;
        if (isEncrypted) {
          try {
            currentSubkeyPassphrase = await triggerSubkeyPasswordModal(selectedSubkey);
          } catch {
            return;
          }
        }

        const newPassphrase = await triggernewPasswordChangeModal();
        await subkeys[subkeyIndex].keyPacket.encrypt(newPassphrase);

        let finalPrivate = privateKey.armor();
        const finalPublic = privateKey.toPublic().armor();

        if (ownerPassphrase !== null) {
          const reProtected = await openpgp.encryptKey({ privateKey, passphrase: ownerPassphrase });
          finalPrivate = reProtected.armor();
        }

        await updateKeyInIndexeddb(selectedUserId.id, { privateKey: finalPrivate, publicKey: finalPublic });

        const refreshed = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u) => u.id === selectedUserId.id);

        if (ownerPassphrase === null) {
          addToast({
            title: currentSubkeyPassphrase === null
              ? "Subkey Password Added Successfully"
              : "Subkey Password Changed Successfully",
            color: "success",
          });
        } else {
          addToast({
            title: "The primary key is already password-protected, so subkey passwords cannot differ from the primary passphrase.",
            color: "warning",
          });
        }

        return updated;
      } catch (err) {
        console.error("Error in addOrChangeSubkeyPassword:", err);
        addToast({ title: "Failed To Change Subkey Password", color: "danger" });
      }
    },
    [selectedUserId, triggerKeyPasswordModal, triggerSubkeyPasswordModal, triggernewPasswordChangeModal, setUsers]
  );

  // ---------------------------------------------------------------------------
  // removePasswordFromKey
  // ---------------------------------------------------------------------------

  const removePasswordFromKey = useCallback(
    async ({ setremovePasswordModal }) => {
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
      } catch {
        addToast({ title: "Failed to remove password", color: "danger" });
      }
      setremovePasswordModal(false);
    },
    [selectedUserId, triggerKeyPasswordModal, decryptSubkeys, updateKeyPassword, setUsers]
  );

  // ---------------------------------------------------------------------------
  // RemoveSubkeyPassword
  // ---------------------------------------------------------------------------

  const RemoveSubkeyPassword = useCallback(
    async (subkeyIndex) => {
      if (!selectedUserId || subkeyIndex === undefined) return;
      try {
        let privateKey = await openpgp.readPrivateKey({ armoredKey: selectedUserId.privateKey });
        let ownerPassphrase = null;
        if (!privateKey.isDecrypted()) {
          ownerPassphrase = await triggerKeyPasswordModal(selectedUserId);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: ownerPassphrase });
        }

        const subkeys = privateKey.getSubkeys();
        const targetSubkeyObj = subkeys[subkeyIndex];
        if (!targetSubkeyObj) throw new Error("Subkey not found");

        const isEncrypted = !targetSubkeyObj.isDecrypted();
        let currentSubkeyPassphrase = null;
        if (isEncrypted) {
          try {
            currentSubkeyPassphrase = await triggerSubkeyPasswordModal(targetSubkeyObj);
          } catch {
            return;
          }
        }

        if (!targetSubkeyObj.isDecrypted() && currentSubkeyPassphrase) {
          await targetSubkeyObj.keyPacket.decrypt(currentSubkeyPassphrase);
        }

        let finalPrivate = privateKey.armor();
        const finalPublic = privateKey.toPublic().armor();

        if (ownerPassphrase !== null) {
          const reparsed = await openpgp.readPrivateKey({ armoredKey: finalPrivate });
          const reProtected = await openpgp.encryptKey({ privateKey: reparsed, passphrase: ownerPassphrase });
          finalPrivate = reProtected.armor();
        }

        await updateKeyInIndexeddb(selectedUserId.id, { privateKey: finalPrivate, publicKey: finalPublic });
        const refreshed = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u) => u.id === selectedUserId.id);

        if (ownerPassphrase === null) {
          addToast({ title: "Subkey Password removed successfully", color: "success" });
        } else {
          addToast({
            title: "The primary key is already password-protected, so subkey passwords cannot be removed.",
            color: "warning",
          });
        }

        return updated;
      } catch {
        addToast({ title: "Failed To Remove Subkey Password", color: "danger" });
      }
    },
    [selectedUserId, triggerKeyPasswordModal, triggerSubkeyPasswordModal, setUsers]
  );

  // ---------------------------------------------------------------------------
  // deleteKey
  // ---------------------------------------------------------------------------

  const deleteKey = useCallback(
    async (userId) => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(dbPgpKeys, "readwrite");
        const store = transaction.objectStore(dbPgpKeys);
        const request = store.delete(userId);

        request.onsuccess = async () => {
          const refreshedKeys = await loadKeysFromIndexedDB();
          setUsers(refreshedKeys);
          const totalPages = Math.ceil(refreshedKeys.length / rowsPerPage);
          if (page > totalPages) setPage(Math.max(1, totalPages));
          resolve();
        };

        request.onerror = (e) => reject(e.target.error);
      });
    },
    [rowsPerPage, page, setPage, setUsers]
  );

  // ---------------------------------------------------------------------------
  // addUserID
  // ---------------------------------------------------------------------------

  const addUserID = useCallback(
    async (user, { name, email, setName, setEmail, setaddUserIDModal, setNameInvalid, setEmailInvalid }) => {
      setNameInvalid(false);
      setEmailInvalid(false);
      if (!name.trim()) { setNameInvalid(true); return; }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailInvalid(true); return; }

      const validEmail = email.trim();
      setaddUserIDModal(false);

      try {
        let privateKey = await openpgp.readPrivateKey({ armoredKey: user.privateKey });
        let currentPassword = null;
        if (!privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);
        const fullPublicKey = await openpgp.readKey({ armoredKey: user.publicKey });

        const userRevocationMap = new Map();
        fullPublicKey.users.forEach((u) => {
          if (u.userID) {
            userRevocationMap.set(u.userID.userID, {
              isRevoked: u.isRevoked(),
              revocationSignatures: [...u.revocationSignatures],
            });
          }
        });

        const originalSubkeys = privateKey.getSubkeys();
        const subkeyRevocationMap = new Map();
        const subkeyBindingSignaturesMap = new Map();
        originalSubkeys.forEach((sk) => {
          const fp = sk.getFingerprint();
          subkeyRevocationMap.set(fp, { isRevoked: sk.isRevoked(), revocationSignatures: [...sk.revocationSignatures] });
          subkeyBindingSignaturesMap.set(fp, [...sk.bindingSignatures]);
        });

        const currentUserIDs = fullPublicKey.getUserIDs().map(parseUserId);
        const newUserID = validEmail ? { name: name.trim(), email: validEmail } : { name: name.trim() };
        const updatedUserIDs = [...currentUserIDs.map((u) =>
          u.email && u.email !== "N/A" ? { name: u.name, email: u.email } : { name: u.name }
        ), newUserID];

        const creationTime = privateKey.getCreationTime();
        const expirationTime = await privateKey.getExpirationTime();
        const expirationSeconds = expirationTime ? Math.floor((expirationTime - creationTime) / 1000) : undefined;

        const updatedKeyPair = await openpgp.reformatKey({
          privateKey,
          userIDs: updatedUserIDs,
          date: creationTime,
          keyExpirationTime: expirationSeconds,
          format: "armored",
        });

        let updatedPrivateKey = await openpgp.readPrivateKey({ armoredKey: updatedKeyPair.privateKey });

        updatedPrivateKey.getSubkeys().forEach((sk) => {
          const fp = sk.getFingerprint();
          const origBind = subkeyBindingSignaturesMap.get(fp);
          if (origBind?.length) sk.bindingSignatures = [...origBind];
          const orig = subkeyRevocationMap.get(fp);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!sk.revocationSignatures.some((e) => e.equals(sig))) sk.revocationSignatures.push(sig);
            });
          }
        });

        updatedPrivateKey.users.forEach((u) => {
          if (!u.userID) return;
          const orig = userRevocationMap.get(u.userID.userID);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!u.revocationSignatures.some((e) => e.equals(sig))) u.revocationSignatures.push(sig);
            });
          }
        });

        updatedKeyPair.privateKey = updatedPrivateKey.armor();

        if (currentPassword) {
          const reEncrypted = await openpgp.encryptKey({ privateKey: updatedPrivateKey, passphrase: currentPassword });
          updatedKeyPair.privateKey = reEncrypted.armor();
        }

        updatedKeyPair.privateKey = await reEncryptSubkeys(updatedKeyPair.privateKey, subkeyPassphrases);

        await updateKeyInIndexeddb(user.id, {
          privateKey: updatedKeyPair.privateKey,
          publicKey: updatedPrivateKey.toPublic().armor(),
        });

        addToast({ title: "User ID added successfully", color: "success" });
        setUsers(await loadKeysFromIndexedDB());
        setName("");
        setEmail("");
      } catch (error) {
        addToast({ title: "Failed to add User ID", color: "danger" });
        console.error(error);
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // setPrimaryUserID
  // ---------------------------------------------------------------------------

  const setPrimaryUserID = useCallback(
    async (user, targetUserIDObj, { setModalUserIDs }) => {
      try {
        const refreshedStart = await loadKeysFromIndexedDB();
        const currentUserObj = refreshedStart.find((u) => u.id === user.id);
        if (!currentUserObj) throw new Error("User not found in IndexedDB");

        const publicKey = await openpgp.readKey({ armoredKey: currentUserObj.publicKey });
        const userRevocationMap = new Map();
        publicKey.users.forEach((u) => {
          if (u.userID) {
            userRevocationMap.set(u.userID.userID, {
              isRevoked: u.isRevoked(),
              revocationSignatures: [...u.revocationSignatures],
            });
          }
        });

        const freshUserIDs = publicKey.getUserIDs().map(parseUserId);
        if (freshUserIDs[0]?.id === targetUserIDObj.id) {
          addToast({ title: "Primary User ID already selected", color: "primary" });
          setUsers(refreshedStart);
          if (setModalUserIDs) setModalUserIDs(await getUserIDsFromKeyForModal(currentUserObj));
          return;
        }

        let privateKey = await openpgp.readPrivateKey({ armoredKey: currentUserObj.privateKey });
        let currentPassword = null;
        if (!privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);

        const originalSubkeys = privateKey.getSubkeys();
        const subkeyRevocationMap = new Map();
        const subkeyBindingSignaturesMap = new Map();
        originalSubkeys.forEach((sk) => {
          const fp = sk.getFingerprint();
          subkeyRevocationMap.set(fp, { isRevoked: sk.isRevoked(), revocationSignatures: [...sk.revocationSignatures] });
          subkeyBindingSignaturesMap.set(fp, [...sk.bindingSignatures]);
        });

        const currentUserIDs = publicKey.getUserIDs().map(parseUserId);
        const targetUser = currentUserIDs.find((u) => u.id === targetUserIDObj.id);
        if (!targetUser) throw new Error("Target user ID not found on key");

        const reorderedUserIDs = [
          targetUser,
          ...currentUserIDs.filter((u) => u.id !== targetUserIDObj.id),
        ].map((u) => u.email && u.email !== "N/A" ? { name: u.name, email: u.email } : { name: u.name });

        const creationTime = privateKey.getCreationTime();
        const expirationTime = await privateKey.getExpirationTime();
        const expirationSeconds = expirationTime ? Math.floor((expirationTime - creationTime) / 1000) : undefined;

        const updatedKeyPair = await openpgp.reformatKey({
          privateKey,
          userIDs: reorderedUserIDs,
          date: creationTime,
          keyExpirationTime: expirationSeconds,
          format: "armored",
        });

        let updatedPrivateKey = await openpgp.readPrivateKey({ armoredKey: updatedKeyPair.privateKey });

        updatedPrivateKey.getSubkeys().forEach((sk) => {
          const fp = sk.getFingerprint();
          const origBind = subkeyBindingSignaturesMap.get(fp);
          if (origBind?.length) sk.bindingSignatures = [...origBind];
          const orig = subkeyRevocationMap.get(fp);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!sk.revocationSignatures.some((e) => e.equals(sig))) sk.revocationSignatures.push(sig);
            });
          }
        });

        updatedPrivateKey.users.forEach((u) => {
          if (!u.userID) return;
          const orig = userRevocationMap.get(u.userID.userID);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!u.revocationSignatures.some((e) => e.equals(sig))) u.revocationSignatures.push(sig);
            });
          }
        });

        updatedKeyPair.privateKey = updatedPrivateKey.armor();

        if (currentPassword) {
          const reEncrypted = await openpgp.encryptKey({ privateKey: updatedPrivateKey, passphrase: currentPassword });
          updatedKeyPair.privateKey = reEncrypted.armor();
        }

        updatedKeyPair.privateKey = await reEncryptSubkeys(updatedKeyPair.privateKey, subkeyPassphrases);

        await updateKeyInIndexeddb(user.id, {
          privateKey: updatedKeyPair.privateKey,
          publicKey: updatedPrivateKey.toPublic().armor(),
        });

        addToast({ title: "Primary User ID updated successfully", color: "success" });
        const refreshed = await loadKeysFromIndexedDB();
        setUsers(refreshed);

        const updatedUser = refreshed.find((u) => u.id === user.id);
        if (updatedUser && setModalUserIDs) {
          setModalUserIDs(await getUserIDsFromKeyForModal(updatedUser));
        }
      } catch (error) {
        console.error("setPrimaryUserID error:", error);
        addToast({ title: "Failed to update Primary User ID", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // revokeUserID
  // ---------------------------------------------------------------------------

  const revokeUserID = useCallback(
    async (user, targetUserIDObj, { setModalUserIDs }) => {
      try {
        const refreshedStart = await loadKeysFromIndexedDB();
        const currentUserObj = refreshedStart.find((u) => u.id === user.id);
        if (!currentUserObj) throw new Error("User not found in IndexedDB");

        let privateKey = await openpgp.readPrivateKey({ armoredKey: currentUserObj.privateKey });
        let currentPassword = null;
        if (!privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);

        const targetUser = privateKey.users.find((u) => {
          if (!u.userID) return false;
          const parsed = parseUserId(u.userID.userID);
          return parsed.id === targetUserIDObj.id;
        });
        if (!targetUser) throw new Error("Target user ID not found on key");

        const revokedUser = await targetUser.revoke(privateKey.keyPacket);
        const idx = privateKey.users.indexOf(targetUser);
        if (idx !== -1) privateKey.users[idx] = revokedUser;

        let updatedPrivateKeyArmored = privateKey.armor();
        const updatedPublicKeyArmored = privateKey.toPublic().armor();

        if (currentPassword) {
          const reEncryptedKey = await openpgp.encryptKey({ privateKey, passphrase: currentPassword });
          updatedPrivateKeyArmored = reEncryptedKey.armor();
        }

        updatedPrivateKeyArmored = await reEncryptSubkeys(updatedPrivateKeyArmored, subkeyPassphrases);

        await updateKeyInIndexeddb(user.id, { privateKey: updatedPrivateKeyArmored, publicKey: updatedPublicKeyArmored });
        addToast({ title: "User ID revoked successfully", color: "success" });

        const refreshed = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updatedUser = refreshed.find((u) => u.id === user.id);
        if (updatedUser && setModalUserIDs) {
          setModalUserIDs(await getUserIDsFromKeyForModal(updatedUser));
        }
      } catch (error) {
        console.error("revokeUserID error:", error);
        addToast({ title: "Failed to revoke User ID", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // addSubkey
  // ---------------------------------------------------------------------------

  const addSubkey = useCallback(
    async (user, { selectedAlgorithm, subkeyOption, isNoExpiryChecked, expiryDate, setaddSubkeyModal }) => {
      if (!user || !user.privateKey) return;
      try {
        let privateKey = await openpgp.readPrivateKey({ armoredKey: user.privateKey });
        let currentPassword = null;
        if (!privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);

        const originalSubkeys = privateKey.getSubkeys();
        const subkeyRevocationMap = new Map();
        originalSubkeys.forEach((sk) => {
          const fp = sk.getFingerprint();
          subkeyRevocationMap.set(fp, { isRevoked: sk.isRevoked(), revocationSignatures: [...sk.revocationSignatures] });
        });

        const opt = String(subkeyOption);
        const isSign = opt === "0";
        const isEncrypt = opt === "1";
        let subkeyOpts = { date: new Date(), sign: isSign, encrypt: isEncrypt };

        if (!isNoExpiryChecked && expiryDate) {
          const now = Date.now();
          const sel = new Date(expiryDate);
          const midnightAfter = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate() + 1).getTime();
          subkeyOpts.keyExpirationTime = Math.floor((midnightAfter - now) / 1000);
        }

        if (selectedAlgorithm.startsWith("rsa")) {
          subkeyOpts.type = "rsa";
          subkeyOpts.rsaBits = parseInt(selectedAlgorithm.replace("rsa", ""), 10);
        } else if (selectedAlgorithm === "curve25519") {
          subkeyOpts.type = "ecc";
          subkeyOpts.curve = "curve25519Legacy";
        } else if (selectedAlgorithm === "ed25519") {
          subkeyOpts.type = "ecc";
          subkeyOpts.curve = "ed25519Legacy";
        } else {
          subkeyOpts.type = "ecc";
          subkeyOpts.curve = selectedAlgorithm;
        }

        privateKey = await privateKey.addSubkey(subkeyOpts);

        privateKey.getSubkeys().forEach((sk) => {
          const fp = sk.getFingerprint();
          const orig = subkeyRevocationMap.get(fp);
          if (orig?.isRevoked) {
            orig.revocationSignatures.forEach((sig) => {
              if (!sk.revocationSignatures.some((e) => JSON.stringify(e) === JSON.stringify(sig))) {
                sk.revocationSignatures.push(sig);
              }
            });
          }
        });

        let updatedPrivateArmored = privateKey.armor();
        let updatedPublicArmored = privateKey.toPublic().armor();

        if (currentPassword) {
          const decryptedKey = await openpgp.readPrivateKey({ armoredKey: updatedPrivateArmored });
          const reEncryptedKey = await openpgp.encryptKey({ privateKey: decryptedKey, passphrase: currentPassword });
          updatedPrivateArmored = reEncryptedKey.armor();
        }

        updatedPrivateArmored = await reEncryptSubkeys(updatedPrivateArmored, subkeyPassphrases);

        await updateKeyInIndexeddb(user.id, { privateKey: updatedPrivateArmored, publicKey: updatedPublicArmored });
        addToast({ title: "Subkey added successfully", color: "success" });
        setaddSubkeyModal(false);
        setUsers(await loadKeysFromIndexedDB());
      } catch (err) {
        console.error(err);
        addToast({ title: "Failed to add subkey", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // GenerateRevocationCertificate
  // ---------------------------------------------------------------------------

  const GenerateRevocationCertificate = useCallback(
    async (user) => {
      try {
        let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        await decryptSubkeys(privateKey);

        const fullPublicKey = await openpgp.readKey({ armoredKey: user.publicKey });
        const formattedUserIDs = fullPublicKey.getUserIDs().map(parseUserId).map((u) =>
          u.email && u.email !== "N/A" ? { name: u.name, email: u.email } : { name: u.name }
        );

        const { revocationCertificate } = await openpgp.reformatKey({
          privateKey,
          userIDs: formattedUserIDs,
          format: "armored",
        });

        const keyid = user.keyid.replace(/\s/g, "");
        const blob = new Blob([revocationCertificate], { type: "text/plain" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${user.name}_0x${keyid}_REVOCATION_CERTIFICATE.asc`;
        link.click();
        URL.revokeObjectURL(objectUrl);

        addToast({ title: "Revocation Certificate Generated", color: "success" });
      } catch {
        addToast({ title: "Failed to generate revocation certificate", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys]
  );

  // ---------------------------------------------------------------------------
  // RevokeUsingCertificate
  // ---------------------------------------------------------------------------

  const RevokeUsingCertificate = useCallback(
    async (user, revocationCertificate, { setKeyInput }) => {
      setKeyInput("");
      try {
        if (user.privateKey && user.privateKey.trim()) {
          let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
          let currentPassword = null;
          if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
            currentPassword = await triggerKeyPasswordModal(user);
            privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
          }

          const subkeyPassphrases = await decryptSubkeys(privateKey);

          const revokedKey = await openpgp.revokeKey({
            key: privateKey,
            format: "armored",
            revocationCertificate,
            date: new Date(),
          });

          const revokedPrivateKeyObj = await openpgp.readPrivateKey({ armoredKey: revokedKey.privateKey });
          let finalPrivateKey = revokedPrivateKeyObj.armor();
          const finalPublicKey = revokedPrivateKeyObj.toPublic().armor();

          if (currentPassword) {
            const reEncrypted = await openpgp.encryptKey({ privateKey: revokedPrivateKeyObj, passphrase: currentPassword });
            finalPrivateKey = reEncrypted.armor();
          }

          finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

          await updateKeyInIndexeddb(user.id, { privateKey: finalPrivateKey, publicKey: finalPublicKey });

          const keyid = user.keyid.replace(/\s/g, "");
          const blob = new Blob([finalPublicKey], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${user.name}_0x${keyid}_REVOKED_PUBLIC_KEY.asc`;
          link.click();
          URL.revokeObjectURL(url);

          addToast({
            title: "Key Revoked",
            description: "Both public and private keys have been updated with the revocation signature.",
            color: "success",
          });
        } else {
          const publicKey = await openpgp.readKey({ armoredKey: user.publicKey });
          const revokedKey = await openpgp.revokeKey({ key: publicKey, format: "armored", revocationCertificate, date: new Date() });
          await updateKeyInIndexeddb(user.id, { publicKey: revokedKey.publicKey });

          const keyid = user.keyid.replace(/\s/g, "");
          const blob = new Blob([revokedKey.publicKey], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${user.name}_0x${keyid}_REVOKED_PUBLIC_KEY.asc`;
          link.click();
          URL.revokeObjectURL(url);

          addToast({
            title: "Public Key Revoked",
            description: "Your public key has been updated with the revocation signature.",
            color: "success",
          });
        }

        setUsers(await loadKeysFromIndexedDB());
      } catch (error) {
        addToast({ title: "Revocation Failed", description: error.message || "An unexpected error occurred.", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // revokeKey
  // ---------------------------------------------------------------------------

  const revokeKey = useCallback(
    async (user) => {
      setRevocationReasonText("");
      try {
        let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
        let currentPassword = null;
        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        const subkeyPassphrases = await decryptSubkeys(privateKey);

        const revokedKey = await openpgp.revokeKey({
          key: privateKey,
          format: "armored",
          reasonForRevocation: { flag: parseInt(revocationReason), string: revocationReasonText || undefined },
          date: new Date(),
        });

        const revokedPrivateKeyObj = await openpgp.readPrivateKey({ armoredKey: revokedKey.privateKey });
        let finalPrivateKey = revokedPrivateKeyObj.armor();
        const finalPublicKey = revokedPrivateKeyObj.toPublic().armor();

        if (currentPassword) {
          const reEncrypted = await openpgp.encryptKey({ privateKey: revokedPrivateKeyObj, passphrase: currentPassword });
          finalPrivateKey = reEncrypted.armor();
        }

        finalPrivateKey = await reEncryptSubkeys(finalPrivateKey, subkeyPassphrases);

        await updateKeyInIndexeddb(user.id, { privateKey: finalPrivateKey, publicKey: finalPublicKey });

        const keyid = user.keyid.replace(/\s/g, "");
        const blob = new Blob([revokedKey.publicKey], { type: "text/plain" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = `${user.name}_0x${keyid}_PUBLIC_REVOKED.asc`;
        link.click();
        URL.revokeObjectURL(objectUrl);

        addToast({ title: "Key Revoked Successfully", color: "success" });
        setUsers(await loadKeysFromIndexedDB());
      } catch (error) {
        console.error(error);
        addToast({ title: "Failed to revoke key", color: "danger" });
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, revocationReason, revocationReasonText, setRevocationReasonText, setUsers]
  );

  // ---------------------------------------------------------------------------
  // revokeSubkey
  // ---------------------------------------------------------------------------

  const revokeSubkey = useCallback(
    async (subkeyIndex, { setSelectedUserId: setSelUsr }) => {
      setRevocationReasonText("");
      try {
        let primaryKey = await openpgp.readKey({ armoredKey: selectedUserId.privateKey });
        let currentPassword = null;
        if (primaryKey.isPrivate() && !primaryKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(selectedUserId);
          primaryKey = await openpgp.decryptKey({ privateKey: primaryKey, passphrase: currentPassword });
        }

        const subkeys = primaryKey.getSubkeys();
        const targetSubkeyObj = subkeys[subkeyIndex];
        if (!targetSubkeyObj) throw new Error("Subkey not found");

        const isEncrypted = !targetSubkeyObj.isDecrypted();
        let currentSubkeyPassphrase = null;
        if (isEncrypted) {
          try {
            currentSubkeyPassphrase = await triggerSubkeyPasswordModal(targetSubkeyObj);
          } catch {
            return;
          }
        }

        let targetSubkey = subkeys[subkeyIndex];
        if (!targetSubkey.isDecrypted() && currentSubkeyPassphrase) {
          await targetSubkey.keyPacket.decrypt(currentSubkeyPassphrase);
        }

        const revokedSubkey = await targetSubkey.revoke(
          primaryKey.keyPacket,
          { flag: parseInt(revocationReason), string: revocationReasonText || undefined },
          new Date()
        );

        await targetSubkey.update(revokedSubkey);

        if (isEncrypted && currentSubkeyPassphrase) {
          await targetSubkey.keyPacket.encrypt(currentSubkeyPassphrase);
        }

        let newPrivateArmored = primaryKey.armor();
        let newPublicArmored = primaryKey.toPublic().armor();

        if (currentPassword !== null) {
          const reProtected = await openpgp.encryptKey({ privateKey: primaryKey, passphrase: currentPassword });
          newPrivateArmored = reProtected.armor();
        }

        await updateKeyInIndexeddb(selectedUserId.id, { privateKey: newPrivateArmored, publicKey: newPublicArmored });

        const refreshedKeys = await loadKeysFromIndexedDB();
        setUsers(refreshedKeys);
        const updated = refreshedKeys.find((u) => u.id === selectedUserId.id);
        if (updated && setSelUsr) setSelUsr(updated);

        addToast({ title: "Subkey Revoked Successfully", color: "success" });
      } catch (error) {
        console.error(error);
        addToast({ title: "Failed to revoke subkey", color: "danger" });
      }
    },
    [selectedUserId, triggerKeyPasswordModal, triggerSubkeyPasswordModal, revocationReason, revocationReasonText, setRevocationReasonText, setUsers]
  );

  // ---------------------------------------------------------------------------
  // getRevocationReason
  // ---------------------------------------------------------------------------

  const getRevocationReason = useCallback(async (user) => {
    const key = await openpgp.readKey({ armoredKey: user.publicKey || user.privateKey });
    if (!key.revocationSignatures || key.revocationSignatures.length === 0) return null;
    for (const sig of key.revocationSignatures) {
      if (typeof sig.reasonForRevocationFlag !== "undefined") {
        return { code: sig.reasonForRevocationFlag, text: sig.reasonForRevocationString || null };
      }
    }
    return null;
  }, []);

  // ---------------------------------------------------------------------------
  // getUserIDsFromKeyForModal  (needed by setPrimaryUserID / revokeUserID)
  // ---------------------------------------------------------------------------

  const getUserIDsFromKeyForModal = useCallback(async (user) => {
    if (!user || !user.publicKey) return [];
    try {
      const key = await openpgp.readKey({ armoredKey: user.publicKey });
      const uids = key.getUserIDs();
      const keyUsers = key.users;
      const parsedUsers = [];
      for (let i = 0; i < keyUsers.length; i++) {
        const parsedUser = parseUserId(uids[i]);
        const isRevoked = await keyUsers[i].isRevoked();
        if (isRevoked) parsedUser.status = "revoked";
        parsedUsers.push(parsedUser);
      }
      return parsedUsers;
    } catch (error) {
      console.error("Error fetching user IDs:", error);
      return [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // manageSubkeys
  // ---------------------------------------------------------------------------

  const manageSubkeys = useCallback(async (user) => {
    if (!user || !user.privateKey) return [];
    try {
      const privateKey = await openpgp.readPrivateKey({ armoredKey: user.privateKey });

      const formatDateLocal = (isoDate) => {
        const date = new Date(isoDate);
        if (!(date instanceof Date) || isNaN(date.getTime())) return "Unknown";
        const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const day = String(date.getDate()).padStart(2, "0");
        return `${day}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
      };

      const getSubkeyExpiryInfo = async (sk) => {
        try {
          const isRevoked = await sk.isRevoked();
          if (isRevoked) return { expirydate: "Revoked", status: "revoked" };
          const expirationTime = await sk.getExpirationTime();
          const now = new Date();
          if (!expirationTime || expirationTime === Infinity) return { expirydate: "No Expiry", status: "active" };
          if (expirationTime < now) return { expirydate: formatDateLocal(expirationTime), status: "expired" };
          return { expirydate: formatDateLocal(expirationTime), status: "active" };
        } catch {
          return { expirydate: "Error", status: "unknown" };
        }
      };

      const getSubkeyUsage = (sk) => {
        const usage = [];
        for (const sig of sk.bindingSignatures) {
          const flagsArray = sig.keyFlags || sig.parsedKeyFlags || [];
          for (const f of flagsArray) {
            if (f & openpgp.enums.keyFlags.signData) usage.push("Signing");
            if (f & (openpgp.enums.keyFlags.encryptCommunication | openpgp.enums.keyFlags.encryptStorage)) usage.push("Encryption");
          }
        }
        return [...new Set(usage)].join(", ") || "Unknown";
      };

      const formatAlgorithmLocal = (algoInfo) => {
        const labelMap = {
          curve25519: "Curve25519 (EdDSA/ECDH)",
          nistP256: "NIST P-256 (ECDSA/ECDH)",
          nistP521: "NIST P-521 (ECDSA/ECDH)",
          brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
          brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
        };
        if (["eddsa","ecdh","eddsaLegacy","curve25519"].includes(algoInfo.algorithm)) return labelMap.curve25519;
        if (algoInfo.curve && labelMap[algoInfo.curve]) return labelMap[algoInfo.curve];
        if (/^rsa/i.test(algoInfo.algorithm)) {
          switch (algoInfo.bits) {
            case 2048: return "RSA 2048";
            case 3072: return "RSA 3072";
            case 4096: return "RSA 4096";
            default: return `RSA (${algoInfo.bits || "?"} bits)`;
          }
        }
        return algoInfo.algorithm || "Unknown";
      };

      const privateSubs = privateKey.getSubkeys();
      return await Promise.all(
        privateSubs.map(async (sk, idx) => {
          const algoInfo = sk.getAlgorithmInfo();
          const { expirydate, status } = await getSubkeyExpiryInfo(sk);
          return {
            id: `${user.id}-subkey-${idx}`,
            name: user.name,
            email: user.email,
            creationdate: formatDateLocal(sk.getCreationTime()),
            expirydate,
            status,
            passwordprotected: !sk.isDecrypted() ? "Yes" : "No",
            usage: getSubkeyUsage(sk),
            keyid: sk.getKeyID().toHex().toUpperCase().match(/.{1,4}/g).join(" "),
            fingerprint: sk.getFingerprint().toUpperCase().match(/.{1,4}/g).join(" "),
            algorithm: formatAlgorithmLocal(algoInfo),
            avatar: KeyringImg.src,
          };
        })
      );
    } catch (e) {
      console.error("Error extracting subkeys:", e);
      return [];
    }
  }, []);

  return {
    publishKeyOnServer,
    exportPublicKey,
    backupKeyring,
    backupSubkey,
    certifyUserKey,
    getKeyCertifications,
    ChangeKeyValidity,
    ChangeSubkeyValidity,
    addOrChangeKeyPassword,
    addOrChangeSubkeyPassword,
    removePasswordFromKey,
    RemoveSubkeyPassword,
    deleteKey,
    addUserID,
    setPrimaryUserID,
    revokeUserID,
    addSubkey,
    manageSubkeys,
    GenerateRevocationCertificate,
    RevokeUsingCertificate,
    revokeKey,
    revokeSubkey,
    getRevocationReason,
    getUserIDsFromKeyForModal,
    updateKeyPassword,
  };
}
