import localFont from "next/font/local";

export const fontSans = localFont({
  src: "../public/fonts/Inter-latin.woff2",
  variable: "--font-sans",
  display: "swap",
});

export const fontSerif = localFont({
  src: "../public/fonts/dm-serif-text-regular.woff2",
  variable: "--font-serif",
  display: "swap",
});