import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3005";
const title = "EsseBeauty — Il gestionale per il tuo centro estetico";
const description = "Agenda, clienti, vendite, team e crescita: EsseBeauty riunisce la gestione del tuo centro estetico in un unico spazio.";

export const metadata: Metadata = {
  description,
  metadataBase: new URL(siteUrl),
  openGraph: {
    description,
    images: [{ alt: "EsseBeauty — Il tuo centro estetico, finalmente tutto sotto controllo", height: 1024, url: "/og.png", width: 1536 }],
    locale: "it_IT",
    siteName: "EsseBeauty",
    title,
    type: "website",
  },
  title,
  twitter: {
    card: "summary_large_image",
    description,
    images: ["/og.png"],
    title,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html className={`${sans.variable} ${display.variable}`} lang="it"><body>{children}</body></html>;
}
