import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "bullmq", "ioredis", "playwright"]
};

export default nextConfig;
