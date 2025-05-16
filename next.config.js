/** @type {import('next').NextConfig} */

const buildTimestamp = Date.now().toString();

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    offlineGoogleAnalytics: true,
    additionalManifestEntries: [
      { url: "/", revision: buildTimestamp },
      { url: "/generate", revision: buildTimestamp },
      { url: "/import", revision: buildTimestamp },
      { url: "/encrypt", revision: buildTimestamp },
      { url: "/decrypt", revision: buildTimestamp },
      { url: "/login", revision: buildTimestamp },
      { url: "/create-vault", revision: buildTimestamp },
      { url: "/vault", revision: buildTimestamp },
      { url: "/cloud-backup", revision: buildTimestamp },
      { url: "/cloud-manage", revision: buildTimestamp },
    ],
    runtimeCaching: [
      // Cache all main pages permanently
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "main-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/generate$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "generate-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/import$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "import-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/encrypt$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "encrypt-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/decrypt$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "decrypt-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/login$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "login-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/create-vault$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "create-vault-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/vault$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "vault-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/cloud-backup$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "cloud-backup-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/cloud-manage$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "cloud-manage-page-cache",
          expiration: {
            maxEntries: 1,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      // Cache static assets (JS, CSS, images, fonts) permanently
      {
        urlPattern: ({ request }) =>
          ["style", "script", "worker"].includes(request.destination),
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "static-resources",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: ({ request }) => request.destination === "image",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "image-cache",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
    ],
  },
});

const nextConfig = {
  turbopack: {
    resolveExtensions: [".mdx", ".tsx", ".ts", ".jsx", ".js", ".json"],
  },
};

module.exports = withPWA(nextConfig);
