import type { NextConfig } from "next";
import webpack from "webpack";

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
        urlPattern: ({ request }: any) =>
          ["style", "script", "worker"].includes(request.destination),
        handler: "NetworkFirst",
        options: {
          cacheName: "static-resources",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 60 * 60 * 24 * 365,
          },
        },
      },
      {
        urlPattern: ({ request }: any) => request.destination === "image",
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

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https: blob:;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  connect-src 'self' https://keyserver.ubuntu.com https://keys.openpgp.org https://authjs.dev;
  worker-src 'self' blob:;
  upgrade-insecure-requests;
`;

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()" },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim() },
];

const nextConfig: NextConfig = {
  turbopack: {
    resolveExtensions: [".mdx", ".tsx", ".ts", ".jsx", ".js", ".json"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
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

export default withPWA(nextConfig);
