import type { NextConfig } from "next";

/** The project's own Supabase host when configured; a narrow fallback for
 *  scaffolding/CI where the env var is absent. */
function supabaseHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || "**.supabase.co";
  } catch {
    return "**.supabase.co";
  }
}

const HOST = supabaseHost();
const IMAGE_SOURCE = `https://${HOST}`;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Start in report-only mode. Next's inline bootstrap scripts and styles need
  // nonces or hashes before this can be enforced without breaking rendering.
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "form-action 'self'",
      `img-src 'self' data: blob: ${IMAGE_SOURCE}`,
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      `connect-src 'self' ${IMAGE_SOURCE} wss://${HOST}`,
    ].join("; "),
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Uploaded memories live in Supabase Storage. Scoped to the public object
    // path so the image optimiser cannot be used to proxy arbitrary hosts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: HOST,
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // The default is 1MB, which one phone photo can exceed. The browser
      // resizes first and the server re-checks type, count and size, but the
      // body cap must still cover the worst accepted batch (12 x 2MB).
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
