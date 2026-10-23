import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  outputFileTracingIncludes: {
    "/api/v1/rag/export": ["./rag/generated/**/*"],
    "/api/v1/chat": ["./certs/supabase-ca.crt"],
  },
};

export default nextConfig;
