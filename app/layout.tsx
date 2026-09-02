import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * next/font でセルフホストし、globals.css の Google Fonts `@import`
 * (描画ブロッキング) を廃止する。日本語フォントは unicode-range 分割が
 * 多いため preload はしない。Inter は日本語UIで出番が無いので同梱しない。
 */
const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
  variable: "--font-sans",
});

// メタデータ用の表示ラベル (UI ヘッダーや slog 41 など製品面のメタ参照)。
const metaAppName = "Hugmeid";
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  // ルート別 metadata が `%s | Hugmeid` になり、タブ・履歴・共有で画面を区別できる。
  title: {
    default: metaAppName,
    template: `%s | ${metaAppName}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: metaAppName,
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    siteName: metaAppName,
    locale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={notoSansJp.variable}>
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
