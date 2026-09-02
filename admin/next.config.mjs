import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const assetBaseUrl = process.env.GCS_PUBLIC_ASSET_BASE_URL?.trim();
const imageRemotePatterns = assetBaseUrl
  ? [{ protocol: "https", hostname: new URL(assetBaseUrl).hostname }]
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    // The whole admin app is private back-office tooling: everything must be
    // no-store, not just a handful of API prefixes like the public app.
    const securityHeaders = [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cache-Control", value: "no-store" },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
};

export default nextConfig;
