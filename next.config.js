/** @type {import('next').NextConfig} */

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Cache all main pages permanently
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "main-page-cache",
          expiration: {
            maxEntries: 1,
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
