import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  
  serverExternalPackages: ["dd-trace"],
};

export default nextConfig;
