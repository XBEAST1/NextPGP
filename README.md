<h1 align="center">Next PGP</h1>

<p align="center">
  <b>Next PGP</b> is an elegant, powerful, and modern Progressive Web App (PWA) built with <b>Next.js</b>. It provides an app-like experience for generating OpenPGP keys, managing keyrings, and securely encrypting and decrypting messages and files with zero-knowledge architecture.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.6-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Security-Zero--Knowledge-green?style=flat-square" alt="Zero-Knowledge" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-orange?style=flat-square" alt="License" />
</p>

---

## 🚀 Key Features

* **Advanced Key Generation:**
  * Effortlessly generate cryptographically secure PGP keys.
  * Supports modern elliptic curve and legacy algorithms:
    * **Curve25519 (EdDSA/ECDH)** — *Recommended*
    * **NIST P-256, P-521 (ECDSA/ECDH)**
    * **Brainpool P-256r1, P-512r1 (ECDSA/ECDH)**
    * **RSA 2048, 3072, 4096**
* **Comprehensive Keyring Management:**
  * Add, manage, delete, import, export, and backup keys.
  * Query, import, and publish public keys via public **PGP keyservers** (HKP).
  * Add, modify, or strip key passphrases.
  * Manage and revoke User IDs and subkeys.
* **Encryption & Decryption Suite:**
  * Asymmetric and symmetric text message encryption and decryption.
  * Single file encryption and decryption with integrity verification.
  * **Batch File Processing:** Process multiple files simultaneously with distinct recipient keys.
  * **Folder Recursion:** Recursively encrypt and decrypt entire folder structures, preserving internal paths.
* **Zero-Knowledge Cloud Vaults:**
  * End-to-end encrypted remote key backups.
  * Password-derived keys using **PBKDF2** (1,000,000 iterations, SHA-512) and **AES-256-GCM**.
  * Server-opaque `verificationCipher` — passwords and private keys are never transmitted to or readable by the server.
* **Multithreaded Web Worker Pool:**
  * Dynamic worker pool automatically scales cryptographic tasks across all available CPU cores via `navigator.hardwareConcurrency`.
  * Keeps the interface reactive at 60 FPS even during heavy batch operations.
* **Cross-Platform Progressive Web App (PWA):**
  * Installable on macOS, Windows, Linux, Android, and iOS with offline support.

---

## ⚡ Quick Start

### Prerequisites
* **Node.js**: `22.x` (enforced via [`.nvmrc`](.nvmrc))
* **Package Manager**: [`pnpm`](https://pnpm.io/) (`>= 9.x` or `11.x`)
* **PostgreSQL** & **Redis**

### Installation & Local Run

```bash
# 1. Clone repository
git clone https://github.com/xbeast1/NextPGP.git
cd NextPGP

# 2. Install dependencies (triggers Prisma client generation)
pnpm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env and supply your DATABASE_URL, REDIS, and AUTH_SECRET

# 4. Push database schema
pnpm prisma db push

# 5. Generate local SSL certificates for Web Crypto API support
pnpm setup:https

# 6. Start HTTPS development server
pnpm dev:https
```

Visit **`https://nextpgp-dev.com:3000`** in your browser.

> [!NOTE]
> For a detailed guide on setting up custom host mappings, resolving certificate warnings, and troubleshooting, read the **[Developer Guide](docs/development.md)**.

---

## 🏗 System Architecture

NextPGP separates client-side cryptography from cloud storage via an authenticated zero-knowledge boundary:

```mermaid
flowchart TB
    subgraph Client["Client Browser (PWA)"]
        UI["HeroUI / React 19 Frontend<br/>(Main Thread)"]
        Pool["Dynamic Web Worker Pool<br/>(lib/workerPool.ts)"]
        Worker["Crypto Workers (Multi-core)<br/>(lib/cryptoWorker.ts)"]
        IDB[("Encrypted IndexedDB<br/>(lib/indexeddb.ts)")]
        VaultCtx["In-Memory Vault Context<br/>(Ephemeral Key State)"]
        
        UI <-->|"Jobs & Events"| Pool
        Pool <-->|"Parallel Tasks"| Worker
        UI <-->|"AES-256-GCM Wrapped Keys"| IDB
        UI <-->|"Session Unwrapping"| VaultCtx
    end

    subgraph Edge["Network Boundary (HTTPS Only)"]
        CSRF["CSRF & Timing-Safe Check"]
        RL["Redis Rate Limiter"]
    end

    subgraph Server["Next.js Cloud Backend"]
        NextAuth["NextAuth v5<br/>(Google, GitHub, Discord, Email)"]
        RouteAPI["Zero-Knowledge Route Handlers<br/>(/api/vault/*, /api/manage-keys/*)"]
        Prisma["Prisma ORM"]
        Postgres[("PostgreSQL Database<br/>(Encrypted Vaults & Keys)")]
        RedisStore[("Redis Store<br/>(Rate Limits & Tokens)")]
    end

    UI -->|"Opaque Authenticated Ciphertexts Only"| Edge
    Edge --> RouteAPI
    Edge --> NextAuth
    RouteAPI <--> RL
    RL <--> RedisStore
    RouteAPI <--> Prisma
    NextAuth <--> Prisma
    Prisma <--> Postgres
```

---

## 📖 Documentation Hub

Comprehensive architectural, cryptographic, and operational documentation is available in the [`docs/`](docs/) directory:

| Document | Purpose |
| :--- | :--- |
| **[Cryptographic Specification](docs/crypto-spec.md)** | Byte-level wire format, 45-byte NextPGP header, PBKDF2/AES-GCM key derivation, verification ciphers, and zero-knowledge proofs |
| **[System Architecture](docs/architecture.md)** | Web Worker concurrency pool, client-side IndexedDB persistence, ephemeral memory lifecycle, and data models |
| **[Developer & Contribution Guide](docs/development.md)** | Local environment setup, HTTPS certificates, Prisma migrations, running tests with Vitest, and ESLint |
| **[Self-Hosting Guide](docs/self-hosting.md)** | Production deployment, Nginx reverse proxy configuration, OAuth provider setup (Google/GitHub/Discord), and full `.env` variable reference |
| **[Manual Test Matrix](docs/manual-test-matrix.md)** | Comprehensive test matrix for message, file, and folder encryption combinations |

---

## 🧪 Testing & Scripts

```bash
# Run unit & integration tests with Vitest
pnpm test

# Run tests in interactive watch mode
pnpm test:watch

# Run linter checks
pnpm lint

# Build production bundle with Prisma migration deployment
pnpm build

# Launch Prisma Studio to inspect database records
pnpm prisma studio
```

---

## 🛠 Tech Stack

* **Framework:** [Next.js 15](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
* **Cryptography:** [OpenPGP.js](https://openpgpjs.org/) & Native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
* **UI Components & Styling:** [HeroUI](https://www.heroui.com/) & [Tailwind CSS](https://tailwindcss.com/)
* **Database & ORM:** [PostgreSQL](https://www.postgresql.org/) & [Prisma ORM](https://www.prisma.io/)
* **Authentication:** [NextAuth.js v5](https://authjs.dev/)
* **In-Memory Cache & Rate Limiter:** [Redis](https://redis.io/) / `ioredis`
* **Worker Multithreading:** Custom Dynamic Web Worker Pool
* **Testing:** [Vitest](https://vitest.dev/)

---

## 💻 Video Previews

| Keyring Management | Cloud Sync & Vault | Message & File Encryption |
| :---: | :---: | :---: |
| [![Keyring Management](https://img.youtube.com/vi/1gl4OlUaibY/maxresdefault.jpg)](https://www.youtube.com/watch?v=1gl4OlUaibY) | [![Cloud Vault](https://img.youtube.com/vi/YZAAwo0ukS0/maxresdefault.jpg)](https://www.youtube.com/watch?v=YZAAwo0ukS0) | [![Encryption](https://img.youtube.com/vi/KuyIN6AV6SM/maxresdefault.jpg)](https://www.youtube.com/watch?v=KuyIN6AV6SM) |

---

## 📸 Screenshots

### 💻 PC
<p align="center">
  <img width="410px" src="https://github.com/user-attachments/assets/2ec2473c-2069-4a26-b94a-99059e6354ec" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/6de8f672-c0d2-402b-9366-8bf92878da53" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/9e1cd403-3fe8-40de-a3e0-7935cc99725a" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/eff9e7f5-4c86-44ec-953b-0e48b60eb952" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/e57d92bf-1b33-41e3-a1ce-2a6b1d59aca9" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/1baaf5bf-86b3-473f-a3d1-fcc05b9ff1c5" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/04948ea5-2328-4b39-bc99-d6be931174cc" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/0a2dddf8-426b-4f23-adb7-e5790d2560e6" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/9cb0ebde-8b48-4187-a67e-ebd7fa4c6917" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/069f1832-cb55-4dd4-b12d-44c6e08f07e4" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/fa7203e4-78f4-4368-a8f9-08eeb5f380db" alt="Image" />
  <img width="410px" src="https://github.com/user-attachments/assets/be31fc3a-29c5-484f-8c74-1749a15f4f04" alt="Image" />
</p>

### 📱 Mobile
<p align="center">
  <img width="270px" src="https://github.com/user-attachments/assets/4860225b-cc2b-48d9-9b38-e548d8a15d40" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/dc30d81f-5163-4caa-9a66-b9dce9c6e7df" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/d1215c2c-1327-4751-99a3-399701c3a7f6" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/cb0b3fee-38fb-445d-a80b-b5e1fbfe7b41" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/6a7c5b74-ccc4-429e-92b6-26f7385da6a3" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/59c378c0-834a-48fb-96d6-078cdaa98d93" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/b4759faa-dbb5-4043-9cc5-fbe7b0f0d67f" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/24c1c8d5-4f5f-4805-afa4-39293dcbe977" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/591f26f5-7274-44b1-9677-8379aa7cf38e" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/450bfa8f-9fb8-47d9-b23e-4c843a27f04b" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/ed40eb19-80ac-4297-a480-5d1185a73600" alt="Image" />
  <img width="270px" src="https://github.com/user-attachments/assets/6a7c704c-cbc3-4873-941f-2677005467e7" alt="Image" />
</p>

---

## 📝 License

This project is licensed under the [GNU General Public License v3.0](LICENSE).

---

## 💬 Contact & Support

* **GitHub:** [@xbeast1](https://github.com/xbeast1)
* **Email:** [xbeast1@proton.me](mailto:xbeast1@proton.me)

<p align="center">✨ <b>Next PGP</b> simplifies secure messaging. Generate, manage, and encrypt with confidence! ✨</p>
