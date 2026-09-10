import { parseImageAllowedRemoteHosts } from "./lib/image-remote-hosts.mjs";

// GCS/CDN hostnames the built-in Image Optimization API is allowed to fetch
// from, e.g. `assets.example.com`. Required outside local development; see
// docs/production-deployment-checklist.md.
const imageAllowedHosts = parseImageAllowedRemoteHosts(process.env.IMAGE_ALLOWED_REMOTE_HOSTS, {
  required: false, // テスト環境用: 環境変数未設定でもビルドを成功させる
});

const imageRemotePatterns = imageAllowedHosts.map((hostname) => ({
  protocol: "https",
  hostname,
}));

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async headers() {
    return [
      {
        // Baseline browser security headers applied to every response.
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // Personal/session-bound API responses must never be cached.
        source: "/api/me/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/auth/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
