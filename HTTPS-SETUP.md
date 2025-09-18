# HTTPS Development Setup for localhost.com

This guide will help you set up your Next.js app to run on `localhost.com` with HTTPS, enabling the Web Crypto API for development.

## Why HTTPS for localhost.com?

The Web Crypto API requires a secure context (HTTPS) to work. By setting up `localhost.com` with HTTPS, you can:

- Use the Web Crypto API in your development environment
- Test cryptographic features locally
- Ensure your app works the same way in development and production

## Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
# Run the automated setup script
./scripts/setup-https.sh
```

### Option 2: Manual Setup

#### Step 1: Generate SSL Certificates

```bash
# Generate self-signed SSL certificates
yarn setup:https
```

#### Step 2: Update Hosts File

Add this line to your `/etc/hosts` file:

```
127.0.0.1 localhost.com
```

**Linux/macOS:**

```bash
sudo nano /etc/hosts
# Add: 127.0.0.1 localhost.com
```

**Windows:**

1. Open Notepad as Administrator
2. Open `C:\Windows\System32\drivers\etc\hosts`
3. Add: `127.0.0.1 localhost.com`

#### Step 3: Start HTTPS Development Server

```bash
# Start the app with HTTPS
yarn dev:https
```

## Usage

1. **Start the server:**

   ```bash
   yarn dev:https
   ```

2. **Open your browser:**
   Go to `https://localhost.com:3000`

3. **Accept the certificate warning:**

   - Your browser will show a security warning because we're using a self-signed certificate
   - Click "Advanced" → "Proceed to localhost.com (unsafe)" or similar
   - This is safe for development

4. **Verify Web Crypto API:**
   Open browser console and test:
   ```javascript
   console.log("Web Crypto API available:", !!window.crypto.subtle);
   ```

## Available Scripts

- `yarn dev:https` - Start development server with HTTPS
- `yarn setup:https` - Generate SSL certificates
- `yarn dev` - Regular development server (HTTP)

## Troubleshooting

### Certificate Issues

If you get certificate errors:

1. Make sure certificates were generated: `ls -la certs/`
2. Regenerate certificates: `yarn setup:https`
3. Clear browser cache and restart browser

### Hosts File Issues

If `localhost.com` doesn't resolve:

1. Check hosts file: `cat /etc/hosts | grep localhost.com`
2. Flush DNS cache:
   - **Linux:** `sudo systemctl restart systemd-resolved`
   - **macOS:** `sudo dscacheutil -flushcache`
   - **Windows:** `ipconfig /flushdns`

### Port Issues

If port 3000 is in use:

1. Kill the process: `lsof -ti:3000 | xargs kill -9`
2. Or change the port in `server.js`

### Browser Security Warnings

This is normal for self-signed certificates. The warnings are safe to ignore in development.

## Security Notes

- **Development Only:** These self-signed certificates are only for development
- **Production:** Use proper SSL certificates from a trusted CA in production
- **Team Sharing:** Each developer should generate their own certificates

## File Structure

```
├── certs/                    # SSL certificates (auto-generated)
│   ├── localhost.com-key.pem # Private key
│   └── localhost.com.pem     # Certificate
├── scripts/
│   ├── generate-cert.js      # Certificate generator
│   └── setup-https.sh        # Automated setup script
├── server.js                 # HTTPS development server
└── HTTPS-SETUP.md           # This file
```

## Next Steps

Once HTTPS is working:

1. Test your Web Crypto API features
2. Update any hardcoded localhost URLs in your code
3. Consider updating your development workflow documentation
