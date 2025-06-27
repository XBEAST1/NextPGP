/** @type {import('next').NextConfig} */

const webpack = require("webpack");
const buildTimestamp = Date.now().toString();

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
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
      { url: "/about", revision: buildTimestamp },
      { url: "/offline", revision: buildTimestamp },
    ],
    runtimeCaching: [
      // Cache all main pages permanently
      {
        urlPattern:
          /^https:\/\/nextpgp\.vercel\.app\/($|generate|import|encrypt|decrypt|login|create-vault|vault|cloud-backup|cloud-manage|about|offline)$/,
        handler: "NetworkFirst",
        options: {
          cacheName: "main-pages",
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 13,
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
  webpack(config) {
    config.plugins.push(
      new webpack.DefinePlugin({
        __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
      })
    );
    return config;
  },
};

module.exports = withPWA(nextConfig);
