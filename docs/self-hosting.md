# NextPGP Self-Hosting & Configuration Guide

This guide covers everything required to deploy, configure, and operate a self-hosted NextPGP instance in production.

---

## 1. System Requirements

* **Runtime**: Node.js `22.x`
* **Database**: PostgreSQL `14+`
* **In-Memory Store**: Redis `6+` (for API rate limiting)
* **Reverse Proxy**: Nginx, Caddy, or Cloudflare (with HTTPS / SSL termination)

---

## 2. Environment Variables Reference

NextPGP uses the following environment variables defined in [`.env.example`](file:///Users/xbeast/My-Projects/NextPGP/.env.example):

### Core System Configuration

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `AUTH_SECRET` | **Yes** | — | Cryptographic salt used by NextAuth to sign session tokens and CSRF digests. Generate with `openssl rand -hex 32`. |
| `AUTH_URL` | **Yes** | `http://localhost:3000` | The public canonical URL of your instance (e.g. `https://pgp.yourdomain.com`). Must include `https://` in production. |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`. |
| `REDIS` | **Yes** | — | Redis connection URL: `redis://HOST:PORT` (or `rediss://` for TLS-enabled Redis). |

### OAuth Authentication Providers (Optional)
If you wish to allow user authentication via OAuth, configure at least one provider:

| Variable | Provider | Notes |
| :--- | :--- | :--- |
| `AUTH_GOOGLE_ID` | Google OAuth | Client ID from Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth | Client Secret from Google Cloud Console |
| `AUTH_GITHUB_ID` | GitHub OAuth | Client ID from GitHub Developer Settings |
| `AUTH_GITHUB_SECRET` | GitHub OAuth | Client Secret from GitHub Developer Settings |
| `AUTH_DISCORD_ID` | Discord OAuth | Client ID from Discord Developer Portal |
| `AUTH_DISCORD_SECRET` | Discord OAuth | Client Secret from Discord Developer Portal |

> [!NOTE]
> **OAuth Callback URLs**:
> When configuring OAuth applications in provider consoles, register the callback URL format:
> * Google: `${AUTH_URL}/api/auth/callback/google`
> * GitHub: `${AUTH_URL}/api/auth/callback/github`
> * Discord: `${AUTH_URL}/api/auth/callback/discord`

### Transactional Email / OTP Configuration (Optional)
NextPGP uses the Gmail API via OAuth2 to dispatch OTP codes for account actions and vault deletion:

| Variable | Description |
| :--- | :--- |
| `GMAIL_EMAIL` | The sender address (e.g. `notifications@yourdomain.com`) |
| `GMAIL_CLIENT_ID` | Google Cloud OAuth2 Client ID authorized for Gmail API |
| `GMAIL_CLIENT_SECRET` | Google Cloud OAuth2 Client Secret |
| `GMAIL_REFRESH_TOKEN` | Authorized OAuth2 refresh token with `mail.google.com` scope |

---

## 3. Production Build & Deployment

### Step 1: Install Dependencies
```bash
pnpm install --frozen-lockfile
```

### Step 2: Run Database Migrations & Build
```bash
# Deploys Prisma migrations and builds optimized Next.js bundle
pnpm build
```

### Step 3: Launch Service
```bash
# Starts Next.js production server on port 3000 (or PORT env variable)
pnpm start
```

### Process Management with PM2
For persistent background execution with auto-restart on crashes:
```bash
pnpm add -g pm2
pm2 start "pnpm start" --name "nextpgp"
pm2 save
pm2 startup
```

---

## 4. Reverse Proxy Setup (Nginx Example)

Because Web Crypto and PWA Service Workers require HTTPS, terminate SSL at your reverse proxy:

```nginx
server {
    listen 80;
    server_name pgp.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pgp.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pgp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pgp.yourdomain.com/privkey.pem;

    # Modern SSL security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Security & Maintenance Checklist

- [ ] `AUTH_SECRET` is unique and at least 32 characters long.
- [ ] Database backups for PostgreSQL are scheduled regularly.
- [ ] Redis instance is password-protected and restricted to internal network traffic.
- [ ] SSL certificate renewal (e.g. Certbot) is automated.
- [ ] HTTPS is enforced across all endpoints.
