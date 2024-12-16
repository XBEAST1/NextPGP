import "@/styles/globals.css";
import clsx from "clsx";
import { Providers } from "./providers";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";
import Logo from "@/assets/Logo2.jpg";

const twittercardimg = `https://nextpgp.vercel.app${Logo.src}`;

export const generateMetadata = () => {
  return {
    title: "Next PGP",
    description:
      "Next PGP is a beautiful, modern online PGP tool built with Next.js. It can generate keys, manage keyrings, encrypt and decrypt messages securely and effortlessly.",
    keywords:
      "PGP tool, Next.js PGP, online PGP tool, key management, key generation, encrypt message, decrypt message, secure communication, OpenPGP, keyring management, encryption tool, modern PGP tool",
    openGraph: {
      title: "Next PGP",
      description:
        "Next PGP is an elegant and powerful online tool for generating PGP keys, managing keyrings, and securely encrypting and decrypting messages.",
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
        "Experience a beautiful and modern online PGP tool for key generation, keyring management, encryption, and decryption. Built with Next.js.",
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
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <div className="relative flex flex-col h-screen">
            <Navbar />
            <main className="container mx-auto max-w-7xl pt-6 px-6 flex-grow">
              {children}
            </main>
            <br />
            <footer className="w-full flex items-center justify-center py-3">
              <div className="flex items-center gap-1 text-current">
                <span className="text-default-400">Developed By</span>
                <p className="text-default-800">XBEAST</p>
              </div>
            </footer>
            <br />
          </div>
        </Providers>
      </body>
    </html>
  );
}
