import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono, VT323 } from "next/font/google";
import { Pwa } from "@/components/pwa";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-face", subsets: ["latin"] });
/** CRT display face for the game screens. */
const crt = VT323({ variable: "--font-crt", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: { default: "Botched · party games in your group chat", template: "%s · Botched" },
  description: "Real-time party games for friends. Start with Who's the Bot: one player in the chat is an AI. Find it before it outlasts you.",
  applicationName: "Botched",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3210"),
  appleWebApp: { capable: true, title: "Botched", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", siteName: "Botched" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0b0a14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${mono.variable} ${crt.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Pwa />
      </body>
    </html>
  );
}
