<h1 align="center">Next PGP</h1>

<p align="center">
  <b>Next PGP</b> is an elegant, powerful, and modern Progressive Web App (PWA) built with <b>Next.js</b>. It provides an app like experience for generating keys, managing keyrings, and securely encrypting and decrypting messages with ease.
</p>

---

<h2>🚀 Features</h2>
<ul>
  <li><b>Key Generation:</b> Effortlessly generate secure PGP keys to protect sensitive information.</li>
  <li><b>Keyring Management:</b> Easily add, manage, and delete keyrings for seamless key organization.</li>
  <li><b>Encryption & Decryption:</b> Encrypt and decrypt messages and files securely with an intuitive user interface.</li>
  <li><b>Batch File Encryption & Decryption:</b> Efficiently encrypt and decrypt multiple files at once.</li>
  <li><b>Folder Encryption & Decryption:</b> Securely Encrypt and Decrypt entire folders while maintaining the <b>original directory structure</b> (recursive encryption).</li>
  <li><b>Cloud Management:</b> Securely backup and manage PGP keys in the cloud, with encrypted vaults ensuring top tier protection.</li>
  <li><b>Encrypted Vaults:</b> Each user’s vault is secured with a password-derived key using <b>PBKDF2</b> (1,000,000 iterations, SHA-256), and vault data including <b>verification cipher</b> is encrypted client-side using <b>AES-256-GCM</b> for strong confidentiality and integrity.</li>
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
</ul>

---

<h2>🔒 Security</h2>
<p><b>Next PGP</b> is built around a <b>Zero-Knowledge</b> and <b>End-to-End Encryption (E2EE)</b> model — ensuring that your secrets stay yours, even in the cloud.</p>

<ul>
  <li><b>True End-to-End Encryption (E2EE):</b> All encryption and decryption happens entirely on the <b>client-side</b>. Your <b>PGP keys</b>, <b>vault contents</b>, and <b>sensitive data</b> are encrypted before ever <b>leaving your device</b> — the server never sees them <b>unencrypted</b>.</li>
  <li><b>Vault Protection:</b> Your vault password is used to derive an encryption key via <b>PBKDF2</b> (with 1,000,000 iterations) on the client, securing your data with <b>AES-256-GCM</b>. For authentication, the password verification is also handled client-side ensuring <b>zero-knowledge architecture</b> at every layer.</li>
  <li><b>Zero-knowledge cloud storage:</b> Although you can back up and sync your encrypted vault to the cloud, it is <b>fully opaque</b> to the server. Only <b>you can decrypt it</b>.</li>
  <li><b>In-memory vault context:</b> Vault password is never stored in session or local storage — it’s kept in <b>memory only</b> while the app is open, adding an additional layer of <b>runtime safety</b>.</li>
  <li><b>Built on HTTPS + Web Crypto API:</b> Communication is always <b>encrypted in transit</b>, and cryptographic operations use <b>trusted, native browser APIs</b>.</li>
</ul>

<p><b>⚠️ TL;DR:</b> Although it's a web app, <b>all cryptographic operations happen on your device</b>. You're never sending <b>raw passwords or secrets</b> to the server — not even once. <b>Next PGP is secure by design.</b></p>

---

<h2>💻 Click To Watch Previews</h2>

| Video 1 | Video 2 |
| ------ | ------ |
| [![Next PGP](https://img.youtube.com/vi/1gl4OlUaibY/maxresdefault.jpg)](https://www.youtube.com/watch?v=1gl4OlUaibY) | [![Next PGP](https://img.youtube.com/vi/TdBdOO4SRew/maxresdefault.jpg)](https://www.youtube.com/watch?v=TdBdOO4SRew) |

---

<h2>📸 Screenshots</h2>
<h3>💻 PC</h3>
<img width="410px" src="https://github.com/user-attachments/assets/1f2d772a-08b6-4498-b837-bd64495758a0" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/6eea6178-bf5f-4cd2-94b2-7271d196fce0" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/7fa7ac95-5c86-4f80-8d72-1825c71b9f68" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9cac8569-082b-4a56-afef-f4f51b2acf53" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/150e1f10-fc25-4517-9a75-db056c93b97e" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/c86e1217-496a-4ade-a10e-63aa5f93abb3" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/6a040f34-8fed-4ab2-85b8-53d9b6fcfff8" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/eb8b3130-bed1-4e84-9af1-8666c9385f59" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/96eef080-7aea-496b-8147-33dcec93044b" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9cd5e356-d292-413f-8e97-0b5c0945b6af" alt="Image">

<h3>📱 Mobile</h3>
<img width="270px" src="https://github.com/user-attachments/assets/cc2e314b-0d61-495b-838a-3bb3c35a2ef8" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d1215c2c-1327-4751-99a3-399701c3a7f6" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/91141276-8132-473e-baeb-f4268fd05de8" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/6a7c5b74-ccc4-429e-92b6-26f7385da6a3" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d33cbaf2-0375-40ab-93da-69b6d3b9056c" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/59c378c0-834a-48fb-96d6-078cdaa98d93" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/b4759faa-dbb5-4043-9cc5-fbe7b0f0d67f" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/24c1c8d5-4f5f-4805-afa4-39293dcbe977" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/591f26f5-7274-44b1-9677-8379aa7cf38e" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/450bfa8f-9fb8-47d9-b23e-4c843a27f04b" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/fd7642d3-f618-4738-b9d0-271c9007ef4d" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d31831ad-ba6b-4c52-a1dd-46250c99baa1" alt="Image">


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
