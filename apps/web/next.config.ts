import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  experimental: {
    optimizePackageImports: ["@sportcomplex/ui"],
  },
  webpack: (config, { isServer, webpack: wp }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        crypto: false,
        "util/types": false,
      };
      if (wp?.NormalModuleReplacementPlugin) {
        config.plugins.push(
          new wp.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, "");
          })
        );
      }
    }
    return config;
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
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;