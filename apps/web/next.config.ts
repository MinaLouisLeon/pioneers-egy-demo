import type { NextConfig } from "next";

/**
 * Environment variables come from the monorepo-root `.env`, which is loaded
 * into the process by `dotenv-cli` in this package's `dev`/`build`/`start`
 * scripts — see package.json.
 *
 * They cannot be loaded from here instead: `proxy.ts` runs in the Edge runtime,
 * where `process.env` is inlined at build time from the *real* process
 * environment. Anything injected while `next.config.ts` is being evaluated is
 * already too late, and every route 500s with "Your project's URL and Key are
 * required to create a Supabase client".
 *
 * On Vercel there is no `.env` file; dotenv-cli no-ops and the dashboard's
 * environment variables are used directly.
 */
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
