/**
 * hooks/useUserIdManagement.ts
 *
 * Operations for adding, reordering (setting primary), revoking,
 * and listing User IDs on PGP keys.
 */

"use client";

import { useCallback } from "react";
import { addToast } from "@heroui/react";
import * as openpgp from "openpgp";
import { updateKeyInIndexeddb } from "@/lib/indexeddb";
import {
  loadKeysFromIndexedDB,
  parseUserId,
  captureKeySignatureState,
  restoreKeySignatureState,
  withDecryptedKey,
  safeExpirationSeconds,
  WithDecryptedKeyOpts,
} from "@/lib/pgp";
import { KeyringUser } from "@/hooks/useKeyOperations";

export interface UseUserIdManagementConfig {
  setUsers: (users: KeyringUser[] | any[]) => void;
  getDecryptionOpts: () => WithDecryptedKeyOpts;
  setSelectedUserId?: (user: KeyringUser | any) => void;
}

const isCancellationError = (err: any): boolean => {
  return err instanceof Error && err.message === "Password entry cancelled";
};

export function useUserIdManagement({
  setUsers,
  getDecryptionOpts,
  setSelectedUserId,
}: UseUserIdManagementConfig) {
  // ---------------------------------------------------------------------------
  // getUserIDsFromKeyForModal
  // ---------------------------------------------------------------------------
  const getUserIDsFromKeyForModal = useCallback(async (user: KeyringUser | any) => {
    if (!user) return [];
    let publicKeyArmored = user.publicKey;
    if (user.id) {
      try {
        const refreshed: any = await loadKeysFromIndexedDB();
        const found = refreshed.find((u: any) => u.id === user.id);
        if (found?.publicKey) {
          publicKeyArmored = found.publicKey;
        }
      } catch {
        // Fall back to user.publicKey
      }
    }
    if (!publicKeyArmored) return [];
    try {
      const key = await openpgp.readKey({ armoredKey: publicKeyArmored });
      const uids = key.getUserIDs();
      const keyUsers = key.users;
      const parsedUsers = [];
      for (let i = 0; i < keyUsers.length; i++) {
        const parsedUser = parseUserId(uids[i]);
        const isRevoked = await (keyUsers[i] as any).isRevoked();
        if (isRevoked) parsedUser.status = "revoked";
        parsedUsers.push(parsedUser);
      }
      return parsedUsers;
    } catch (error: any) {
      console.error("Error fetching user IDs:", error);
      return [];
    }
  }, []);

  // ---------------------------------------------------------------------------
  // addUserID
  // ---------------------------------------------------------------------------
  const addUserID = useCallback(
    async (
      user: KeyringUser | any,
      { name, email }: { name: string; email?: string }
    ): Promise<KeyringUser | boolean> => {
      if (!name || !name.trim()) return false;
      const validEmail = email?.trim() || "";

      try {
        const refreshedStart: any = await loadKeysFromIndexedDB();
        const currentUserObj = refreshedStart.find((u: any) => u.id === user.id) || user;

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          currentUserObj,
          getDecryptionOpts(),
          async ({ privateKey, publicKeyObj }) => {
            const signatureState = await captureKeySignatureState(publicKeyObj, privateKey);

            const currentUserIDs = publicKeyObj.getUserIDs().map(parseUserId);
            const newUserID = validEmail
              ? { name: name.trim(), email: validEmail }
              : { name: name.trim() };
            const updatedUserIDs = [
              ...currentUserIDs.map((u: any) =>
                u.email && u.email !== "N/A" ? { name: u.name, email: u.email } : { name: u.name }
              ),
              newUserID,
            ];

            const creationTime = privateKey.getCreationTime();
            const expirationTime = await privateKey.getExpirationTime();
            const expirationSeconds = safeExpirationSeconds(expirationTime, creationTime);

            const updatedKeyPair = (await openpgp.reformatKey({
              privateKey,
              userIDs: updatedUserIDs,
              date: creationTime,
              keyExpirationTime: expirationSeconds,
              format: "object",
            })) as any;

            const updatedPrivateKey = updatedKeyPair.privateKey;
            restoreKeySignatureState(updatedPrivateKey, signatureState);

            return { privateKey: updatedPrivateKey };
          }
        );

        await updateKeyInIndexeddb(user.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });
        addToast({ title: "User ID added successfully", color: "success" });
        const refreshed: any = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u: any) => u.id === user.id);
        if (updated) {
          setSelectedUserId?.(updated);
        }
        return updated || true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        console.error("addUserID error:", error);
        addToast({ title: "Failed to add User ID", color: "danger" });
        return false;
      }
    },
    [getDecryptionOpts, setUsers, setSelectedUserId]
  );

  // ---------------------------------------------------------------------------
  // setPrimaryUserID
  // ---------------------------------------------------------------------------
  const setPrimaryUserID = useCallback(
    async (user: KeyringUser | any, targetUserIDObj: any): Promise<KeyringUser | boolean> => {
      try {
        const refreshedStart: any = await loadKeysFromIndexedDB();
        const currentUserObj = refreshedStart.find((u: any) => u.id === user.id);
        if (!currentUserObj) throw new Error("User not found in IndexedDB");

        const targetId = typeof targetUserIDObj === "string" ? targetUserIDObj : targetUserIDObj?.id;
        const initialPubKey = await openpgp.readKey({ armoredKey: currentUserObj.publicKey });
        const freshUserIDs = initialPubKey.getUserIDs().map(parseUserId);
        if (freshUserIDs[0]?.id === targetId) {
          addToast({ title: "Primary User ID already selected", color: "primary" });
          setUsers(refreshedStart);
          setSelectedUserId?.(currentUserObj);
          return currentUserObj;
        }

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          currentUserObj,
          getDecryptionOpts(),
          async ({ privateKey, publicKeyObj }) => {
            const signatureState = await captureKeySignatureState(publicKeyObj, privateKey);

            const currentUserIDs = publicKeyObj.getUserIDs().map(parseUserId);
            const targetUser = currentUserIDs.find((u: any) => u.id === targetId);
            if (!targetUser) throw new Error("Target user ID not found on key");

            const reorderedUserIDs = [
              targetUser,
              ...currentUserIDs.filter((u: any) => u.id !== targetId),
            ].map((u: any) =>
              u.email && u.email !== "N/A" ? { name: u.name, email: u.email } : { name: u.name }
            );

            const creationTime = privateKey.getCreationTime();
            const expirationTime = await privateKey.getExpirationTime();
            const expirationSeconds = safeExpirationSeconds(expirationTime, creationTime);

            const updatedKeyPair = (await openpgp.reformatKey({
              privateKey,
              userIDs: reorderedUserIDs,
              date: creationTime,
              keyExpirationTime: expirationSeconds,
              format: "object",
            })) as any;

            const updatedPrivateKey = updatedKeyPair.privateKey;
            restoreKeySignatureState(updatedPrivateKey, signatureState);

            return { privateKey: updatedPrivateKey };
          }
        );

        await updateKeyInIndexeddb(user.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });
        addToast({ title: "Primary User ID updated successfully", color: "success" });

        const refreshed: any = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u: any) => u.id === user.id);
        if (updated) {
          setSelectedUserId?.(updated);
        }
        return updated || true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        console.error("setPrimaryUserID error:", error);
        addToast({ title: "Failed to update Primary User ID", color: "danger" });
        return false;
      }
    },
    [getDecryptionOpts, setUsers, setSelectedUserId]
  );

  // ---------------------------------------------------------------------------
  // revokeUserID
  // ---------------------------------------------------------------------------
  const revokeUserID = useCallback(
    async (user: KeyringUser | any, targetUserIDObj: any): Promise<KeyringUser | boolean> => {
      try {
        const refreshedStart: any = await loadKeysFromIndexedDB();
        const currentUserObj = refreshedStart.find((u: any) => u.id === user.id);
        if (!currentUserObj) throw new Error("User not found in IndexedDB");

        const targetId = typeof targetUserIDObj === "string" ? targetUserIDObj : targetUserIDObj?.id;

        const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
          currentUserObj,
          getDecryptionOpts(),
          async ({ privateKey }) => {
            const targetUser = privateKey.users.find((u: any) => {
              if (!u.userID) return false;
              const parsed = parseUserId(u.userID.userID);
              return parsed.id === targetId;
            });
            if (!targetUser) throw new Error("Target user ID not found on key");

            const revokedUser = await (targetUser as any).revoke(privateKey.keyPacket);
            const idx = privateKey.users.indexOf(targetUser);
            if (idx !== -1) privateKey.users[idx] = revokedUser;

            return { privateKey };
          }
        );

        await updateKeyInIndexeddb(user.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });
        addToast({ title: "User ID revoked successfully", color: "success" });

        const refreshed: any = await loadKeysFromIndexedDB();
        setUsers(refreshed);
        const updated = refreshed.find((u: any) => u.id === user.id);
        if (updated) {
          setSelectedUserId?.(updated);
        }
        return updated || true;
      } catch (error: any) {
        if (isCancellationError(error)) return false;
        console.error("revokeUserID error:", error);
        addToast({ title: "Failed to revoke User ID", color: "danger" });
        return false;
      }
    },
    [getDecryptionOpts, setUsers, setSelectedUserId]
  );

  return {
    addUserID,
    setPrimaryUserID,
    revokeUserID,
    getUserIDsFromKeyForModal,
  };
}
