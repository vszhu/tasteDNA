import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { SessionProvider } from "@/components/providers/session-provider";
import { TasteProvider } from "@/components/providers/taste-provider";

export const metadata: Metadata = {
  title: { default: "TasteDNA — Your palate, decoded", template: "%s | TasteDNA" },
  description: "Rate what you know. Decode any menu. Find the dishes made for your palate.",
};

export const viewport: Viewport = { themeColor: "#f7f3eb", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider><TasteProvider><AppShell>{children}</AppShell></TasteProvider></SessionProvider>
      </body>
    </html>
  );
}
