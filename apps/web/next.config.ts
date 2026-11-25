import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API and shared packages ship TypeScript source, so Next must compile them.
  transpilePackages: ["@elsewhere/api", "@elsewhere/shared"],
  // Native database drivers can't be bundled; load them from node_modules at runtime.
  serverExternalPackages: [
    "@prisma/adapter-libsql",
    "@libsql/client",
    "libsql",
    "@node-rs/argon2",
  ],
};

export default nextConfig;
