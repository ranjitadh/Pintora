const rawBackendOrigin =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";
const backendOrigin = (
  rawBackendOrigin.includes("://") ? rawBackendOrigin : `http://${rawBackendOrigin}`
).replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "merchpress.nl",
        port: "",
        pathname: "/assets/**",
      },
    ],
  },
  skipTrailingSlashRedirect: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendOrigin}/api/:path*/` },
      { source: "/media/:path*", destination: `${backendOrigin}/media/:path*` },
    ];
  },
};

export default nextConfig;
