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
      <li>Change key validity periods</li>
      <li>Add, change, and remove passphrases</li>
      <li>Add, manage, and delete User IDs</li>
      <li>Revoke keys securely when needed</li>
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
  <li><b>Database:</b> MongoDB for cloud storage and user vault management.</li>
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

<h2>📚 Vault & Cloud Flow Overview (Zero-Knowledge Architecture)</h2>

#### Vault Creation
```
├─ User enters password
├─ Generate 32-byte random verification text (Uint8Array)
├─ Convert to hex string and add "VERIFY:" prefix
├─ Encrypt combined verification text with password:
│   ├─ Generate 16-byte random salt (for PBKDF2)
│   ├─ Generate 12-byte random IV (for AES-GCM)
│   ├─ Derive AES key from password + salt using PBKDF2 (1,000,000 iterations)
│   ├─ Encrypt verification text using the derived AES Key + IV
|   ├─ Combine salt + IV + ciphertext into one buffer
|   └─ Base64 encode combined buffer → verificationCipher
└─ Send the verificationCipher to the server and store in the database (no password sent)
```

#### Vault Login
```
├─ User enters password
├─ Fetch verificationCipher from server
├─ Decode base64 → extract salt, IV, ciphertext
├─ Derive AES key from entered password + extracted salt PBKDF2 (1,000,000 iterations)
├─ Decrypt ciphertext using the derived AES Key + IV
├─ Check decrypted text:
│   ├─ If starts with "VERIFY:" → password correct → unlock vault
│   └─ Else → incorrect password → show error
├─ Call VaultContext.unlockVault(password)
│   ├─ Get masterKey from IndexedDB
│   ├─ Encrypt vault password with AES-GCM + random IV using masterKey
│   ├─ Store encrypted vault password + IV in React state (in-memory)
│   └─ Set vault unlocked flag
└─ Call server API `/api/vault/unlock`
   └─ Issues secure jwt vault session token cookie (30 min expiry)
```

#### Vault Password Storage in VaultContext
```
├─ Vault password stored encrypted in React state
├─ Encryption uses separate masterKey (from IndexedDB)
└─ Password decrypted on-demand via VaultContext.getVaultPassword()
```

#### Cloud Backup
```
├─ Retrieve vault password by calling VaultContext.getVaultPassword()
└─ For each PGP key to backup:
    ├─ Compute hashes and compare with:
    │   ├─ IndexedDB PGP key
    │   └─ MongoDB PGP key
    │       └─ To check the PGP key is already backed up to the MongoDB or not
    ├─ Generate 16-byte random salt (for PBKDF2)
    ├─ Generate 12-byte random IV (for AES-GCM)
    ├─ Derive AES key from vault password + salt using PBKDF2 (1,000,000 iterations)
    ├─ Encrypt PGP Key using the derived AES Key + IV
    ├─ Combine salt + IV + PGP Key Cipher into one buffer
    ├─ Base64 encode combined buffer → Encrypted PGP Key
    └─ Send the encrypted PGP key and its hash to the server and store in the database
```

#### Cloud Manage
```
├─ Retrieve vault password by calling VaultContext.getVaultPassword()
└─ Retrieve encrypted PGP keys from MongoDB
    ├─ Decode base64 → extract salt, IV, PGP Key Cipher
    ├─ Derive AES key from vault password + extracted salt PBKDF2 (1,000,000 iterations)
    ├─ Decrypt each PGP Key Cipher using the derived AES Key + IV
    ├─ User clicks on import PGP key button
    ├─ Compare PGP Key hash with:
    │   ├─ MongoDB PGP key
    │   └─ IndexedDB PGP key
    │       └─ To check that the PGP key is already imported to the IndexedDB or not
    ├─ Get masterKey from IndexedDB
    └─ Encrypt PGP Key with AES-GCM + random IV using masterKey and store in IndexedDB
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

| Video 1 | Video 2 |
| ------ | ------ |
| [![Next PGP](https://img.youtube.com/vi/1gl4OlUaibY/maxresdefault.jpg)](https://www.youtube.com/watch?v=1gl4OlUaibY) | [![Next PGP](https://img.youtube.com/vi/YZAAwo0ukS0/maxresdefault.jpg)](https://www.youtube.com/watch?v=YZAAwo0ukS0) |

---

<h2>📸 Screenshots</h2>
<h3>💻 PC</h3>
<img width="410px" src="https://github.com/user-attachments/assets/fa9308c8-5d8a-45b2-b79a-138b7fbd95af" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9e1cd403-3fe8-40de-a3e0-7935cc99725a" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/45e823b0-2218-482d-9e7f-3ee46dd547dd" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/e57d92bf-1b33-41e3-a1ce-2a6b1d59aca9" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/04948ea5-2328-4b39-bc99-d6be931174cc" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/0a2dddf8-426b-4f23-adb7-e5790d2560e6" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9cb0ebde-8b48-4187-a67e-ebd7fa4c6917" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/069f1832-cb55-4dd4-b12d-44c6e08f07e4" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/5da76bcd-7aff-4155-91ba-75888078f326" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/d7ef3ee9-bc1e-43f3-b27c-b2546d3d3dad" alt="Image">

<h3>📱 Mobile</h3>
<img width="270px" src="https://github.com/user-attachments/assets/7ccdc959-a201-4ddf-8c51-9847d85f4858" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d1215c2c-1327-4751-99a3-399701c3a7f6" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/cb0b3fee-38fb-445d-a80b-b5e1fbfe7b41" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/6a7c5b74-ccc4-429e-92b6-26f7385da6a3" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d33cbaf2-0375-40ab-93da-69b6d3b9056c" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/59c378c0-834a-48fb-96d6-078cdaa98d93" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/b4759faa-dbb5-4043-9cc5-fbe7b0f0d67f" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/24c1c8d5-4f5f-4805-afa4-39293dcbe977" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/591f26f5-7274-44b1-9677-8379aa7cf38e" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/450bfa8f-9fb8-47d9-b23e-4c843a27f04b" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/da3adcc4-6d38-4f1e-b212-413fbd2f6a13" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/ebbe3a23-56d2-409c-914d-68bc76ba6da5" alt="Image">


<h2>📝 License</h2>
<p>This project is licensed under the <a href="LICENSE">GPL-3.0 license</a>.</p>

---

<h2>💬 Contact</h2>
<p>If you have any questions, feel free to reach out:</p>
<ul>
  <li><b>GitHub:</b> <a href="https://github.com/xbeast">XBEAST1</a></li>
  <li><b>Email:</b> <a href="mailto:xbeast331@proton.me">xbeast331@proton.me</a></li>
</ul>

---

<p align="center">✨ <b>Next PGP</b> simplifies secure messaging. Generate, manage, and encrypt with confidence! ✨</p>
