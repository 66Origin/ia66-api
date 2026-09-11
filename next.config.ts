import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/v1/rag/export": ["./rag/generated/**/*"],
  },
};

export default nextConfig;
