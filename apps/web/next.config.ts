import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    optimizePackageImports: ["@sportcomplex/ui"],
  },
  // Paquetes del monorepo servidos desde fuente (./src) — se transpilan
  // en build/dev para no requerir `turbo build` previo (F0/dev local).
  transpilePackages: [
    "@sportcomplex/core",
    "@sportcomplex/db",
    "@sportcomplex/validation",
    "@sportcomplex/ui",
  ],
  env: {
    TZ: "America/Bogota",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
};

export default nextConfig;