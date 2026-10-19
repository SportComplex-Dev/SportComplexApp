import type { NextConfig } from "next";

/**
 * Host de Supabase Storage derivado de `NEXT_PUBLIC_SUPABASE_URL` (build-arg):
 * nada de `<ref>.supabase.co` hardcodeado. Si la variable falta o es inválida
 * se omite el patrón, de modo que solo se sirven assets locales.
 */
const SUPABASE_STORAGE_HOST: string | null = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@node-rs/argon2", "@sportcomplex/automation"],
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
    remotePatterns: SUPABASE_STORAGE_HOST
      ? [
          {
            protocol: "https",
            hostname: SUPABASE_STORAGE_HOST,
            pathname: "/storage/v1/object/public/sportcomplex-assets/**",
          },
        ]
      : [],
  },
};

export default nextConfig;