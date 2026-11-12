/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*/` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
    ];
  },
};

export default nextConfig;
