const { createServer } = require("https");
const { parse } = require("url");
const next = require("next");
const fs = require("fs");
const path = require("path");

const dev = process.env.NODE_ENV !== "production";
const hostname = "nextpgp-dev.com";
const port = process.env.PORT || 3000;

if (dev) {
  process.env.NODE_ENV = "development";
  process.env.AUTH_URL = `https://${hostname}:${port}`;
  // Allow self-signed certificates in development
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Initialize Next.js app
const app = next({
  dev,
  hostname,
  port,
  ...(dev && { turbo: true }),
});
const handle = app.getRequestHandler();

// SSL certificate paths
const certDir = path.join(__dirname, "certs");
const keyPath = path.join(certDir, "nextpgp-dev.com-key.pem");
const certPath = path.join(certDir, "nextpgp-dev.com.pem");

// Check if certificates exist
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("❌ SSL certificates not found!");
  console.log("💡 Run: node scripts/generate-cert.js");
  process.exit(1);
}

// SSL options
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  })
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`🚀 Ready on https://${hostname}:${port}`);
      console.log("🔐 HTTPS enabled - Web Crypto API available!");
      console.log("\n📝 Make sure to add this to your /etc/hosts file:");
      console.log("   127.0.0.1 nextpgp-dev.com");
    });
});
