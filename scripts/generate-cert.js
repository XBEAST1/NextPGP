#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const certDir = path.join(__dirname, "..", "certs");
const keyPath = path.join(certDir, "localhost.com-key.pem");
const certPath = path.join(certDir, "localhost.com.pem");

// Create certs directory if it doesn't exist
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  console.log("✅ SSL certificates already exist");
  process.exit(0);
}

console.log("🔐 Generating SSL certificates for localhost.com...");

try {
  // Generate private key
  execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: "inherit" });

  // Generate certificate signing request
  const csrPath = path.join(certDir, "localhost.com.csr");
  execSync(
    `openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost.com"`,
    { stdio: "inherit" }
  );

  // Generate self-signed certificate
  execSync(
    `openssl x509 -req -days 365 -in "${csrPath}" -signkey "${keyPath}" -out "${certPath}"`,
    { stdio: "inherit" }
  );

  // Clean up CSR file
  fs.unlinkSync(csrPath);

  console.log("✅ SSL certificates generated successfully!");
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${certPath}`);
} catch (error) {
  console.error("❌ Error generating certificates:", error.message);
  console.log("\n💡 Make sure OpenSSL is installed on your system:");
  console.log("   - Ubuntu/Debian: sudo apt-get install openssl");
  console.log("   - macOS: brew install openssl");
  console.log(
    "   - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html"
  );
  process.exit(1);
}
