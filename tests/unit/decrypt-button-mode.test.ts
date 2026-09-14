import { describe, it, expect } from "vitest";
import { isVerificationInput } from "@/app/decrypt/decryptUtils";

describe("isVerificationInput", () => {
  const cleartextSignedMessage = `-----BEGIN PGP SIGNED MESSAGE-----
Hash: SHA512

YoU FoRgEt a ThOuSaNd ThInGs EvErYdAY...
-----BEGIN PGP SIGNATURE-----
wrsEARYKAG0Fgmqn4M4JkEniSM3jhiX4RRQAAAAAABwAIHNhbHRAbm90YXRp
=xqUF
-----END PGP SIGNATURE-----`;

  const detachedSignature = `-----BEGIN PGP SIGNATURE-----
wrsEARYKAG0Fgmqn4M4JkEniSM3jhiX4RRQAAAAAABwAIHNhbHRAbm90YXRp
=xqUF
-----END PGP SIGNATURE-----`;

  const encryptedMessage = `-----BEGIN PGP MESSAGE-----
wy4ECQMI4WkC8V2...
-----END PGP MESSAGE-----`;

  it("returns true for cleartext signed message", () => {
    expect(isVerificationInput(cleartextSignedMessage)).toBe(true);
  });

  it("returns true for detached signature", () => {
    expect(isVerificationInput(detachedSignature)).toBe(true);
  });

  it("handles leading whitespace and newlines correctly", () => {
    expect(isVerificationInput(`   \n\n  ${cleartextSignedMessage}`)).toBe(true);
    expect(isVerificationInput(`  \t ${detachedSignature}`)).toBe(true);
  });

  it("returns false for standard encrypted PGP message", () => {
    expect(isVerificationInput(encryptedMessage)).toBe(false);
  });

  it("returns false for empty or non-signature text", () => {
    expect(isVerificationInput("")).toBe(false);
    expect(isVerificationInput("   ")).toBe(false);
    expect(isVerificationInput(null)).toBe(false);
    expect(isVerificationInput(undefined)).toBe(false);
    expect(isVerificationInput("Hello, world!")).toBe(false);
  });

  it("returns false when files are present, even if text is a signed message", () => {
    const dummyFile = { name: "secret.gpg" };
    expect(isVerificationInput(cleartextSignedMessage, [dummyFile])).toBe(false);
    expect(isVerificationInput(detachedSignature, [dummyFile])).toBe(false);
  });

  it("returns true when files array is empty and signed message is present", () => {
    expect(isVerificationInput(cleartextSignedMessage, [])).toBe(true);
    expect(isVerificationInput(detachedSignature, [])).toBe(true);
  });
});
