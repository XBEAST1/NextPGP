import { describe, it, expect, beforeAll } from "vitest";
import * as openpgp from "openpgp";
import {
  aliceKey,
  bobKey,
  charlieProtectedKey,
  daveProtectedKey,
  toStoredPGPKeys,
  ALL_TEST_KEYS,
  TEST_PASSWORDS,
} from "../fixtures/keys";
import {
  encryptMatrixPayload,
  MATRIX_SCENARIOS,
  type MatrixScenarioId,
} from "../helpers/matrix-generator";
import { runDecryptWorkerHarness } from "../helpers/worker-harness";

describe("Decryption Matrix Integration — Text Messages (Scenarios 1-10)", () => {
  const PLAINTEXT = "Super Secret Message for NextPGP Automated Test Matrix!";

  // Scenario 1: Only password
  it("Scenario 1: Only password", async () => {
    const ciphertext = (await encryptMatrixPayload(1, PLAINTEXT)) as string;

    // Decrypt using messagePasswordDecrypt
    const res = await runDecryptWorkerHarness({
      type: "messagePasswordDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
      password: TEST_PASSWORDS.SYMMETRIC,
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Message successfully decrypted using Password");
    expect(res.toasts.some((t) => t.color === "success")).toBe(true);
  });

  // Scenario 2: Only password with signer
  it("Scenario 2: Only password with signer (Alice)", async () => {
    const ciphertext = (await encryptMatrixPayload(2, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messagePasswordDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
      password: TEST_PASSWORDS.SYMMETRIC,
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Message successfully decrypted using Password");
    expect(res.details).toContain("Signature by: Alice <alice@nextpgp.local>");
    expect(res.details).toContain("Fingerprint:");
  });

  // Scenario 3: Only password with recipients (Bob)
  it("Scenario 3: Only password with recipients — decrypted with Bob key", async () => {
    const ciphertext = (await encryptMatrixPayload(3, PLAINTEXT)) as string;

    // Decrypt using Bob's private key via messageDecrypt
    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([bobKey, aliceKey]),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Recipients:");
    expect(res.details).toContain("Bob <bob@nextpgp.local>");
    expect(res.details).toContain("Message successfully decrypted using key: Bob <bob@nextpgp.local>");
  });

  it("Scenario 3: Only password with recipients — decrypted with Password", async () => {
    const ciphertext = (await encryptMatrixPayload(3, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messagePasswordDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
      password: TEST_PASSWORDS.SYMMETRIC,
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Recipients:");
    expect(res.details).toContain("Bob <bob@nextpgp.local>");
  });

  // Scenario 4: Only password with password-protected signer (Charlie)
  it("Scenario 4: Only password with password-protected signer (Charlie)", async () => {
    const ciphertext = (await encryptMatrixPayload(4, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messagePasswordDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
      password: TEST_PASSWORDS.SYMMETRIC,
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Signature by: Charlie <charlie@nextpgp.local>");
  });

  // Scenario 5: Only password with password-protected recipients (Charlie)
  it("Scenario 5: Only password with password-protected recipients — unlocked with passphrase", async () => {
    const ciphertext = (await encryptMatrixPayload(5, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([charlieProtectedKey], { includePassphrase: true }),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Charlie <charlie@nextpgp.local>");
  });

  // Scenario 6: Only recipients (Bob)
  it("Scenario 6: Only recipients (Bob)", async () => {
    const ciphertext = (await encryptMatrixPayload(6, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([bobKey]),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Recipients:");
    expect(res.details).toContain("Bob <bob@nextpgp.local>");
  });

  // Scenario 7: Recipients with signer (Bob recipient, Alice signer)
  it("Scenario 7: Recipients with signer", async () => {
    const ciphertext = (await encryptMatrixPayload(7, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([bobKey, aliceKey]),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Recipients:");
    expect(res.details).toContain("Bob <bob@nextpgp.local>");
    expect(res.details).toContain("Signature by: Alice <alice@nextpgp.local>");
  });

  // Scenario 8: Password-protected signer with normal recipients (Charlie signer, Bob recipient)
  it("Scenario 8: Password-protected signer with normal recipients", async () => {
    const ciphertext = (await encryptMatrixPayload(8, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([bobKey, charlieProtectedKey]),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Recipients:");
    expect(res.details).toContain("Bob <bob@nextpgp.local>");
    expect(res.details).toContain("Signature by: Charlie <charlie@nextpgp.local>");
  });

  // Scenario 9: Password-protected signer, normal recipients, and password
  it("Scenario 9: Password-protected signer, normal recipients, and password", async () => {
    const ciphertext = (await encryptMatrixPayload(9, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([bobKey, charlieProtectedKey]),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Signature by: Charlie <charlie@nextpgp.local>");
    expect(res.details).toContain("Bob <bob@nextpgp.local>");
  });

  // Scenario 10: Password-protected signer, password-protected recipients, and password
  it("Scenario 10: Password-protected signer, password-protected recipients, and password", async () => {
    const ciphertext = (await encryptMatrixPayload(10, PLAINTEXT)) as string;

    const res = await runDecryptWorkerHarness({
      type: "messageDecrypt",
      inputMessage: ciphertext,
      pgpKeys: toStoredPGPKeys([daveProtectedKey, charlieProtectedKey], {
        includePassphrase: true,
      }),
    });

    expect(res.decryptedMessage).toBe(PLAINTEXT);
    expect(res.details).toContain("Signature by: Charlie <charlie@nextpgp.local>");
    expect(res.details).toContain("Dave <dave@nextpgp.local>");
  });

  describe("Cleartext & Detached Signatures", () => {
    it("Verifies cleartext signed messages (Alice)", async () => {
      const clearMessage = await openpgp.createCleartextMessage({ text: "Hello Cleartext" });
      const privKey = await openpgp.readPrivateKey({ armoredKey: aliceKey.privateKey });
      const signedArmored = await openpgp.sign({
        message: clearMessage,
        signingKeys: privKey,
      });

      const res = await runDecryptWorkerHarness({
        type: "messageDecrypt",
        inputMessage: signedArmored,
        pgpKeys: toStoredPGPKeys([aliceKey]),
      });

      expect(res.decryptedMessage).toBe("Hello Cleartext");
      expect(res.details).toContain("Signature by: Alice <alice@nextpgp.local>");
      expect(res.toasts.some((t) => t.title.includes("Successfully Verified"))).toBe(true);
    });

    it("Verifies detached signature only", async () => {
      const emptyMsg = await openpgp.createMessage({ text: "" });
      const privKey = await openpgp.readPrivateKey({ armoredKey: aliceKey.privateKey });
      const detachedSig = (await openpgp.sign({
        message: emptyMsg,
        signingKeys: privKey,
        format: "armored",
        detached: true,
      })) as string;

      const res = await runDecryptWorkerHarness({
        type: "messageDecrypt",
        inputMessage: detachedSig,
        pgpKeys: toStoredPGPKeys([aliceKey]),
      });

      expect(res.details).toContain("Signature by: Alice <alice@nextpgp.local>");
      expect(res.toasts.some((t) => t.title.includes("PGP Signature Detected"))).toBe(true);
    });
  });
});
