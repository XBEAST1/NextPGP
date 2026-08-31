import { describe, it, expect } from "vitest";
import * as openpgp from "openpgp";
import {
  aliceKey,
  bobKey,
  toStoredPGPKeys,
  ALL_TEST_KEYS,
  TEST_PASSWORDS,
} from "../fixtures/keys";
import { encryptMatrixPayload } from "../helpers/matrix-generator";
import { runDecryptWorkerHarness } from "../helpers/worker-harness";

// Mock helper to create a mock File / Blob object for worker tests
function createMockFile(name: string, data: Uint8Array): File {
  return {
    name,
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    size: data.length,
    type: "application/octet-stream",
  } as unknown as File;
}

describe("Decryption Matrix Integration — File Decryption (`fileDecrypt`, `filePasswordDecrypt`, `.sig`)", () => {
  const FILE_CONTENT = new TextEncoder().encode("Confidential document binary payload 12345");

  describe("Single File Decryption", () => {
    it("Decrypts single file with recipient key (Bob)", async () => {
      const encryptedBinary = (await encryptMatrixPayload(6, FILE_CONTENT, "binary")) as Uint8Array;
      const mockFile = createMockFile("document.pdf.gpg", encryptedBinary);

      const res = await runDecryptWorkerHarness({
        type: "fileDecrypt",
        files: [mockFile],
        pgpKeys: toStoredPGPKeys([bobKey]),
      });

      expect(res.downloadFiles.length).toBe(1);
      expect(res.downloadFiles[0].fileName).toBe("document.pdf");
      expect(new TextDecoder().decode(res.downloadFiles[0].decrypted)).toBe(
        "Confidential document binary payload 12345"
      );
      expect(res.isComplete).toBe(true);
    });

    it("Decrypts single file with password", async () => {
      const encryptedBinary = (await encryptMatrixPayload(1, FILE_CONTENT, "binary")) as Uint8Array;
      const mockFile = createMockFile("archive.zip.pgp", encryptedBinary);

      const res = await runDecryptWorkerHarness({
        type: "filePasswordDecrypt",
        files: [mockFile],
        pgpKeys: toStoredPGPKeys(ALL_TEST_KEYS),
        password: TEST_PASSWORDS.SYMMETRIC,
      });

      expect(res.downloadFiles.length).toBe(1);
      expect(res.downloadFiles[0].fileName).toBe("archive.zip");
      expect(new TextDecoder().decode(res.downloadFiles[0].decrypted)).toBe(
        "Confidential document binary payload 12345"
      );
      expect(res.isComplete).toBe(true);
    });
  });

  describe("Multiple Files Decryption", () => {
    it("Decrypts multiple files in a single batch", async () => {
      const file1Data = new TextEncoder().encode("File 1 content");
      const file2Data = new TextEncoder().encode("File 2 content");

      const encrypted1 = (await encryptMatrixPayload(6, file1Data, "binary")) as Uint8Array;
      const encrypted2 = (await encryptMatrixPayload(6, file2Data, "binary")) as Uint8Array;

      const mockFile1 = createMockFile("file1.txt.gpg", encrypted1);
      const mockFile2 = createMockFile("file2.txt.gpg", encrypted2);

      const res = await runDecryptWorkerHarness({
        type: "fileDecrypt",
        files: [mockFile1, mockFile2],
        pgpKeys: toStoredPGPKeys([bobKey]),
      });

      expect(res.downloadFiles.length).toBe(2);
      expect(res.downloadFiles[0].fileName).toBe("file1.txt");
      expect(new TextDecoder().decode(res.downloadFiles[0].decrypted)).toBe("File 1 content");
      expect(res.downloadFiles[1].fileName).toBe("file2.txt");
      expect(new TextDecoder().decode(res.downloadFiles[1].decrypted)).toBe("File 2 content");
      expect(res.isComplete).toBe(true);
    });
  });

  describe("Attached Signature (.sig) File Verification", () => {
    it("Verifies and extracts binary attached signature file", async () => {
      const dataToSign = new TextEncoder().encode("Attached file content to verify");
      const msg = await openpgp.createMessage({ binary: dataToSign });
      const privKey = await openpgp.readPrivateKey({ armoredKey: aliceKey.privateKey });

      const signed = (await openpgp.sign({
        message: msg,
        signingKeys: privKey,
        format: "binary",
      })) as Uint8Array;

      const mockFile = createMockFile("verified-doc.pdf.sig", signed);

      const res = await runDecryptWorkerHarness({
        type: "fileDecrypt",
        files: [mockFile],
        pgpKeys: toStoredPGPKeys([aliceKey]),
      });

      expect(res.downloadFiles.length).toBe(1);
      expect(res.downloadFiles[0].fileName).toBe("verified-doc.pdf");
      expect(new TextDecoder().decode(res.downloadFiles[0].decrypted)).toBe(
        "Attached file content to verify"
      );
      expect(res.details).toContain("Signature by: Alice <alice@nextpgp.local>");
    });
  });
});
