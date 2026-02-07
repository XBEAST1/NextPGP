<h1 align="center">Next PGP</h1>

<p align="center">
  <b>Next PGP</b> is an elegant, powerful, and modern Progressive Web App (PWA) built with <b>Next.js</b>. It provides an app like experience for generating keys, managing keyrings, and securely encrypting and decrypting messages with ease.
</p>

---

<h2>🚀 Features</h2>
<ul>
  <li><b>Key Generation:</b>
    <ul>
      <li>Effortlessly generate secure PGP keys</li>
      <li>Supports multiple algorithms, including:
        <ul>
          <li>Curve25519 (EdDSA/ECDH) - Recommended</li>
          <li>NIST P-256, P-521 (ECDSA/ECDH)</li>
          <li>Brainpool P-256r1, P-512r1 (ECDSA/ECDH)</li>
          <li>RSA 2048, 3072, 4096</li>
        </ul>
      </li>
    </ul>
  </li>

  <li><b>Keyring Management:</b>
    <ul>
      <li>Add, manage, delete, import, export, and backup keys</li>
      <li>Search, import, and publish public keys via PGP keyservers</li>
      <li>Add, change, and remove passphrases</li>
      <li>Add, manage, and revoke User IDs</li>
      <li>Add, manage, and revoke subkeys</li>
    </ul>
  </li>

  <li><b>Encryption & Decryption:</b>
    <ul>
      <li>Encrypt and decrypt messages with ease</li>
      <li>Secure file encryption and decryption</li>
      <li>Intuitive user interface for seamless operation</li>
    </ul>
  </li>

  <li><b>Batch File Encryption & Decryption:</b>
    <ul>
      <li>Encrypt multiple files at once</li>
      <li>Decrypt multiple files efficiently</li>
    </ul>
  </li>

  <li><b>Folder Encryption & Decryption:</b>
    <ul>
      <li>Encrypt and decrypt entire folders recursively</li>
      <li>Maintain original directory structure</li>
    </ul>
  </li>

  <li><b>Cloud Management:</b>
    <ul>
      <li>Securely backup PGP keys to the cloud</li>
      <li>Manage keys remotely with encrypted vaults</li>
      <li>Ensure top-tier protection with <b>end-to-end encryption</b></li>
    </ul>
  </li>

  <li><b>Encrypted Vaults:</b>
    <ul>
      <li>Password-derived key security using <b>PBKDF2</b> (1,000,000 iterations, SHA-512)</li>
      <li>Vault data including <b>verification cipher</b> encrypted client-side</li>
      <li>Strong confidentiality and integrity with <b>AES-256-GCM</b></li>
    </ul>
  </li>

  <li><b>Web Worker Multithreading:</b>
    <ul>
      <li>Dynamically scales encryption and decryption workloads in parallel across <b>all CPU cores</b></li>
      <li>Keeps the interface fast and responsive, even during <b>heavy processing</b></li>
      <li>Automatically adapts to <b>your device's performance</b> capabilities</li>
    </ul>
  </li>
</ul>

---

<h2>❓ Why Next PGP?</h2>
<ul>
  <li><b>Secure Local Storage:</b> Utilizes <b>IndexedDB</b> to store keys locally, encrypted by the <b>Web Crypto API</b>.</li>
  <li><b>Modern UI:</b> Clean and elegant user experience built on modern design principles.</li>
  <li><b>Blazing Fast Performance:</b> Built with <b>Next.js</b> to deliver superior speed and performance.</li>
  <li><b>Smooth Cloud Management:</b> Seamless and secure integration of cloud based key storage and retrieval for enhanced accessibility and control.</li>
  <li><b>Cross Platform Progressive Web App (PWA):</b> Web based application that works on every device — Windows, macOS, Linux, Android, and iOS with offline capabilities.</li>
</ul>

---

<h2>🛠 Tech Stack</h2>
<ul>
  <li><b>Framework:</b> <a href="https://nextjs.org/">Next JS</a></li>
  <li><b>UI Components:</b> <a href="https://www.heroui.com/"> Hero UI</a></li>
  <li><b>Database:</b> PostgreSQL for cloud storage and user vault management.</li>
  <li><b>PWA Integration:</b> Service workers, manifest setup, and offline support.</li>
  <li><b>State Management:</b> Efficient handling of state for keyrings and messages.</li>
  <li><b>Performance Optimization:</b> Dynamic Web Worker pool for parallel cryptographic operations using all available CPU cores</li>
</ul>

---

<h2>🔒 Security</h2>
<p><b>Next PGP</b> is built around a <b>Zero-Knowledge</b> and <b>End-to-End Encryption (E2EE)</b> model — ensuring that your secrets stay yours, even in the cloud.</p>

<ul>
  <li><b>True End-to-End Encryption (E2EE):</b> All encryption and decryption happens entirely on the <b>client-side</b>. Your <b>PGP keys</b>, <b>vault contents</b>, and <b>sensitive data</b> are encrypted before ever <b>leaving your device</b> — the server never sees them <b>unencrypted</b>.</li>
  <li><b>Vault Protection:</b> Your vault password is used to derive an encryption key via <b>PBKDF2</b> (with 1,000,000 iterations) on the client, securing your data with <b>AES-256-GCM</b>. For authentication, the password verification is also handled client-side ensuring <b>zero-knowledge architecture</b> at every layer.</li>
  <li><b>Zero-knowledge cloud storage:</b> Although you can back up and sync your encrypted vault to the cloud, it is <b>fully opaque</b> to the server. Only <b>you can decrypt it</b>.</li>
  <li><b>In-memory vault context:</b> Vault password is never stored in session or local storage — it's kept in <b>memory only</b> while the app is open, adding an additional layer of <b>runtime safety</b>.</li>
  <li><b>Built on HTTPS + Web Crypto API:</b> Communication is always <b>encrypted in transit</b>, and cryptographic operations use <b>trusted, native browser APIs</b>.</li>
</ul>

<p><b>⚠️ TL;DR:</b> Although it's a web app, <b>all cryptographic operations happen on your device</b>. You're never sending <b>raw passwords or secrets</b> to the server — not even once. <b>Next PGP is secure by design.</b></p>

---

<h2>📚 App Security Overview (Zero-Knowledge Architecture)</h2>

#### App Password Protection Setup
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

#### App Password Login
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

#### App Password Removal
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

#### Session Management
```
├─ Temporary session validation
├─ Auto-clear on page refresh
├─ Generate temporary AES-GCM key for memory storage
├─ Re-encrypt decrypted main crypto key with temporary key
├─ Store in memory (encrypted)
└─ No persistent sessions
```

#### Data Protection
```
├─ PGP keys encrypted with AES-GCM + random IV
├─ IndexedDB encryption with main crypto key
└─ Zero-knowledge architecture (client-side only)
```

#### Security Features
```
├─ Web Crypto API for all operations
├─ HTTPS enforcement
├─ AES-GCM encryption for data protection
└─ PBKDF2 key derivation for password protection
```

<h2>📚 Vault & Cloud Flow Overview (Zero-Knowledge Architecture)</h2>

#### Vault Creation
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
│   │   ├─ 4 bytes: ITERATIONS (big-endian uint32)
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

#### Vault Login
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
   └─ Server issues a secure jwt vault session token cookie (30 min expiry)
```

#### Vault Password Storage in VaultContext
```
├─ Vault password stored encrypted in memory (React state)
├─ Encryption uses separate masterKey (from IndexedDB)
└─ Password decrypted on-demand via VaultContext.getVaultPassword()
```

#### Cloud Backup
```
├─ Retrieve vault password by calling VaultContext.getVaultPassword()
└─ For each PGP key to backup:
    ├─ Compute hashes and compare with:
    │   ├─ IndexedDB PGP key
    │   └─ Cloud Database PGP key
    │       └─ To check the PGP key is already backed up to the Cloud Database or not
    ├─ If not already backed up:
    │   ├─ Generate 16-byte random salt
    │   ├─ Generate 12-byte random IV
    │   ├─ Compress the PGP key with DEFLATE (pako)
    │   ├─ Derive 64-byte key from vault password + salt using PBKDF2-SHA512 (1M iterations)
    │   │   ├─ First 32 bytes: AES-GCM key
    │   │   └─ Next 32 bytes: HMAC-SHA256 key
    │   ├─ Encrypt compressed PGP key with AES-GCM + IV
    │   ├─ Build 45-byte header:
    │   │   ├─ 2B MAGIC ('NP')
    │   │   ├─ 1B VERSION
    │   │   ├─ 1B PURPOSE
    │   │   ├─ 1B KDF_ID (0x01)
    │   │   ├─ 1B CIPHER_ID (0x01)
    │   │   ├─ 1B FLAGS (0x01 = compressed)
    │   │   ├─ 4B ITERATIONS
    │   │   ├─ 2B RESERVED
    │   │   └─ 32B SHA-256(header)
    │   ├─ Compute HMAC-SHA256 over (header + ciphertext + IV + salt)
    │   ├─ Concatenate: header  + ciphertext  + IV  + salt  + HMAC
    │   └─ Base64 encode → encrypted PGP key
    └─ Send the encrypted PGP key and its hash to the server and store in the Cloud Database
```

#### Cloud Manage
```
├─ Retrieve vault password by calling VaultContext.getVaultPassword()
└─ Retrieve list of encrypted PGP keys from Cloud Database
    ├─ For each encrypted PGP key:
    │   ├─ Base64 → rawBuffer
    │   ├─ Parse out:
    │   │   ├─ header (45 bytes)
    │   │   ├─ ciphertext
    │   │   ├─ IV (12 bytes)
    │   │   ├─ salt (16 bytes)
    │   │   └─ HMAC (32 bytes)
    │   ├─ Verify:
    │   │   ├─ MAGIC == 'NP'
    │   │   ├─ VERSION supported
    │   │   ├─ header hash matches
    │   │   └─ HMAC valid over (header + ciphertext + IV + salt)
    │   ├─ Extract ITERATIONS & KDF_ID, derive 64-byte key via PBKDF2-SHA512
    │   ├─ Decrypt ciphertext with AES-GCM + IV
    │   ├─ Decompress with INFLATE (pako) → PGP key bytes
    │   └─ Compute its hash
    ├─ User clicks "import" on one PGP key
    ├─ Compare cloud PGP key hash against IndexedDB PGP keys to avoid duplicates
    ├─ Get masterKey from IndexedDB
    ├─ Encrypt PGP key with AES-GCM + random IV using masterKey
    └─ Store the final AES-GCM-wrapped PGP key (and IV) in IndexedDB
```

#### Vault Locking
```
├─ User presses lock vault button or closes tab
└─ VaultContext.lockVault()
   ├─ Clears encrypted vault password from React state (in-memory)
   ├─ Calls server API `/api/vault/lock` to revoke jwt vault session token
   └─ Sets vault locked flag
```

---

<h2>💻 Click To Watch Previews</h2>

| Video 1 | Video 2 | Video 3 |
| ------ | ------ | ------ |
| [![Next PGP](https://img.youtube.com/vi/1gl4OlUaibY/maxresdefault.jpg)](https://www.youtube.com/watch?v=1gl4OlUaibY) | [![Next PGP](https://img.youtube.com/vi/YZAAwo0ukS0/maxresdefault.jpg)](https://www.youtube.com/watch?v=YZAAwo0ukS0) | [![Next PGP](https://img.youtube.com/vi/KuyIN6AV6SM/maxresdefault.jpg)](https://www.youtube.com/watch?v=KuyIN6AV6SM) |

---

<h2>📸 Screenshots</h2>
<h3>💻 PC</h3>
<img width="410px" src="https://github.com/user-attachments/assets/2ec2473c-2069-4a26-b94a-99059e6354ec" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/6de8f672-c0d2-402b-9366-8bf92878da53" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9e1cd403-3fe8-40de-a3e0-7935cc99725a" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/eff9e7f5-4c86-44ec-953b-0e48b60eb952" alt="Image"/>
<img width="410px" src="https://github.com/user-attachments/assets/e57d92bf-1b33-41e3-a1ce-2a6b1d59aca9" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/1baaf5bf-86b3-473f-a3d1-fcc05b9ff1c5" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/04948ea5-2328-4b39-bc99-d6be931174cc" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/0a2dddf8-426b-4f23-adb7-e5790d2560e6" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9cb0ebde-8b48-4187-a67e-ebd7fa4c6917" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/069f1832-cb55-4dd4-b12d-44c6e08f07e4" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/fa7203e4-78f4-4368-a8f9-08eeb5f380db" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/be31fc3a-29c5-484f-8c74-1749a15f4f04" alt="Image">

<h3>📱 Mobile</h3>
<img width="270px" src="https://github.com/user-attachments/assets/4860225b-cc2b-48d9-9b38-e548d8a15d40" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/dc30d81f-5163-4caa-9a66-b9dce9c6e7df" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d1215c2c-1327-4751-99a3-399701c3a7f6" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/cb0b3fee-38fb-445d-a80b-b5e1fbfe7b41" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/6a7c5b74-ccc4-429e-92b6-26f7385da6a3" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/59c378c0-834a-48fb-96d6-078cdaa98d93" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/b4759faa-dbb5-4043-9cc5-fbe7b0f0d67f" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/24c1c8d5-4f5f-4805-afa4-39293dcbe977" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/591f26f5-7274-44b1-9677-8379aa7cf38e" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/450bfa8f-9fb8-47d9-b23e-4c843a27f04b" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/ed40eb19-80ac-4297-a480-5d1185a73600" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/6a7c704c-cbc3-4873-941f-2677005467e7" alt="Image">

<h2>📝 License</h2>
<p>This project is licensed under the <a href="LICENSE">GPL-3.0 license</a>.</p>

---

<h2>💬 Contact</h2>
<p>If you have any questions, feel free to reach out:</p>
<ul>
  <li><b>GitHub:</b> <a href="https://github.com/xbeast1">XBEAST1</a></li>
  <li><b>Email:</b> <a href="mailto:xbeast1@proton.me">xbeast1@proton.me</a></li>
</ul>

---

<p align="center">✨ <b>Next PGP</b> simplifies secure messaging. Generate, manage, and encrypt with confidence! ✨</p>
