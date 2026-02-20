import type { NextConfig } from "next";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

// Loader path from orchids-visual-edits - use direct resolve to get the actual file
const loaderPath = require_.resolve('orchids-visual-edits/loader.js');

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/session/blank",
        destination: "/app",
        permanent: false, // 307 — temporary redirect; easier to change later than a 308
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    rules: {
      "*.{jsx,tsx}": {
        loaders: [loaderPath]
      }
    }
  }
};

export default nextConfig;
