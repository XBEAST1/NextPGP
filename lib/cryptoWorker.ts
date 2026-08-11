import pako from "pako";

// Constants for header
const MAGIC = [0x4e, 0x50]; // 'NP' for "NextPGP"
const ENCRYPTION_VERSION = 0x01;
const PURPOSE = 0x01;
const KDF_ID = 0x01; // 0x01 = PBKDF2
const CIPHER_ID = 0x01; // 0x01 = AES-GCM
const FLAGS = 0x01; // Compression used flag
const RESERVED = [0x00, 0x00]; // 2 bytes reserved for future extensions
const DEFAULT_ITERATIONS = 1_000_000; // PBKDF2 iteration count

// Lengths
const SALT_LENGTH = 16; // 16 bytes salt
const IV_LENGTH = 12; // 12 bytes IV for AES-GCM
const HMAC_LENGTH = 32; // 32 bytes HMAC-SHA256 tag

// Header consists of: 2 bytes magic + 1 byte version + 1 byte purpose +
// 1 byte KDF ID + 1 byte Cipher ID + 1 byte flags + 4 bytes iterations +
// 2 bytes reserved + 32 bytes header hash = 45 bytes total
const HEADER_LENGTH = 2 + 1 + 1 + 1 + 1 + 1 + 4 + 2 + 32;

// Byte offsets in header
const HEADER_INDEX = {
  MAGIC: 0,
  VERSION: 2,
  PURPOSE: 3,
  KDF_ID: 4,
  CIPHER_ID: 5,
  FLAGS: 6,
  ITERATIONS: 7, // 4 bytes: 7-10
  RESERVED: 11, // 2 bytes: 11-12
  HEADER_HASH: 13, // 32 bytes: 13-44
};

// Utility: encode/decode Base64
const toBase64 = (buf: any) => btoa(String.fromCharCode(...buf));

const fromBase64 = (str: any) =>
  new Uint8Array(
    atob(str)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

// Utility: encode a 32-bit BE integer
const encodeUInt32BE = (value: any) => {
  const arr = new Uint8Array(4);
  new DataView(arr.buffer).setUint32(0, value, false);
  return arr;
};

// SHA-256 hash helper
const sha256 = async (data: any) => {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
};

// Derive 64 bytes (512 bits) via PBKDF2-SHA512: 32 bytes AES key + 32 bytes HMAC key
export const deriveKey = async (password: any, salt: any, iterations = DEFAULT_ITERATIONS) => {
  const enc = new TextEncoder();
  const saltArray = salt instanceof Uint8Array ? salt : new Uint8Array(salt);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-512",
      salt: saltArray,
      iterations,
    },
    baseKey,
    512
  );

  return new Uint8Array(bits);
};

// Timing-safe comparison for Uint8Arrays
const timingSafeEqual = (a: any, b: any) => {
  if (!a || !b || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
};

// Extract salt from ciphertext without full decryption
export const extractSalt = (base64Data: any) => {
  const data = fromBase64(base64Data);
  if (data.length < HEADER_LENGTH + IV_LENGTH + SALT_LENGTH + HMAC_LENGTH) {
    throw new Error("Invalid cipher length");
  }
  const salt = data.slice(-(SALT_LENGTH + HMAC_LENGTH), -HMAC_LENGTH);
  return Array.from(salt);
};

// Derive master key material and return serializable arrays
export const deriveMasterKey = async (password: any, salt: any, iterations = DEFAULT_ITERATIONS) => {
  let saltBytes;
  if (salt) {
    saltBytes = salt instanceof Uint8Array ? salt : new Uint8Array(salt);
  } else {
    saltBytes = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  }
  const keyMaterial = await deriveKey(password, saltBytes, iterations);
  return {
    keyMaterial: Array.from(keyMaterial),
    salt: Array.from(saltBytes),
  };
};

// AES-GCM + HMAC-SHA256 encryption (supports derive-once keyMaterial or password)
export const encrypt = async (text: any, options: any = {}) => {
  const enc = new TextEncoder();
  let keyMaterial;
  let salt;
  const iterations = options.iterations || DEFAULT_ITERATIONS;

  if (options.keyMaterial && options.salt) {
    // Fast path: use pre-derived keyMaterial and salt (0 PBKDF2 iterations)
    keyMaterial = options.keyMaterial instanceof Uint8Array
      ? options.keyMaterial
      : new Uint8Array(options.keyMaterial);
    salt = options.salt instanceof Uint8Array
      ? options.salt
      : new Uint8Array(options.salt);
  } else if (options.password) {
    // Standard path: generate new salt and derive key
    salt = options.salt
      ? (options.salt instanceof Uint8Array ? options.salt : new Uint8Array(options.salt))
      : crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    keyMaterial = await deriveKey(options.password, salt, iterations);
  } else {
    throw new Error("Missing password or keyMaterial for encryption");
  }

  // Always generate a fresh, unique 12-byte IV for every encryption (mandatory AES-GCM security)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Compress plaintext
  const compressed = pako.deflate(enc.encode(text));

  const aesKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial.slice(0, 32),
    "AES-GCM",
    false,
    ["encrypt"]
  );

  // Encrypt data
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, compressed)
  );

  // Build 45-byte standard header
  const header = new Uint8Array(HEADER_LENGTH);
  header.set(MAGIC, HEADER_INDEX.MAGIC);
  header[HEADER_INDEX.VERSION] = ENCRYPTION_VERSION;
  header[HEADER_INDEX.PURPOSE] = PURPOSE;
  header[HEADER_INDEX.KDF_ID] = KDF_ID;
  header[HEADER_INDEX.CIPHER_ID] = CIPHER_ID;
  header[HEADER_INDEX.FLAGS] = FLAGS;
  header.set(encodeUInt32BE(iterations), HEADER_INDEX.ITERATIONS);
  header.set(RESERVED, HEADER_INDEX.RESERVED);

  // Hash header fields (excluding hash area) for integrity
  const headerHash = await sha256(header.slice(0, HEADER_INDEX.HEADER_HASH));
  header.set(headerHash.slice(0, 32), HEADER_INDEX.HEADER_HASH);

  // Sign everything: header + ciphertext + iv + salt
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial.slice(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const hmacData = new Uint8Array([...header, ...encrypted, ...iv, ...salt]);
  const hmac = new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, hmacData)
  );

  // Concatenate all and return Base64
  return toBase64(
    new Uint8Array([...header, ...encrypted, ...iv, ...salt, ...hmac])
  );
};

// AES-GCM + HMAC-SHA256 decryption (supports fast-path with keyMaterial or legacy fallback)
export const decrypt = async (base64Data: any, options: any = {}) => {
  try {
    const data = fromBase64(base64Data);

    // Ensure minimum length
    if (data.length < HEADER_LENGTH + IV_LENGTH + SALT_LENGTH + HMAC_LENGTH) {
      throw new Error("Invalid cipher length");
    }

    // Parse segments
    const header = data.slice(0, HEADER_LENGTH);
    const encrypted = data.slice(
      HEADER_LENGTH,
      -(IV_LENGTH + SALT_LENGTH + HMAC_LENGTH)
    );
    const iv = data.slice(
      -(IV_LENGTH + SALT_LENGTH + HMAC_LENGTH),
      -(SALT_LENGTH + HMAC_LENGTH)
    );
    const salt = data.slice(-(SALT_LENGTH + HMAC_LENGTH), -HMAC_LENGTH);
    const hmac = data.slice(-HMAC_LENGTH);

    // Validate magic
    if (
      header[HEADER_INDEX.MAGIC] !== MAGIC[0] ||
      header[HEADER_INDEX.MAGIC + 1] !== MAGIC[1]
    ) {
      throw new Error("Invalid file format");
    }

    // Validate version
    if (header[HEADER_INDEX.VERSION] !== ENCRYPTION_VERSION) {
      throw new Error("Unsupported encryption version");
    }

    // Validate header hash
    const expectedHash = header.slice(HEADER_INDEX.HEADER_HASH);
    const actualHash = await sha256(header.slice(0, HEADER_INDEX.HEADER_HASH));
    if (!timingSafeEqual(expectedHash, actualHash)) {
      throw new Error("Header tampering detected");
    }

    // Extract iterations
    const iterations = new DataView(header.buffer).getUint32(
      HEADER_INDEX.ITERATIONS,
      false
    );

    // Derive or reuse keyMaterial
    let keyMaterial = null;

    if (options.keyMaterial && options.expectedSalt) {
      const expectedSalt = options.expectedSalt instanceof Uint8Array
        ? options.expectedSalt
        : new Uint8Array(options.expectedSalt);

      // Fast path: if ciphertext salt matches expectedSalt, use cached keyMaterial directly
      if (timingSafeEqual(salt, expectedSalt)) {
        keyMaterial = options.keyMaterial instanceof Uint8Array
          ? options.keyMaterial
          : new Uint8Array(options.keyMaterial);
      }
    }

    // Fallback: If no matching keyMaterial, derive using password
    if (!keyMaterial) {
      if (!options.password) {
        throw new Error("Missing password for key derivation");
      }
      const kdfId = header[HEADER_INDEX.KDF_ID];
      if (kdfId === 0x01) {
        keyMaterial = await deriveKey(options.password, salt, iterations);
      } else {
        throw new Error("Unsupported KDF");
      }
    }

    const aesKey = await crypto.subtle.importKey(
      "raw",
      keyMaterial.slice(0, 32),
      "AES-GCM",
      false,
      ["decrypt"]
    );

    const hmacKey = await crypto.subtle.importKey(
      "raw",
      keyMaterial.slice(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Verify HMAC
    const hmacData = new Uint8Array([...header, ...encrypted, ...iv, ...salt]);
    const valid = await crypto.subtle.verify("HMAC", hmacKey, hmac, hmacData);
    if (!valid) throw new Error("Invalid signature");

    // Decrypt and decompress
    const decrypted = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, encrypted)
    );

    return new TextDecoder().decode(pako.inflate(decrypted));
  } catch (err: any) {
    throw new Error(err.message || "Decryption failed");
  }
};

// SHA-512 hash
const hashKey = async (text: any) => {
  const enc = new TextEncoder();
  const buffer = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-512", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

onmessage = async (e: any) => {
  const task = e.data;
  try {
    switch (task.type) {
      case "encrypt": {
        // Accepts: text, password (optional if keyMaterial provided), keyMaterial (optional), salt (optional)
        const result = await encrypt(task.text, {
          password: task.password,
          keyMaterial: task.keyMaterial,
          salt: task.salt,
          iterations: task.iterations,
        });
        postMessage({ type: task.responseType, payload: result, taskId: task.taskId });
        break;
      }
      case "decrypt": {
        // Accepts: encryptedBase64, password (optional if keyMaterial matches), keyMaterial (optional), expectedSalt (optional)
        const result = await decrypt(task.encryptedBase64, {
          password: task.password,
          keyMaterial: task.keyMaterial,
          expectedSalt: task.expectedSalt,
        });
        postMessage({ type: task.responseType, payload: result, taskId: task.taskId });
        break;
      }
      case "deriveMasterKey": {
        // Derives 64-byte key material from password and salt once
        const result = await deriveMasterKey(task.password, task.salt, task.iterations);
        postMessage({ type: task.responseType || "deriveMasterKeyResponse", payload: result, taskId: task.taskId });
        break;
      }
      case "extractSalt": {
        const result = extractSalt(task.encryptedBase64);
        postMessage({ type: task.responseType || "extractSaltResponse", payload: result, taskId: task.taskId });
        break;
      }
      case "hashKey": {
        const result = await hashKey(task.text);
        postMessage({ type: task.responseType, payload: result, taskId: task.taskId });
        break;
      }
      default:
        throw new Error("Unknown task type");
    }
  } catch (err: any) {
    postMessage({ type: "error", error: err.message || "Unknown error", taskId: task.taskId });
  }
};
