import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseImageAllowedRemoteHosts } from "./lib/image-remote-hosts.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const deployEnv = process.env.HUGMEID_DEPLOY_ENV;
const imageRemotePatterns = parseImageAllowedRemoteHosts(process.env.IMAGE_ALLOWED_REMOTE_HOSTS, {
  required: deployEnv === "staging" || deployEnv === "production",
})
  .map((hostname) => ({ protocol: "https", hostname }));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const securityHeaders = [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    ];
    const privateApiNoStoreHeaders = [{ key: "Cache-Control", value: "no-store" }];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/health",
        headers: privateApiNoStoreHeaders,
      },
      {
        source: "/api/auth/:path*",
        headers: privateApiNoStoreHeaders,
      },
      {
        source: "/api/me/:path*",
        headers: privateApiNoStoreHeaders,
      },
      {
        source: "/api/syllabus/:path*",
        headers: privateApiNoStoreHeaders,
      },
      {
        source: "/api/admin/:path*",
        headers: privateApiNoStoreHeaders,
      },
    ];
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
};

let config = nextConfig;

if (process.env.ANALYZE === "true") {
  const createBundleAnalyzer = (await import("@next/bundle-analyzer")).default;
  config = createBundleAnalyzer({ enabled: true })(nextConfig);
}

export default config;
