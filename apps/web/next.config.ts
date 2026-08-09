import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Workspace packages ship raw TypeScript rather than a build step, so Next
   * has to compile them itself. This is what keeps `pnpm dev` instant after a
   * change in packages/core.
   */
  transpilePackages: [
    "@pioneers/ui",
    "@pioneers/core",
    "@pioneers/supabase",
    "@pioneers/api-client",
  ],
};

export default nextConfig;
