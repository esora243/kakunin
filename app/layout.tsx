import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { SavedItemsProvider } from "@/components/SavedItemsContext";
import { LineFollowFloating } from "@/components/LineFollowFloating";
import { siteConfig } from "@/lib/site";

/**
 * RootLayout
 * - AuthProvider / SavedItemsProvider / AppLayout を一括適用。
 * - 公式LINE 友だち追加用フローティングボタンを常時表示（モバイル配慮済み）。
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    locale: "ja_JP",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F97316",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          <SavedItemsProvider>
            <AppLayout>{children}</AppLayout>
            {/* 公式LINE 友だち追加フローティング（全画面共通） */}
            <LineFollowFloating />
          </SavedItemsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
