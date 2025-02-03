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
        handler: "CacheFirst",
        options: {
          cacheName: "main-page-cache",
          expiration: {
            maxEntries: 1,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/generate$/,
        handler: "CacheFirst",
        options: {
          cacheName: "generate-page-cache",
          expiration: {
            maxEntries: 1,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/import$/,
        handler: "CacheFirst",
        options: {
          cacheName: "import-page-cache",
          expiration: {
            maxEntries: 1,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/encrypt$/,
        handler: "CacheFirst",
        options: {
          cacheName: "encrypt-page-cache",
          expiration: {
            maxEntries: 1,
          },
        },
      },
      {
        urlPattern: /^https:\/\/nextpgp\.vercel\.app\/decrypt$/,
        handler: "CacheFirst",
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
        },
      },
      {
        urlPattern: ({ request }) => request.destination === "image",
        handler: "CacheFirst",
        options: {
          cacheName: "image-cache",
        },
      },
    ],
  },
});

const nextConfig = {
  experimental: {
    turbo: {
      // ...
    },
  },
};

module.exports = withPWA(nextConfig);
