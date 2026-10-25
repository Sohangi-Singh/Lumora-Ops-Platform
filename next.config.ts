import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Camera + geolocation are needed by the worker survey; nothing else.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(self)" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  // Pin the workspace root (a stray lockfile in a parent folder confuses inference).
  outputFileTracingRoot: process.cwd(),
  // Fonts and the letterhead are read from disk when rendering quote PDFs.
  outputFileTracingIncludes: {
    "/**": ["./lib/pdf/fonts/**", "./public/brand/letterhead.jpg", "./public/brand/logo.png"],
  },
  experimental: {
    authInterrupts: true,
    serverActions: { bodySizeLimit: "2mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
