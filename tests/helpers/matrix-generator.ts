import * as openpgp from "openpgp";
import {
  aliceKey,
  bobKey,
  charlieProtectedKey,
  daveProtectedKey,
  TEST_PASSWORDS,
} from "../fixtures/keys";

export type MatrixScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface MatrixScenarioMeta {
  id: MatrixScenarioId;
  title: string;
  hasPassword: boolean;
  hasRecipients: boolean;
  hasSigner: boolean;
  isSignerProtected: boolean;
  isRecipientProtected: boolean;
  expectedSignerName?: string;
  expectedRecipientNames?: string[];
  expectedDecryptionKeyName?: string;
}

export const MATRIX_SCENARIOS: Record<MatrixScenarioId, MatrixScenarioMeta> = {
  1: {
    id: 1,
    title: "Only password",
    hasPassword: true,
    hasRecipients: false,
    hasSigner: false,
    isSignerProtected: false,
    isRecipientProtected: false,
  },
  2: {
    id: 2,
    title: "Only password with signer",
    hasPassword: true,
    hasRecipients: false,
    hasSigner: true,
    isSignerProtected: false,
    isRecipientProtected: false,
    expectedSignerName: "Alice",
  },
  3: {
    id: 3,
    title: "Only password with recipients",
    hasPassword: true,
    hasRecipients: true,
    hasSigner: false,
    isSignerProtected: false,
    isRecipientProtected: false,
    expectedRecipientNames: ["Bob"],
  },
  4: {
    id: 4,
    title: "Only password with password-protected signer",
    hasPassword: true,
    hasRecipients: false,
    hasSigner: true,
    isSignerProtected: true,
    isRecipientProtected: false,
    expectedSignerName: "Charlie",
  },
  5: {
    id: 5,
    title: "Only password with password-protected recipients",
    hasPassword: true,
    hasRecipients: true,
    hasSigner: false,
    isSignerProtected: false,
    isRecipientProtected: true,
    expectedRecipientNames: ["Charlie"],
  },
  6: {
    id: 6,
    title: "Only recipients",
    hasPassword: false,
    hasRecipients: true,
    hasSigner: false,
    isSignerProtected: false,
    isRecipientProtected: false,
    expectedRecipientNames: ["Bob"],
    expectedDecryptionKeyName: "Bob",
  },
  7: {
    id: 7,
    title: "Recipients with signer",
    hasPassword: false,
    hasRecipients: true,
    hasSigner: true,
    isSignerProtected: false,
    isRecipientProtected: false,
    expectedSignerName: "Alice",
    expectedRecipientNames: ["Bob"],
    expectedDecryptionKeyName: "Bob",
  },
  8: {
    id: 8,
    title: "Password-protected signer with normal recipients",
    hasPassword: false,
    hasRecipients: true,
    hasSigner: true,
    isSignerProtected: true,
    isRecipientProtected: false,
    expectedSignerName: "Charlie",
    expectedRecipientNames: ["Bob"],
    expectedDecryptionKeyName: "Bob",
  },
  9: {
    id: 9,
    title: "Password-protected signer, normal recipients, and password",
    hasPassword: true,
    hasRecipients: true,
    hasSigner: true,
    isSignerProtected: true,
    isRecipientProtected: false,
    expectedSignerName: "Charlie",
    expectedRecipientNames: ["Bob"],
    expectedDecryptionKeyName: "Bob",
  },
  10: {
    id: 10,
    title: "Password-protected signer, password-protected recipients, and password",
    hasPassword: true,
    hasRecipients: true,
    hasSigner: true,
    isSignerProtected: true,
    isRecipientProtected: true,
    expectedSignerName: "Charlie",
    expectedRecipientNames: ["Dave"],
    expectedDecryptionKeyName: "Dave",
  },
};

/**
 * Encrypts a text message or binary data for a specific matrix scenario.
 */
export async function encryptMatrixPayload(
  scenarioId: MatrixScenarioId,
  data: string | Uint8Array,
  format: "armored" | "binary" = "armored"
): Promise<string | Uint8Array> {
  const meta = MATRIX_SCENARIOS[scenarioId];
  if (!meta) {
    throw new Error(`Unknown scenario id: ${scenarioId}`);
  }

  // 1. Prepare message
  const message =
    typeof data === "string"
      ? await openpgp.createMessage({ text: data })
      : await openpgp.createMessage({ binary: data });

  // 2. Prepare passwords
  const passwords = meta.hasPassword ? [TEST_PASSWORDS.SYMMETRIC] : undefined;

  // 3. Prepare recipient public keys
  let encryptionKeys: openpgp.Key[] | undefined;
  if (meta.hasRecipients) {
    let keyArmored = bobKey.publicKey;
    if (meta.id === 5) {
      keyArmored = charlieProtectedKey.publicKey;
    } else if (meta.id === 10) {
      keyArmored = daveProtectedKey.publicKey;
    }
    encryptionKeys = [await openpgp.readKey({ armoredKey: keyArmored })];
  }

  // 4. Prepare signing key
  let signingKeys: openpgp.PrivateKey | undefined;
  if (meta.hasSigner) {
    if (meta.isSignerProtected) {
      let charliePriv = await openpgp.readPrivateKey({
        armoredKey: charlieProtectedKey.privateKey,
      });
      signingKeys = await openpgp.decryptKey({
        privateKey: charliePriv,
        passphrase: TEST_PASSWORDS.CHARLIE_KEY,
      });
    } else {
      signingKeys = await openpgp.readPrivateKey({
        armoredKey: aliceKey.privateKey,
      });
    }
  }

  // 5. Encrypt
  return openpgp.encrypt({
    message,
    passwords,
    encryptionKeys,
    signingKeys,
    format: format as any,
  }) as Promise<string | Uint8Array>;
}
