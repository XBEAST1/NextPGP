/**
 * hooks/useKeyRevocation.ts
 *
 * Operations for revoking keys, generating revocation certificates,
 * and querying revocation reasons.
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
  withDecryptedKey,
  WithDecryptedKeyOpts,
} from "@/lib/pgp";
import { KeyringUser } from "@/hooks/useKeyOperations";

export interface UseKeyRevocationConfig {
  setUsers: (users: KeyringUser[] | any[]) => void;
  getDecryptionOpts: () => WithDecryptedKeyOpts;
  decryptSubkeys: (privateKey: any) => Promise<Map<number, string>>;
  triggerKeyPasswordModal: (user: any) => Promise<string>;
  revocationReason: string;
  revocationReasonText: string;
  setRevocationReasonText: (text: string) => void;
}

const isCancellationError = (err: any): boolean => {
  return err instanceof Error && err.message === "Password entry cancelled";
};

export function useKeyRevocation({
  setUsers,
  getDecryptionOpts,
  decryptSubkeys,
  triggerKeyPasswordModal,
  revocationReason,
  revocationReasonText,
  setRevocationReasonText,
}: UseKeyRevocationConfig) {
  // ---------------------------------------------------------------------------
  // generateRevocationCertificate
  // ---------------------------------------------------------------------------
  const generateRevocationCertificate = useCallback(
    async (user: KeyringUser | any): Promise<boolean> => {
      try {
        let privateKey: any = await openpgp.readKey({ armoredKey: user.privateKey });
        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          const currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({ privateKey, passphrase: currentPassword });
        }

        await decryptSubkeys(privateKey);

        const fullPublicKey = await openpgp.readKey({ armoredKey: user.publicKey });
        const formattedUserIDs = fullPublicKey
          .getUserIDs()
          .map(parseUserId)
          .map((u) =>
            u.email && u.email !== "N/A" ? { name: u.name, email: u.email } : { name: u.name }
          );

        const { revocationCertificate } = (await openpgp.reformatKey({
          privateKey,
          userIDs: formattedUserIDs,
          format: "armored",
        })) as any;

        const keyid = user.keyid.replace(/\s/g, "");
        downloadAsFile(
          revocationCertificate,
          `${user.name}_0x${keyid}_REVOCATION_CERTIFICATE.asc`
        );
        addToast({ title: "Revocation Certificate Generated", color: "success" });
        return true;
      } catch (err: any) {
        if (isCancellationError(err)) return false;
        addToast({ title: "Failed to generate revocation certificate", color: "danger" });
        return false;
      }
    },
    [triggerKeyPasswordModal, decryptSubkeys]
  );

  // ---------------------------------------------------------------------------
  // revokeUsingCertificate
  // ---------------------------------------------------------------------------
  const revokeUsingCertificate = useCallback(
    async (user: KeyringUser | any, revocationCertificate: string): Promise<boolean> => {
      try {
        const keyid = user.keyid.replace(/\s/g, "");

        if (user.privateKey && user.privateKey.trim()) {
          const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
            user,
            getDecryptionOpts(),
            async ({ privateKey }) => {
              const revokedKey = (await openpgp.revokeKey({
                key: privateKey,
                format: "object",
                revocationCertificate,
                date: new Date(),
              })) as any;
              return { privateKey: revokedKey.privateKey };
            }
          );

          await updateKeyInIndexeddb(user.id, {
            privateKey: finalPrivateKey,
            publicKey: finalPublicKey,
          });
          downloadAsFile(finalPublicKey, `${user.name}_0x${keyid}_REVOKED_PUBLIC_KEY.asc`);

          addToast({
            title: "Key Revoked",
            description: "Both public and private keys have been updated with the revocation signature.",
            color: "success",
          });
        } else {
          const publicKey = await openpgp.readKey({ armoredKey: user.publicKey });
          const revokedKey = (await openpgp.revokeKey({
            key: publicKey,
            format: "armored",
            revocationCertificate,
            date: new Date(),
          })) as any;
          await updateKeyInIndexeddb(user.id, { publicKey: revokedKey.publicKey });

          downloadAsFile(revokedKey.publicKey, `${user.name}_0x${keyid}_REVOKED_PUBLIC_KEY.asc`);

          addToast({
            title: "Public Key Revoked",
            description: "Your public key has been updated with the revocation signature.",
            color: "success",
          });
        }

        setUsers(await loadKeysFromIndexedDB());
        return true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        addToast({
          title: "Revocation Failed",
          description: error.message || "An unexpected error occurred.",
          color: "danger",
        });
        return false;
      }
    },
    [getDecryptionOpts, setUsers]
  );

  // ---------------------------------------------------------------------------
  // revokeKey
  // ---------------------------------------------------------------------------
  const revokeKey = useCallback(
    async (user: KeyringUser | any): Promise<boolean> => {
      setRevocationReasonText("");
      try {
        const keyid = user.keyid.replace(/\s/g, "");

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          user,
          getDecryptionOpts(),
          async ({ privateKey }) => {
            const revokedKey = (await openpgp.revokeKey({
              key: privateKey,
              format: "object",
              reasonForRevocation: {
                flag: parseInt(revocationReason, 10),
                string: revocationReasonText || undefined,
              },
              date: new Date(),
            })) as any;
            return { privateKey: revokedKey.privateKey };
          }
        );

        await updateKeyInIndexeddb(user.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });
        downloadAsFile(finalPublicKey, `${user.name}_0x${keyid}_PUBLIC_REVOKED.asc`);

        addToast({ title: "Key Revoked Successfully", color: "success" });
        setUsers(await loadKeysFromIndexedDB());
        return true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        console.error("revokeKey error:", error);
        addToast({ title: "Failed to revoke key", color: "danger" });
        return false;
      }
    },
    [getDecryptionOpts, revocationReason, revocationReasonText, setRevocationReasonText, setUsers]
  );

  // ---------------------------------------------------------------------------
  // getRevocationReason
  // ---------------------------------------------------------------------------
  const getRevocationReason = useCallback(async (user: KeyringUser | any) => {
    try {
      const key = await openpgp.readKey({ armoredKey: user.publicKey || user.privateKey });
      if (!key.revocationSignatures || key.revocationSignatures.length === 0) return null;
      for (const sig of key.revocationSignatures) {
        if (typeof sig.reasonForRevocationFlag !== "undefined") {
          return {
            code: sig.reasonForRevocationFlag,
            text: sig.reasonForRevocationString || null,
          };
        }
      }
      return null;
    } catch (e) {
      console.error("Error reading revocation reason:", e);
      return null;
    }
  }, []);

  return {
    generateRevocationCertificate,
    revokeUsingCertificate,
    revokeKey,
    getRevocationReason,
  };
}
