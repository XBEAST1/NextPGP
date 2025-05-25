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
| [![Next PGP](https://img.youtube.com/vi/1gl4OlUaibY/maxresdefault.jpg)](https://www.youtube.com/watch?v=1gl4OlUaibY) | [![Next PGP](https://img.youtube.com/vi/NRofMNqZPfo/maxresdefault.jpg)](https://www.youtube.com/watch?v=NRofMNqZPfo) |

---

<h2>📸 Screenshots</h2>
<h3>💻 PC</h3>
<img width="410px" src="https://github.com/user-attachments/assets/57e8c14d-1201-4165-aafc-37327bb91423" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/17317d38-47af-4676-8972-345704fe2c58" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/290579fc-1a7f-4131-8d4d-ccea2a175f56" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/856fc99e-4e7d-458b-a50f-9622aa495976" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/af7c657b-b54f-4bc3-8258-6d3f90147c28" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/062f88f7-7682-41c2-800b-2a67cceb1d2b" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/2e86b248-65f4-4ecf-812d-f4d233037e6b" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/b239edc2-2358-429a-ba62-37d849653724" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/f8cf426f-431d-40f6-9d47-944ac141746f" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/9f1aedfa-d214-4beb-ac08-5dd873673153" alt="Image">
<img width="410px" src="https://github.com/user-attachments/assets/29ed3bf0-a2f0-47d1-af8d-4ed788e07cdd" alt="Image">


<h3>📱 Mobile</h3>
<img width="270px" src="https://github.com/user-attachments/assets/c77d78ae-4cfc-4c0b-837c-770608c1d02c" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/7e22fa86-acc2-4a2b-a2a4-57bafa368aa4" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/4ef64a86-5970-4117-a162-cfe270d367b0" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/f01114d7-68fd-4879-80bc-3d4863b55f55" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/914ff8ed-12c9-4188-806d-a7648119baa4" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/aab05f56-d44c-49fb-86f7-2bd5d5cc961b" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/c7c8a9d6-2852-4256-abec-c28127a223c5" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/d6105fd7-6441-42f7-a8d5-257a03eba0bd" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/c978e118-de4a-43ac-b62b-072e978128e3" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/cbe3739f-7535-48ef-87dd-f4c0a0c8feba" alt="Image">
<img width="270px" src="https://github.com/user-attachments/assets/3c55d345-c9ae-48b8-89c8-0757e1619f75" alt="Image">


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