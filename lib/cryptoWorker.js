// AES-GCM encryption (client-side)
const encrypt = async (text, password) => {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 1000000,
      hash: "SHA-512",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );

  // Combine salt, iv, and the encrypted content
  const combined = new Uint8Array(
    salt.byteLength + iv.byteLength + encryptedBuffer.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(
    new Uint8Array(encryptedBuffer),
    salt.byteLength + iv.byteLength
  );

  // Binary-safe base64 encoding
  const toBase64 = (uint8array) => {
    let binary = "";
    for (let i = 0; i < uint8array.length; i++) {
      binary += String.fromCharCode(uint8array[i]);
    }
    return btoa(binary);
  };

  return toBase64(combined);
};

// AES-GCM decryption (client-side)
const decrypt = async (encryptedBase64, password) => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) =>
    c.charCodeAt(0)
  );
  const salt = encryptedBytes.slice(0, 16);
  const iv = encryptedBytes.slice(16, 28);
  const data = encryptedBytes.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 1000000,
      hash: "SHA-512",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return dec.decode(decryptedBuffer);
};

const hashKey = async (text) => {
  const enc = new TextEncoder();
  const buffer = enc.encode(text);
  const digest = await crypto.subtle.digest("SHA-512", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

onmessage = async (e) => {
  const task = e.data;
  try {
    switch (task.type) {
      case "encrypt":
        {
          const result = await encrypt(task.text, task.password);
          postMessage({ type: task.responseType, payload: result });
        }
        break;
      case "decrypt":
        {
          const result = await decrypt(task.encryptedBase64, task.password);
          postMessage({ type: task.responseType, payload: result });
        }
        break;
      case "hashKey":
        {
          const result = await hashKey(task.text);
          postMessage({ type: task.responseType, payload: result });
        }
        break;
      default:
        throw new Error("Unknown task type");
    }
  } catch {
    postMessage({ type: "error" });
  }
};
