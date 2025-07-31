import "@/styles/globals.css";
import clsx from "clsx";
import Logo from "@/assets/Logo2.jpg";
import AppUpdater from "@/components/app-updater";
import { Providers } from "./providers";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import { GoogleAnalytics } from "@next/third-parties/google";
import { auth } from "@/auth";
import { NProgressLink } from "@/components/nprogress";
import { SessionProvider } from "next-auth/react";
import { NavigationProgress } from "@/components/nprogress";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { VaultProvider } from "@/context/VaultContext";
import { ToastProvider } from "@heroui/toast";
import { JsonLd } from "react-schemaorg";

const twittercardimg = `https://nextpgp.vercel.app${Logo.src}`;

export const metadata = {
  manifest: "/manifest.json",
  title: "Next PGP",
  description:
    "NextPGP is a elegant and powerful, modern online pgp tool built with Next.js. It can generate keys, manage keyrings, encrypt and decrypt messages securely and effortlessly.",
  keywords:
    "PGP tool, Next.js PGP, online pgp tool, key management, key generation, encrypt message, decrypt message, secure communication, OpenPGP, keyring management, encryption tool, modern PGP tool",
  openGraph: {
    title: "Next PGP",
    description:
      "NextPGP is a elegant and powerful, modern online pgp tool built with Next.js. It can generate keys, manage keyrings, encrypt and decrypt messages securely and effortlessly.",
    images: [
      {
        url: twittercardimg,
        alt: "Next PGP",
      },
    ],
    url: "https://nextpgp.vercel.app",
    siteName: "NextPGP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@NextPGP",
    title: "Next PGP",
    description:
      "NextPGP is a elegant and powerful, modern online pgp tool built with Next.js. It can generate keys, manage keyrings, encrypt and decrypt messages securely and effortlessly.",
    images: [twittercardimg],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Next PGP",
  url: "https://nextpgp.vercel.app",
  description:
    "NextPGP is a elegant and powerful, modern online pgp tool built with Next.js. It can generate keys, manage keyrings, encrypt and decrypt messages securely and effortlessly.",
  image: twittercardimg,
  author: {
    "@type": "Person",
    name: "XBEAST",
  },
  keywords:
    "PGP tool, Next.js PGP, online pgp tool, key management, key generation, encrypt message, decrypt message, secure communication, OpenPGP, keyring management, encryption tool, modern PGP tool",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({ children }) {
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <html suppressHydrationWarning lang="en">
        <head />
        <body
          className={clsx(
            "min-h-screen bg-background font-sans antialiased",
            fontSans.variable
          )}
        >
          <JsonLd item={websiteSchema} />
          <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
            <AppUpdater />
            <VaultProvider>
              <SpeedInsights />
              <NavigationProgress />
              <div className="relative flex flex-col h-screen">
                <Navbar />
                <main className="container mx-auto max-w-7xl pt-6 px-6 flex-grow">
                  <ToastProvider
                    toastProps={{
                      timeout: 4000,
                      shouldShowTimeoutProgress: true,
                    }}
                    toastOffset={30}
                    placement={"top-right"}
                  />
                  {children}
                  <GoogleAnalytics gaId="G-EJ067X6M97" />
                </main>
                <br />
                <footer className="w-full flex flex-col items-center justify-center py-3 gap-1 text-sm">
                  <div className="flex items-center gap-1 text-current">
                    <span className="text-default-400">Developed By</span>
                    <a
                      href="https://github.com/XBEAST1"
                      target="_blank"
                      rel="noreferrer"
                      className="text-default-800"
                    >
                      XBEAST 🖤✨
                    </a>
                  </div>
                  <div className="text-xs flex gap-3">
                    <NProgressLink
                      href="/privacy"
                      className="text-default-400 hover:text-default-600 transition-all"
                    >
                      Privacy Policy
                    </NProgressLink>
                    <NProgressLink
                      href="/terms"
                      className="text-default-400 hover:text-default-600 transition-all"
                    >
                      Terms of Service
                    </NProgressLink>
                  </div>
                </footer>
                <br />
              </div>
            </VaultProvider>
          </Providers>
        </body>
      </html>
    </SessionProvider>
  );
}
