import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  deriveMasterKey,
  extractSalt,
  hashKey,
  handleCryptoWorkerMessage,
} from "@/lib/cryptoWorker";
import type {
  CryptoWorkerMessageData,
  CryptoResponsePayload,
} from "@/lib/cryptoWorker.types";

async function runCryptoHarness(
  data: CryptoWorkerMessageData
): Promise<CryptoResponsePayload> {
  let responsePayload: CryptoResponsePayload | undefined;
  const originalPostMessage = globalThis.postMessage;

  (globalThis as any).postMessage = (response: CryptoResponsePayload) => {
    responsePayload = response;
  };

  try {
    const event = { data } as MessageEvent<CryptoWorkerMessageData>;
    await handleCryptoWorkerMessage(event);
  } finally {
    (globalThis as any).postMessage = originalPostMessage;
  }

  if (!responsePayload) {
    throw new Error("No response message emitted from worker handler");
  }

  return responsePayload;
}

describe("Vault Crypto Worker Integration Tests (`lib/cryptoWorker.ts`)", () => {
  const PASSWORD = "vault-super-secret-password-123!";
  const PLAINTEXT = "Vault Secret Data: API Keys & Credentials";

  describe("Direct Cryptographic Functions", () => {
    it("Encrypts and decrypts text using password", async () => {
      const encryptedBase64 = await encrypt(PLAINTEXT, { password: PASSWORD });
      expect(encryptedBase64).toBeDefined();
      expect(typeof encryptedBase64).toBe("string");
      expect(encryptedBase64).not.toBe(PLAINTEXT);

      const decryptedText = await decrypt(encryptedBase64, { password: PASSWORD });
      expect(decryptedText).toBe(PLAINTEXT);
    });

    it("Derives master key material and performs fast-path encryption/decryption", async () => {
      const master = await deriveMasterKey(PASSWORD);
      expect(master.keyMaterial.length).toBe(64);
      expect(master.salt.length).toBe(16);

      const encryptedBase64 = await encrypt(PLAINTEXT, {
        keyMaterial: master.keyMaterial,
        salt: master.salt,
      });

      const decryptedText = await decrypt(encryptedBase64, {
        keyMaterial: master.keyMaterial,
        expectedSalt: master.salt,
      });

      expect(decryptedText).toBe(PLAINTEXT);
    });

    it("Extracts 16-byte salt from ciphertext header without full decryption", async () => {
      const master = await deriveMasterKey(PASSWORD);
      const encryptedBase64 = await encrypt(PLAINTEXT, {
        keyMaterial: master.keyMaterial,
        salt: master.salt,
      });

      const extracted = extractSalt(encryptedBase64);
      expect(extracted).toEqual(master.salt);
    });

    it("Computes SHA-512 key hash", async () => {
      const hash1 = await hashKey("test-key-1");
      const hash2 = await hashKey("test-key-1");
      const hash3 = await hashKey("test-key-2");

      expect(hash1).toHaveLength(128); // 512 bits = 64 bytes = 128 hex chars
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it("Prevents double-encryption on already encrypted ciphertext", async () => {
      const encryptedOnce = await encrypt(PLAINTEXT, { password: PASSWORD });
      const encryptedTwice = await encrypt(encryptedOnce, { password: PASSWORD });

      expect(encryptedTwice).toBe(encryptedOnce);
    });

    it("Detects header tampering and throws error", async () => {
      const encryptedBase64 = await encrypt(PLAINTEXT, { password: PASSWORD });
      const rawBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

      // Mutate a byte in the payload
      rawBytes[50] ^= 0xff;

      const tamperedBase64 = btoa(String.fromCharCode(...rawBytes));

      await expect(decrypt(tamperedBase64, { password: PASSWORD })).rejects.toThrow();
    });
  });

  describe("Worker Message Handler (`handleCryptoWorkerMessage`)", () => {
    it("Handles encrypt task", async () => {
      const res = await runCryptoHarness({
        type: "encrypt",
        responseType: "encryptResponse",
        text: PLAINTEXT,
        password: PASSWORD,
        taskId: 101,
      });

      expect(res.type).toBe("encryptResponse");
      expect(res.taskId).toBe(101);
      expect(typeof res.payload).toBe("string");
    });

    it("Handles decrypt task", async () => {
      const cipher = await encrypt(PLAINTEXT, { password: PASSWORD });

      const res = await runCryptoHarness({
        type: "decrypt",
        responseType: "decryptResponse",
        encryptedBase64: cipher,
        password: PASSWORD,
        taskId: 102,
      });

      expect(res.type).toBe("decryptResponse");
      expect(res.taskId).toBe(102);
      expect(res.payload).toBe(PLAINTEXT);
    });

    it("Handles deriveMasterKey task", async () => {
      const res = await runCryptoHarness({
        type: "deriveMasterKey",
        responseType: "deriveMasterKeyResponse",
        password: PASSWORD,
        taskId: 103,
      });

      expect(res.type).toBe("deriveMasterKeyResponse");
      expect(res.taskId).toBe(103);

      const payload = res.payload as { keyMaterial: number[]; salt: number[] };
      expect(payload.keyMaterial.length).toBe(64);
      expect(payload.salt.length).toBe(16);
    });

    it("Handles extractSalt task", async () => {
      const master = await deriveMasterKey(PASSWORD);
      const cipher = await encrypt(PLAINTEXT, {
        keyMaterial: master.keyMaterial,
        salt: master.salt,
      });

      const res = await runCryptoHarness({
        type: "extractSalt",
        responseType: "extractSaltResponse",
        encryptedBase64: cipher,
        taskId: 104,
      });

      expect(res.type).toBe("extractSaltResponse");
      expect(res.taskId).toBe(104);
      expect(res.payload).toEqual(master.salt);
    });

    it("Handles hashKey task", async () => {
      const res = await runCryptoHarness({
        type: "hashKey",
        responseType: "hashKeyResponse",
        text: "my-key",
        taskId: 105,
      });

      expect(res.type).toBe("hashKeyResponse");
      expect(res.taskId).toBe(105);
      expect(typeof res.payload).toBe("string");
    });

    it("Emits error for missing or invalid parameters", async () => {
      const res = await runCryptoHarness({
        type: "encrypt",
        responseType: "encryptResponse",
        taskId: 106,
      });

      expect(res.type).toBe("error");
      expect(res.taskId).toBe(106);
      expect(res.error).toBe("Missing text for encryption");
    });
  });
});
