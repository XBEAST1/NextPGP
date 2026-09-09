# NextPGP Developer & Contribution Guide

This guide walks you through setting up a local development environment for NextPGP, running tests, managing databases, and setting up local HTTPS for Web Crypto API compatibility.

---

## 1. Prerequisites

Ensure your development machine meets the following version requirements:

* **Node.js**: `22.x` (Managed via [`.nvmrc`](file:///Users/xbeast/My-Projects/NextPGP/.nvmrc))
* **Package Manager**: [`pnpm`](https://pnpm.io/) (`>= 9.x` / `11.x`)
* **PostgreSQL**: `>= 14` (Required for NextAuth sessions, user accounts, and encrypted cloud vaults)
* **Redis**: `>= 6` (Required for API rate limiting and token session caching)
* **OpenSSL**: For generating local self-signed SSL certificates

```bash
# Verify Node and pnpm versions
node -v   # Should be v22.x.x
pnpm -v   # Should be 9.x or 11.x
```

---

## 2. Quick Start Setup

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/xbeast1/NextPGP.git
cd NextPGP

# Install dependencies (automatically runs 'prisma generate' postinstall)
pnpm install
```

### Step 2: Configure Environment Variables
Copy [.env.example](file:///Users/xbeast/My-Projects/NextPGP/.env.example) to `.env`:
```bash
cp .env.example .env
```
Populate the core database and session keys:
```env
AUTH_SECRET="generate-a-secure-random-secret-e.g.-openssl-rand-hex-32"
AUTH_URL="http://localhost:3000"
DATABASE_URL="postgresql://postgres:password@localhost:5432/nextpgp?schema=public"
REDIS="redis://localhost:6379"
```
*(For a complete breakdown of OAuth and Gmail SMTP keys, see the [Self-Hosting Guide](file:///Users/xbeast/My-Projects/NextPGP/docs/self-hosting.md)).*

### Step 3: Initialize the Database
Push the Prisma schema to your local PostgreSQL instance:
```bash
pnpm prisma db push
```

---

## 3. HTTPS Development Setup

### Why HTTPS is Required
The **Web Crypto API** (`window.crypto.subtle`) strictly requires a **Secure Context** (HTTPS or `localhost`). When testing custom local domains (such as `nextpgp-dev.com`), Progressive Web App (PWA) service workers, or testing across devices on your local network, HTTPS is mandatory.

### Option A: Automated HTTPS Setup (Recommended)
Run the automated script to generate local certs, append hosts entries, and configure permissions:
```bash
./scripts/setup-https.sh
```

### Option B: Manual HTTPS Setup

1. **Generate Local SSL Certificates**:
   ```bash
   pnpm setup:https
   # Generates certs/nextpgp-dev.com-key.pem and certs/nextpgp-dev.com.pem
   ```

2. **Update Local Hosts File**:
   Map `nextpgp-dev.com` to `127.0.0.1`:
   * **macOS / Linux**:
     ```bash
     sudo nano /etc/hosts
     # Append: 127.0.0.1 nextpgp-dev.com
     ```
   * **Windows**:
     Open Notepad as Administrator and edit `C:\Windows\System32\drivers\etc\hosts`:
     ```text
     127.0.0.1 nextpgp-dev.com
     ```

3. **Start HTTPS Dev Server**:
   ```bash
   pnpm dev:https
   ```
   Navigate to `https://nextpgp-dev.com:3000`. Accept the browser self-signed security warning (safe for local development).

---

## 4. Development Scripts Reference

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Start standard development server with Next.js Turbopack |
| `pnpm dev:https` | Start development server over HTTPS via `server.ts` |
| `pnpm setup:https` | Generate self-signed SSL certificates in `certs/` |
| `pnpm build` | Run Prisma migration deploy and build production bundle |
| `pnpm start` | Run Next.js production server |
| `pnpm lint` | Execute ESLint checks across `.js`, `.jsx`, `.ts`, `.tsx` |
| `pnpm test` | Run all unit & integration tests using Vitest |
| `pnpm test:watch` | Run Vitest in interactive watch mode |
| `pnpm prisma studio` | Launch local visual UI to inspect PostgreSQL records |
| `pnpm prisma db push` | Synchronize Prisma schema with local database |

---

## 5. Testing & Quality Assurance

### Vitest Test Suite
NextPGP tests are organized under [`tests/`](file:///Users/xbeast/My-Projects/NextPGP/tests):
* `tests/unit/`: Unit tests for cryptography helpers, key parsing, and binary envelope packaging.
* `tests/integration/`: Integration tests for API routes, auth flow, and database models.
* `tests/helpers/`: Shared mock factories and crypto helpers.
* `tests/fixtures/`: Sample OpenPGP ASCII-armored keys and test vectors.

```bash
# Run full test suite once
pnpm test

# Run tests with file watching
pnpm test:watch

# Regenerate cryptographic test keys if fixtures change
npx tsx scripts/generate-test-keys.ts
```

### Linting & Formatting
Verify code formatting and TypeScript rules before committing:
```bash
pnpm lint
```

---

## 6. Troubleshooting

* **Self-Signed Certificate Warning**:
  * Browsers will flag untrusted certificates on `nextpgp-dev.com`. Click **Advanced** &rarr; **Proceed to nextpgp-dev.com (unsafe)**.
* **Port 3000 Already in Use**:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```
* **DNS Cache Not Resolving `nextpgp-dev.com`**:
  * macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
  * Linux: `sudo systemctl restart systemd-resolved`
  * Windows: `ipconfig /flushdns`
