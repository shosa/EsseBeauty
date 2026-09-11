import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import PlatformConsole from "./_components/PlatformConsole";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  description: "Console multi-tenant di EsseBeauty",
  title: "Platform | EsseBeauty",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html className={`${inter.variable} ${manrope.variable}`} lang="it"><body><PlatformConsole>{children}</PlatformConsole></body></html>;
}
