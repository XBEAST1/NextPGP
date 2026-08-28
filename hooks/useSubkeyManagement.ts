/**
 * hooks/useSubkeyManagement.ts
 *
 * Operations for adding subkeys, listing subkeys, changing subkey validity,
 * managing subkey passwords, revoking subkeys, and exporting subkeys.
 */

"use client";

import { useCallback } from "react";
import { addToast } from "@heroui/react";
import * as openpgp from "openpgp";
import { updateKeyInIndexeddb } from "@/lib/indexeddb";
import {
  loadKeysFromIndexedDB,
  parseUserId,
  downloadAsFile,
  captureRevocationState,
  restoreRevocationState,
  withDecryptedKey,
  WithDecryptedKeyOpts,
} from "@/lib/pgp";
import { KeyringUser } from "@/hooks/useKeyOperations";
import KeyringImg from "@/assets/Keyring.png";

export interface UseSubkeyManagementConfig {
  setUsers: (users: KeyringUser[] | any[]) => void;
  getDecryptionOpts: () => WithDecryptedKeyOpts;
  triggerKeyPasswordModal: (user: any) => Promise<string>;
  triggerNewPasswordChangeModal: () => Promise<string>;
  triggerSubkeyPasswordModal: (subkey: any) => Promise<string>;
  setSubkeyGlobalIndex: (idx: number | null) => void;
  selectedUserId: KeyringUser | any;
  selectedKeyName?: string;
  selectedKeyId?: string;
  revocationReason: string;
  revocationReasonText: string;
  setRevocationReasonText: (text: string) => void;
}

const isCancellationError = (err: any): boolean => {
  return err instanceof Error && err.message === "Password entry cancelled";
};

export function useSubkeyManagement({
  setUsers,
  getDecryptionOpts,
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
}: UseSubkeyManagementConfig) {
  // ---------------------------------------------------------------------------
  // backupSubkey
  // ---------------------------------------------------------------------------
  const backupSubkey = useCallback(
    async (subkey: any, subkeyIndex: number, armoredSubkey: string) => {
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

        downloadAsFile(
          armoredSubkey,
          `${selectedKeyName}_0x${mainkeyid}_SECRET_SUBKEY_0x${keyid}_${label}.asc`
        );
      } catch (err: any) {
        if (isCancellationError(err)) return;
        addToast({ title: "Failed to process or export the subkey.", color: "danger" });
      }
    },
    [selectedUserId, selectedKeyId, selectedKeyName, triggerKeyPasswordModal, triggerSubkeyPasswordModal]
  );

  // ---------------------------------------------------------------------------
  // changeSubkeyValidity
  // ---------------------------------------------------------------------------
  const changeSubkeyValidity = useCallback(
    async (
      armoredSelectedSubkey: string,
      {
        isNoExpiryChecked,
        expiryDate,
      }: { isNoExpiryChecked: boolean; expiryDate: string | null }
    ): Promise<boolean> => {
      if (!selectedUserId || !armoredSelectedSubkey) return false;
      try {
        const now = new Date();
        let keyExpirationTime: number | undefined;
        if (isNoExpiryChecked || !expiryDate) {
          keyExpirationTime = undefined;
        } else {
          const sel = new Date(expiryDate);
          const expiry = new Date(
            sel.getFullYear(),
            sel.getMonth(),
            sel.getDate() + 1,
            0,
            0,
            0,
            0
          );
          keyExpirationTime = Math.floor((expiry.getTime() - now.getTime()) / 1000);
        }

        const subkeyContainer = await openpgp.readKey({ armoredKey: armoredSelectedSubkey });
        const targetPacket = subkeyContainer.subkeys?.[0]?.keyPacket;
        if (!targetPacket) throw new Error("Invalid subkey data");
        const keyIDhex = targetPacket.getKeyID().toHex();

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          selectedUserId,
          getDecryptionOpts(),
          async ({ privateKey, publicKeyObj }) => {
            const targetSubkey = privateKey.subkeys.find(
              (s: any) => s.keyPacket.getKeyID().toHex() === keyIDhex
            );
            if (!targetSubkey) throw new Error("Subkey not found on primary key");

            const existingUserIDs = publicKeyObj
              .getUserIDs()
              .map(parseUserId)
              .map((u: any) =>
                u.email && u.email !== "N/A"
                  ? { name: u.name, email: u.email.trim() }
                  : { name: u.name }
              );

            const { privateKey: helperKey } = (await openpgp.reformatKey({
              privateKey,
              userIDs: existingUserIDs,
              keyExpirationTime,
              date: new Date(),
              format: "object",
            })) as any;

            const updatedSubkey = helperKey.subkeys.find(
              (s: any) => s.keyPacket.getKeyID().toHex() === keyIDhex
            );
            if (!updatedSubkey) throw new Error("Failed to locate updated subkey");

            await targetSubkey.update(updatedSubkey, new Date());
            return { privateKey };
          }
        );

        await updateKeyInIndexeddb(selectedUserId.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });

        const refreshed: any = await loadKeysFromIndexedDB();
        setUsers(refreshed);

        addToast({ title: "Subkey Validity Updated", color: "success" });
        return true;
      } catch (err: any) {
        if (isCancellationError(err)) return false;
        console.error("changeSubkeyValidity error:", err);
        addToast({ title: "Failed to update subkey validity", color: "danger" });
        return false;
      }
    },
    [selectedUserId, getDecryptionOpts, setUsers]
  );

  // ---------------------------------------------------------------------------
  // addOrChangeSubkeyPassword
  // ---------------------------------------------------------------------------
  const addOrChangeSubkeyPassword = useCallback(
    async (subkeyIndex: number): Promise<KeyringUser | undefined> => {
      if (!selectedUserId || subkeyIndex === undefined) return undefined;
      try {
        let privateKey: any = await openpgp.readPrivateKey({
          armoredKey: selectedUserId.privateKey,
        });
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
            return undefined;
          }
        }

        const newPassphrase = await triggerNewPasswordChangeModal();
        await subkeys[subkeyIndex].keyPacket.encrypt(newPassphrase);

        let finalPrivate = privateKey.armor();
        const finalPublic = privateKey.toPublic().armor();

        if (ownerPassphrase !== null) {
          const reProtected = await openpgp.encryptKey({
            privateKey,
            passphrase: ownerPassphrase,
          });
          finalPrivate = reProtected.armor();
        }

        await updateKeyInIndexeddb(selectedUserId.id, {
          privateKey: finalPrivate,
          publicKey: finalPublic,
        });

        const refreshed: any = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u: any) => u.id === selectedUserId.id);

        if (ownerPassphrase === null) {
          addToast({
            title:
              currentSubkeyPassphrase === null
                ? "Subkey Password Added Successfully"
                : "Subkey Password Changed Successfully",
            color: "success",
          });
        } else {
          addToast({
            title:
              "The primary key is already password-protected, so subkey passwords cannot differ from the primary passphrase.",
            color: "warning",
          });
        }

        setSubkeyGlobalIndex(null);
        return updated;
      } catch (err: any) {
        setSubkeyGlobalIndex(null);
        if (isCancellationError(err)) return undefined;
        console.error("Error in addOrChangeSubkeyPassword:", err);
        addToast({ title: "Failed To Change Subkey Password", color: "danger" });
        return undefined;
      }
    },
    [
      selectedUserId,
      triggerKeyPasswordModal,
      triggerSubkeyPasswordModal,
      triggerNewPasswordChangeModal,
      setSubkeyGlobalIndex,
      setUsers,
    ]
  );

  // ---------------------------------------------------------------------------
  // removeSubkeyPassword
  // ---------------------------------------------------------------------------
  const removeSubkeyPassword = useCallback(
    async (subkeyIndex: number): Promise<KeyringUser | undefined> => {
      if (!selectedUserId || subkeyIndex === undefined) return undefined;
      try {
        let privateKey: any = await openpgp.readPrivateKey({
          armoredKey: selectedUserId.privateKey,
        });
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
            return undefined;
          }
        }

        if (!targetSubkeyObj.isDecrypted() && currentSubkeyPassphrase) {
          await targetSubkeyObj.keyPacket.decrypt(currentSubkeyPassphrase);
        }

        let finalPrivate = privateKey.armor();
        const finalPublic = privateKey.toPublic().armor();

        if (ownerPassphrase !== null) {
          const reparsed = await openpgp.readPrivateKey({ armoredKey: finalPrivate });
          const reProtected = await openpgp.encryptKey({
            privateKey: reparsed,
            passphrase: ownerPassphrase,
          });
          finalPrivate = reProtected.armor();
        }

        await updateKeyInIndexeddb(selectedUserId.id, {
          privateKey: finalPrivate,
          publicKey: finalPublic,
        });
        const refreshed: any = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u: any) => u.id === selectedUserId.id);

        if (ownerPassphrase === null) {
          addToast({ title: "Subkey Password removed successfully", color: "success" });
        } else {
          addToast({
            title:
              "The primary key is already password-protected, so subkey passwords cannot be removed.",
            color: "warning",
          });
        }

        setSubkeyGlobalIndex(null);
        return updated;
      } catch (err: any) {
        setSubkeyGlobalIndex(null);
        if (isCancellationError(err)) return undefined;
        addToast({ title: "Failed To Remove Subkey Password", color: "danger" });
        return undefined;
      }
    },
    [
      selectedUserId,
      triggerKeyPasswordModal,
      triggerSubkeyPasswordModal,
      setSubkeyGlobalIndex,
      setUsers,
    ]
  );

  // ---------------------------------------------------------------------------
  // addSubkey
  // ---------------------------------------------------------------------------
  const addSubkey = useCallback(
    async (
      user: KeyringUser | any,
      {
        selectedAlgorithm,
        subkeyOption,
        isNoExpiryChecked,
        expiryDate,
      }: {
        selectedAlgorithm: string;
        subkeyOption: string;
        isNoExpiryChecked: boolean;
        expiryDate: string | null;
      }
    ): Promise<boolean> => {
      if (!user || !user.privateKey) return false;
      try {
        const opt = String(subkeyOption);
        const isSign = opt === "0";
        const isEncrypt = opt === "1";
        let subkeyOpts: any = { date: new Date(), sign: isSign, encrypt: isEncrypt };

        if (!isNoExpiryChecked && expiryDate) {
          const now = Date.now();
          const sel = new Date(expiryDate);
          const midnightAfter = new Date(
            sel.getFullYear(),
            sel.getMonth(),
            sel.getDate() + 1
          ).getTime();
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

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          user,
          getDecryptionOpts(),
          async ({ privateKey, publicKeyObj }) => {
            const revocationMaps = await captureRevocationState(publicKeyObj, privateKey);
            const mutatedKey = await privateKey.addSubkey(subkeyOpts);
            restoreRevocationState(mutatedKey, revocationMaps);
            return { privateKey: mutatedKey };
          }
        );

        await updateKeyInIndexeddb(user.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });
        addToast({ title: "Subkey added successfully", color: "success" });
        setUsers(await loadKeysFromIndexedDB());
        return true;
      } catch (err: any) {
        if (isCancellationError(err)) return false;
        console.error("addSubkey error:", err);
        addToast({ title: "Failed to add subkey", color: "danger" });
        return false;
      }
    },
    [getDecryptionOpts, setUsers]
  );

  // ---------------------------------------------------------------------------
  // revokeSubkey
  // ---------------------------------------------------------------------------
  const revokeSubkey = useCallback(
    async (subkeyIndex: number): Promise<boolean> => {
      setRevocationReasonText("");
      try {
        let primaryKey: any = await openpgp.readKey({ armoredKey: selectedUserId.privateKey });
        let currentPassword = null;
        if (primaryKey.isPrivate() && !primaryKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(selectedUserId);
          primaryKey = (await openpgp.decryptKey({
            privateKey: primaryKey as any,
            passphrase: currentPassword,
          })) as any;
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
            return false;
          }
        }

        let targetSubkey = subkeys[subkeyIndex];
        if (!targetSubkey.isDecrypted() && currentSubkeyPassphrase) {
          await (targetSubkey.keyPacket as any).decrypt(currentSubkeyPassphrase);
        }

        const revokedSubkey = await targetSubkey.revoke(
          primaryKey.keyPacket,
          {
            flag: parseInt(revocationReason, 10),
            string: revocationReasonText || undefined,
          },
          new Date()
        );

        await targetSubkey.update(revokedSubkey);

        if (isEncrypted && currentSubkeyPassphrase) {
          await (targetSubkey.keyPacket as any).encrypt(currentSubkeyPassphrase);
        }

        let newPrivateArmored = primaryKey.armor();
        let newPublicArmored = primaryKey.toPublic().armor();

        if (currentPassword !== null) {
          const reProtected = await openpgp.encryptKey({
            privateKey: primaryKey,
            passphrase: currentPassword,
          });
          newPrivateArmored = reProtected.armor();
        }

        await updateKeyInIndexeddb(selectedUserId.id, {
          privateKey: newPrivateArmored,
          publicKey: newPublicArmored,
        });

        const refreshedKeys: any = await loadKeysFromIndexedDB();
        setUsers(refreshedKeys);

        addToast({ title: "Subkey Revoked Successfully", color: "success" });
        return true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        console.error("revokeSubkey error:", error);
        addToast({ title: "Failed to revoke subkey", color: "danger" });
        return false;
      }
    },
    [
      selectedUserId,
      triggerKeyPasswordModal,
      triggerSubkeyPasswordModal,
      revocationReason,
      revocationReasonText,
      setRevocationReasonText,
      setUsers,
    ]
  );

  // ---------------------------------------------------------------------------
  // manageSubkeys
  // ---------------------------------------------------------------------------
  const manageSubkeys = useCallback(async (user: KeyringUser | any) => {
    if (!user || !user.privateKey) return [];
    try {
      const privateKey = await openpgp.readPrivateKey({ armoredKey: user.privateKey });

      const formatDateLocal = (isoDate: any) => {
        const date = new Date(isoDate);
        if (!(date instanceof Date) || isNaN(date.getTime())) return "Unknown";
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
        return `${day}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
      };

      const getSubkeyExpiryInfo = async (sk: any) => {
        try {
          const isRevoked = await sk.isRevoked();
          if (isRevoked) return { expirydate: "Revoked", status: "revoked" };
          const expirationTime = await sk.getExpirationTime();
          const now = new Date();
          if (!expirationTime || expirationTime === Infinity)
            return { expirydate: "No Expiry", status: "active" };
          if (expirationTime < now)
            return { expirydate: formatDateLocal(expirationTime), status: "expired" };
          return { expirydate: formatDateLocal(expirationTime), status: "active" };
        } catch {
          return { expirydate: "Error", status: "unknown" };
        }
      };

      const getSubkeyUsage = (sk: any) => {
        const usage = [];
        for (const sig of sk.bindingSignatures) {
          const flagsArray = sig.keyFlags || sig.parsedKeyFlags || [];
          for (const f of flagsArray) {
            if (f & openpgp.enums.keyFlags.signData) usage.push("Signing");
            if (
              f &
              (openpgp.enums.keyFlags.encryptCommunication |
                openpgp.enums.keyFlags.encryptStorage)
            )
              usage.push("Encryption");
          }
        }
        return [...new Set(usage)].join(", ") || "Unknown";
      };

      const formatAlgorithmLocal = (algoInfo: any) => {
        const labelMap: Record<string, string> = {
          curve25519: "Curve25519 (EdDSA/ECDH)",
          nistP256: "NIST P-256 (ECDSA/ECDH)",
          nistP521: "NIST P-521 (ECDSA/ECDH)",
          brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
          brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
        };
        if (["eddsa", "ecdh", "eddsaLegacy", "curve25519"].includes(algoInfo.algorithm))
          return labelMap.curve25519;
        if (algoInfo.curve && labelMap[algoInfo.curve]) return labelMap[algoInfo.curve];
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
        return algoInfo.algorithm || "Unknown";
      };

      const privateSubs = privateKey.getSubkeys();
      return await Promise.all(
        privateSubs.map(async (sk: any, idx: any) => {
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
            keyid:
              sk.getKeyID().toHex().toUpperCase().match(/.{1,4}/g)?.join(" ") ||
              sk.getKeyID().toHex().toUpperCase(),
            fingerprint:
              sk.getFingerprint().toUpperCase().match(/.{1,4}/g)?.join(" ") ||
              sk.getFingerprint().toUpperCase(),
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
    backupSubkey,
    changeSubkeyValidity,
    addOrChangeSubkeyPassword,
    removeSubkeyPassword,
    addSubkey,
    revokeSubkey,
    manageSubkeys,
  };
}
