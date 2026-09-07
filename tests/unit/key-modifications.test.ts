import { describe, it, expect, beforeAll } from "vitest";
import * as openpgp from "openpgp";
import { captureKeySignatureState, restoreKeySignatureState, withDecryptedKey } from "@/lib/pgp";
import { generateTestKeyPair } from "../fixtures/keys";

describe("key-modifications integration tests", () => {
  let rootKey: openpgp.PrivateKey;
  let certifierKey: openpgp.PrivateKey;

  beforeAll(async () => {
    rootKey = (await generateTestKeyPair("Root User", "root@example.com", { passphrase: "password123" })).privateKey;
    certifierKey = (await generateTestKeyPair("Certifier", "certifier@example.com")).privateKey;
  });

  describe("Suite 1: Certification Preservation through reformatKey", () => {
    it("preserves third-party certifications after reformatKey", async () => {
      const certifiedPub = await rootKey.toPublic().signAllUsers([certifierKey]);
      const state = await captureKeySignatureState(certifiedPub, rootKey);
      
      const decryptedRoot = await openpgp.decryptKey({
        privateKey: rootKey,
        passphrase: "password123",
      });

      const { privateKey: reformattedKey } = await openpgp.reformatKey({
        privateKey: decryptedRoot,
        userIDs: [{ name: "Root User", email: "root@example.com" }],
        keyExpirationTime: 3600,
        format: "object",
        passphrase: "password123",
      }) as any;

      expect(reformattedKey.users[0].otherCertifications?.length || 0).toBe(0);
      restoreKeySignatureState(reformattedKey, state);
      expect(reformattedKey.users[0].otherCertifications?.length).toBeGreaterThan(0);
    });
  });

  describe("Suite 2: User ID Operations", () => {
    it("preserves existing certifications when adding a new user ID", async () => {
      const certifiedPub = await rootKey.toPublic().signAllUsers([certifierKey]);
      const state = await captureKeySignatureState(certifiedPub, rootKey);

      const decryptedRoot = await openpgp.decryptKey({
        privateKey: rootKey,
        passphrase: "password123",
      });

      const { privateKey: reformattedKey } = await openpgp.reformatKey({
        privateKey: decryptedRoot,
        userIDs: [
          { name: "Root User", email: "root@example.com" },
          { name: "Secondary", email: "secondary@example.com" },
        ],
        format: "object",
        passphrase: "password123",
      }) as any;

      restoreKeySignatureState(reformattedKey, state);

      const firstUser = reformattedKey.users.find((u: any) => u.userID?.userID === "Root User <root@example.com>");
      expect(firstUser?.otherCertifications?.length).toBeGreaterThan(0);
      
      const secondUser = reformattedKey.users.find((u: any) => u.userID?.userID === "Secondary <secondary@example.com>");
      expect(secondUser?.otherCertifications?.length || 0).toBe(0);
    });

    it("revoking a user ID preserves other users' certifications", async () => {
      const decryptedRoot = await openpgp.decryptKey({
        privateKey: rootKey,
        passphrase: "password123",
      });

      const { privateKey: twoUserKey } = await openpgp.reformatKey({
        privateKey: decryptedRoot,
        userIDs: [
          { name: "Root User", email: "root@example.com" },
          { name: "Secondary", email: "secondary@example.com" },
        ],
        format: "object",
        passphrase: "password123",
      }) as any;

      const certifiedPub = await twoUserKey.toPublic().signAllUsers([certifierKey]);
      const state = await captureKeySignatureState(certifiedPub, twoUserKey);
      restoreKeySignatureState(twoUserKey, state);

      const decryptedTwoUser = await openpgp.decryptKey({
        privateKey: twoUserKey,
        passphrase: "password123",
      });

      const targetUser = decryptedTwoUser.users.find((u: any) => u.userID?.userID === "Secondary <secondary@example.com>");
      if (!targetUser) throw new Error("target user not found");
      const revokedUser = await (targetUser as any).revoke(decryptedTwoUser.keyPacket);
      
      const userIdx = decryptedTwoUser.users.findIndex((u: any) => u.userID?.userID === "Secondary <secondary@example.com>");
      decryptedTwoUser.users[userIdx] = revokedUser;

      const primaryUser = decryptedTwoUser.users.find((u: any) => u.userID?.userID === "Root User <root@example.com>");
      expect(primaryUser?.otherCertifications?.length).toBeGreaterThan(0);
      expect(revokedUser.otherCertifications?.length).toBeGreaterThan(0);
      expect(await revokedUser.isRevoked()).toBe(true);
    });
  });

  describe("Suite 3: Key Validity and Passwords", () => {
    it("preserves certifications during password change (decrypt + encrypt roundtrip)", async () => {
      const certifiedPub = await rootKey.toPublic().signAllUsers([certifierKey]);
      const state = await captureKeySignatureState(certifiedPub, rootKey);
      restoreKeySignatureState(rootKey, state);

      const decryptedKey = await openpgp.decryptKey({
        privateKey: rootKey,
        passphrase: "password123",
      });

      const encryptedKey = await openpgp.encryptKey({
        privateKey: decryptedKey,
        passphrase: "newpassword456",
      }) as any;

      expect(encryptedKey.users[0].otherCertifications?.length).toBeGreaterThan(0);

      // Verify that armored encrypted private key retains otherCertifications when read back
      const reparsedEncrypted = await openpgp.readPrivateKey({ armoredKey: encryptedKey.armor() });
      expect(reparsedEncrypted.users[0].otherCertifications?.length).toBeGreaterThan(0);
    });
  });

  describe("Suite 4: Subkey Operations", () => {
    it("adding a subkey preserves primary user certifications", async () => {
      const certifiedPub = await rootKey.toPublic().signAllUsers([certifierKey]);
      const state = await captureKeySignatureState(certifiedPub, rootKey);
      restoreKeySignatureState(rootKey, state);

      const decryptedKey = await openpgp.decryptKey({
        privateKey: rootKey,
        passphrase: "password123",
      });

      const keyWithSubkey = await decryptedKey.addSubkey({
        type: "ecc",
        curve: "curve25519" as any,
      }) as any;

      expect(keyWithSubkey.users[0].otherCertifications?.length).toBeGreaterThan(0);
    });

    it("reproduces and tests withDecryptedKey preserving certifications when adding a subkey", async () => {
      const { privateKey: freshRootKey } = await generateTestKeyPair("Root User", "root@example.com", { passphrase: "password123" });
      const certifiedPub = await freshRootKey.toPublic().signAllUsers([certifierKey]);
      const user = {
        id: "test-user-1",
        name: "Root User",
        email: "root@example.com",
        privateKey: freshRootKey.armor(),
        publicKey: certifiedPub.armor(),
      };

      const opts = {
        triggerKeyPasswordModal: async () => "password123",
        decryptSubkeys: async () => new Map<number, string>(),
      };

      const { finalPrivateKey, finalPublicKey } = await withDecryptedKey(
        user,
        opts,
        async ({ privateKey, publicKeyObj }: any) => {
          const signatureState = await captureKeySignatureState(publicKeyObj, privateKey);
          const mutatedKey = await privateKey.addSubkey({
            type: "ecc",
            curve: "curve25519" as any,
          });
          restoreKeySignatureState(mutatedKey, signatureState);
          return { privateKey: mutatedKey };
        }
      );

      const parsedFinalPub = await openpgp.readKey({ armoredKey: finalPublicKey });
      expect(parsedFinalPub.users[0].otherCertifications?.length).toBeGreaterThan(0);

      // Now test a SECOND subkey addition using the resulting user record
      const userAfterFirstSubkey = {
        ...user,
        privateKey: finalPrivateKey,
        publicKey: finalPublicKey,
      };

      const { finalPublicKey: secondPublicKey } = await withDecryptedKey(
        userAfterFirstSubkey,
        opts,
        async ({ privateKey, publicKeyObj }: any) => {
          const signatureState = await captureKeySignatureState(publicKeyObj, privateKey);
          const mutatedKey = await privateKey.addSubkey({
            type: "ecc",
            curve: "curve25519" as any,
          });
          restoreKeySignatureState(mutatedKey, signatureState);
          return { privateKey: mutatedKey };
        }
      );

      const parsedSecondPub = await openpgp.readKey({ armoredKey: secondPublicKey });
      expect(parsedSecondPub.users[0].otherCertifications?.length).toBeGreaterThan(0);
    });

    it("automatically preserves certifications in withDecryptedKey even if callback does not manually capture/restore", async () => {
      const { privateKey: freshRootKey } = await generateTestKeyPair("Auto Root", "autoroot@example.com", { passphrase: "password123" });
      const certifiedPub = await freshRootKey.toPublic().signAllUsers([certifierKey]);
      const user = {
        id: "test-user-auto",
        name: "Auto Root",
        email: "autoroot@example.com",
        privateKey: freshRootKey.armor(),
        publicKey: certifiedPub.armor(),
      };

      const opts = {
        triggerKeyPasswordModal: async () => "password123",
        decryptSubkeys: async () => new Map<number, string>(),
      };

      // Callback does NOT touch captureKeySignatureState or restoreKeySignatureState
      const { finalPublicKey } = await withDecryptedKey(
        user,
        opts,
        async ({ privateKey }: any) => {
          const mutatedKey = await privateKey.addSubkey({
            type: "ecc",
            curve: "curve25519" as any,
          });
          return { privateKey: mutatedKey };
        }
      );

      const parsedFinalPub = await openpgp.readKey({ armoredKey: finalPublicKey });
      expect(parsedFinalPub.users[0].otherCertifications?.length).toBeGreaterThan(0);
    });

    it("preserves certifications when revoking a subkey", async () => {
      const { privateKey: freshRootKey } = await generateTestKeyPair("Revoke Subkey User", "revokesubkey@example.com");
      const subkey = await freshRootKey.addSubkey({
        type: "ecc",
        curve: "curve25519" as any,
      });

      const certifiedPub = await subkey.toPublic().signAllUsers([certifierKey]);
      const pubKeyObj = await openpgp.readKey({ armoredKey: certifiedPub.armor() });

      const signatureState = await captureKeySignatureState(pubKeyObj, subkey);
      const targetSubkey = subkey.getSubkeys()[0];
      const revokedSubkey = await targetSubkey.revoke(
        subkey.keyPacket as any,
        { flag: 0, string: "Key is Compromised" },
        new Date()
      );

      await targetSubkey.update(revokedSubkey);
      restoreKeySignatureState(subkey, signatureState);

      const finalPub = await openpgp.readKey({ armoredKey: subkey.toPublic().armor() });
      expect(finalPub.users[0].otherCertifications?.length).toBeGreaterThan(0);
      expect(finalPub.getSubkeys()[0].revocationSignatures.length).toBeGreaterThan(0);
    });
  });

  describe("Suite 5: Comprehensive End-to-End Key Lifecycle", () => {
    it("preserves certifications through full lifecycle: add subkey -> subkey password -> multiple user IDs -> reorder primary -> revoke user ID -> revoke subkey", async () => {
      // Setup: Generate root key and have it certified by an external key
      const { privateKey: rootPriv } = await generateTestKeyPair("Master User", "master@example.com", {
        passphrase: "masterpass123",
      });
      const certifiedPub = await rootPriv.toPublic().signAllUsers([certifierKey]);

      let userRecord = {
        id: "lifecycle-test-user",
        name: "Master User",
        email: "master@example.com",
        privateKey: rootPriv.armor(),
        publicKey: certifiedPub.armor(),
      };

      const assertCertificationsPresent = async (record: typeof userRecord, stepName: string) => {
        const pub = await openpgp.readKey({ armoredKey: record.publicKey });
        const target = pub.users.find((u: any) => u.userID?.userID?.includes("master@example.com"));
        expect(target, `Primary user must exist at step: ${stepName}`).toBeDefined();
        expect(target?.otherCertifications?.length, `Certifications missing at step: ${stepName}`).toBeGreaterThan(0);
        expect(target?.otherCertifications[0].issuerKeyID.toHex().toUpperCase()).toBe(
          certifierKey.getKeyIDs()[0].toHex().toUpperCase()
        );
      };

      // Verify baseline certifications
      await assertCertificationsPresent(userRecord, "initial baseline");

      // -----------------------------------------------------------------------
      // Step 1: Add a Subkey
      // -----------------------------------------------------------------------
      let baseOpts = {
        triggerKeyPasswordModal: async () => "masterpass123",
        decryptSubkeys: async () => new Map<number, string>(),
      };

      const step1Result = await withDecryptedKey(
        userRecord,
        baseOpts,
        async ({ privateKey }: any) => {
          const mutatedKey = await privateKey.addSubkey({
            type: "ecc",
            curve: "curve25519" as any,
          });
          return { privateKey: mutatedKey };
        }
      );

      userRecord = {
        ...userRecord,
        privateKey: step1Result.finalPrivateKey,
        publicKey: step1Result.finalPublicKey,
      };
      await assertCertificationsPresent(userRecord, "Step 1: after add subkey");

      // -----------------------------------------------------------------------
      // Step 2: Add Subkey Password Protection (Subkey Passphrase)
      // -----------------------------------------------------------------------
      // Mirroring useSubkeyManagement addOrChangeSubkeyPassword flow
      let pkToEncrypt = await openpgp.readPrivateKey({ armoredKey: userRecord.privateKey });
      pkToEncrypt = await openpgp.decryptKey({ privateKey: pkToEncrypt, passphrase: "masterpass123" });
      await (pkToEncrypt.subkeys[0].keyPacket as any).encrypt("subkeypass456");

      const reProtectedPriv = await openpgp.encryptKey({
        privateKey: pkToEncrypt,
        passphrase: "masterpass123",
      });
      // In our fixed implementation, subkey password operations only update privateKey
      userRecord.privateKey = reProtectedPriv.armor();
      await assertCertificationsPresent(userRecord, "Step 2: after subkey password encryption");

      // -----------------------------------------------------------------------
      // Step 3: Add Multiple User IDs (Secondary and Tertiary)
      // -----------------------------------------------------------------------
      const subkeyPasses = new Map<number, string>([[0, "subkeypass456"]]);
      const optsWithProtectedSubkey = {
        triggerKeyPasswordModal: async () => "masterpass123",
        decryptSubkeys: async (pk: any) => {
          if (!pk.subkeys[0].isDecrypted()) {
            await pk.subkeys[0].keyPacket.decrypt("subkeypass456");
          }
          return subkeyPasses;
        },
      };

      const step3Result = await withDecryptedKey(
        userRecord,
        optsWithProtectedSubkey,
        async ({ privateKey, publicKeyObj }: any) => {
          const existingUserIDs = publicKeyObj.getUserIDs().map((u: string) => {
            const match = u.match(/^(.*?)\s*<(.+?)>$/);
            return match ? { name: match[1].trim(), email: match[2].trim() } : { name: u.trim() };
          });

          const updatedUserIDs = [
            ...existingUserIDs,
            { name: "Secondary User", email: "secondary@example.com" },
            { name: "Tertiary User", email: "tertiary@example.com" },
          ];

          const reformatted = (await openpgp.reformatKey({
            privateKey,
            userIDs: updatedUserIDs,
            format: "object",
          })) as any;

          return { privateKey: reformatted.privateKey };
        }
      );

      userRecord = {
        ...userRecord,
        privateKey: step3Result.finalPrivateKey,
        publicKey: step3Result.finalPublicKey,
      };
      await assertCertificationsPresent(userRecord, "Step 3: after adding multiple user IDs");

      // Verify all 3 user IDs exist on public key
      const pubStep3 = await openpgp.readKey({ armoredKey: userRecord.publicKey });
      expect(pubStep3.getUserIDs().length).toBe(3);

      // -----------------------------------------------------------------------
      // Step 4: Reorder User IDs (Set Secondary User as Primary)
      // -----------------------------------------------------------------------
      const step4Result = await withDecryptedKey(
        userRecord,
        optsWithProtectedSubkey,
        async ({ privateKey, publicKeyObj }: any) => {
          const userIDs = publicKeyObj.getUserIDs().map((u: string) => {
            const match = u.match(/^(.*?)\s*<(.+?)>$/);
            return match ? { name: match[1].trim(), email: match[2].trim() } : { name: u.trim() };
          });

          const secondary = userIDs.find((u: any) => u.email === "secondary@example.com");
          const others = userIDs.filter((u: any) => u.email !== "secondary@example.com");
          const reordered = [secondary, ...others];

          const reformatted = (await openpgp.reformatKey({
            privateKey,
            userIDs: reordered,
            format: "object",
          })) as any;

          return { privateKey: reformatted.privateKey };
        }
      );

      userRecord = {
        ...userRecord,
        privateKey: step4Result.finalPrivateKey,
        publicKey: step4Result.finalPublicKey,
      };
      await assertCertificationsPresent(userRecord, "Step 4: after reordering primary user ID");

      const pubStep4 = await openpgp.readKey({ armoredKey: userRecord.publicKey });
      expect(pubStep4.getUserIDs()[0]).toContain("secondary@example.com");

      // -----------------------------------------------------------------------
      // Step 5: Revoke a User ID ("Tertiary User")
      // -----------------------------------------------------------------------
      const step5Result = await withDecryptedKey(
        userRecord,
        optsWithProtectedSubkey,
        async ({ privateKey }: any) => {
          const targetUser = privateKey.users.find((u: any) =>
            u.userID?.userID?.includes("tertiary@example.com")
          );
          expect(targetUser).toBeDefined();

          const revoked = await (targetUser as any).revoke(privateKey.keyPacket);
          const idx = privateKey.users.indexOf(targetUser);
          privateKey.users[idx] = revoked;

          return { privateKey };
        }
      );

      userRecord = {
        ...userRecord,
        privateKey: step5Result.finalPrivateKey,
        publicKey: step5Result.finalPublicKey,
      };
      await assertCertificationsPresent(userRecord, "Step 5: after revoking tertiary user ID");

      // -----------------------------------------------------------------------
      // Step 6: Revoke the Subkey
      // -----------------------------------------------------------------------
      let primaryKeyForSubkeyRevoke = await openpgp.readPrivateKey({ armoredKey: userRecord.privateKey });
      primaryKeyForSubkeyRevoke = await openpgp.decryptKey({
        privateKey: primaryKeyForSubkeyRevoke,
        passphrase: "masterpass123",
      });
      if (!primaryKeyForSubkeyRevoke.subkeys[0].isDecrypted()) {
        await (primaryKeyForSubkeyRevoke.subkeys[0].keyPacket as any).decrypt("subkeypass456");
      }

      const pubKeyObjBeforeRevoke = await openpgp.readKey({ armoredKey: userRecord.publicKey });
      const signatureStateBeforeRevoke = await captureKeySignatureState(
        pubKeyObjBeforeRevoke,
        primaryKeyForSubkeyRevoke
      );

      const subkeyToRevoke = primaryKeyForSubkeyRevoke.subkeys[0];
      const revokedSubkey = await subkeyToRevoke.revoke(
        primaryKeyForSubkeyRevoke.keyPacket as any,
        { flag: 0, string: "Key is Compromised" },
        new Date()
      );
      await subkeyToRevoke.update(revokedSubkey);
      restoreKeySignatureState(primaryKeyForSubkeyRevoke, signatureStateBeforeRevoke);

      await (primaryKeyForSubkeyRevoke.subkeys[0].keyPacket as any).encrypt("subkeypass456");
      const reProtectedAfterSubkeyRevoke = await openpgp.encryptKey({
        privateKey: primaryKeyForSubkeyRevoke,
        passphrase: "masterpass123",
      });

      userRecord = {
        ...userRecord,
        privateKey: reProtectedAfterSubkeyRevoke.armor(),
        publicKey: primaryKeyForSubkeyRevoke.toPublic().armor(),
      };
      await assertCertificationsPresent(userRecord, "Step 6: after revoking subkey");

      // -----------------------------------------------------------------------
      // Step 7: Remove Subkey Password (Decrypt and Keep Decrypted)
      // -----------------------------------------------------------------------
      let pkForPassRemoval = await openpgp.readPrivateKey({ armoredKey: userRecord.privateKey });
      pkForPassRemoval = await openpgp.decryptKey({ privateKey: pkForPassRemoval, passphrase: "masterpass123" });
      if (!pkForPassRemoval.subkeys[0].isDecrypted()) {
        await (pkForPassRemoval.subkeys[0].keyPacket as any).decrypt("subkeypass456");
      }
      const reEncryptedAfterPassRemoval = await openpgp.encryptKey({
        privateKey: pkForPassRemoval,
        passphrase: "masterpass123",
      });
      // In useSubkeyManagement, removeSubkeyPassword only updates privateKey
      userRecord.privateKey = reEncryptedAfterPassRemoval.armor();
      await assertCertificationsPresent(userRecord, "Step 7: after removing subkey password");

      // -----------------------------------------------------------------------
      // Step 8: Change Subkey Validity via withDecryptedKey
      // -----------------------------------------------------------------------
      const step8Opts = {
        triggerKeyPasswordModal: async () => "masterpass123",
        decryptSubkeys: async () => new Map<number, string>(),
      };
      const activeSubkeyIdHex = (await openpgp.readKey({ armoredKey: userRecord.publicKey }))
        .subkeys[1].keyPacket.getKeyID().toHex();

      const step8Result = await withDecryptedKey(
        userRecord,
        step8Opts,
        async ({ privateKey, publicKeyObj }: any) => {
          const targetSubkey = privateKey.subkeys.find(
            (s: any) => s.keyPacket.getKeyID().toHex() === activeSubkeyIdHex
          );
          expect(targetSubkey).toBeDefined();

          const existingUserIDs = publicKeyObj.getUserIDs().map((u: string) => {
            const match = u.match(/^(.*?)\s*<(.+?)>$/);
            return match ? { name: match[1].trim(), email: match[2].trim() } : { name: u.trim() };
          });

          const { privateKey: helperKey } = (await openpgp.reformatKey({
            privateKey,
            userIDs: existingUserIDs,
            keyExpirationTime: 7200,
            date: new Date(),
            format: "object",
          })) as any;

          const updatedSubkey = helperKey.subkeys.find(
            (s: any) => s.keyPacket.getKeyID().toHex() === activeSubkeyIdHex
          );
          await targetSubkey.update(updatedSubkey, new Date());
          return { privateKey };
        }
      );

      userRecord = {
        ...userRecord,
        privateKey: step8Result.finalPrivateKey,
        publicKey: step8Result.finalPublicKey,
      };
      await assertCertificationsPresent(userRecord, "Step 8: after updating subkey validity");

      // -----------------------------------------------------------------------
      // Step 9: Change Primary Key Validity via withDecryptedKey
      // -----------------------------------------------------------------------
      const step9Result = await withDecryptedKey(
        userRecord,
        step8Opts,
        async ({ privateKey, publicKeyObj }: any) => {
          const allUserIDs = publicKeyObj.getUserIDs().map((u: string) => {
            const match = u.match(/^(.*?)\s*<(.+?)>$/);
            return match ? { name: match[1].trim(), email: match[2].trim() } : { name: u.trim() };
          });

          const updatedKeyPair = (await openpgp.reformatKey({
            privateKey,
            keyExpirationTime: 86400,
            date: new Date(),
            format: "object",
            userIDs: allUserIDs,
          })) as any;

          return { privateKey: updatedKeyPair.privateKey };
        }
      );

      userRecord = {
        ...userRecord,
        privateKey: step9Result.finalPrivateKey,
        publicKey: step9Result.finalPublicKey,
      };
      await assertCertificationsPresent(userRecord, "Step 9: after changing primary key validity");

      // -----------------------------------------------------------------------
      // Final Inspection: Certifications & Statuses Completely Intact
      // -----------------------------------------------------------------------
      const finalPub = await openpgp.readKey({ armoredKey: userRecord.publicKey });
      expect(finalPub.users.length).toBe(3);
      expect(finalPub.subkeys.length).toBe(2);
      expect(finalPub.subkeys[0].revocationSignatures.length).toBeGreaterThan(0);

      const certifiedUser = finalPub.users.find((u: any) => u.userID?.userID?.includes("master@example.com"));
      expect(certifiedUser?.otherCertifications?.length).toBeGreaterThan(0);
      expect(certifiedUser?.otherCertifications[0].issuerKeyID.toHex().toUpperCase()).toBe(
        certifierKey.getKeyIDs()[0].toHex().toUpperCase()
      );
    });
  });
});
