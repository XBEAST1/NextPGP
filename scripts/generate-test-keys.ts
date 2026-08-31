import * as openpgp from "openpgp";
import * as fs from "fs";
import * as path from "path";

async function generate() {
  console.log("Generating static test keys for NextPGP test suite...");

  // 1. Alice (Plain, no passphrase)
  const alice = await openpgp.generateKey({
    type: "ecc",
    curve: "ed25519Legacy",
    userIDs: [{ name: "Alice", email: "alice@nextpgp.local" }],
    format: "armored",
  });

  // 2. Bob (Plain, no passphrase)
  const bob = await openpgp.generateKey({
    type: "ecc",
    curve: "ed25519Legacy",
    userIDs: [{ name: "Bob", email: "bob@nextpgp.local" }],
    format: "armored",
  });

  // 3. Charlie (Password-protected)
  const charlie = await openpgp.generateKey({
    type: "ecc",
    curve: "ed25519Legacy",
    userIDs: [{ name: "Charlie", email: "charlie@nextpgp.local" }],
    passphrase: "charlie-pass-123",
    format: "armored",
  });

  // 4. Dave (Password-protected)
  const dave = await openpgp.generateKey({
    type: "ecc",
    curve: "ed25519Legacy",
    userIDs: [{ name: "Dave", email: "dave@nextpgp.local" }],
    passphrase: "dave-pass-456",
    format: "armored",
  });

  const content = `/**
 * Pre-generated deterministic OpenPGP key fixtures for the NextPGP test suite.
 * Generated using ECC (Curve25519 / Ed25519) for fast headless testing.
 */

import type { StoredPGPKey } from "@/app/decrypt/decryptWorker.types";

export const TEST_PASSWORDS = {
  SYMMETRIC: "symmetric-vault-password-789",
  CHARLIE_KEY: "charlie-pass-123",
  DAVE_KEY: "dave-pass-456",
  WRONG_PASSWORD: "incorrect-password-xyz",
} as const;

export interface TestKeyFixture {
  id: string;
  name: string;
  email: string;
  publicKey: string;
  privateKey: string;
  passphrase?: string;
  isPasswordProtected: boolean;
}

/** 1. Alice - Plain key (no passphrase) */
export const aliceKey: TestKeyFixture = {
  id: "key-alice-01",
  name: "Alice",
  email: "alice@nextpgp.local",
  publicKey: ${JSON.stringify(alice.publicKey)},
  privateKey: ${JSON.stringify(alice.privateKey)},
  isPasswordProtected: false,
};

/** 2. Bob - Plain key (no passphrase) */
export const bobKey: TestKeyFixture = {
  id: "key-bob-02",
  name: "Bob",
  email: "bob@nextpgp.local",
  publicKey: ${JSON.stringify(bob.publicKey)},
  privateKey: ${JSON.stringify(bob.privateKey)},
  isPasswordProtected: false,
};

/** 3. Charlie - Password-protected key (passphrase: "charlie-pass-123") */
export const charlieProtectedKey: TestKeyFixture = {
  id: "key-charlie-03",
  name: "Charlie",
  email: "charlie@nextpgp.local",
  publicKey: ${JSON.stringify(charlie.publicKey)},
  privateKey: ${JSON.stringify(charlie.privateKey)},
  passphrase: TEST_PASSWORDS.CHARLIE_KEY,
  isPasswordProtected: true,
};

/** 4. Dave - Password-protected key (passphrase: "dave-pass-456") */
export const daveProtectedKey: TestKeyFixture = {
  id: "key-dave-04",
  name: "Dave",
  email: "dave@nextpgp.local",
  publicKey: ${JSON.stringify(dave.publicKey)},
  privateKey: ${JSON.stringify(dave.privateKey)},
  passphrase: TEST_PASSWORDS.DAVE_KEY,
  isPasswordProtected: true,
};

export const ALL_TEST_KEYS: TestKeyFixture[] = [
  aliceKey,
  bobKey,
  charlieProtectedKey,
  daveProtectedKey,
];

/**
 * Converts TestKeyFixture list into StoredPGPKey objects for decrypt worker input.
 * By default, leaves passphrase unset unless includePassphrase is true.
 */
export function toStoredPGPKeys(
  keys: TestKeyFixture[],
  options: { includePassphrase?: boolean } = {}
): StoredPGPKey[] {
  return keys.map((k) => ({
    id: k.id,
    publicKey: k.publicKey,
    privateKey: k.privateKey,
    passphrase: options.includePassphrase ? k.passphrase : undefined,
    userIDs: [\`\${k.name} <\${k.email}>\`],
  }));
}
`;

  const fixturesDir = path.resolve(process.cwd(), "tests/fixtures");
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const outputPath = path.join(fixturesDir, "keys.ts");
  fs.writeFileSync(outputPath, content, "utf8");
  console.log("Successfully written keys.ts to", outputPath);
}

generate().catch(console.error);
