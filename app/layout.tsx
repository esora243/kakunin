import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { SavedItemsProvider } from "@/components/SavedItemsContext";
import { siteConfig } from "@/lib/site";

/**
 * RootLayout
 * - Hugmeid mock の "Noto Sans JP" / "Inter" フォント、bg-[#FFF9FA] を全体に適用。
 * - AuthProvider / SavedItemsProvider / AppLayout を一括適用し、
 *   全ページで LINE LIFF ログイン・保存機能・ヘッダーナビを共有。
 * - meta はサイト名/説明 + OGP(og:image はスポンサー用に拡張可能)。
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
  themeColor: "#F97316", // ブランド orange-500
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
