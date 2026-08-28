/**
 * hooks/useKeyCertifications.ts
 *
 * Operations for certifying other users' public keys and inspecting certifications.
 */

"use client";

import { useCallback } from "react";
import { addToast } from "@heroui/react";
import * as openpgp from "openpgp";
import { updateKeyInIndexeddb } from "@/lib/indexeddb";
import { loadKeysFromIndexedDB } from "@/lib/pgp";
import { KeyringUser } from "@/hooks/useKeyOperations";

export interface UseKeyCertificationsConfig {
  setUsers: (users: KeyringUser[] | any[]) => void;
  triggerKeyPasswordModal: (user: any) => Promise<string>;
  decryptSubkeys: (privateKey: any) => Promise<Map<number, string>>;
}

const isCancellationError = (err: any): boolean => {
  return err instanceof Error && err.message === "Password entry cancelled";
};

export function useKeyCertifications({
  setUsers,
  triggerKeyPasswordModal,
  decryptSubkeys,
}: UseKeyCertificationsConfig) {
  // ---------------------------------------------------------------------------
  // certifyUserKey
  // ---------------------------------------------------------------------------
  const certifyUserKey = useCallback(
    async (certifierUser: KeyringUser | any, targetUser: KeyringUser | any): Promise<string | null> => {
      try {
        let privateKey: any = await openpgp.readKey({ armoredKey: certifierUser.privateKey });

        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(certifierUser);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        await decryptSubkeys(privateKey);

        const theirPub = await openpgp.readKey({ armoredKey: targetUser.publicKey });
        const signerKeyId = privateKey.getKeyIDs()[0].toHex().toLowerCase();

        const existingKeyIds = theirPub.users.flatMap((u: any) =>
          u.otherCertifications.map((sig: any) => sig.issuerKeyID.toHex().toLowerCase())
        );

        if (existingKeyIds.includes(signerKeyId)) {
          addToast({
            title: `${targetUser.name}'s Key Already Certified By ${certifierUser.name}'s Key`,
            color: "primary",
          });
          return targetUser.publicKey;
        }

        // OpenPGP.js signAllUsers creates certification signatures for all user IDs
        // using the signing keys provided without needing to mutate internal properties.
        const certifiedKey = await theirPub.signAllUsers([privateKey], new Date());
        const updatedArmored = certifiedKey.armor();

        await updateKeyInIndexeddb(targetUser.id, {
          privateKey: targetUser.privateKey,
          publicKey: updatedArmored,
        });

        setUsers(await loadKeysFromIndexedDB());

        addToast({
          title: `${targetUser.name}'s Key Successfully Certified By ${certifierUser.name}'s Key`,
          color: "success",
        });

        return updatedArmored;
      } catch (err: any) {
        if (isCancellationError(err)) return null;
        console.error("Certification failed:", err);
        addToast({ title: `Certification Error: ${err.message || err}`, color: "danger" });
        return null;
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys, setUsers]
  );

  // ---------------------------------------------------------------------------
  // getKeyCertifications
  // ---------------------------------------------------------------------------
  const getKeyCertifications = useCallback(async (selectedUser: any, allKeys: any[]) => {
    if (!selectedUser?.publicKey) return [];
    try {
      const pubKey = await openpgp.readKey({ armoredKey: selectedUser.publicKey });
      const certifications = pubKey.users.flatMap((user: any) =>
        user.otherCertifications.map((sig: any) => ({
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
        const match = allKeys.find((k: any) => k.keyid.replace(/\s/g, "") === cert.issuerKeyID);
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

  return {
    certifyUserKey,
    getKeyCertifications,
  };
}
