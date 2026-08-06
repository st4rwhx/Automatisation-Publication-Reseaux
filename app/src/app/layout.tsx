import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEMATYS Auto Post AI — Vos réseaux sociaux, publiés tout seuls",
  description:
    "L'IA de CEMATYS génère et publie automatiquement vos posts et vidéos sur LinkedIn, Instagram, TikTok et Facebook, sans y passer une minute par jour.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={frFR}>
      <html lang="fr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
