import * as openpgp from "openpgp";
import type { StoredPGPKey } from "./decryptWorker.types";

/**
 * Reads and parses all armored public keys from the provided stored PGP keys.
 */
export async function loadPublicKeys(
  pgpKeys: StoredPGPKey[] | undefined
): Promise<openpgp.Key[]> {
  const validKeys = Array.isArray(pgpKeys) ? pgpKeys : [];
  return Promise.all(
    validKeys
      .filter((k) => k.publicKey)
      .map((k) => openpgp.readKey({ armoredKey: k.publicKey! }))
  );
}

/**
 * Finds a matching public key by its key ID hex string (matching primary key or subkeys).
 */
export function matchKeyByHex(
  publicKeys: openpgp.Key[],
  hex: string
): openpgp.Key | undefined {
  if (!hex) return undefined;
  return publicKeys.find(
    (k) =>
      k.getKeyID().toHex() === hex ||
      k.getSubkeys().some((s) => s.getKeyID().toHex() === hex)
  );
}

/**
 * Finds a matching public key by an openpgp.KeyID object (matching primary key or subkeys).
 */
export function matchKeyByKeyID(
  publicKeys: openpgp.Key[],
  keyID: openpgp.KeyID
): openpgp.Key | undefined {
  return publicKeys.find(
    (key) =>
      key.getKeyID().equals(keyID) ||
      key.getSubkeys().some((subkey) => subkey.getKeyID().equals(keyID))
  );
}

/**
 * Safely extracts the primary user ID string from a key, returning a fallback on failure.
 */
export async function getUserIDFromKey(
  key: openpgp.Key | undefined,
  fallback = "Unknown Key"
): Promise<string> {
  if (!key) return fallback;
  try {
    const primary = await key.getPrimaryUser();
    return primary.user.userID?.userID || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Extracts and formats the uppercase hex fingerprint (grouped by 4 chars) from a signature packet.
 */
export function formatFingerprint(
  signaturePacket: openpgp.SignaturePacket | undefined | null
): string {
  if (!signaturePacket) return "";
  const fingerprintBytes = signaturePacket.issuerFingerprint;
  if (!fingerprintBytes) return "";

  return (
    Array.from(fingerprintBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(" ") || ""
  );
}

/**
 * Formats a signature creation timestamp into a human-readable localized string.
 */
export function formatSignatureTime(
  created: Date | null | undefined,
  locale?: string
): string {
  if (!created) return "Not Available";
  const loc =
    locale ||
    (typeof navigator !== "undefined" && navigator.language
      ? navigator.language
      : "en-US");
  const is24Hour = loc.includes("GB") || loc.includes("DE");

  const dayName = created.toLocaleDateString(loc, {
    weekday: "long",
  });
  const monthName = created.toLocaleDateString(loc, {
    month: "long",
  });
  const day = created.getDate();
  const year = created.getFullYear();
  const timeWithZone = created.toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: !is24Hour,
    timeZoneName: "long",
  });

  return `${dayName}, ${monthName} ${day}, ${year} ${timeWithZone}`;
}

/**
 * Determines the primary user ID name of the private key used for decryption.
 */
export async function getDecryptionKeyName(
  privateKey: openpgp.PrivateKey,
  publicKeys: openpgp.Key[]
): Promise<string | undefined> {
  try {
    const privateKeyID = privateKey.getKeyID().toHex();
    const matchedKey = matchKeyByHex(publicKeys, privateKeyID);
    if (matchedKey) {
      const primary = await matchedKey.getPrimaryUser();
      return primary.user.userID?.userID;
    }
  } catch {}
  return undefined;
}

/**
 * Checks if an OpenPGP message packet list contains an S2K symmetric-key encrypted packet.
 */
export function isPasswordEncryptedMessage(
  message: openpgp.Message<openpgp.Data>
): boolean {
  // S2K is defined on SymEncryptedSessionKeyPacket at runtime
  return message.packets.some(
    (packet) => Boolean((packet as { s2k?: unknown }).s2k)
  );
}

/**
 * Builds the formatted recipient list string array for a decrypted message.
 */
export async function buildRecipientList(
  message: openpgp.Message<openpgp.Data>,
  publicKeys: openpgp.Key[]
): Promise<string[]> {
  const encryptionKeyIDs = message.getEncryptionKeyIDs();
  return Promise.all(
    encryptionKeyIDs.map(async (keyID) => {
      const matchedKey = matchKeyByKeyID(publicKeys, keyID);
      const hexFormatted = keyID.toHex().match(/.{1,4}/g)?.join(" ") || "";
      if (matchedKey) {
        const userID = await getUserIDFromKey(matchedKey, "Unknown Key");
        return `\u00A0\u00A0\u00A0\u00A0\u00A0  - ${userID} (${hexFormatted})`;
      } else {
        return `\u00A0\u00A0\u00A0\u00A0\u00A0  - Unknown (${hexFormatted})`;
      }
    })
  );
}

/**
 * Builds verification details for detached or cleartext signatures (without decryption header).
 */
export async function buildVerificationDetails(
  signatures: openpgp.VerificationResult[] | undefined,
  publicKeys: openpgp.Key[],
  locale?: string
): Promise<string> {
  let details = "";
  if (signatures && signatures.length > 0) {
    for (const sig of signatures) {
      const resolved = await sig.signature;
      const hex = sig.keyID?.toHex() ?? "";
      const matched = matchKeyByHex(publicKeys, hex);
      const userID = await getUserIDFromKey(matched, "Unknown Key");
      const formatted = hex.replace(/(.{4})/g, "$1 ").trim();

      const signaturePacket = resolved.packets[0];
      const fingerprint = formatFingerprint(signaturePacket);
      const created = signaturePacket?.created
        ? new Date(signaturePacket.created)
        : null;
      const createdTimeStr = formatSignatureTime(created, locale || "en-US");

      details += `📝 Signature by: ${userID} (${formatted})\n`;
      details += `🔐 Fingerprint: ${fingerprint}\n`;
      details += `⏱️ Signature created on: ${createdTimeStr}\n\n`;
    }
  } else {
    details = "❌ No signatures found or could not verify signature.\n\n";
  }
  return details;
}

/**
 * Builds decrypted signature details including key/password info and signatures.
 */
export async function buildDecryptionSignatureDetails(
  signatures: openpgp.VerificationResult[] | undefined,
  publicKeys: openpgp.Key[],
  options: {
    isFile?: boolean;
    isPassword?: boolean;
    decryptionKeyName?: string;
    locale?: string;
  }
): Promise<string> {
  const { isFile = false, isPassword = false, decryptionKeyName, locale } = options;
  const targetLabel = isFile ? "File" : "Message";
  const methodLabel = isPassword
    ? "Password"
    : `key: ${decryptionKeyName || "Unknown Key"}`;

  let details = "";

  if (signatures && signatures.length > 0) {
    for (const sig of signatures) {
      const { signature } = sig;
      const resolvedSignature = await signature;
      const signaturePacket = resolvedSignature.packets[0];
      const fingerprint = formatFingerprint(signaturePacket);

      const createdTime = signaturePacket?.created
        ? new Date(signaturePacket.created)
        : null;
      const createdTimeStr = formatSignatureTime(createdTime, locale);

      const signingKeyID = sig.keyID?.toHex();
      let userID = "Unknown Key";
      const formattedKeyID = signingKeyID
        ? signingKeyID.replace(/(.{4})/g, "$1 ").trim()
        : "";

      if (signingKeyID) {
        const matchedKey = matchKeyByHex(publicKeys, signingKeyID);
        if (matchedKey) {
          userID = await getUserIDFromKey(matchedKey, "Unnamed Key");
        }
      }

      details += `🔑 ${targetLabel} successfully decrypted using ${methodLabel}\n`;
      details += `📝 Signature by: ${userID}`;
      if (formattedKeyID) details += ` (${formattedKeyID})`;
      details += `\n`;
      details += `🔐 Fingerprint: ${fingerprint}\n`;
      details += `⏱️ Signature created on: ${createdTimeStr}\n\n`;
    }
  } else {
    details += `🔑 ${targetLabel} successfully decrypted using ${methodLabel}\n`;
    details += `❓ You cannot be sure who encrypted this ${targetLabel.toLowerCase()} as it is not signed.\n\n`;
  }

  return details;
}
