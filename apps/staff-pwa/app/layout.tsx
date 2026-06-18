import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "EsseBeauty Staff",
  description: "App installabile per collaboratori EsseBeauty",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#402334",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${manrope.variable} ${fraunces.variable}`} lang="it">
      <body>{children}</body>
    </html>
  );
}
