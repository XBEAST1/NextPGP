import { describe, it, expect } from "vitest";
import * as openpgp from "openpgp";
import {
  loadPublicKeys,
  matchKeyByHex,
  matchKeyByKeyID,
  getUserIDFromKey,
  formatFingerprint,
  formatSignatureTime,
  getDecryptionKeyName,
  isPasswordEncryptedMessage,
  buildRecipientList,
  buildVerificationDetails,
  buildDecryptionSignatureDetails,
} from "@/app/decrypt/decryptWorker.helpers";
import {
  aliceKey,
  bobKey,
  charlieProtectedKey,
  toStoredPGPKeys,
  ALL_TEST_KEYS,
  TEST_PASSWORDS,
} from "../fixtures/keys";

describe("decryptWorker.helpers unit tests", () => {
  describe("loadPublicKeys", () => {
    it("returns empty array for undefined or empty keys", async () => {
      expect(await loadPublicKeys(undefined)).toEqual([]);
      expect(await loadPublicKeys([])).toEqual([]);
    });

    it("filters out keys without publicKey", async () => {
      const result = await loadPublicKeys([{ privateKey: "xyz" }]);
      expect(result).toEqual([]);
    });

    it("parses valid armored public keys", async () => {
      const stored = toStoredPGPKeys([aliceKey, bobKey]);
      const keys = await loadPublicKeys(stored);
      expect(keys.length).toBe(2);
      expect(keys[0].getUserIDs()).toContain("Alice <alice@nextpgp.local>");
      expect(keys[1].getUserIDs()).toContain("Bob <bob@nextpgp.local>");
    });
  });

  describe("matchKeyByHex and matchKeyByKeyID", () => {
    it("matches key by primary key hex ID", async () => {
      const keys = await loadPublicKeys(toStoredPGPKeys([aliceKey, bobKey]));
      const aliceHex = keys[0].getKeyID().toHex();

      const matched = matchKeyByHex(keys, aliceHex);
      expect(matched).toBeDefined();
      expect(matched?.getUserIDs()).toContain("Alice <alice@nextpgp.local>");
    });

    it("returns undefined when hex is empty or not found", async () => {
      const keys = await loadPublicKeys(toStoredPGPKeys([aliceKey]));
      expect(matchKeyByHex(keys, "")).toBeUndefined();
      expect(matchKeyByHex(keys, "0000000000000000")).toBeUndefined();
    });

    it("matches key by openpgp.KeyID object", async () => {
      const keys = await loadPublicKeys(toStoredPGPKeys([aliceKey, bobKey]));
      const bobKeyID = keys[1].getKeyID();

      const matched = matchKeyByKeyID(keys, bobKeyID);
      expect(matched).toBeDefined();
      expect(matched?.getUserIDs()).toContain("Bob <bob@nextpgp.local>");
    });
  });

  describe("getUserIDFromKey", () => {
    it("extracts primary user ID from key", async () => {
      const keys = await loadPublicKeys(toStoredPGPKeys([aliceKey]));
      const userId = await getUserIDFromKey(keys[0]);
      expect(userId).toBe("Alice <alice@nextpgp.local>");
    });

    it("returns fallback for undefined key", async () => {
      const userId = await getUserIDFromKey(undefined, "Custom Fallback");
      expect(userId).toBe("Custom Fallback");
    });
  });

  describe("formatFingerprint", () => {
    it("formats fingerprint bytes into uppercase 4-char chunks", () => {
      const fakePacket = {
        issuerFingerprint: new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]),
      } as unknown as openpgp.SignaturePacket;

      const formatted = formatFingerprint(fakePacket);
      expect(formatted).toBe("DEAD BEEF 0102");
    });

    it("returns empty string if packet or issuerFingerprint is missing", () => {
      expect(formatFingerprint(null)).toBe("");
      expect(formatFingerprint(undefined)).toBe("");
      expect(formatFingerprint({} as openpgp.SignaturePacket)).toBe("");
    });
  });

  describe("formatSignatureTime", () => {
    it("formats valid Date into localized string", () => {
      const date = new Date("2026-08-31T12:00:00Z");
      const formatted = formatSignatureTime(date, "en-US");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("August");
    });

    it("returns 'Not Available' when date is null or undefined", () => {
      expect(formatSignatureTime(null)).toBe("Not Available");
      expect(formatSignatureTime(undefined)).toBe("Not Available");
    });
  });

  describe("getDecryptionKeyName", () => {
    it("finds primary user name for private key from public keys list", async () => {
      const priv = await openpgp.readPrivateKey({
        armoredKey: bobKey.privateKey,
      });
      const publicKeys = await loadPublicKeys(toStoredPGPKeys([aliceKey, bobKey]));

      const name = await getDecryptionKeyName(priv, publicKeys);
      expect(name).toBe("Bob <bob@nextpgp.local>");
    });
  });

  describe("isPasswordEncryptedMessage", () => {
    it("detects S2K in password-encrypted message", async () => {
      const msg = await openpgp.createMessage({ text: "hello" });
      const encrypted = await openpgp.encrypt({
        message: msg,
        passwords: [TEST_PASSWORDS.SYMMETRIC],
        format: "object",
      });

      expect(isPasswordEncryptedMessage(encrypted as openpgp.Message<openpgp.Data>)).toBe(true);
    });

    it("returns false for recipient-only encrypted message", async () => {
      const msg = await openpgp.createMessage({ text: "hello" });
      const pubKey = await openpgp.readKey({ armoredKey: aliceKey.publicKey });
      const encrypted = await openpgp.encrypt({
        message: msg,
        encryptionKeys: [pubKey],
        format: "object",
      });

      expect(isPasswordEncryptedMessage(encrypted as openpgp.Message<openpgp.Data>)).toBe(false);
    });
  });

  describe("buildRecipientList", () => {
    it("resolves recipient IDs against known public keys", async () => {
      const msg = await openpgp.createMessage({ text: "secret" });
      const pubKey = await openpgp.readKey({ armoredKey: bobKey.publicKey });
      const encrypted = (await openpgp.encrypt({
        message: msg,
        encryptionKeys: [pubKey],
        format: "object",
      })) as openpgp.Message<openpgp.Data>;

      const publicKeys = await loadPublicKeys(toStoredPGPKeys([bobKey]));
      const recipients = await buildRecipientList(encrypted, publicKeys);

      expect(recipients.length).toBe(1);
      expect(recipients[0]).toContain("Bob <bob@nextpgp.local>");
    });
  });

  describe("buildVerificationDetails and buildDecryptionSignatureDetails", () => {
    it("returns un-signed message warning when no signatures present", async () => {
      const publicKeys = await loadPublicKeys(toStoredPGPKeys([aliceKey]));
      const details = await buildDecryptionSignatureDetails(
        undefined,
        publicKeys,
        {
          isFile: false,
          isPassword: true,
        }
      );

      expect(details).toContain("Message successfully decrypted using Password");
      expect(details).toContain("You cannot be sure who encrypted this message as it is not signed.");
    });

    it("returns key decryption info with signature when signed", async () => {
      const clearMsg = await openpgp.createCleartextMessage({ text: "signed text" });
      const privKey = await openpgp.readPrivateKey({ armoredKey: aliceKey.privateKey });
      const signed = await openpgp.sign({
        message: clearMsg,
        signingKeys: privKey,
      });

      const parsed = await openpgp.readCleartextMessage({ cleartextMessage: signed });
      const publicKeys = await loadPublicKeys(toStoredPGPKeys([aliceKey]));
      const verifyResult = await openpgp.verify({
        message: parsed,
        verificationKeys: publicKeys,
      });

      const details = await buildDecryptionSignatureDetails(
        verifyResult.signatures,
        publicKeys,
        {
          isFile: false,
          isPassword: false,
          decryptionKeyName: "Bob <bob@nextpgp.local>",
        }
      );

      expect(details).toContain("Message successfully decrypted using key: Bob <bob@nextpgp.local>");
      expect(details).toContain("Signature by: Alice <alice@nextpgp.local>");
      expect(details).toContain("Fingerprint:");
      expect(details).toContain("Signature created on:");
    });
  });
});
