import { describe, it, expect } from "vitest";
import * as openpgp from "openpgp";
import {
  aliceKey,
  bobKey,
  charlieProtectedKey,
  toStoredPGPKeys,
  ALL_TEST_KEYS,
  TEST_PASSWORDS,
} from "../fixtures/keys";
import { encryptMatrixPayload } from "../helpers/matrix-generator";
import { runDecryptWorkerHarness } from "../helpers/worker-harness";

function createMockFile(name: string, data: Uint8Array): File {
  return {
    name,
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    size: data.length,
    type: "application/octet-stream",
  } as unknown as File;
}

describe("Negative Testing & Error Handling", () => {
  const PLAINTEXT = "Classified content";

  it("Wrong password on messagePasswordDecrypt returns incorrect password toast and error", async () => {
    const ciphertext = (await encryptMatrixPayload(1, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messagePasswordDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
      password: TEST_PASSWORDS.WRONG_PASSWORD,
    });

    expect(res.toasts.some((t) => t.title.includes("Incorrect password"))).toBe(true);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("Wrong password on filePasswordDecrypt returns incorrect password toast and passworderror", async () => {
    const data = new TextEncoder().encode(PLAINTEXT);
    const encryptedBinary = (await encryptMatrixPayload(1, data, "binary")) as Uint8Array;
    const mockFile = createMockFile("secure.bin.gpg", encryptedBinary);

    const res = await runDecryptWorkerHarness({
      type: "filePasswordDecrypt",
      files: [mockFile],
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
      password: TEST_PASSWORDS.WRONG_PASSWORD,
    });

    expect(res.toasts.some((t) => t.title.includes("Incorrect Password for file"))).toBe(true);
    expect(res.passwordErrors.length).toBeGreaterThan(0);
  });

  it("Missing private key on messageDecrypt returns 'No valid private key' toast and error", async () => {
    // Encrypted to Bob, but we only supply Alice's key
    const ciphertext = (await encryptMatrixPayload(6, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([aliceKey]),
    });

    expect(
      res.toasts.some((t) => t.title.includes("No valid private key available"))
    ).toBe(true);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("Encrypted private key without passphrase prompts for password modal", async () => {
    // Encrypted to Charlie (password protected), but we provide Charlie key without passphrase
    const ciphertext = (await encryptMatrixPayload(5, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([charlieProtectedKey], { includePassphrase: false }),
    });

    expect(res.isPasswordModalOpen).toBe(true);
    expect(res.currentPrivateKey).toBe(charlieProtectedKey.privateKey);
    expect(
      res.toasts.some((t) => t.title.includes("encrypted with a password protected key"))
    ).toBe(true);
  });

  it("Malformed PGP message format returns invalid format error", async () => {
    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: "THIS IS NOT A VALID PGP MESSAGE",
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
    });

    expect(
      res.toasts.some((t) => t.title.includes("not in a valid PGP format"))
    ).toBe(true);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it("Missing signature block in cleartext signed message returns error", async () => {
    const malformedCleartext = `-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nSome message without signature block`;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: malformedCleartext,
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
    });

    expect(
      res.toasts.some((t) => t.title.includes("missing its PGP signature block"))
    ).toBe(true);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
