import { describe, it, expect } from "vitest";
import * as openpgp from "openpgp";
import {
  aliceKey,
  bobKey,
  TEST_PASSWORDS,
} from "../fixtures/keys";
import { handleEncryptWorkerMessage } from "@/app/encrypt/encryptWorker";
import type {
  EncryptWorkerMessageData,
  EncryptResponsePayload,
} from "@/app/encrypt/encryptWorker.types";

function createMockFile(
  name: string,
  data: Uint8Array,
  webkitRelativePath: string = ""
): File {
  return {
    name,
    webkitRelativePath,
    arrayBuffer: async () =>
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    size: data.length,
    type: "application/octet-stream",
  } as unknown as File;
}

async function runEncryptHarness(
  data: EncryptWorkerMessageData
): Promise<{
  messages: EncryptResponsePayload[];
  encryptedMessage?: string;
  downloadFile?: { fileName: string; encrypted: Uint8Array | string };
  toasts: Array<{ title: string; description?: string; color: string }>;
}> {
  const messages: EncryptResponsePayload[] = [];
  const originalPostMessage = globalThis.postMessage;

  (globalThis as any).postMessage = (response: EncryptResponsePayload) => {
    messages.push(response);
  };

  try {
    const event = { data } as MessageEvent<EncryptWorkerMessageData>;
    await handleEncryptWorkerMessage(event);
  } finally {
    (globalThis as any).postMessage = originalPostMessage;
  }

  let encryptedMessage: string | undefined;
  let downloadFile: { fileName: string; encrypted: Uint8Array | string } | undefined;
  const toasts: Array<{ title: string; description?: string; color: string }> = [];

  for (const msg of messages) {
    if (msg.type === "setEncryptedMessage") {
      encryptedMessage = msg.payload;
    } else if (msg.type === "downloadFile") {
      downloadFile = msg.payload;
    } else if (msg.type === "addToast") {
      toasts.push(msg.payload);
    }
  }

  return { messages, encryptedMessage, downloadFile, toasts };
}

describe("Encrypt Worker Integration Tests", () => {
  const PLAINTEXT = "Hello NextPGP Secure Message!";

  describe("messageEncrypt", () => {
    it("Encrypts text message with password", async () => {
      const res = await runEncryptHarness({
        type: "messageEncrypt",
        message: PLAINTEXT,
        isChecked: true,
        encryptionPassword: TEST_PASSWORDS.SYMMETRIC,
        recipientKeys: [],
        recipients: [],
      });

      expect(res.encryptedMessage).toBeDefined();
      expect(res.encryptedMessage).toContain("-----BEGIN PGP MESSAGE-----");

      // Verify it can be decrypted
      const decrypted = await openpgp.decrypt({
        message: await openpgp.readMessage({ armoredMessage: res.encryptedMessage! }),
        passwords: [TEST_PASSWORDS.SYMMETRIC],
      });
      expect(decrypted.data).toBe(PLAINTEXT);
    });

    it("Encrypts text message with recipient key (Bob)", async () => {
      const res = await runEncryptHarness({
        type: "messageEncrypt",
        message: PLAINTEXT,
        isChecked: false,
        recipientKeys: [{ id: "bob-1", publicKey: bobKey.publicKey }],
        recipients: [{ keyId: "bob-1", userId: "Bob <bob@nextpgp.local>" }],
      });

      expect(res.encryptedMessage).toBeDefined();
      expect(res.encryptedMessage).toContain("-----BEGIN PGP MESSAGE-----");

      // Decrypt using Bob's private key
      const bobPriv = await openpgp.readPrivateKey({ armoredKey: bobKey.privateKey });
      const decrypted = await openpgp.decrypt({
        message: await openpgp.readMessage({ armoredMessage: res.encryptedMessage! }),
        decryptionKeys: bobPriv,
      });
      expect(decrypted.data).toBe(PLAINTEXT);
    });

    it("Signs cleartext message when no recipient or password is provided", async () => {
      const res = await runEncryptHarness({
        type: "messageEncrypt",
        message: PLAINTEXT,
        isChecked: false,
        recipientKeys: [],
        recipients: [],
        decryptedPrivateKey: aliceKey.privateKey,
      });

      expect(res.encryptedMessage).toBeDefined();
      expect(res.encryptedMessage).toContain("-----BEGIN PGP SIGNED MESSAGE-----");
      expect(res.encryptedMessage).toContain(PLAINTEXT);
    });

    it("Shows warning toast when no recipient, password, or signer is selected", async () => {
      const res = await runEncryptHarness({
        type: "messageEncrypt",
        message: PLAINTEXT,
        isChecked: false,
        recipientKeys: [],
        recipients: [],
      });

      expect(
        res.toasts.some((t) =>
          t.title.includes("Please provide a signing key, select at least one recipient")
        )
      ).toBe(true);
    });
  });

  describe("fileEncrypt", () => {
    const BINARY_PAYLOAD = new TextEncoder().encode("File secret content 123");

    it("Encrypts single file with recipient key (Bob)", async () => {
      const mockFile = createMockFile("document.pdf", BINARY_PAYLOAD);

      const res = await runEncryptHarness({
        type: "fileEncrypt",
        files: [mockFile],
        isChecked: false,
        recipientKeys: [{ id: "bob-1", publicKey: bobKey.publicKey }],
        recipients: [{ keyId: "bob-1", userId: "Bob <bob@nextpgp.local>" }],
      });

      expect(res.downloadFile).toBeDefined();
      expect(res.downloadFile?.fileName).toBe("document.pdf.gpg");

      // Verify decryption
      const bobPriv = await openpgp.readPrivateKey({ armoredKey: bobKey.privateKey });
      const decrypted = await openpgp.decrypt({
        message: await openpgp.readMessage({
          binaryMessage: res.downloadFile?.encrypted as Uint8Array,
        }),
        decryptionKeys: bobPriv,
        format: "binary",
      });

      expect(new TextDecoder().decode(decrypted.data as Uint8Array)).toBe(
        "File secret content 123"
      );
    });

    it("Signs single file into .sig when no password or recipient is selected", async () => {
      const mockFile = createMockFile("contract.pdf", BINARY_PAYLOAD);

      const res = await runEncryptHarness({
        type: "fileEncrypt",
        files: [mockFile],
        isChecked: false,
        recipientKeys: [],
        recipients: [],
        decryptedPrivateKey: aliceKey.privateKey,
      });

      expect(res.downloadFile).toBeDefined();
      expect(res.downloadFile?.fileName).toBe("contract.pdf.sig");
    });

    it("Bundles directory files into zip and encrypts", async () => {
      const mockFile1 = createMockFile("file1.txt", new TextEncoder().encode("1"), "my-folder/file1.txt");
      const mockFile2 = createMockFile("file2.txt", new TextEncoder().encode("2"), "my-folder/file2.txt");

      const res = await runEncryptHarness({
        type: "fileEncrypt",
        directoryFiles: [mockFile1, mockFile2],
        isChecked: true,
        encryptionPassword: TEST_PASSWORDS.SYMMETRIC,
        recipientKeys: [],
        recipients: [],
      });

      expect(res.downloadFile).toBeDefined();
      expect(res.downloadFile?.fileName).toBe("my-folder.zip.gpg");
    });
  });
});
