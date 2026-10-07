import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
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
};

export default nextConfig;