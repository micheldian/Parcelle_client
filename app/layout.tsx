import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AGRICONNECT — Parcelles & Chantiers",
  description:
    "Gestion des parcelles cadastrales clients et dispatch de la main d'œuvre agricole",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen flex-col">
            <Navbar />
            <main className="min-h-0 flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
