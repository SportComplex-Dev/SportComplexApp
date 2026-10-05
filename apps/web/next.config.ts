import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@sportcomplex/ui", "@sportcomplex/core"],
  experimental: {
    optimizePackageImports: ["@sportcomplex/ui"],
  },
  env: {
    TZ: "America/Bogota",
  },
};

export default nextConfig;
