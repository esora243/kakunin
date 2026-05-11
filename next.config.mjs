/**
 * Next.js 16 設定
 * - Next.js 16 では next.config の eslint オプションが廃止された(eslint.config.mjs で管理)
 * - 画像最適化用のリモートホワイトリスト
 * - 型チェックは別工程 (npm run typecheck) で行うため build からは除外
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
