import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },

  async rewrites() {
    return [{ source: "/ai-venture", destination: "/concepts" }]
  },
  // pdf-parse/pdfjs-dist load their own worker script via a self-relative
  // dynamic import at runtime; bundling them rewrites that path to a chunk
  // that never gets emitted, breaking PDF text extraction. Loading them
  // unbundled via plain Node `require`/`import` keeps that self-import intact.
  serverExternalPackages: ["dd-trace", "pdf-parse", "pdfjs-dist", "@browserbasehq/stagehand", "browser-use"],
};

export default nextConfig;
