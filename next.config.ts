import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // DigitalOcean Spaces (direct + CDN endpoints)
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.cdn.digitaloceanspaces.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
