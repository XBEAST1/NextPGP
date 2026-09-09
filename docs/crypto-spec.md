# NextPGP Cryptographic Specification & Zero-Knowledge Architecture

## 1. Overview & Threat Model

NextPGP is architected around a strict **Zero-Knowledge** and **End-to-End Encryption (E2EE)** paradigm. All cryptographic operations—including OpenPGP keypair generation, symmetric encryption/decryption, passphrases derivation, and vault packing—are executed exclusively inside the client's browser using the native **Web Crypto API** and client-side Web Workers.

### Zero-Knowledge Invariants
* **Zero Plaintext Transmission**: Plaintext messages, raw PGP private/public keys, and master passwords never leave the client's device unencrypted.
* **Server as Dumb Storage**: The Next.js API server and cloud database (PostgreSQL) store only ciphertext payloads wrapped in authenticated cryptographic envelopes (`verificationCipher` and encrypted PGP keys).
* **Zero Password Knowledge**: Passwords are never sent to the server, not even as hashes. Authentication relies on client-side proof of successful decryption of a verification cipher.
* **Ephemeral Memory Security**: Vault master keys and decrypted operational keys reside only in volatile JavaScript memory (encrypted with transient session keys) and are wiped upon lock or browser refresh.

---

## 2. Cryptographic Primitives

| Primitive | Standard / Parameter | Purpose |
| :--- | :--- | :--- |
| **Symmetric Cipher** | AES-256-GCM (128-bit authentication tag) | Key wrapping, payload encryption, local IndexedDB security |
| **Key Derivation (Vault/Cloud)** | PBKDF2 with HMAC-SHA512 (1,000,000 iterations) | Derives 64-byte key material (32B AES-GCM + 32B HMAC) from vault password |
| **Key Derivation (App Password)** | PBKDF2 with HMAC-SHA256 (1,000,000 iterations) | Derives 32-byte key material for local master key encryption |
| **Envelope Authentication** | HMAC-SHA256 (32 bytes) | Cryptographic signature over binary header, ciphertext, IV, and salt |
| **Data Compression** | DEFLATE (`pako`) | Pre-encryption compression for efficiency and traffic mitigation |
| **Random Number Generation** | Web Crypto `crypto.getRandomValues()` | Cryptographically secure random salts and initialization vectors (IVs) |

---

## 3. Wire Format: Encrypted Envelope & 45-Byte Binary Header

Vault verification payloads and cloud-backed PGP keys are serialized into a binary payload, then Base64-encoded. The envelope consists of a **45-byte fixed header**, variable-length ciphertext, 12-byte IV, 16-byte salt, and 32-byte HMAC tag.

### Envelope Structure
```
┌─────────────────┬──────────────────────┬─────────────┬─────────────┬─────────────┐
│ Header (45 B)   │ Ciphertext (N Bytes) │ IV (12 B)   │ Salt (16 B) │ HMAC (32 B) │
└─────────────────┴──────────────────────┴─────────────┴─────────────┴─────────────┘
```

### 45-Byte Header Specification

| Offset | Field | Size | Type | Value / Description |
| :--- | :--- | :--- | :--- | :--- |
| `0x00 - 0x01` | `MAGIC` | 2 bytes | ASCII | `NP` (`0x4E, 0x50` for NextPGP) |
| `0x02` | `VERSION` | 1 byte | uint8 | `0x01` (Encryption format version 1) |
| `0x03` | `PURPOSE` | 1 byte | uint8 | `0x01` (General Vault / Key sync purpose) |
| `0x04` | `KDF_ID` | 1 byte | uint8 | `0x01` = PBKDF2-SHA512 |
| `0x05` | `CIPHER_ID` | 1 byte | uint8 | `0x01` = AES-256-GCM |
| `0x06` | `FLAGS` | 1 byte | uint8 | `0x01` = Compression enabled (`pako` DEFLATE) |
| `0x07 - 0x0A` | `ITERATIONS` | 4 bytes | uint32 (BE) | `1,000,000` (`0x000F4240`) |
| `0x0B - 0x0C` | `RESERVED` | 2 bytes | bytes | `0x00, 0x00` (Reserved for future extensions) |
| `0x0D - 0x2C` | `HEADER_HASH` | 32 bytes | SHA-256 | Hash over bytes `0x00..0x0C` for tamper detection |

---

## 4. Local App Password Security (IndexedDB Storage)

NextPGP enables users to lock their local keyring and IndexedDB data with a local app password.

### App Password Protection Setup
```
├─ User sets app password
├─ Generate 16-byte random salt
├─ Derive 32-byte key from password + salt using PBKDF2-SHA256 (1,000,000 iterations)
├─ Get or generate main encryption key (AES-GCM 256-bit)
├─ Export main crypto key to raw bytes
├─ Encrypt main crypto key with password-derived key:
│   ├─ Generate 12-byte random IV
│   ├─ Encrypt main crypto key bytes with AES-GCM + IV
│   └─ Store encrypted main crypto key + IV + salt + password hash
├─ Generate password hash for verification (SHA-256)
├─ Store in IndexedDB:
│   ├─ encrypted: encrypted main crypto key bytes
│   ├─ iv: 12-byte IV
│   ├─ salt: 16-byte salt
│   ├─ passwordHash: SHA-256 hash of password
│   └─ isPasswordProtected: true
└─ Store decrypted main crypto key in memory (encrypted with temporary key)
```

### App Password Login
```
├─ User enters app password
├─ Fetch encrypted main crypto key record from IndexedDB
├─ Validate password protection is enabled
├─ Derive 32-byte key from password + stored salt using PBKDF2-SHA256 (1M iterations)
├─ Decrypt main crypto key:
│   ├─ Use derived key + stored IV
│   ├─ Decrypt encrypted main crypto key bytes with AES-GCM
│   └─ Import decrypted bytes as AES-GCM key
├─ Verify password by checking if decryption succeeds
│   ├─ If successful → correct password → unlock app
│   └─ If fails → incorrect password → show error
├─ Store decrypted main crypto key in memory:
│   ├─ Generate temporary AES-GCM key
│   ├─ Encrypt decrypted main crypto key with temporary key
│   ├─ Store encrypted main crypto key + IV + temp key in memory
│   └─ Set session flag in sessionStorage
└─ App is now unlocked and can access PGP keys
```

### App Password Removal
```
├─ User removes password protection
├─ Verify current password (requires decrypted main crypto key in memory)
├─ Generate new unencrypted main crypto key (AES-GCM 256-bit)
├─ Re-encrypt all PGP keys:
│   ├─ Decrypt each PGP key with old main crypto key
│   ├─ Re-encrypt with new main crypto key + random IV
│   └─ Update IndexedDB with new encrypted data
├─ Store new unencrypted main crypto key in IndexedDB:
│   ├─ key: raw main crypto key bytes
│   └─ isPasswordProtected: false
└─ Clear password protection completely
```

---

## 5. Encrypted Vault Lifecycle

Users can store their PGP keys in an end-to-end encrypted cloud vault. The server authenticates vault access through a zero-knowledge challenge-response cipher (`verificationCipher`).

### Vault Creation Protocol
```
├─ User enters password
├─ Generate 32-byte random verification text (Uint8Array)
├─ Convert to hex string and add "VERIFY:" prefix
├─ Encrypt verification text with password:
│   ├─ Generate 16-byte random salt
│   ├─ Generate 12-byte random IV
│   ├─ Derive 64-byte key from password + salt using PBKDF2-SHA512 (1,000,000 iterations)
│   │   ├─ First 32 bytes: AES-GCM key
│   │   └─ Next 32 bytes: HMAC-SHA256 key
│   ├─ Compress plaintext using DEFLATE (pako)
│   ├─ Encrypt compressed data with AES-GCM
│   ├─ Construct 45-byte header:
│   │   ├─ 2 bytes: MAGIC ('NP')
│   │   ├─ 1 byte: ENCRYPTION_VERSION
│   │   ├─ 1 byte: PURPOSE
│   │   ├─ 1 byte: KDF_ID (0x01 = PBKDF2)
│   │   ├─ 1 byte: CIPHER_ID (0x01 = AES-GCM)
│   │   ├─ 1 byte: FLAGS (0x01 = compression enabled)
│   │   ├─ 4 bytes: ITERATIONS (big-endian uint32: 1,000,000)
│   │   ├─ 2 bytes: RESERVED (0x0000)
│   │   └─ 32 bytes: SHA-256 hash of header prefix (integrity)
│   ├─ Generate HMAC-SHA256 of (header + ciphertext + IV + salt)
│   ├─ Concatenate:
│   │   ├─ header (45 bytes)
│   │   ├─ ciphertext
│   │   ├─ IV (12 bytes)
│   │   ├─ salt (16 bytes)
│   │   └─ HMAC (32 bytes)
│   └─ Base64 encode full payload → `verificationCipher`
└─ Send `verificationCipher` to server (password never sent)
```

### Vault Unlock & Login Protocol
```
├─ User enters password
├─ Fetch base64 `verificationCipher` from server
├─ Decode and parse:
│   ├─ header (45 bytes)
│   ├─ ciphertext
│   ├─ IV (12 bytes)
│   ├─ salt (16 bytes)
│   └─ HMAC (32 bytes)
├─ Validate:
│   ├─ MAGIC bytes == "NP"
│   ├─ VERSION supported
│   ├─ HEADER hash matches
│   └─ HMAC signature valid
├─ Derive key using KDF_ID (PBKDF2-SHA512 with salt + iterations)
│   ├─ Split into AES-GCM key + HMAC key
├─ Decrypt ciphertext with AES-GCM using IV
├─ Decompress decrypted data using DEFLATE (pako)
├─ Check if plaintext starts with "VERIFY:"
│   ├─ If yes → correct password → unlock vault
│   └─ Else → incorrect password → show error
├─ Call VaultContext.unlockVault(password)
│   ├─ Get masterKey from IndexedDB
│   ├─ Encrypt vault password with AES-GCM + random IV using masterKey
│   ├─ Store encrypted password + IV in memory (React state)
│   └─ Mark vault as unlocked
└─ Call server API `/api/vault/unlock`
   └─ Server issues a secure JWT vault session token cookie (30 min expiry)
```

### Vault Locking
```
├─ User clicks lock vault button or closes tab
└─ VaultContext.lockVault()
   ├─ Clears encrypted vault password from React state (in-memory)
   ├─ Calls server API `/api/vault/lock` to revoke JWT vault session token
   └─ Sets vault locked flag
```

---

## 6. Cloud Backup & Sync Flow

### 6.1 Performance Optimization: Derive-Once Master Key Material
To avoid re-computing 1,000,000 PBKDF2 iterations for every individual key during batch backups or cloud browsing:
1. **Pre-derivation on Vault Unlock**: When the vault is unlocked, `VaultContext.unlockVault` extracts the 16-byte salt from the user's `verificationCipher`.
2. It invokes the worker task `deriveMasterKey` to derive a 64-byte key material once:
   - First 32 bytes: AES-256-GCM encryption key.
   - Next 32 bytes: HMAC-SHA256 signing key.
3. This key material and `vaultSalt` are double-encrypted with the local IndexedDB `masterKey` and retained ephemerally in React state.
4. **Fast-Path Crypto**: When performing encryption or decryption, if the ciphertext salt matches `vaultSalt`, workers use `keyMaterial` directly with **0 PBKDF2 iterations**. If the salt differs or `keyMaterial` is absent, it falls back to standard PBKDF2 derivation.

---

### 6.2 Cloud Backup (Pushing Keys to Cloud)
Triggered via `backupKey(user)` in `hooks/useCloudBackupOps.ts`:

```
├─ Validate Active Vault Session:
│   └─ Retrieve { password, keyMaterial, vaultSalt } via VaultContext.getVaultKeyMaterial()
├─ Handle Passphrase Protection (if backing up private key):
│   ├─ Check if private key is encrypted (isPasswordProtected)
│   └─ If protected:
│       ├─ Prompt user for passphrase via PasswordModal (up to 3 attempts)
│       ├─ Decrypt private key with openpgp.decryptKey(passphrase)
│       └─ Re-armor decrypted private key as raw plaintext key
├─ Parallel Worker Operations:
│   ├─ Hash computation (workerPool { type: "hashKey" }):
│   │   └─ Compute SHA-512 hex digest of raw private key and/or public key
│   │       ├─ Produces `privateKeyHash`
│   │       └─ Produces `publicKeyHash`
│   └─ Zero-Knowledge Encryption (workerPool { type: "encrypt" }):
│       ├─ Double-encryption guard: check isCiphertext (skips if already formatted)
│       ├─ Resolve key material (Fast-path pre-derived keyMaterial OR PBKDF2-SHA512 1M rounds)
│       ├─ Generate unique 12-byte random IV
│       ├─ Compress plaintext ASCII key using DEFLATE (pako)
│       ├─ Encrypt compressed payload with AES-256-GCM + IV
│       ├─ Build 45-byte NextPGP header (Magic 'NP', version 1, KDF, cipher, 1M iterations, header hash)
│       ├─ Generate HMAC-SHA256 over (header + ciphertext + IV + salt)
│       ├─ Concatenate (header + ciphertext + IV + salt + HMAC)
│       └─ Base64 encode → `encryptedPrivateKey` and/or `encryptedPublicKey`
├─ CSRF Token Acquisition:
│   └─ GET /api/csrf → retrieve 64-char HMAC CSRF token
├─ Transmission to API Server:
│   └─ POST /api/manage-keys with payload:
│       {
│         encryptedPrivateKey,
│         encryptedPublicKey,
│         privateKeyHash,
│         publicKeyHash,
│         csrfToken
│       }
└─ Server-Side Handling (app/api/manage-keys/route.ts):
    ├─ Authenticate user session (NextAuth)
    ├─ Enforce rate limits (Redis sliding window: 60 req/min)
    ├─ Validate CSRF token using timingSafeEqual
    ├─ Validate ciphertext structure (validateCipherFormat: magic 'NP', 45B header, lengths)
    ├─ Query PostgreSQL Prisma Vault
    ├─ Check for duplicates via unique `privateKeyHash` or `publicKeyHash`
    │   ├─ If exists → return 200 "Key already backed up."
    │   └─ If new → store in Prisma `pGPKeys` table & return 200 "Key stored successfully"
    └─ Client updates UI status to "Backed Up"
```

---

### 6.3 Cloud Manage (Browsing, Restoring & Deleting Keys)
Managed via `hooks/useCloudManageOps.ts` and `app/cloud-manage/page.tsx`:

#### Step 1: Fetching & Decrypting Cloud Keys
```
├─ GET /api/csrf → retrieve CSRF token
├─ POST /api/manage-keys/fetch-keys { offset, limit, csrfToken }
├─ Server returns list of opaque records: [{ id, privateKey, privateKeyHash, publicKey, publicKeyHash }]
├─ In-Memory Caching: Store paginated records in apiCacheRef to prevent redundant network roundtrips
├─ For each cloud key record (processKey):
│   ├─ Check decryptedCacheRef (return cached decrypted object if already processed)
│   ├─ Parallel Worker Decryption (workerPool { type: "decrypt" }):
│   │   ├─ Decode Base64 ciphertext
│   │   ├─ Validate minimum length (>= 105 bytes)
│   │   ├─ Parse: 45B header, ciphertext, 12B IV, 16B salt, 32B HMAC
│   │   ├─ Verify MAGIC == 'NP' and VERSION == 0x01
│   │   ├─ Verify header integrity (SHA-256 header hash check)
│   │   ├─ Resolve key material (Fast-path if salt matches vaultSalt, else derive via PBKDF2-SHA512)
│   │   ├─ Verify HMAC-SHA256 signature over (header + ciphertext + IV + salt)
│   │   ├─ Decrypt ciphertext using AES-256-GCM + IV
│   │   └─ Decompress with INFLATE (pako) → decrypted ASCII armored key
│   ├─ OpenPGP Parsing:
│   │   ├─ Parse with openpgp.readKey()
│   │   ├─ Extract primary User ID, name, email, creation/expiration dates, fingerprint, key ID, algorithm
│   │   └─ Check if private key is password-protected
│   ├─ Deduplication & Status Check:
│   │   ├─ Compare decrypted keys against local IndexedDB keys (getStoredKeys())
│   │   └─ Set status to "Imported" if already in IndexedDB, else "Not Imported"
│   └─ Cache result in decryptedCacheRef
```

#### Step 2: Restoring / Importing a Key Locally (`importFromCloud`)
```
├─ Retrieve selected cloud key
├─ If private key exists but public key is missing:
│   └─ Derive and armor public key from private key (openpgp.readPrivateKey().toPublic().armor())
├─ Deduplication Check (checkIfKeyExists):
│   └─ Compare normalized armored key against local IndexedDB stored keys
├─ If not present locally:
│   ├─ Retrieve local IndexedDB encryptionKey (getEncryptionKey())
│   ├─ Encrypt { id, publicKey, privateKey } with AES-256-GCM + random 12B IV (encryptData)
│   ├─ Store { id, encrypted, iv } into IndexedDB (`dbPgpKeys` object store)
│   ├─ Invalidate memory caches (apiCacheRef, decryptedCacheRef)
│   └─ Update UI status to "Imported"
```

#### Step 3: Deleting a Cloud Key (`deleteKey`)
```
├─ GET /api/csrf → retrieve CSRF token
├─ DELETE /api/manage-keys with payload:
│   {
│     keyId,
│     privateKeyHash, // or publicKeyHash
│     csrfToken
│   }
├─ Server-Side Processing:
│   ├─ Authenticate session & enforce rate limit
│   ├─ Validate CSRF token
│   ├─ Locate record in PostgreSQL `pGPKeys` via unique hash and user's vaultId
│   └─ Delete record from database
├─ Client resets caches and refreshes cloud key list via loadKeysFromCloud()
└─ UI displays success notification
```
