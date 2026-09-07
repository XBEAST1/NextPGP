import { describe, it, expect, beforeAll } from "vitest";
import * as openpgp from "openpgp";
import {
  parseUserId,
  safeExpirationSeconds,
  captureKeySignatureState,
  restoreKeySignatureState,
} from "@/lib/pgp";
import { generateTestKeyPair } from "../fixtures/keys";

describe("pgp helpers unit tests", () => {
  describe("parseUserId", () => {
    it("parses name and email", () => {
      expect(parseUserId("John Doe <john@example.com>")).toEqual({
        id: "John Doe <john@example.com>",
        name: "John Doe",
        email: "john@example.com",
        status: "active",
      });
    });

    it("parses name without email", () => {
      expect(parseUserId("John Doe")).toEqual({
        id: "John Doe",
        name: "John Doe",
        email: "N/A",
        status: "active",
      });
    });

    it("parses email only", () => {
      expect(parseUserId("<john@example.com>")).toEqual({
        id: "<john@example.com>",
        name: "",
        email: "john@example.com",
        status: "active",
      });
    });

    it("handles empty string", () => {
      expect(parseUserId("")).toEqual({
        id: "",
        name: "",
        email: "N/A",
        status: "active",
      });
    });

    it("handles malformed tags", () => {
      expect(parseUserId("John Doe <john@example.com")).toEqual({
        id: "John Doe <john@example.com",
        name: "John Doe <john@example.com",
        email: "N/A",
        status: "active",
      });
    });
  });

  describe("safeExpirationSeconds", () => {
    it("returns undefined for null or undefined expiry", () => {
      const creationTime = new Date("2026-09-07T10:00:00Z");
      expect(safeExpirationSeconds(null, creationTime)).toBeUndefined();
      expect(safeExpirationSeconds(undefined, creationTime)).toBeUndefined();
    });

    it("returns undefined for Infinity expiry", () => {
      const creationTime = new Date("2026-09-07T10:00:00Z");
      expect(safeExpirationSeconds(Infinity, creationTime)).toBeUndefined();
    });

    it("calculates seconds difference correctly", () => {
      const creationTime = new Date("2026-09-07T10:00:00Z");
      const expirationTime = new Date("2026-09-07T11:00:00Z"); // +1 hour
      expect(safeExpirationSeconds(expirationTime, creationTime)).toBe(3600);
    });

    it("returns undefined if expiration is in the past relative to creation time", () => {
      const creationTime = new Date("2026-09-07T10:00:00Z");
      const expirationTime = new Date("2026-09-07T09:00:00Z"); // -1 hour
      expect(safeExpirationSeconds(expirationTime, creationTime)).toBeUndefined();
    });
  });

  describe("captureKeySignatureState and restoreKeySignatureState", () => {
    let aliceKey: openpgp.PrivateKey;
    let bobKey: openpgp.PrivateKey;
    
    beforeAll(async () => {
      aliceKey = (await generateTestKeyPair("Alice", "alice@example.com")).privateKey;
      bobKey = (await generateTestKeyPair("Bob", "bob@example.com")).privateKey;
    });

    it("captures and restores third-party certifications (otherCertifications)", async () => {
      // Bob signs Alice's key
      const alicePub = aliceKey.toPublic();
      const certifiedAlice = await alicePub.signAllUsers([bobKey]);

      const state = await captureKeySignatureState(certifiedAlice, aliceKey);

      expect(state.userOtherCertificationsMap.has("Alice <alice@example.com>")).toBe(true);
      expect(state.userOtherCertificationsMap.get("Alice <alice@example.com>")?.length).toBeGreaterThan(0);

      // Create a fresh uncertified version of Alice
      const freshAlice = aliceKey.toPublic();
      const freshUser = freshAlice.users[0];
      
      expect(freshUser.otherCertifications?.length || 0).toBe(0);

      restoreKeySignatureState(freshAlice, state);
      
      expect(freshUser.otherCertifications?.length).toBeGreaterThan(0);
      expect(freshUser.otherCertifications![0].issuerKeyID.toHex()).toEqual(bobKey.getKeyID().toHex());
    });

    it("captures and restores key revocation signatures", async () => {
      const { privateKey: revokedAliceKey } = await openpgp.revokeKey({
        key: aliceKey,
        reasonForRevocation: {
          flag: openpgp.enums.reasonForRevocation.keyCompromised,
          string: "compromised",
        },
        format: "object",
      }) as any;
      const state = await captureKeySignatureState(revokedAliceKey);
      
      expect(state.keyRevocationSignatures.length).toBeGreaterThan(0);

      const freshAlice = aliceKey.toPublic();
      expect(freshAlice.revocationSignatures?.length || 0).toBe(0);
      
      restoreKeySignatureState(freshAlice, state);
      expect(freshAlice.revocationSignatures?.length).toBeGreaterThan(0);
    });

    it("captures and restores user ID revocations", async () => {
      const clonedAlice = await openpgp.readPrivateKey({ armoredKey: aliceKey.armor() });
      const targetUser = clonedAlice.users[0];
      const revokedUser = await (targetUser as any).revoke(clonedAlice.keyPacket);
      clonedAlice.users[0] = revokedUser;
      
      const state = await captureKeySignatureState(clonedAlice.toPublic());
      const userState = state.userRevocationMap.get("Alice <alice@example.com>");
      
      expect(userState?.isRevoked).toBe(true);
      expect(userState?.revocationSignatures.length).toBeGreaterThan(0);

      const freshAlice = aliceKey.toPublic();
      restoreKeySignatureState(freshAlice, state);
      
      expect(freshAlice.users[0].revocationSignatures?.length).toBeGreaterThan(0);
    });
  });
});
