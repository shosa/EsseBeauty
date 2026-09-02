import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  description: "Agenda, clienti, vendite, team e crescita: EsseBeauty riunisce la gestione del tuo centro estetico in un unico spazio.",
  title: "EsseBeauty — Il gestionale per il tuo centro estetico",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html className={`${sans.variable} ${display.variable}`} lang="it"><body>{children}</body></html>;
}
