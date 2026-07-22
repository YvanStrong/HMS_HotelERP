/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.png" }];
  },
  images: {
    remotePatterns: [
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
