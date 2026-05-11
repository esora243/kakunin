import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { SavedItemsProvider } from "@/components/SavedItemsContext";
import { siteConfig } from "@/lib/site";

/**
 * RootLayout
 * - Hugmeid mock の "Noto Sans JP" / "Inter" フォント、bg-[#FFF9FA] を全体に適用。
 * - AuthProvider / SavedItemsProvider / AppLayout を一括適用。
 * - Next.js 16 仕様に合わせ themeColor は viewport export に移動。
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

// Next.js 16: themeColor / colorScheme / viewport は generateViewport / viewport export で指定する
export const viewport: Viewport = {
  themeColor: "#F97316", // ブランド orange-500 (Hugmeid mock)
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
          </SavedItemsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
