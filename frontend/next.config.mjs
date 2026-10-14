/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This VPS is 2 GB RAM. Skip ESLint in `next build` and keep webpack on one CPU.
  eslint: { ignoreDuringBuilds: true },
  // Typecheck OOMs this 2 GB VPS during `next build`; webpack still compiles.
  typescript: { ignoreBuildErrors: true },
  productionBrowserSourceMaps: false,
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  allowedDevOrigins: ["kivucloud.rw", "www.kivucloud.rw", "10.10.147.68", "197.243.29.204"],
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.kivucloud.rw" }],
        destination: "https://kivucloud.rw/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/images/kivu-cloud-mark.png" }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "kivucloud.rw",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "www.kivucloud.rw",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "kivucloud.rw",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.kivucloud.rw",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "10.10.147.68",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "127.0.0.1",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "d2mtcik3uxkx71.cloudfront.net",
        pathname: "/**",
      },
      // Add more hotel image CDNs here as needed
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
        pathname: "/**",
      },
      // Google image CDNs (thumbnails, gstatic, etc.)
      {
        protocol: "https",
        hostname: "*.gstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
