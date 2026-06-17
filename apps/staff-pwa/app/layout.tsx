import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

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
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
